#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use tempfile::{tempdir, TempDir};

    use crate::{
        apply_to_project, bootstrap_legacy_migration, doctor, load_skill_registry,
        init_project, scan_warehouse, save_skill_registry, AppConfig, ApplySelections, ClientKind,
        ClientRoots, InitMode, InstallMode, Profile, RegistrySkill, SkillEntry, SkillRegistry,
    };

    struct TestCtx {
        _tmp: TempDir,
        cfg: AppConfig,
        roots: ClientRoots,
        home: PathBuf,
        #[allow(dead_code)]
        project: PathBuf,
    }

    impl TestCtx {
        fn new() -> Self {
            let tmp = tempdir().unwrap();
            let warehouse = tmp.path().join("warehouse");
            let project = tmp.path().join("project");
            let home = tmp.path().join("home");
            fs::create_dir_all(&warehouse).unwrap();
            fs::create_dir_all(&project).unwrap();
            fs::create_dir_all(&home).unwrap();
            Self {
                cfg: AppConfig {
                    skill_warehouse: warehouse,
                    registry_path: tmp.path().join("registry.toml"),
                    bootstrap_migration_done: false,
                    library_roots: Vec::new(),
                    default_profile: Some("claude".into()),
                },
                roots: ClientRoots::from_home(&home),
                home,
                project,
                _tmp: tmp,
            }
        }

        fn create_skill(&self, name: &str) {
            setup_skill(&self.cfg.skill_warehouse, name);
        }

        fn remove_skill(&self, name: &str) {
            fs::remove_dir_all(self.cfg.skill_warehouse.join(name)).unwrap();
        }

        fn create_client_skill(&self, client: ClientKind, name: &str, body: &str) {
            let root = self.roots.global_skill_root(client);
            let dir = root.join(name);
            fs::create_dir_all(&dir).unwrap();
            fs::write(
                dir.join("SKILL.md"),
                format!("---\nname: {name}\ndescription: test\n---\n{body}"),
            )
            .unwrap();
        }
    }

    fn setup_skill(root: &std::path::Path, name: &str) {
        let d = root.join(name);
        fs::create_dir_all(&d).unwrap();
        fs::write(
            d.join("SKILL.md"),
            "---\nname: test\ndescription: test\n---\nbody",
        )
        .unwrap();
    }

    #[test]
    fn apply_symlink_is_idempotent() {
        let tmp = tempdir().unwrap();
        let lib = tmp.path().join("lib");
        let project = tmp.path().join("project");
        fs::create_dir_all(&project).unwrap();
        setup_skill(&lib, "skill_a");
        let claude_src = tmp.path().join("source_claude.md");
        let agents_src = tmp.path().join("source_agents.md");
        fs::write(&claude_src, "c").unwrap();
        fs::write(&agents_src, "a").unwrap();

        let cfg = AppConfig {
            skill_warehouse: tmp.path().join("warehouse"),
            registry_path: tmp.path().join("registry.toml"),
            bootstrap_migration_done: false,
            library_roots: vec![lib.clone()],
            default_profile: Some("claude".into()),
        };
        let profile = Profile {
            id: "claude".into(),
            project_skill_root: PathBuf::from(".claude/skills"),
            claude_md_target: PathBuf::from("CLAUDE.md"),
            agents_md_target: PathBuf::from("AGENTS.md"),
        };

        let sel = ApplySelections {
            skill_ids: vec!["skill_a".into()],
            claude_md_source: Some(claude_src),
            agents_md_source: Some(agents_src),
            mode: InstallMode::Symlink,
        };

        let r1 = apply_to_project(&project, &profile, &cfg, &sel).unwrap();
        assert_eq!(r1.skills_linked, vec!["skill_a".to_string()]);

        let r2 = apply_to_project(&project, &profile, &cfg, &sel).unwrap();
        assert_eq!(r2.skills_skipped_ok, vec!["skill_a".to_string()]);
    }

    #[test]
    fn doctor_reports_broken_symlink() {
        let tmp = tempdir().unwrap();
        let lib = tmp.path().join("lib");
        let project = tmp.path().join("project");
        fs::create_dir_all(&project).unwrap();
        let skill_dir = lib.join("skill_a");
        setup_skill(&lib, "skill_a");

        let cfg = AppConfig {
            skill_warehouse: tmp.path().join("warehouse"),
            registry_path: tmp.path().join("registry.toml"),
            bootstrap_migration_done: false,
            library_roots: vec![lib],
            default_profile: Some("claude".into()),
        };
        let profile = Profile {
            id: "claude".into(),
            project_skill_root: PathBuf::from(".claude/skills"),
            claude_md_target: PathBuf::from("CLAUDE.md"),
            agents_md_target: PathBuf::from("AGENTS.md"),
        };

        let dest = project.join(".claude/skills/skill_a");
        fs::create_dir_all(dest.parent().unwrap()).unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(&skill_dir, &dest).unwrap();

        fs::remove_dir_all(&skill_dir).unwrap();

        let rep = doctor(&project, &profile, &cfg).unwrap();
        assert!(!rep.broken_symlinks.is_empty());
        assert!(!rep.ok);
    }

    #[test]
    fn default_config_uses_agents_manager_skill_root() {
        let cfg = AppConfig::default();
        assert!(cfg.library_roots.is_empty());
        assert!(cfg.skill_warehouse.ends_with(".agents-manager/skills"));
    }

    #[test]
    fn fresh_registry_starts_with_next_id_one() {
        let reg = SkillRegistry::default();
        assert_eq!(reg.next_id, 1);
        assert!(reg.skills.is_empty());
    }

    #[test]
    fn warehouse_scan_assigns_stable_non_reused_ids() {
        let ctx = TestCtx::new();
        ctx.create_skill("alpha");
        ctx.create_skill("beta");

        let first = scan_warehouse(&ctx.cfg).unwrap();
        assert_eq!(first[0].stable_id, 1);
        assert_eq!(first[1].stable_id, 2);

        ctx.remove_skill("alpha");
        ctx.create_skill("gamma");

        let second = scan_warehouse(&ctx.cfg).unwrap();
        assert!(second.iter().any(|e| e.id == "beta" && e.stable_id == 2));
        assert!(second.iter().any(|e| e.id == "gamma" && e.stable_id == 3));
    }

    #[test]
    fn client_global_targets_resolve_expected_paths() {
        let roots = ClientRoots::from_home(std::path::Path::new("/tmp/home"));
        assert_eq!(
            roots.global_skill_root(ClientKind::Codex),
            PathBuf::from("/tmp/home/.codex/skills")
        );
        assert_eq!(
            roots.global_skill_root(ClientKind::Claude),
            PathBuf::from("/tmp/home/.claude/skills")
        );
        assert_eq!(
            roots.global_skill_root(ClientKind::Cursor),
            PathBuf::from("/tmp/home/.cursor/skills")
        );
    }

    #[test]
    fn bootstrap_migration_moves_client_skills_into_warehouse_once() {
        let mut ctx = TestCtx::new();
        ctx.create_client_skill(ClientKind::Codex, "alpha", "from codex");
        ctx.create_client_skill(ClientKind::Claude, "beta", "from claude");

        let report = bootstrap_legacy_migration(&mut ctx.cfg, &ctx.roots).unwrap();

        assert!(ctx.cfg.bootstrap_migration_done);
        assert_eq!(report.imported, 2);
        assert!(ctx.cfg.skill_warehouse.join("alpha").exists());
        assert!(ctx.cfg.skill_warehouse.join("beta").exists());
        assert!(!ctx.home.join(".codex/skills/alpha").exists());
        assert!(!ctx.home.join(".claude/skills/beta").exists());
    }

    #[test]
    fn bootstrap_migration_overwrites_with_later_conflicting_skill() {
        let mut ctx = TestCtx::new();
        ctx.create_client_skill(ClientKind::Codex, "shared", "codex body");
        ctx.create_client_skill(ClientKind::Claude, "shared", "claude body");

        let report = bootstrap_legacy_migration(&mut ctx.cfg, &ctx.roots).unwrap();
        let skill_md = fs::read_to_string(ctx.cfg.skill_warehouse.join("shared/SKILL.md")).unwrap();

        assert_eq!(report.overwritten, 1);
        assert!(skill_md.contains("claude body"));
        assert!(!ctx.home.join(".codex/skills/shared").exists());
        assert!(!ctx.home.join(".claude/skills/shared").exists());
    }

    #[test]
    fn registry_roundtrip_preserves_type_and_tags() {
        let ctx = TestCtx::new();
        let registry = SkillRegistry {
            next_id: 2,
            skills: vec![RegistrySkill {
                stable_id: 1,
                id: "alpha".into(),
                path: PathBuf::from("alpha"),
                active: true,
                skill_type: Some("workflow".into()),
                tags: vec!["rust".into(), "cli".into()],
                source_hint: Some("codex".into()),
            }],
        };

        save_skill_registry(&ctx.cfg, &registry).unwrap();
        let loaded = load_skill_registry(&ctx.cfg).unwrap();

        assert_eq!(loaded.skills[0].skill_type.as_deref(), Some("workflow"));
        assert_eq!(loaded.skills[0].tags, vec!["rust".to_string(), "cli".to_string()]);
        assert_eq!(loaded.skills[0].source_hint.as_deref(), Some("codex"));
    }

    #[test]
    fn init_project_creates_codex_dir_and_agents_md() {
        let ctx = TestCtx::new();
        ctx.create_skill("alpha");
        let scan = scan_warehouse(&ctx.cfg).unwrap();
        let alpha = scan.iter().find(|s| s.id == "alpha").unwrap();

        let report = init_project(
            &ctx.project,
            ClientKind::Codex,
            vec![alpha.stable_id],
            InitMode::Symlink,
            &ctx.cfg,
        )
        .unwrap();

        assert!(ctx.project.join(".codex").exists());
        assert!(ctx.project.join("AGENTS.md").exists());
        assert_eq!(report.invalid_skill_ids.len(), 0);
    }

    #[test]
    fn warehouse_entries_serialize_metadata_fields() {
        let entry = SkillEntry {
            stable_id: 1,
            id: "alpha".into(),
            name: Some("Alpha".into()),
            description: Some("test".into()),
            skill_type: Some("workflow".into()),
            tags: vec!["rust".into()],
            source_hint: Some("codex".into()),
            path: PathBuf::from("/tmp/alpha"),
            skill_md_path: PathBuf::from("/tmp/alpha/SKILL.md"),
        };
        let json = serde_json::to_value(entry).unwrap();
        assert_eq!(json["stable_id"], 1);
        assert_eq!(json["skill_type"], "workflow");
        assert_eq!(json["tags"][0], "rust");
    }
}
