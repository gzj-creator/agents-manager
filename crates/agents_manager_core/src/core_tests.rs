#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use tempfile::{tempdir, TempDir};

    use crate::{
        apply_to_project, doctor, scan_warehouse, AppConfig, ApplySelections, InstallMode, Profile,
        SkillRegistry,
    };

    struct TestCtx {
        _tmp: TempDir,
        cfg: AppConfig,
        project: PathBuf,
    }

    impl TestCtx {
        fn new() -> Self {
            let tmp = tempdir().unwrap();
            let warehouse = tmp.path().join("warehouse");
            let project = tmp.path().join("project");
            fs::create_dir_all(&warehouse).unwrap();
            fs::create_dir_all(&project).unwrap();
            Self {
                cfg: AppConfig {
                    skill_warehouse: warehouse,
                    registry_path: tmp.path().join("registry.toml"),
                    library_roots: Vec::new(),
                    default_profile: Some("claude".into()),
                },
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
}
