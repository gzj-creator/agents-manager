use std::path::PathBuf;

use agents_manager_core::{
    apply_to_project, doctor, init_config_tree, init_project, list_profiles, load_app_config,
    load_profile, migrate_legacy_skills, save_app_config, save_profile, scan_warehouse, AppConfig,
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

fn main() -> Result<(), Box<dyn std::error::Error>> {
    init_config_tree()?;
    let cli = Cli::parse();

    match cli.command {
        Commands::Library { command } => {
            let cfg = load_app_config()?;
            match command {
                LibrarySub::Scan => {
                    let entries = scan_warehouse(&cfg)?;
                    println!("{}", serde_json::to_string_pretty(&entries)?);
                }
                LibrarySub::Paths => {
                    println!("{}", serde_json::to_string_pretty(&cfg.library_roots)?);
                }
            }
        }
        Commands::Profile { command } => match command {
            ProfileSub::List => {
                let profiles = list_profiles()?;
                println!("{}", serde_json::to_string_pretty(&profiles)?);
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
                println!("{}", serde_json::to_string_pretty(&p)?);
            }
        },
        Commands::Config { command } => match command {
            ConfigSub::Show => {
                let cfg = load_app_config()?;
                println!("{}", serde_json::to_string_pretty(&cfg)?);
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
                println!("{}", serde_json::to_string_pretty(&saved)?);
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
            println!("{}", serde_json::to_string_pretty(&report)?);
        }
        Commands::Doctor { project, profile } => {
            let cfg = load_app_config()?;
            let profile = load_profile(&profile)?;
            let report = doctor(&project, &profile, &cfg)?;
            println!("{}", serde_json::to_string_pretty(&report)?);
        }
        Commands::InitProject {
            project,
            client,
            skills,
            mode,
        } => {
            let cfg = load_app_config()?;
            let report = init_project(
                &project,
                parse_client(&client)?,
                skills,
                parse_init_mode(&mode),
                &cfg,
            )?;
            println!("{}", serde_json::to_string_pretty(&report)?);
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
            println!("{}", serde_json::to_string_pretty(&report)?);
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

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
            } => {
                assert_eq!(project, PathBuf::from("."));
                assert_eq!(client, "codex");
                assert_eq!(skills, vec![1, 2, 3]);
                assert_eq!(mode, "symlink");
            }
            _ => panic!("expected init-project command"),
        }
    }

    #[test]
    fn migrate_legacy_skills_cli_parses() {
        let cli = Cli::try_parse_from(["agents-manager", "migrate-legacy-skills"]).unwrap();
        assert!(matches!(cli.command, Commands::MigrateLegacySkills));
    }
}
