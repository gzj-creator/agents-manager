#[cfg(test)]
mod tests {
    use std::env;
    use std::fs;
    use std::path::PathBuf;
    use std::process::Command;
    use std::sync::Mutex;

    use tempfile::{tempdir, TempDir};

    use crate::{
        apply_to_project, bootstrap_legacy_migration, copy_paths_into_entry, create_memory,
        create_skill, delete_memory, delete_skill, doctor, generate_init_memory_command,
        generate_init_project_command, import_dropped_memory, import_dropped_skill,
        import_git_skills, init_memory, init_project, load_managed_mcp_config, load_mcp_config,
        load_skill_registry, rename_memory, rename_skill, save_managed_mcp_config, save_mcp_config,
        save_skill_registry, scan_memory_warehouse, scan_warehouse, sync_global_skills,
        update_editable_settings, update_skill_metadata, AppConfig, ApplySelections, ClientKind,
        ClientRoots, CoreError, CreateMemoryRequest, CreateSkillRequest, EditableSettingsUpdate,
        GlobalSyncRequest, InitMode, InstallMode, McpServerConfig, McpTarget, Profile,
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
            let memory_warehouse = tmp.path().join("memories");
            let project = tmp.path().join("project");
            let home = tmp.path().join("home");
            fs::create_dir_all(&warehouse).unwrap();
            fs::create_dir_all(&memory_warehouse).unwrap();
            fs::create_dir_all(&project).unwrap();
            fs::create_dir_all(&home).unwrap();
            Self {
                cfg: AppConfig {
                    skill_warehouse: warehouse,
                    memory_warehouse,
                    registry_path: tmp.path().join("registry.toml"),
                    bootstrap_migration_done: false,
                    library_roots: Vec::new(),
                    default_profile: Some("claude".into()),
                    mcp_disabled_servers: Default::default(),
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
            memory_warehouse: tmp.path().join("memories"),
            registry_path: tmp.path().join("registry.toml"),
            bootstrap_migration_done: false,
            library_roots: vec![lib.clone()],
            default_profile: Some("claude".into()),
            mcp_disabled_servers: Default::default(),
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
    fn sync_global_skills_reports_conflicts_before_writing_anything() {
        let ctx = TestCtx::new();
        setup_skill_with_body(&ctx.cfg.skill_warehouse, "alpha", "warehouse alpha");
        setup_skill_with_body(&ctx.cfg.skill_warehouse, "beta", "warehouse beta");
        ctx.create_client_skill(ClientKind::Codex, "alpha", "client alpha");

        let warehouse = scan_warehouse(&ctx.cfg).unwrap();
        let alpha_id = warehouse
            .iter()
            .find(|entry| entry.id == "alpha")
            .unwrap()
            .stable_id;
        let beta_id = warehouse
            .iter()
            .find(|entry| entry.id == "beta")
            .unwrap()
            .stable_id;

        let report = sync_global_skills(
            &ctx.cfg,
            &ctx.roots,
            &GlobalSyncRequest {
                client: ClientKind::Codex,
                skill_ids: vec![alpha_id, beta_id],
                overwrite_skill_ids: Vec::new(),
                mode: InstallMode::Copy,
            },
        )
        .unwrap();

        assert!(report.synced_skill_ids.is_empty());
        assert!(report.overwritten_skill_ids.is_empty());
        assert_eq!(report.conflicts.len(), 1);
        assert_eq!(report.conflicts[0].stable_id, alpha_id);
        assert_eq!(report.conflicts[0].id, "alpha");
        assert!(!ctx
            .roots
            .global_skill_root(ClientKind::Codex)
            .join("beta")
            .exists());
    }

    #[test]
    fn sync_global_skills_overwrites_confirmed_conflicts_and_syncs_remaining_skills() {
        let ctx = TestCtx::new();
        setup_skill_with_body(&ctx.cfg.skill_warehouse, "alpha", "warehouse alpha");
        setup_skill_with_body(&ctx.cfg.skill_warehouse, "beta", "warehouse beta");
        ctx.create_client_skill(ClientKind::Codex, "alpha", "client alpha");

        let warehouse = scan_warehouse(&ctx.cfg).unwrap();
        let alpha_id = warehouse
            .iter()
            .find(|entry| entry.id == "alpha")
            .unwrap()
            .stable_id;
        let beta_id = warehouse
            .iter()
            .find(|entry| entry.id == "beta")
            .unwrap()
            .stable_id;

        let report = sync_global_skills(
            &ctx.cfg,
            &ctx.roots,
            &GlobalSyncRequest {
                client: ClientKind::Codex,
                skill_ids: vec![alpha_id, beta_id],
                overwrite_skill_ids: vec![alpha_id],
                mode: InstallMode::Copy,
            },
        )
        .unwrap();

        assert!(report.conflicts.is_empty());
        assert_eq!(report.overwritten_skill_ids, vec![alpha_id]);
        assert_eq!(report.synced_skill_ids, vec![beta_id]);

        let alpha_dir = ctx.roots.global_skill_root(ClientKind::Codex).join("alpha");
        let beta_dir = ctx.roots.global_skill_root(ClientKind::Codex).join("beta");
        let alpha_skill = fs::read_to_string(alpha_dir.join("SKILL.md")).unwrap();
        let alpha_notes = fs::read_to_string(alpha_dir.join("notes.txt")).unwrap();
        let beta_notes = fs::read_to_string(beta_dir.join("notes.txt")).unwrap();

        assert!(alpha_skill.contains("warehouse alpha"));
        assert!(alpha_notes.contains("warehouse alpha"));
        assert!(beta_notes.contains("warehouse beta"));
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
            memory_warehouse: tmp.path().join("memories"),
            registry_path: tmp.path().join("registry.toml"),
            bootstrap_migration_done: false,
            library_roots: vec![lib],
            default_profile: Some("claude".into()),
            mcp_disabled_servers: Default::default(),
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
    fn memory_warehouse_defaults_under_agents_manager_home() {
        let ctx = TestCtx::new();
        let _lock = ENV_LOCK.lock().unwrap();
        let _home = EnvVarGuard::set("HOME", ctx.home.as_os_str());
        let _env = EnvVarGuard::set(
            "AGENTS_MANAGER_CONFIG_DIR",
            ctx.tmp.path().join("config-dir").as_os_str(),
        );

        let cfg = crate::load_app_config().unwrap();

        assert_eq!(
            cfg.memory_warehouse,
            ctx.home.join(".agents-manager/memories")
        );
        assert!(cfg.memory_warehouse.is_dir());
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
    fn scan_memory_warehouse_keeps_entries_without_memory_md() {
        let ctx = TestCtx::new();
        let entry_dir = ctx.cfg.memory_warehouse.join("team-default");
        fs::create_dir_all(&entry_dir).unwrap();

        let entries = scan_memory_warehouse(&ctx.cfg).unwrap();

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].id, "team-default");
        assert!(entries[0].stable_id > 0);
        assert_eq!(entries[0].path, entry_dir);
        assert_eq!(entries[0].memory_md_path, entries[0].path.join("MEMORY.md"));
        assert!(entries[0].tags.is_empty());
    }

    #[test]
    fn scan_memory_warehouse_ignores_hidden_directories_under_warehouse() {
        let ctx = TestCtx::new();
        fs::create_dir_all(ctx.cfg.memory_warehouse.join(".internal-cache")).unwrap();
        fs::create_dir_all(ctx.cfg.memory_warehouse.join("visible-memory")).unwrap();

        let entries = scan_memory_warehouse(&ctx.cfg).unwrap();

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].id, "visible-memory");
    }

    #[test]
    fn scan_memory_warehouse_ignores_legacy_memory_id_files_and_keeps_ids_unique() {
        let ctx = TestCtx::new();
        for name in ["alpha", "beta"] {
            let dir = ctx.cfg.memory_warehouse.join(name);
            fs::create_dir_all(&dir).unwrap();
            fs::write(dir.join(".memory-id"), "7").unwrap();
        }

        let entries = scan_memory_warehouse(&ctx.cfg).unwrap();

        assert_eq!(entries.len(), 2);
        assert!(entries
            .iter()
            .all(|entry| !entry.path.join(".memory-id").exists()));
        assert_ne!(entries[0].stable_id, entries[1].stable_id);
    }

    #[test]
    fn scan_memory_warehouse_ignores_malformed_legacy_memory_id_files() {
        let ctx = TestCtx::new();
        let entry_dir = ctx.cfg.memory_warehouse.join("alpha");
        fs::create_dir_all(&entry_dir).unwrap();
        fs::write(entry_dir.join(".memory-id"), "not-a-number").unwrap();

        let entries = scan_memory_warehouse(&ctx.cfg).unwrap();

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].id, "alpha");
        assert!(entries[0].stable_id > 0);
    }

    #[test]
    fn create_memory_rejects_dot_prefixed_id() {
        let ctx = TestCtx::new();

        let err = create_memory(
            &ctx.cfg,
            CreateMemoryRequest {
                id: ".hidden".into(),
            },
        )
        .unwrap_err();

        match err {
            CoreError::Io(error) => assert_eq!(error.kind(), std::io::ErrorKind::InvalidInput),
            other => panic!("expected InvalidInput IO error, got {other:?}"),
        }
        assert!(!ctx.cfg.memory_warehouse.join(".hidden").exists());
        assert!(scan_memory_warehouse(&ctx.cfg).unwrap().is_empty());
    }

    #[test]
    fn rename_memory_rejects_dot_prefixed_id() {
        let ctx = TestCtx::new();
        let created = create_memory(&ctx.cfg, CreateMemoryRequest { id: "alpha".into() }).unwrap();

        let err = rename_memory(&ctx.cfg, created.stable_id, ".hidden").unwrap_err();

        match err {
            CoreError::Io(error) => assert_eq!(error.kind(), std::io::ErrorKind::InvalidInput),
            other => panic!("expected InvalidInput IO error, got {other:?}"),
        }
        assert!(ctx.cfg.memory_warehouse.join("alpha").exists());
        assert!(!ctx.cfg.memory_warehouse.join(".hidden").exists());
        let rescanned = scan_memory_warehouse(&ctx.cfg).unwrap();
        let alpha = rescanned.iter().find(|entry| entry.id == "alpha").unwrap();
        assert_eq!(alpha.stable_id, created.stable_id);
    }

    #[test]
    fn create_rename_delete_memory_roundtrip() {
        let ctx = TestCtx::new();

        let created = create_memory(&ctx.cfg, CreateMemoryRequest { id: "alpha".into() }).unwrap();
        assert_eq!(created.id, "alpha");
        assert_eq!(
            created.memory_md_path,
            ctx.cfg.memory_warehouse.join("alpha").join("MEMORY.md")
        );
        assert!(!created.path.join(".memory-id").exists());

        let scanned = scan_memory_warehouse(&ctx.cfg).unwrap();
        let scanned_alpha = scanned.iter().find(|entry| entry.id == "alpha").unwrap();
        assert_eq!(scanned_alpha.stable_id, created.stable_id);

        let renamed = rename_memory(&ctx.cfg, created.stable_id, "beta").unwrap();
        assert_eq!(renamed.stable_id, created.stable_id);
        assert_eq!(renamed.id, "beta");
        assert!(!ctx.cfg.memory_warehouse.join("alpha").exists());
        assert!(ctx.cfg.memory_warehouse.join("beta").exists());

        let rescanned = scan_memory_warehouse(&ctx.cfg).unwrap();
        let rescanned_beta = rescanned.iter().find(|entry| entry.id == "beta").unwrap();
        assert_eq!(rescanned_beta.stable_id, created.stable_id);

        delete_memory(&ctx.cfg, renamed.stable_id).unwrap();

        assert!(!ctx.cfg.memory_warehouse.join("alpha").exists());
        assert!(!ctx.cfg.memory_warehouse.join("beta").exists());
        assert!(scan_memory_warehouse(&ctx.cfg).unwrap().is_empty());
    }

    #[test]
    fn import_dropped_memory_from_memory_md_file() {
        let ctx = TestCtx::new();
        let dropped_root = ctx.tmp.path().join("dropped-memory");
        fs::create_dir_all(&dropped_root).unwrap();
        let dropped = dropped_root.join("MEMORY.md");
        fs::write(&dropped, "project memory").unwrap();

        let imported = import_dropped_memory(&ctx.cfg, &dropped).unwrap();

        assert!(imported.path.join("MEMORY.md").exists());
        assert_eq!(
            fs::read_to_string(imported.path.join("MEMORY.md")).unwrap(),
            "project memory"
        );
    }

    #[test]
    fn import_dropped_memory_accepts_agents_symlink_and_reuses_existing_memory() {
        let ctx = TestCtx::new();
        let created = create_memory(&ctx.cfg, CreateMemoryRequest { id: "alpha".into() }).unwrap();
        fs::write(&created.memory_md_path, "remember this").unwrap();

        init_memory(
            ctx.project.as_path(),
            ClientKind::Claude,
            created.stable_id,
            &ctx.cfg,
        )
        .unwrap();

        let imported = import_dropped_memory(&ctx.cfg, &ctx.project.join("AGENTS.md")).unwrap();

        assert_eq!(imported.stable_id, created.stable_id);
        assert_eq!(imported.id, created.id);
        assert_eq!(scan_memory_warehouse(&ctx.cfg).unwrap().len(), 1);
    }

    #[test]
    fn import_dropped_memory_accepts_agents_and_claude_md_files() {
        let ctx = TestCtx::new();

        for file_name in ["AGENTS.md", "CLAUDE.md"] {
            let dropped_root = ctx
                .tmp
                .path()
                .join(format!("dropped-{}", file_name.to_lowercase()));
            fs::create_dir_all(&dropped_root).unwrap();
            let dropped = dropped_root.join(file_name);
            fs::write(&dropped, format!("{file_name} content")).unwrap();

            let imported = import_dropped_memory(&ctx.cfg, &dropped).unwrap();

            assert_eq!(
                imported.id,
                dropped_root.file_name().unwrap().to_string_lossy()
            );
            assert_eq!(
                fs::read_to_string(imported.path.join("MEMORY.md")).unwrap(),
                format!("{file_name} content")
            );
        }
    }

    #[test]
    fn generate_init_project_command_appends_force_flag_when_requested() {
        let command =
            generate_init_project_command(ClientKind::Codex, &[1, 2, 3], Some("copy"), true);

        assert_eq!(
            command,
            "agents-manager init-project --client codex --skills 1,2,3 --mode copy --force"
        );
    }

    #[test]
    fn generate_init_memory_command_uses_client_and_memory_id() {
        let command = generate_init_memory_command(ClientKind::Claude, 12, false);

        assert_eq!(
            command,
            "agents-manager init-memory --client claude --memory 12 --project ."
        );
    }

    #[test]
    fn generate_init_memory_command_appends_force_flag_when_requested() {
        let command = generate_init_memory_command(ClientKind::Claude, 12, true);

        assert_eq!(
            command,
            "agents-manager init-memory --client claude --memory 12 --project . --force"
        );
    }

    #[test]
    fn import_dropped_memory_accepts_directory_and_copies_directory_contents() {
        let ctx = TestCtx::new();
        let dropped_root = ctx.tmp.path().join("dropped").join("dragged-memory");
        fs::create_dir_all(dropped_root.join("nested")).unwrap();
        fs::write(dropped_root.join("MEMORY.md"), "project memory").unwrap();
        fs::write(dropped_root.join("notes.txt"), "hello").unwrap();
        fs::write(dropped_root.join("nested").join("extra.md"), "more").unwrap();

        let imported = import_dropped_memory(&ctx.cfg, &dropped_root).unwrap();

        assert_eq!(imported.id, "dragged-memory");
        assert_eq!(
            fs::read_to_string(imported.path.join("MEMORY.md")).unwrap(),
            "project memory"
        );
        assert_eq!(
            fs::read_to_string(imported.path.join("notes.txt")).unwrap(),
            "hello"
        );
        assert_eq!(
            fs::read_to_string(imported.path.join("nested").join("extra.md")).unwrap(),
            "more"
        );
    }

    #[test]
    fn import_dropped_memory_rejects_invalid_source_path() {
        let ctx = TestCtx::new();
        let missing_parent = ctx.tmp.path().join("imports");
        let missing = missing_parent.join("MEMORY.md");

        let error = import_dropped_memory(&ctx.cfg, &missing).unwrap_err();

        match error {
            CoreError::Io(error) => assert_eq!(error.kind(), std::io::ErrorKind::InvalidInput),
            other => panic!("expected InvalidInput IO error, got {other:?}"),
        }
        assert!(!ctx.cfg.memory_warehouse.join("imports").exists());
        assert!(scan_memory_warehouse(&ctx.cfg).unwrap().is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn import_dropped_memory_cleans_up_created_entry_when_copy_fails() {
        let ctx = TestCtx::new();
        let dropped_root = ctx.tmp.path().join("dropped").join("broken-memory");
        fs::create_dir_all(&dropped_root).unwrap();
        fs::write(dropped_root.join("MEMORY.md"), "project memory").unwrap();
        std::os::unix::fs::symlink(
            dropped_root.join("missing.txt"),
            dropped_root.join("broken-link.txt"),
        )
        .unwrap();

        let error = import_dropped_memory(&ctx.cfg, &dropped_root).unwrap_err();

        match error {
            CoreError::Io(error) => assert_eq!(error.kind(), std::io::ErrorKind::NotFound),
            other => panic!("expected NotFound IO error, got {other:?}"),
        }
        assert!(!ctx.cfg.memory_warehouse.join("broken-memory").exists());
        let registry =
            fs::read_to_string(ctx.cfg.memory_warehouse.join(".memory-registry.toml")).unwrap();
        assert!(!registry.contains("broken-memory"));
        assert!(scan_memory_warehouse(&ctx.cfg).unwrap().is_empty());
    }

    #[test]
    fn init_memory_writes_client_target_from_memory_md() {
        let ctx = TestCtx::new();
        let created = create_memory(&ctx.cfg, CreateMemoryRequest { id: "alpha".into() }).unwrap();
        fs::write(created.memory_md_path.clone(), "remember this").unwrap();

        init_memory(
            ctx.project.as_path(),
            ClientKind::Claude,
            created.stable_id,
            &ctx.cfg,
        )
        .unwrap();

        let agents = ctx.project.join("AGENTS.md");
        let claude = ctx.project.join("CLAUDE.md");

        assert!(fs::symlink_metadata(&agents)
            .unwrap()
            .file_type()
            .is_symlink());
        assert!(fs::symlink_metadata(&claude)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(fs::read_link(&agents).unwrap(), created.memory_md_path);
        assert_eq!(fs::read_link(&claude).unwrap(), PathBuf::from("AGENTS.md"));
        assert_eq!(fs::read_to_string(&claude).unwrap(), "remember this");
    }

    #[test]
    fn init_memory_rejects_existing_target_file() {
        let ctx = TestCtx::new();
        let created = create_memory(&ctx.cfg, CreateMemoryRequest { id: "alpha".into() }).unwrap();
        fs::write(created.memory_md_path.clone(), "remember this").unwrap();
        fs::write(ctx.project.join("AGENTS.md"), "existing").unwrap();

        let error = init_memory(
            ctx.project.as_path(),
            ClientKind::Codex,
            created.stable_id,
            &ctx.cfg,
        )
        .unwrap_err();

        assert!(matches!(error, CoreError::DestConflict(_)));
    }

    #[test]
    fn init_memory_for_cursor_creates_claude_alias_to_agents() {
        let ctx = TestCtx::new();
        let created = create_memory(&ctx.cfg, CreateMemoryRequest { id: "alpha".into() }).unwrap();
        fs::write(created.memory_md_path.clone(), "remember this").unwrap();

        init_memory(
            ctx.project.as_path(),
            ClientKind::Cursor,
            created.stable_id,
            &ctx.cfg,
        )
        .unwrap();

        let agents = ctx.project.join("AGENTS.md");
        let claude = ctx.project.join("CLAUDE.md");

        assert!(fs::symlink_metadata(&agents)
            .unwrap()
            .file_type()
            .is_symlink());
        assert!(fs::symlink_metadata(&claude)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(fs::read_link(&agents).unwrap(), created.memory_md_path);
        assert_eq!(fs::read_link(&claude).unwrap(), PathBuf::from("AGENTS.md"));
    }

    #[test]
    fn init_memory_rejects_existing_claude_alias_target() {
        let ctx = TestCtx::new();
        let created = create_memory(&ctx.cfg, CreateMemoryRequest { id: "alpha".into() }).unwrap();
        fs::write(created.memory_md_path.clone(), "remember this").unwrap();
        fs::write(ctx.project.join("CLAUDE.md"), "existing").unwrap();

        let error = init_memory(
            ctx.project.as_path(),
            ClientKind::Claude,
            created.stable_id,
            &ctx.cfg,
        )
        .unwrap_err();

        assert!(matches!(error, CoreError::DestConflict(_)));
    }

    #[test]
    fn init_memory_rejects_invalid_project_root() {
        let ctx = TestCtx::new();
        let created = create_memory(&ctx.cfg, CreateMemoryRequest { id: "alpha".into() }).unwrap();
        fs::write(created.memory_md_path.clone(), "remember this").unwrap();
        let invalid_project = ctx.project.join("missing-project");

        let error = init_memory(
            invalid_project.as_path(),
            ClientKind::Claude,
            created.stable_id,
            &ctx.cfg,
        )
        .unwrap_err();

        assert!(matches!(
            error,
            CoreError::InvalidProject(path) if path == invalid_project
        ));
    }

    #[test]
    fn copy_paths_into_skill_preserves_existing_files_by_refusing_overwrite() {
        let ctx = TestCtx::new();
        let created = create_skill(
            &ctx.cfg,
            CreateSkillRequest {
                id: "alpha".into(),
                name: None,
                description: None,
            },
        )
        .unwrap();
        fs::write(created.path.join("notes.txt"), "old").unwrap();

        let dropped = ctx.tmp.path().join("notes.txt");
        fs::write(&dropped, "new").unwrap();

        let error = copy_paths_into_entry(&created.path, "", &[dropped]).unwrap_err();

        assert!(matches!(error, CoreError::DestConflict(_)));
    }

    #[test]
    fn delete_skill_removes_skill_directory_by_stable_id() {
        let ctx = TestCtx::new();
        ctx.create_skill("alpha");
        let created = scan_warehouse(&ctx.cfg)
            .unwrap()
            .into_iter()
            .find(|entry| entry.id == "alpha")
            .unwrap();

        delete_skill(&ctx.cfg, created.stable_id).unwrap();

        let rescanned = scan_warehouse(&ctx.cfg).unwrap();
        assert!(!ctx.cfg.skill_warehouse.join("alpha").exists());
        assert!(!rescanned.iter().any(|entry| entry.id == "alpha"));
    }

    #[test]
    fn import_dropped_skill_accepts_skill_md_without_copying_unrelated_parent_contents() {
        let ctx = TestCtx::new();
        let dropped_root = ctx.tmp.path().join("dropped").join("downloads");
        fs::create_dir_all(dropped_root.join("nested")).unwrap();
        fs::write(
            dropped_root.join("SKILL.md"),
            "---\nname: dragged-skill\ndescription: dragged in\n---\nbody",
        )
        .unwrap();
        fs::write(dropped_root.join("notes.txt"), "hello").unwrap();
        fs::write(dropped_root.join("nested").join("extra.md"), "more").unwrap();

        let imported =
            import_dropped_skill(&ctx.cfg, &dropped_root.join("SKILL.md"), None).unwrap();

        assert_eq!(imported.id, "dragged-skill");
        assert!(ctx
            .cfg
            .skill_warehouse
            .join("dragged-skill")
            .join("SKILL.md")
            .exists());
        assert!(!ctx
            .cfg
            .skill_warehouse
            .join("dragged-skill")
            .join("notes.txt")
            .exists());
        assert!(!ctx
            .cfg
            .skill_warehouse
            .join("dragged-skill")
            .join("nested")
            .join("extra.md")
            .exists());
    }

    #[test]
    fn import_dropped_skill_accepts_directory_and_copies_directory_contents() {
        let ctx = TestCtx::new();
        let dropped_root = ctx.tmp.path().join("dropped").join("dragged-skill");
        fs::create_dir_all(dropped_root.join("nested")).unwrap();
        fs::write(
            dropped_root.join("SKILL.md"),
            "---\nname: dragged-skill\ndescription: dragged in\n---\nbody",
        )
        .unwrap();
        fs::write(dropped_root.join("notes.txt"), "hello").unwrap();
        fs::write(dropped_root.join("nested").join("extra.md"), "more").unwrap();

        let imported = import_dropped_skill(&ctx.cfg, &dropped_root, None).unwrap();

        assert_eq!(imported.id, "dragged-skill");
        assert_eq!(
            fs::read_to_string(
                ctx.cfg
                    .skill_warehouse
                    .join("dragged-skill")
                    .join("notes.txt")
            )
            .unwrap(),
            "hello"
        );
        assert_eq!(
            fs::read_to_string(
                ctx.cfg
                    .skill_warehouse
                    .join("dragged-skill")
                    .join("nested")
                    .join("extra.md")
            )
            .unwrap(),
            "more"
        );
    }

    #[test]
    fn import_dropped_skill_can_overwrite_an_existing_skill_directory_in_place() {
        let ctx = TestCtx::new();
        let created = create_skill(
            &ctx.cfg,
            CreateSkillRequest {
                id: "existing-id".into(),
                name: None,
                description: None,
            },
        )
        .unwrap();
        update_skill_metadata(
            &ctx.cfg,
            created.stable_id,
            Some("workflow".into()),
            vec!["shared".into()],
        )
        .unwrap();
        fs::write(
            created.path.join("SKILL.md"),
            "---\nname: Shared Name\ndescription: old\n---\nold body",
        )
        .unwrap();
        fs::write(created.path.join("stale.txt"), "remove me").unwrap();

        let dropped_root = ctx.tmp.path().join("dropped").join("incoming-skill");
        fs::create_dir_all(dropped_root.join("nested")).unwrap();
        fs::write(
            dropped_root.join("SKILL.md"),
            "---\nname: Shared Name\ndescription: new\n---\nnew body",
        )
        .unwrap();
        fs::write(dropped_root.join("notes.txt"), "fresh").unwrap();
        fs::write(dropped_root.join("nested").join("extra.md"), "nested").unwrap();

        let imported =
            import_dropped_skill(&ctx.cfg, &dropped_root, Some(created.stable_id)).unwrap();

        assert_eq!(imported.stable_id, created.stable_id);
        assert_eq!(imported.id, "existing-id");
        assert_eq!(imported.skill_type.as_deref(), Some("workflow"));
        assert_eq!(imported.tags, vec!["shared"]);
        assert_eq!(imported.name.as_deref(), Some("Shared Name"));
        assert_eq!(imported.description.as_deref(), Some("new"));
        assert!(!created.path.join("stale.txt").exists());
        assert_eq!(
            fs::read_to_string(created.path.join("notes.txt")).unwrap(),
            "fresh"
        );
        assert_eq!(
            fs::read_to_string(created.path.join("nested").join("extra.md")).unwrap(),
            "nested"
        );
    }

    #[test]
    fn import_dropped_skill_can_overwrite_only_skill_md_when_dropping_a_single_file() {
        let ctx = TestCtx::new();
        let created = create_skill(
            &ctx.cfg,
            CreateSkillRequest {
                id: "existing-id".into(),
                name: None,
                description: None,
            },
        )
        .unwrap();
        fs::write(
            created.path.join("SKILL.md"),
            "---\nname: Shared Name\ndescription: old\n---\nold body",
        )
        .unwrap();
        fs::write(created.path.join("notes.txt"), "keep me").unwrap();

        let dropped_root = ctx.tmp.path().join("dropped").join("downloads");
        fs::create_dir_all(&dropped_root).unwrap();
        let dropped_skill_md = dropped_root.join("SKILL.md");
        fs::write(
            &dropped_skill_md,
            "---\nname: Shared Name\ndescription: new\n---\nnew body",
        )
        .unwrap();

        let imported =
            import_dropped_skill(&ctx.cfg, &dropped_skill_md, Some(created.stable_id)).unwrap();

        assert_eq!(imported.stable_id, created.stable_id);
        assert_eq!(imported.description.as_deref(), Some("new"));
        assert_eq!(
            fs::read_to_string(created.path.join("notes.txt")).unwrap(),
            "keep me"
        );
        assert_eq!(
            fs::read_to_string(created.path.join("SKILL.md")).unwrap(),
            "---\nname: Shared Name\ndescription: new\n---\nnew body"
        );
    }

    #[test]
    fn rename_skill_moves_directory_and_preserves_stable_id() {
        let ctx = TestCtx::new();
        ctx.create_skill("alpha");
        let created = scan_warehouse(&ctx.cfg)
            .unwrap()
            .into_iter()
            .find(|entry| entry.id == "alpha")
            .unwrap();

        let renamed = rename_skill(&ctx.cfg, created.stable_id, "beta").unwrap();

        assert_eq!(renamed.stable_id, created.stable_id);
        assert_eq!(renamed.id, "beta");
        assert!(!ctx.cfg.skill_warehouse.join("alpha").exists());
        assert!(ctx.cfg.skill_warehouse.join("beta").exists());
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
    fn init_project_creates_codex_dir_without_memory_file() {
        let ctx = TestCtx::new();
        ctx.create_skill("alpha");
        let scan = scan_warehouse(&ctx.cfg).unwrap();
        let alpha = scan.iter().find(|s| s.id == "alpha").unwrap();

        let report = init_project(
            &ctx.project,
            ClientKind::Codex,
            vec![alpha.stable_id],
            InitMode::Symlink,
            false,
            &ctx.cfg,
        )
        .unwrap();

        assert!(ctx.project.join(".codex").exists());
        assert!(ctx.project.join("AGENTS.md").symlink_metadata().is_err());
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
        assert!(ctx
            .cfg
            .skill_warehouse
            .join("prompts-bar/SKILL.md")
            .exists());
        assert!(scanned.iter().any(|skill| skill.id == "foo"));
        assert!(scanned.iter().any(|skill| skill.id == "prompts-bar"));
        let imported = scanned
            .iter()
            .find(|skill| skill.id == "prompts-bar")
            .unwrap();
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
    fn load_managed_mcp_config_merges_disabled_drafts_and_prefers_enabled_target_copy() {
        let ctx = TestCtx::new();
        let _lock = ENV_LOCK.lock().unwrap();
        let _env = EnvVarGuard::set(
            "AGENTS_MANAGER_CONFIG_DIR",
            ctx.tmp.path().join("config-dir").as_os_str(),
        );

        let target = McpTarget::codex_global(&ctx.home);
        fs::create_dir_all(ctx.home.join(".codex")).unwrap();
        fs::write(
            ctx.home.join(".codex/config.toml"),
            "[mcp_servers.better-icons]\ncommand = \"uvx\"\nargs = [\"better-icons\"]\n",
        )
        .unwrap();

        let mut cfg = ctx.cfg.clone();
        let target_key = target.config_path().unwrap().display().to_string();
        let mut disabled_better_icons = McpServerConfig::stdio(
            "better-icons",
            "npx",
            vec!["-y".into(), "better-icons".into()],
        );
        disabled_better_icons.enabled = false;
        let mut disabled_openai_docs =
            McpServerConfig::remote("openai-docs", "https://developers.openai.com/mcp");
        disabled_openai_docs.enabled = false;
        cfg.mcp_disabled_servers.insert(
            target_key,
            vec![disabled_better_icons, disabled_openai_docs],
        );

        let managed = load_managed_mcp_config(&cfg, &target).unwrap();

        assert_eq!(managed.servers.len(), 2);
        assert_eq!(
            managed.servers.get("better-icons"),
            Some(&McpServerConfig {
                enabled: true,
                ..McpServerConfig::stdio("better-icons", "uvx", vec!["better-icons".into()])
            })
        );
        assert_eq!(
            managed.servers.get("openai-docs"),
            Some(&McpServerConfig {
                enabled: false,
                ..McpServerConfig::remote("openai-docs", "https://developers.openai.com/mcp")
            })
        );
    }

    #[test]
    fn save_managed_mcp_config_writes_only_enabled_servers_and_persists_disabled_drafts() {
        let ctx = TestCtx::new();
        let _lock = ENV_LOCK.lock().unwrap();
        let _env = EnvVarGuard::set(
            "AGENTS_MANAGER_CONFIG_DIR",
            ctx.tmp.path().join("config-dir").as_os_str(),
        );

        let target = McpTarget::codex_global(&ctx.home);
        let mut disabled_openai_docs =
            McpServerConfig::remote("openai-docs", "https://developers.openai.com/mcp");
        disabled_openai_docs.enabled = false;

        let updated = save_managed_mcp_config(
            &ctx.cfg,
            &target,
            vec![
                McpServerConfig::stdio(
                    "better-icons",
                    "npx",
                    vec!["-y".into(), "better-icons".into()],
                ),
                disabled_openai_docs.clone(),
            ],
        )
        .unwrap();

        let raw = fs::read_to_string(ctx.home.join(".codex/config.toml")).unwrap();
        assert!(raw.contains("[mcp_servers.better-icons]"));
        assert!(!raw.contains("[mcp_servers.openai-docs]"));

        let target_key = target.config_path().unwrap().display().to_string();
        assert_eq!(
            updated.mcp_disabled_servers.get(&target_key),
            Some(&vec![disabled_openai_docs])
        );
    }

    #[test]
    fn save_managed_codex_global_mcp_preserves_non_mcp_content_while_updating_mcp_table() {
        let ctx = TestCtx::new();
        let _lock = ENV_LOCK.lock().unwrap();
        let _env = EnvVarGuard::set(
            "AGENTS_MANAGER_CONFIG_DIR",
            ctx.tmp.path().join("config-dir").as_os_str(),
        );

        fs::create_dir_all(ctx.home.join(".codex")).unwrap();
        fs::write(
            ctx.home.join(".codex/config.toml"),
            "# keep me\nmodel = \"gpt-5\"\n[profiles.default]\napproval = \"never\"\n[mcp_servers.old]\ncommand = \"npx\"\nargs = [\"old\"]\n",
        )
        .unwrap();

        let target = McpTarget::codex_global(&ctx.home);
        let mut disabled_openai_docs =
            McpServerConfig::remote("openai-docs", "https://developers.openai.com/mcp");
        disabled_openai_docs.enabled = false;

        save_managed_mcp_config(
            &ctx.cfg,
            &target,
            vec![
                McpServerConfig::stdio(
                    "better-icons",
                    "npx",
                    vec!["-y".into(), "better-icons".into()],
                ),
                disabled_openai_docs,
            ],
        )
        .unwrap();

        let raw = fs::read_to_string(ctx.home.join(".codex/config.toml")).unwrap();
        assert!(raw.contains("# keep me"));
        assert!(raw.contains("model = \"gpt-5\""));
        assert!(raw.contains("[profiles.default]"));
        assert!(raw.contains("approval = \"never\""));
        assert!(raw.contains("[mcp_servers.better-icons]"));
        assert!(!raw.contains("[mcp_servers.old]"));
        assert!(!raw.contains("[mcp_servers.openai-docs]"));
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
