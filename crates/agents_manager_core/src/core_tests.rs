#[cfg(test)]
mod tests {
    use std::env;
    use std::fs;
    use std::path::PathBuf;
    use std::process::Command;
    use std::sync::Mutex;

    use tempfile::{tempdir, TempDir};

    use crate::{
        apply_to_project, bootstrap_legacy_migration, create_skill, doctor, import_git_skills,
        init_project, load_mcp_config, load_skill_registry, save_mcp_config,
        save_skill_registry, scan_warehouse, update_editable_settings, AppConfig,
        ApplySelections, ClientKind, ClientRoots, CoreError, CreateSkillRequest,
        EditableSettingsUpdate, InitMode, InstallMode, McpServerConfig, McpTarget, Profile,
        RegistrySkill, SkillEntry, SkillRegistry,
    };

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    struct EnvVarGuard {
        key: &'static str,
        prev: Option<std::ffi::OsString>,
    }

    impl EnvVarGuard {
        fn set<V: AsRef<std::ffi::OsStr>>(key: &'static str, value: V) -> Self {
            let prev = env::var_os(key);
            env::set_var(key, value);
            Self { key, prev }
        }
    }

    impl Drop for EnvVarGuard {
        fn drop(&mut self) {
            match self.prev.take() {
                Some(v) => env::set_var(self.key, v),
                None => env::remove_var(self.key),
            }
        }
    }

    struct TestCtx {
        tmp: TempDir,
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
                tmp,
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

    fn setup_skill_with_body(root: &std::path::Path, relative: &str, body: &str) {
        let d = root.join(relative);
        fs::create_dir_all(&d).unwrap();
        let name = PathBuf::from(relative)
            .file_name()
            .unwrap()
            .to_string_lossy()
            .into_owned();
        fs::write(
            d.join("SKILL.md"),
            format!("---\nname: {name}\ndescription: test\n---\n{body}"),
        )
        .unwrap();
        fs::write(d.join("notes.txt"), body).unwrap();
    }

    fn init_git_repo(path: &std::path::Path) {
        let status = Command::new("git")
            .args(["init"])
            .current_dir(path)
            .status()
            .unwrap();
        assert!(status.success());

        let status = Command::new("git")
            .args(["add", "."])
            .current_dir(path)
            .status()
            .unwrap();
        assert!(status.success());

        let status = Command::new("git")
            .args([
                "-c",
                "user.name=Test User",
                "-c",
                "user.email=test@example.com",
                "commit",
                "-m",
                "init",
            ])
            .current_dir(path)
            .status()
            .unwrap();
        assert!(status.success());
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
    fn update_editable_settings_changes_warehouse_and_library_roots_only() {
        let ctx = TestCtx::new();
        let _lock = ENV_LOCK.lock().unwrap();
        let _env = EnvVarGuard::set(
            "AGENTS_MANAGER_CONFIG_DIR",
            ctx.tmp.path().join("config-dir").as_os_str(),
        );

        let next_warehouse = ctx.tmp.path().join("next-warehouse");
        let next_root = ctx.tmp.path().join("lib-a");

        let updated = update_editable_settings(
            &ctx.cfg,
            EditableSettingsUpdate {
                skill_warehouse: Some(next_warehouse.clone()),
                library_roots: Some(vec![next_root.clone()]),
            },
        )
        .unwrap();

        let saved_path = crate::config::config_file_path().unwrap();
        let saved_contents = fs::read_to_string(&saved_path).unwrap();
        let saved_cfg: AppConfig = toml::from_str(&saved_contents).unwrap();

        assert_eq!(updated.skill_warehouse, next_warehouse);
        assert_eq!(updated.library_roots, vec![next_root]);
        assert!(updated.skill_warehouse.is_dir());

        assert!(saved_path.is_file());
        assert!(saved_contents.contains("next-warehouse"));
        assert!(saved_contents.contains("lib-a"));
        assert_eq!(saved_cfg.skill_warehouse, updated.skill_warehouse);
        assert_eq!(saved_cfg.library_roots, updated.library_roots);

        assert_eq!(updated.registry_path, ctx.cfg.registry_path);
        assert_eq!(
            updated.bootstrap_migration_done,
            ctx.cfg.bootstrap_migration_done
        );
        assert_eq!(updated.default_profile, ctx.cfg.default_profile);
        assert_eq!(saved_cfg.registry_path, ctx.cfg.registry_path);
        assert_eq!(
            saved_cfg.bootstrap_migration_done,
            ctx.cfg.bootstrap_migration_done
        );
        assert_eq!(saved_cfg.default_profile, ctx.cfg.default_profile);
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
    fn create_skill_creates_directory_without_starter_skill_md() {
        let ctx = TestCtx::new();

        let created = create_skill(
            &ctx.cfg,
            CreateSkillRequest {
                id: "new-skill".into(),
                name: Some("New Skill".into()),
                description: Some("starter description".into()),
            },
        )
        .unwrap();

        assert_eq!(created.id, "new-skill");
        assert!(ctx.cfg.skill_warehouse.join("new-skill").is_dir());
        assert!(!ctx.cfg.skill_warehouse.join("new-skill/SKILL.md").exists());
        assert_eq!(created.name, None);
        assert_eq!(created.description, None);
    }

    #[test]
    fn create_skill_returns_error_if_skill_already_exists() {
        let ctx = TestCtx::new();

        let first = create_skill(
            &ctx.cfg,
            CreateSkillRequest {
                id: "new-skill".into(),
                name: Some("First Name".into()),
                description: Some("first description".into()),
            },
        )
        .unwrap();
        assert_eq!(first.id, "new-skill");

        let err = create_skill(
            &ctx.cfg,
            CreateSkillRequest {
                id: "new-skill".into(),
                name: Some("Second Name".into()),
                description: Some("second description".into()),
            },
        )
        .unwrap_err();

        match err {
            CoreError::Io(error) => assert_eq!(error.kind(), std::io::ErrorKind::AlreadyExists),
            other => panic!("expected AlreadyExists IO error, got {other:?}"),
        }
    }

    #[test]
    fn scan_warehouse_includes_empty_skill_dirs_and_picks_up_skill_md_later() {
        let ctx = TestCtx::new();

        let created = create_skill(
            &ctx.cfg,
            CreateSkillRequest {
                id: "roundtrip".into(),
                name: Some("ignored".into()),
                description: Some("ignored".into()),
            },
        )
        .unwrap();

        assert_eq!(created.id, "roundtrip");
        assert_eq!(created.name, None);
        assert_eq!(created.description, None);

        fs::write(
            ctx.cfg.skill_warehouse.join("roundtrip").join("SKILL.md"),
            "---\nname: Roundtrip\ndescription: imported later\n---\nbody",
        )
        .unwrap();

        let rescanned = scan_warehouse(&ctx.cfg).unwrap();
        let entry = rescanned
            .iter()
            .find(|entry| entry.id == "roundtrip")
            .unwrap();
        assert_eq!(entry.name.as_deref(), Some("Roundtrip"));
        assert_eq!(entry.description.as_deref(), Some("imported later"));
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
        assert_eq!(
            loaded.skills[0].tags,
            vec!["rust".to_string(), "cli".to_string()]
        );
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

    #[test]
    fn git_import_recursively_discovers_nested_skills_and_flattens_ids() {
        let ctx = TestCtx::new();
        let repo = tempdir().unwrap();
        setup_skill_with_body(repo.path(), "foo", "root body");
        setup_skill_with_body(repo.path(), "prompts/bar", "nested body");
        init_git_repo(repo.path());

        let report = import_git_skills(&ctx.cfg, repo.path().to_string_lossy().as_ref()).unwrap();
        let scanned = scan_warehouse(&ctx.cfg).unwrap();

        assert_eq!(report.discovered, 2);
        assert_eq!(report.imported, 2);
        assert!(ctx.cfg.skill_warehouse.join("foo/SKILL.md").exists());
        assert!(ctx.cfg.skill_warehouse.join("prompts-bar/SKILL.md").exists());
        assert!(scanned.iter().any(|skill| skill.id == "foo"));
        assert!(scanned.iter().any(|skill| skill.id == "prompts-bar"));
        let imported = scanned.iter().find(|skill| skill.id == "prompts-bar").unwrap();
        let expected_source_hint = format!("git:{}#prompts/bar", repo.path().display());
        assert_eq!(
            imported.source_hint.as_deref(),
            Some(expected_source_hint.as_str())
        );
    }

    #[test]
    fn git_import_skips_identical_existing_skill_dirs() {
        let ctx = TestCtx::new();
        setup_skill_with_body(&ctx.cfg.skill_warehouse, "foo", "same body");

        let repo = tempdir().unwrap();
        setup_skill_with_body(repo.path(), "foo", "same body");
        init_git_repo(repo.path());

        let report = import_git_skills(&ctx.cfg, repo.path().to_string_lossy().as_ref()).unwrap();
        let contents = fs::read_to_string(ctx.cfg.skill_warehouse.join("foo/SKILL.md")).unwrap();

        assert_eq!(report.discovered, 1);
        assert_eq!(report.imported, 0);
        assert_eq!(report.skipped, 1);
        assert_eq!(report.conflicts, 0);
        assert!(contents.contains("same body"));
    }

    #[test]
    fn git_import_reports_conflict_without_overwriting_existing_skill() {
        let ctx = TestCtx::new();
        setup_skill_with_body(&ctx.cfg.skill_warehouse, "foo", "local body");

        let repo = tempdir().unwrap();
        setup_skill_with_body(repo.path(), "foo", "remote body");
        init_git_repo(repo.path());

        let report = import_git_skills(&ctx.cfg, repo.path().to_string_lossy().as_ref()).unwrap();
        let contents = fs::read_to_string(ctx.cfg.skill_warehouse.join("foo/SKILL.md")).unwrap();

        assert_eq!(report.discovered, 1);
        assert_eq!(report.imported, 0);
        assert_eq!(report.skipped, 0);
        assert_eq!(report.conflicts, 1);
        assert!(contents.contains("local body"));
        assert!(!contents.contains("remote body"));
    }

    #[test]
    fn save_cursor_project_mcp_preserves_non_mcp_fields() {
        let dir = tempfile::tempdir().unwrap();
        let project = dir.path();
        fs::create_dir_all(project.join(".cursor")).unwrap();
        fs::write(
            project.join(".cursor/mcp.json"),
            r#"{"theme":"warm","mcpServers":{"existing":{"command":"npx","args":["server"]}}}"#,
        )
        .unwrap();

        save_mcp_config(
            &McpTarget::cursor_project(project),
            vec![McpServerConfig::stdio(
                "better-icons",
                "npx",
                vec!["-y".into(), "better-icons".into()],
            )],
        )
        .unwrap();

        let raw = fs::read_to_string(project.join(".cursor/mcp.json")).unwrap();
        assert!(raw.contains("\"theme\""));
        assert!(raw.contains("\"better-icons\""));
        assert!(!raw.contains("\"existing\""));

        let loaded = load_mcp_config(&McpTarget::cursor_project(project)).unwrap();
        assert_eq!(loaded.servers.len(), 1);
        assert_eq!(
            loaded.servers.get("better-icons"),
            Some(&McpServerConfig::stdio(
                "better-icons",
                "npx",
                vec!["-y".into(), "better-icons".into()],
            ))
        );
    }

    #[test]
    fn save_cursor_project_mcp_returns_error_for_existing_invalid_utf8_file() {
        let dir = tempfile::tempdir().unwrap();
        let project = dir.path();
        let config_path = project.join(".cursor/mcp.json");
        let invalid_bytes = vec![0xff, 0xfe, b'{'];
        fs::create_dir_all(project.join(".cursor")).unwrap();
        fs::write(&config_path, &invalid_bytes).unwrap();

        let err = save_mcp_config(
            &McpTarget::cursor_project(project),
            vec![McpServerConfig::stdio(
                "better-icons",
                "npx",
                vec!["-y".into(), "better-icons".into()],
            )],
        )
        .unwrap_err();

        match err {
            CoreError::Io(error) => assert_eq!(error.kind(), std::io::ErrorKind::InvalidData),
            other => panic!("expected invalid data IO error, got {other:?}"),
        }

        assert_eq!(fs::read(&config_path).unwrap(), invalid_bytes);
    }

    #[test]
    fn save_codex_global_mcp_returns_error_for_existing_invalid_utf8_file() {
        let home = tempfile::tempdir().unwrap();
        let config_path = home.path().join(".codex/config.toml");
        let invalid_bytes = vec![0xff, 0xfe, b'['];
        fs::create_dir_all(home.path().join(".codex")).unwrap();
        fs::write(&config_path, &invalid_bytes).unwrap();

        let err = save_mcp_config(
            &McpTarget::codex_global(home.path()),
            vec![McpServerConfig::stdio(
                "better-icons",
                "npx",
                vec!["-y".into(), "better-icons".into()],
            )],
        )
        .unwrap_err();

        match err {
            CoreError::Io(error) => assert_eq!(error.kind(), std::io::ErrorKind::InvalidData),
            other => panic!("expected invalid data IO error, got {other:?}"),
        }

        assert_eq!(fs::read(&config_path).unwrap(), invalid_bytes);
    }

    #[test]
    fn save_cursor_global_mcp_preserves_non_mcp_fields() {
        let home = tempfile::tempdir().unwrap();
        fs::create_dir_all(home.path().join(".cursor")).unwrap();
        fs::write(
            home.path().join(".cursor/mcp.json"),
            r#"{"theme":"warm","mcpServers":{"existing":{"command":"npx","args":["server"]}}}"#,
        )
        .unwrap();

        save_mcp_config(
            &McpTarget::cursor_global(home.path()),
            vec![McpServerConfig::stdio(
                "better-icons",
                "npx",
                vec!["-y".into(), "better-icons".into()],
            )],
        )
        .unwrap();

        let raw = fs::read_to_string(home.path().join(".cursor/mcp.json")).unwrap();
        assert!(raw.contains("\"theme\""));
        assert!(raw.contains("\"better-icons\""));
        assert!(!raw.contains("\"existing\""));

        let loaded = load_mcp_config(&McpTarget::cursor_global(home.path())).unwrap();
        assert_eq!(loaded.servers.len(), 1);
        assert_eq!(
            loaded.servers.get("better-icons"),
            Some(&McpServerConfig::stdio(
                "better-icons",
                "npx",
                vec!["-y".into(), "better-icons".into()],
            ))
        );
    }

    #[cfg(unix)]
    #[test]
    fn load_cursor_project_mcp_returns_error_for_unreadable_existing_file() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().unwrap();
        let project = dir.path();
        let cursor_dir = project.join(".cursor");
        let config_path = cursor_dir.join("mcp.json");
        fs::create_dir_all(&cursor_dir).unwrap();
        fs::write(&config_path, "{}").unwrap();

        let original_mode = fs::metadata(&cursor_dir).unwrap().permissions().mode();
        fs::set_permissions(&cursor_dir, fs::Permissions::from_mode(0o000)).unwrap();

        let result = load_mcp_config(&McpTarget::cursor_project(project));

        fs::set_permissions(&cursor_dir, fs::Permissions::from_mode(original_mode)).unwrap();

        let err = result.unwrap_err();
        match err {
            CoreError::Io(error) => {
                assert_eq!(error.kind(), std::io::ErrorKind::PermissionDenied)
            }
            other => panic!("expected permission denied IO error, got {other:?}"),
        }
    }

    #[test]
    fn save_codex_global_mcp_preserves_non_mcp_tables() {
        let home = tempfile::tempdir().unwrap();
        fs::create_dir_all(home.path().join(".codex")).unwrap();
        fs::write(
            home.path().join(".codex/config.toml"),
            "model = \"gpt-5\"\n[mcp_servers.old]\ncommand = \"npx\"\nargs = [\"old\"]\n",
        )
        .unwrap();

        save_mcp_config(
            &McpTarget::codex_global(home.path()),
            vec![McpServerConfig::stdio(
                "better-icons",
                "npx",
                vec!["-y".into(), "better-icons".into()],
            )],
        )
        .unwrap();

        let raw = fs::read_to_string(home.path().join(".codex/config.toml")).unwrap();
        assert!(raw.contains("model = \"gpt-5\""));
        assert!(raw.contains("[mcp_servers.better-icons]"));
        assert!(!raw.contains("[mcp_servers.old]"));

        let loaded = load_mcp_config(&McpTarget::codex_global(home.path())).unwrap();
        assert_eq!(loaded.servers.len(), 1);
        assert_eq!(
            loaded.servers.get("better-icons"),
            Some(&McpServerConfig::stdio(
                "better-icons",
                "npx",
                vec!["-y".into(), "better-icons".into()],
            ))
        );
    }

    #[test]
    fn save_codex_global_remote_mcp_uses_url_field() {
        let home = tempfile::tempdir().unwrap();

        save_mcp_config(
            &McpTarget::codex_global(home.path()),
            vec![McpServerConfig::remote(
                "openai-docs",
                "https://developers.openai.com/mcp",
            )],
        )
        .unwrap();

        let raw = fs::read_to_string(home.path().join(".codex/config.toml")).unwrap();
        assert!(raw.contains("[mcp_servers.openai-docs]"));
        assert!(raw.contains("url = \"https://developers.openai.com/mcp\""));
        assert!(!raw.contains("command ="));

        let loaded = load_mcp_config(&McpTarget::codex_global(home.path())).unwrap();
        assert_eq!(
            loaded.servers.get("openai-docs"),
            Some(&McpServerConfig::remote(
                "openai-docs",
                "https://developers.openai.com/mcp",
            ))
        );
    }

    #[test]
    fn save_claude_project_mcp_writes_dot_mcp_json_and_preserves_non_mcp_fields() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(
            dir.path().join(".mcp.json"),
            r#"{"theme":"warm","mcpServers":{"existing":{"command":"npx","args":["server"]}}}"#,
        )
        .unwrap();

        save_mcp_config(
            &McpTarget::claude_project(dir.path()),
            vec![McpServerConfig::stdio(
                "better-icons",
                "npx",
                vec!["-y".into(), "better-icons".into()],
            )],
        )
        .unwrap();

        let raw = fs::read_to_string(dir.path().join(".mcp.json")).unwrap();
        assert!(raw.contains("\"theme\""));
        assert!(raw.contains("\"better-icons\""));
        assert!(!raw.contains("\"existing\""));

        let loaded = load_mcp_config(&McpTarget::claude_project(dir.path())).unwrap();
        assert_eq!(loaded.servers.len(), 1);
        assert_eq!(
            loaded.servers.get("better-icons"),
            Some(&McpServerConfig::stdio(
                "better-icons",
                "npx",
                vec!["-y".into(), "better-icons".into()],
            ))
        );
    }

    #[test]
    fn save_claude_global_mcp_preserves_non_mcp_fields() {
        let home = tempfile::tempdir().unwrap();
        fs::write(
            home.path().join(".claude.json"),
            r#"{"theme":"warm","mcpServers":{"existing":{"command":"npx","args":["server"]}}}"#,
        )
        .unwrap();

        save_mcp_config(
            &McpTarget::claude_global(home.path()),
            vec![McpServerConfig::stdio(
                "better-icons",
                "npx",
                vec!["-y".into(), "better-icons".into()],
            )],
        )
        .unwrap();

        let raw = fs::read_to_string(home.path().join(".claude.json")).unwrap();
        assert!(raw.contains("\"theme\""));
        assert!(raw.contains("\"better-icons\""));
        assert!(!raw.contains("\"existing\""));

        let loaded = load_mcp_config(&McpTarget::claude_global(home.path())).unwrap();
        assert_eq!(loaded.servers.len(), 1);
        assert_eq!(
            loaded.servers.get("better-icons"),
            Some(&McpServerConfig::stdio(
                "better-icons",
                "npx",
                vec!["-y".into(), "better-icons".into()],
            ))
        );
    }

    #[test]
    fn save_claude_global_remote_mcp_uses_url_field() {
        let home = tempfile::tempdir().unwrap();

        save_mcp_config(
            &McpTarget::claude_global(home.path()),
            vec![McpServerConfig::remote(
                "openai-docs",
                "https://developers.openai.com/mcp",
            )],
        )
        .unwrap();

        let raw = fs::read_to_string(home.path().join(".claude.json")).unwrap();
        assert!(raw.contains("\"openai-docs\""));
        assert!(raw.contains("\"url\":\"https://developers.openai.com/mcp\""));
        assert!(!raw.contains("\"command\""));

        let loaded = load_mcp_config(&McpTarget::claude_global(home.path())).unwrap();
        assert_eq!(
            loaded.servers.get("openai-docs"),
            Some(&McpServerConfig::remote(
                "openai-docs",
                "https://developers.openai.com/mcp",
            ))
        );
    }

    #[test]
    fn codex_project_scope_is_reported_unsupported() {
        let dir = tempfile::tempdir().unwrap();

        let load_err = load_mcp_config(&McpTarget::codex_project(dir.path())).unwrap_err();
        assert!(matches!(load_err, CoreError::UnsupportedMcpTarget(_)));
        assert!(load_err.to_string().contains("project-scoped"));

        let save_err = save_mcp_config(
            &McpTarget::codex_project(dir.path()),
            vec![McpServerConfig::stdio(
                "better-icons",
                "npx",
                vec!["-y".into(), "better-icons".into()],
            )],
        )
        .unwrap_err();
        assert!(matches!(save_err, CoreError::UnsupportedMcpTarget(_)));
        assert!(save_err.to_string().contains("project-scoped"));
    }
}
