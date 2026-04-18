use std::path::PathBuf;

use agents_manager_core::{
    apply_to_project, doctor, init_config_tree, list_profiles, load_app_config, load_profile,
    save_app_config, save_profile, scan_library, AppConfig, ApplySelections, InstallMode, Profile,
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

fn main() -> Result<(), Box<dyn std::error::Error>> {
    init_config_tree()?;
    let cli = Cli::parse();

    match cli.command {
        Commands::Library { command } => {
            let cfg = load_app_config()?;
            match command {
                LibrarySub::Scan => {
                    let entries = scan_library(&cfg)?;
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
    }

    Ok(())
}
