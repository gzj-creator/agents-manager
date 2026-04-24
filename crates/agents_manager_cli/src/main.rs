use std::io::{BufRead, Write};
use std::path::PathBuf;

use agents_manager_core::{
    apply_to_project, doctor, init_config_tree, init_memory, init_memory_conflicts,
    init_memory_with_overwrite, init_project, list_profiles, load_app_config, load_profile,
    migrate_legacy_skills, save_app_config, save_profile, scan_warehouse, AppConfig,
    ApplySelections, ClientKind, ClientRoots, InitMode, InstallMode, Profile,
};
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "agents-manager")]
#[command(about = "Manage skills + CLAUDE.md/AGENTS.md for projects")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Library {
        #[command(subcommand)]
        command: LibrarySub,
    },
    Profile {
        #[command(subcommand)]
        command: ProfileSub,
    },
    Config {
        #[command(subcommand)]
        command: ConfigSub,
    },
    Apply {
        #[arg(long, default_value = ".")]
        project: PathBuf,
        #[arg(long)]
        profile: String,
        #[arg(long, value_delimiter = ',')]
        skills: Vec<String>,
        #[arg(long)]
        claude_md: Option<PathBuf>,
        #[arg(long)]
        agents_md: Option<PathBuf>,
        #[arg(long, default_value = "symlink")]
        mode: String,
    },
    Doctor {
        #[arg(long, default_value = ".")]
        project: PathBuf,
        #[arg(long)]
        profile: String,
    },
    InitProject {
        #[arg(long, default_value = ".")]
        project: PathBuf,
        #[arg(long)]
        client: String,
        #[arg(long, value_delimiter = ',')]
        skills: Vec<u64>,
        #[arg(long, default_value = "symlink")]
        mode: String,
        #[arg(long)]
        force: bool,
    },
    InitMemory {
        #[arg(long, default_value = ".")]
        project: PathBuf,
        #[arg(long)]
        client: String,
        #[arg(long)]
        memory: u64,
        #[arg(long)]
        force: bool,
    },
    MigrateLegacySkills,
}

#[derive(Subcommand)]
enum LibrarySub {
    Scan,
    Paths,
}

#[derive(Subcommand)]
enum ProfileSub {
    List,
    Upsert {
        #[arg(long)]
        id: String,
        #[arg(long)]
        project_skill_root: PathBuf,
        #[arg(long, default_value = "CLAUDE.md")]
        claude_md_target: PathBuf,
        #[arg(long, default_value = "AGENTS.md")]
        agents_md_target: PathBuf,
    },
}

#[derive(Subcommand)]
enum ConfigSub {
    Show,
    SetLibraryRoots {
        #[arg(long, value_delimiter = ',')]
        roots: Vec<PathBuf>,
        #[arg(long)]
        default_profile: Option<String>,
    },
}

fn parse_mode(mode: &str) -> InstallMode {
    match mode {
        "copy" => InstallMode::Copy,
        _ => InstallMode::Symlink,
    }
}

fn parse_init_mode(mode: &str) -> InitMode {
    match mode {
        "copy" => InitMode::Copy,
        _ => InitMode::Symlink,
    }
}

fn parse_client(client: &str) -> Result<ClientKind, Box<dyn std::error::Error>> {
    match client {
        "codex" => Ok(ClientKind::Codex),
        "claude" => Ok(ClientKind::Claude),
        "cursor" => Ok(ClientKind::Cursor),
        _ => Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("unsupported client: {client}"),
        )
        .into()),
    }
}

fn init_memory_success_output() -> String {
    serde_json::to_string_pretty(&serde_json::json!({ "status": "ok" }))
        .expect("serializing init-memory success payload should not fail")
}

fn execute_command<W: Write>(
    command: Commands,
    out: &mut W,
) -> Result<(), Box<dyn std::error::Error>> {
    let stdin = std::io::stdin();
    let mut input = stdin.lock();
    execute_command_with_input(command, &mut input, out)
}

fn execute_command_with_input<R: BufRead, W: Write>(
    command: Commands,
    input: &mut R,
    out: &mut W,
) -> Result<(), Box<dyn std::error::Error>> {
    match command {
        Commands::Library { command } => {
            let cfg = load_app_config()?;
            match command {
                LibrarySub::Scan => {
                    let entries = scan_warehouse(&cfg)?;
                    writeln!(out, "{}", serde_json::to_string_pretty(&entries)?)?;
                }
                LibrarySub::Paths => {
                    writeln!(out, "{}", serde_json::to_string_pretty(&cfg.library_roots)?)?;
                }
            }
        }
        Commands::Profile { command } => match command {
            ProfileSub::List => {
                let profiles = list_profiles()?;
                writeln!(out, "{}", serde_json::to_string_pretty(&profiles)?)?;
            }
            ProfileSub::Upsert {
                id,
                project_skill_root,
                claude_md_target,
                agents_md_target,
            } => {
                let p = Profile {
                    id,
                    project_skill_root,
                    claude_md_target,
                    agents_md_target,
                };
                save_profile(&p)?;
                writeln!(out, "{}", serde_json::to_string_pretty(&p)?)?;
            }
        },
        Commands::Config { command } => match command {
            ConfigSub::Show => {
                let cfg = load_app_config()?;
                writeln!(out, "{}", serde_json::to_string_pretty(&cfg)?)?;
            }
            ConfigSub::SetLibraryRoots {
                roots,
                default_profile,
            } => {
                let mut cfg = load_app_config()?;
                cfg.library_roots = roots;
                if let Some(p) = default_profile {
                    cfg.default_profile = Some(p);
                }
                save_app_config(&cfg)?;
                let saved: AppConfig = load_app_config()?;
                writeln!(out, "{}", serde_json::to_string_pretty(&saved)?)?;
            }
        },
        Commands::Apply {
            project,
            profile,
            skills,
            claude_md,
            agents_md,
            mode,
        } => {
            let cfg = load_app_config()?;
            let profile = load_profile(&profile)?;
            let report = apply_to_project(
                &project,
                &profile,
                &cfg,
                &ApplySelections {
                    skill_ids: skills,
                    claude_md_source: claude_md,
                    agents_md_source: agents_md,
                    mode: parse_mode(&mode),
                },
            )?;
            writeln!(out, "{}", serde_json::to_string_pretty(&report)?)?;
        }
        Commands::Doctor { project, profile } => {
            let cfg = load_app_config()?;
            let profile = load_profile(&profile)?;
            let report = doctor(&project, &profile, &cfg)?;
            writeln!(out, "{}", serde_json::to_string_pretty(&report)?)?;
        }
        Commands::InitProject {
            project,
            client,
            skills,
            mode,
            force,
        } => {
            let cfg = load_app_config()?;
            let report = init_project(
                &project,
                parse_client(&client)?,
                skills,
                parse_init_mode(&mode),
                force,
                &cfg,
            )?;
            writeln!(out, "{}", serde_json::to_string_pretty(&report)?)?;
        }
        Commands::InitMemory {
            project,
            client,
            memory,
            force,
        } => {
            let cfg = load_app_config()?;
            let client = parse_client(&client)?;
            if force {
                init_memory_with_overwrite(&project, client, memory, true, &cfg)?;
            } else {
                let conflicts = init_memory_conflicts(&project, client, memory, &cfg)?;
                if conflicts.is_empty() {
                    init_memory(&project, client, memory, &cfg)?;
                } else {
                    for conflict in &conflicts {
                        if !confirm_overwrite(conflict, input, out)? {
                            return Err(agents_manager_core::CoreError::DestConflict(
                                conflict.clone(),
                            )
                            .into());
                        }
                    }
                    init_memory_with_overwrite(&project, client, memory, true, &cfg)?;
                }
            }
            writeln!(out, "{}", init_memory_success_output())?;
        }
        Commands::MigrateLegacySkills => {
            let mut cfg = load_app_config()?;
            let roots = ClientRoots::detect().ok_or_else(|| {
                std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "could not resolve home directory for client roots",
                )
            })?;
            let report = migrate_legacy_skills(&cfg, &roots)?;
            if !cfg.bootstrap_migration_done {
                cfg.bootstrap_migration_done = true;
                save_app_config(&cfg)?;
            }
            writeln!(out, "{}", serde_json::to_string_pretty(&report)?)?;
        }
    }

    Ok(())
}

fn confirm_overwrite<R: BufRead, W: Write>(
    path: &std::path::Path,
    input: &mut R,
    out: &mut W,
) -> Result<bool, Box<dyn std::error::Error>> {
    loop {
        write!(out, "{} 已存在，是否覆盖？[y/N]: ", path.display())?;
        out.flush()?;

        let mut answer = String::new();
        let bytes = input.read_line(&mut answer)?;
        if bytes == 0 {
            return Ok(false);
        }

        match answer.trim().to_ascii_lowercase().as_str() {
            "y" | "yes" => return Ok(true),
            "" | "n" | "no" => return Ok(false),
            _ => {
                writeln!(out, "请输入 y 或 n。")?;
            }
        }
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    init_config_tree()?;
    let cli = Cli::parse();
    let stdout = std::io::stdout();
    let mut out = stdout.lock();
    execute_command(cli.command, &mut out)
}

#[cfg(test)]
mod tests {
    use std::env;
    use std::fs;
    use std::io::Cursor;
    use std::sync::Mutex;
    use std::time::{SystemTime, UNIX_EPOCH};

    use agents_manager_core::{
        create_memory, create_skill, CreateMemoryRequest, CreateSkillRequest,
    };

    use super::*;

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
                Some(value) => env::set_var(self.key, value),
                None => env::remove_var(self.key),
            }
        }
    }

    struct TestDir {
        path: PathBuf,
    }

    impl TestDir {
        fn new() -> Self {
            let nonce = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos();
            let path = env::temp_dir().join(format!(
                "agents-manager-cli-main-rs-{}-{nonce}",
                std::process::id()
            ));
            fs::create_dir_all(&path).unwrap();
            Self { path }
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    #[test]
    fn init_project_cli_parses_skill_ids() {
        let cli = Cli::try_parse_from([
            "agents-manager",
            "init-project",
            "--client",
            "codex",
            "--skills",
            "1,2,3",
        ])
        .unwrap();

        match cli.command {
            Commands::InitProject {
                project,
                client,
                skills,
                mode,
                force,
            } => {
                assert_eq!(project, PathBuf::from("."));
                assert_eq!(client, "codex");
                assert_eq!(skills, vec![1, 2, 3]);
                assert_eq!(mode, "symlink");
                assert!(!force);
            }
            _ => panic!("expected init-project command"),
        }
    }

    #[test]
    fn init_memory_cli_parses_memory_id_and_client() {
        let cli = Cli::try_parse_from([
            "agents-manager",
            "init-memory",
            "--client",
            "claude",
            "--memory",
            "12",
        ])
        .unwrap();

        match cli.command {
            Commands::InitMemory {
                project,
                client,
                memory,
                force,
            } => {
                assert_eq!(project, PathBuf::from("."));
                assert_eq!(client, "claude");
                assert_eq!(memory, 12);
                assert!(!force);
            }
            _ => panic!("expected init-memory command"),
        }
    }

    #[test]
    fn init_project_command_can_force_overwrite_conflicting_target() {
        let _env_lock = ENV_LOCK.lock().unwrap();
        let tmp = TestDir::new();
        let home = tmp.path.join("home");
        let config_dir = tmp.path.join("config");
        let project = tmp.path.join("project");
        let memory_warehouse = tmp.path.join("memories");
        let skill_warehouse = tmp.path.join("skills");

        fs::create_dir_all(&home).unwrap();
        fs::create_dir_all(&config_dir).unwrap();
        fs::create_dir_all(&project).unwrap();
        fs::create_dir_all(&memory_warehouse).unwrap();
        fs::create_dir_all(&skill_warehouse).unwrap();

        let _home_guard = EnvVarGuard::set("HOME", &home);
        let _config_guard = EnvVarGuard::set("AGENTS_MANAGER_CONFIG_DIR", &config_dir);

        let cfg = AppConfig {
            skill_warehouse,
            memory_warehouse,
            registry_path: tmp.path.join("registry.toml"),
            bootstrap_migration_done: false,
            library_roots: Vec::new(),
            default_profile: Some("claude".into()),
            mcp_disabled_servers: Default::default(),
        };
        save_app_config(&cfg).unwrap();

        let skill = create_skill(
            &cfg,
            CreateSkillRequest {
                id: "alpha".into(),
                name: None,
                description: None,
            },
        )
        .unwrap();

        let target_dir = project.join(".codex/skills/alpha");
        fs::create_dir_all(&target_dir).unwrap();
        fs::write(target_dir.join("stale.txt"), "stale").unwrap();

        let skill_arg = skill.stable_id.to_string();
        let project_arg = project.to_string_lossy().into_owned();
        let cli = Cli::try_parse_from([
            "agents-manager",
            "init-project",
            "--client",
            "codex",
            "--skills",
            skill_arg.as_str(),
            "--project",
            project_arg.as_str(),
            "--force",
        ])
        .unwrap();

        let mut output = Vec::new();
        execute_command(cli.command, &mut output).unwrap();

        assert!(fs::symlink_metadata(&target_dir)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(
            fs::canonicalize(fs::read_link(&target_dir).unwrap()).unwrap(),
            fs::canonicalize(skill.path).unwrap()
        );
    }

    #[test]
    fn init_memory_success_output_is_small_json_payload() {
        assert_eq!(init_memory_success_output(), "{\n  \"status\": \"ok\"\n}");
    }

    #[test]
    fn init_memory_command_executes_and_prints_success_output() {
        let _env_lock = ENV_LOCK.lock().unwrap();
        let tmp = TestDir::new();
        let home = tmp.path.join("home");
        let config_dir = tmp.path.join("config");
        let project = tmp.path.join("project");
        let memory_warehouse = tmp.path.join("memories");
        let skill_warehouse = tmp.path.join("skills");

        fs::create_dir_all(&home).unwrap();
        fs::create_dir_all(&config_dir).unwrap();
        fs::create_dir_all(&project).unwrap();
        fs::create_dir_all(&memory_warehouse).unwrap();
        fs::create_dir_all(&skill_warehouse).unwrap();

        let _home_guard = EnvVarGuard::set("HOME", &home);
        let _config_guard = EnvVarGuard::set("AGENTS_MANAGER_CONFIG_DIR", &config_dir);

        let cfg = AppConfig {
            skill_warehouse,
            memory_warehouse,
            registry_path: tmp.path.join("registry.toml"),
            bootstrap_migration_done: false,
            library_roots: Vec::new(),
            default_profile: Some("claude".into()),
            mcp_disabled_servers: Default::default(),
        };
        save_app_config(&cfg).unwrap();

        let memory = create_memory(&cfg, CreateMemoryRequest { id: "alpha".into() }).unwrap();
        fs::write(&memory.memory_md_path, "remember this").unwrap();

        let memory_arg = memory.stable_id.to_string();
        let project_arg = project.to_string_lossy().into_owned();
        let cli = Cli::try_parse_from([
            "agents-manager",
            "init-memory",
            "--client",
            "claude",
            "--memory",
            memory_arg.as_str(),
            "--project",
            project_arg.as_str(),
        ])
        .unwrap();

        let mut output = Vec::new();
        execute_command(cli.command, &mut output).unwrap();

        let agents = project.join("AGENTS.md");
        let claude = project.join("CLAUDE.md");

        assert!(fs::symlink_metadata(&agents)
            .unwrap()
            .file_type()
            .is_symlink());
        assert!(fs::symlink_metadata(&claude)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(fs::read_link(&agents).unwrap(), memory.memory_md_path);
        assert_eq!(fs::read_link(&claude).unwrap(), PathBuf::from("AGENTS.md"));
        assert_eq!(fs::read_to_string(&claude).unwrap(), "remember this");
        assert_eq!(
            String::from_utf8(output).unwrap(),
            format!("{}\n", init_memory_success_output())
        );
    }

    #[test]
    fn init_memory_command_can_overwrite_conflicting_targets_after_confirmation() {
        let _env_lock = ENV_LOCK.lock().unwrap();
        let tmp = TestDir::new();
        let home = tmp.path.join("home");
        let config_dir = tmp.path.join("config");
        let project = tmp.path.join("project");
        let memory_warehouse = tmp.path.join("memories");
        let skill_warehouse = tmp.path.join("skills");

        fs::create_dir_all(&home).unwrap();
        fs::create_dir_all(&config_dir).unwrap();
        fs::create_dir_all(&project).unwrap();
        fs::create_dir_all(&memory_warehouse).unwrap();
        fs::create_dir_all(&skill_warehouse).unwrap();

        let _home_guard = EnvVarGuard::set("HOME", &home);
        let _config_guard = EnvVarGuard::set("AGENTS_MANAGER_CONFIG_DIR", &config_dir);

        let cfg = AppConfig {
            skill_warehouse,
            memory_warehouse,
            registry_path: tmp.path.join("registry.toml"),
            bootstrap_migration_done: false,
            library_roots: Vec::new(),
            default_profile: Some("claude".into()),
            mcp_disabled_servers: Default::default(),
        };
        save_app_config(&cfg).unwrap();

        let memory = create_memory(&cfg, CreateMemoryRequest { id: "alpha".into() }).unwrap();
        fs::write(&memory.memory_md_path, "remember this").unwrap();
        fs::write(project.join("AGENTS.md"), "old agents").unwrap();
        fs::write(project.join("CLAUDE.md"), "old claude").unwrap();

        let memory_arg = memory.stable_id.to_string();
        let project_arg = project.to_string_lossy().into_owned();
        let cli = Cli::try_parse_from([
            "agents-manager",
            "init-memory",
            "--client",
            "claude",
            "--memory",
            memory_arg.as_str(),
            "--project",
            project_arg.as_str(),
        ])
        .unwrap();

        let mut input = Cursor::new(b"y\ny\n");
        let mut output = Vec::new();
        execute_command_with_input(cli.command, &mut input, &mut output).unwrap();

        let agents = project.join("AGENTS.md");
        let claude = project.join("CLAUDE.md");

        assert!(fs::symlink_metadata(&agents)
            .unwrap()
            .file_type()
            .is_symlink());
        assert!(fs::symlink_metadata(&claude)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(fs::read_link(&agents).unwrap(), memory.memory_md_path);
        assert_eq!(fs::read_link(&claude).unwrap(), PathBuf::from("AGENTS.md"));
        assert_eq!(fs::read_to_string(&claude).unwrap(), "remember this");
    }

    #[test]
    fn init_memory_command_can_force_overwrite_conflicting_targets() {
        let _env_lock = ENV_LOCK.lock().unwrap();
        let tmp = TestDir::new();
        let home = tmp.path.join("home");
        let config_dir = tmp.path.join("config");
        let project = tmp.path.join("project");
        let memory_warehouse = tmp.path.join("memories");
        let skill_warehouse = tmp.path.join("skills");

        fs::create_dir_all(&home).unwrap();
        fs::create_dir_all(&config_dir).unwrap();
        fs::create_dir_all(&project).unwrap();
        fs::create_dir_all(&memory_warehouse).unwrap();
        fs::create_dir_all(&skill_warehouse).unwrap();

        let _home_guard = EnvVarGuard::set("HOME", &home);
        let _config_guard = EnvVarGuard::set("AGENTS_MANAGER_CONFIG_DIR", &config_dir);

        let cfg = AppConfig {
            skill_warehouse,
            memory_warehouse,
            registry_path: tmp.path.join("registry.toml"),
            bootstrap_migration_done: false,
            library_roots: Vec::new(),
            default_profile: Some("claude".into()),
            mcp_disabled_servers: Default::default(),
        };
        save_app_config(&cfg).unwrap();

        let memory = create_memory(&cfg, CreateMemoryRequest { id: "alpha".into() }).unwrap();
        fs::write(&memory.memory_md_path, "remember this").unwrap();
        fs::write(project.join("AGENTS.md"), "old agents").unwrap();
        fs::write(project.join("CLAUDE.md"), "old claude").unwrap();

        let memory_arg = memory.stable_id.to_string();
        let project_arg = project.to_string_lossy().into_owned();
        let cli = Cli::try_parse_from([
            "agents-manager",
            "init-memory",
            "--client",
            "claude",
            "--memory",
            memory_arg.as_str(),
            "--project",
            project_arg.as_str(),
            "--force",
        ])
        .unwrap();

        let mut output = Vec::new();
        execute_command(cli.command, &mut output).unwrap();

        let agents = project.join("AGENTS.md");
        let claude = project.join("CLAUDE.md");

        assert!(fs::symlink_metadata(&agents)
            .unwrap()
            .file_type()
            .is_symlink());
        assert!(fs::symlink_metadata(&claude)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(fs::read_link(&agents).unwrap(), memory.memory_md_path);
        assert_eq!(fs::read_link(&claude).unwrap(), PathBuf::from("AGENTS.md"));
        assert_eq!(fs::read_to_string(&claude).unwrap(), "remember this");
    }

    #[test]
    fn init_memory_command_preserves_conflicting_target_when_overwrite_declined() {
        let _env_lock = ENV_LOCK.lock().unwrap();
        let tmp = TestDir::new();
        let home = tmp.path.join("home");
        let config_dir = tmp.path.join("config");
        let project = tmp.path.join("project");
        let memory_warehouse = tmp.path.join("memories");
        let skill_warehouse = tmp.path.join("skills");

        fs::create_dir_all(&home).unwrap();
        fs::create_dir_all(&config_dir).unwrap();
        fs::create_dir_all(&project).unwrap();
        fs::create_dir_all(&memory_warehouse).unwrap();
        fs::create_dir_all(&skill_warehouse).unwrap();

        let _home_guard = EnvVarGuard::set("HOME", &home);
        let _config_guard = EnvVarGuard::set("AGENTS_MANAGER_CONFIG_DIR", &config_dir);

        let cfg = AppConfig {
            skill_warehouse,
            memory_warehouse,
            registry_path: tmp.path.join("registry.toml"),
            bootstrap_migration_done: false,
            library_roots: Vec::new(),
            default_profile: Some("claude".into()),
            mcp_disabled_servers: Default::default(),
        };
        save_app_config(&cfg).unwrap();

        let memory = create_memory(&cfg, CreateMemoryRequest { id: "alpha".into() }).unwrap();
        fs::write(&memory.memory_md_path, "remember this").unwrap();
        fs::write(project.join("AGENTS.md"), "existing").unwrap();

        let memory_arg = memory.stable_id.to_string();
        let project_arg = project.to_string_lossy().into_owned();
        let cli = Cli::try_parse_from([
            "agents-manager",
            "init-memory",
            "--client",
            "codex",
            "--memory",
            memory_arg.as_str(),
            "--project",
            project_arg.as_str(),
        ])
        .unwrap();

        let mut input = Cursor::new(b"n\n");
        let mut output = Vec::new();
        let err = execute_command_with_input(cli.command, &mut input, &mut output).unwrap_err();

        assert!(err
            .to_string()
            .contains("Destination exists and is not a matching symlink"));
        assert_eq!(
            fs::read_to_string(project.join("AGENTS.md")).unwrap(),
            "existing"
        );
    }

    #[test]
    fn migrate_legacy_skills_cli_parses() {
        let cli = Cli::try_parse_from(["agents-manager", "migrate-legacy-skills"]).unwrap();
        assert!(matches!(cli.command, Commands::MigrateLegacySkills));
    }
}
