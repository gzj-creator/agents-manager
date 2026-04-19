use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::error::{CoreError, Result};

pub const APP_CONFIG_DIR_NAME: &str = "agents-manager";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default = "default_skill_warehouse")]
    pub skill_warehouse: PathBuf,
    #[serde(default = "default_registry_path")]
    pub registry_path: PathBuf,
    #[serde(default)]
    pub bootstrap_migration_done: bool,
    #[serde(default)]
    pub library_roots: Vec<PathBuf>,
    #[serde(default)]
    pub default_profile: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            skill_warehouse: default_skill_warehouse(),
            registry_path: default_registry_path(),
            bootstrap_migration_done: false,
            library_roots: Vec::new(),
            default_profile: Some("claude".to_string()),
        }
    }
}

fn app_home_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".agents-manager")
}

fn default_skill_warehouse() -> PathBuf {
    app_home_dir().join("skills")
}

fn default_registry_path() -> PathBuf {
    app_home_dir().join("registry.toml")
}

pub fn config_dir() -> Result<PathBuf> {
    if let Some(p) = std::env::var_os("AGENTS_MANAGER_CONFIG_DIR") {
        if !p.is_empty() {
            return Ok(PathBuf::from(p));
        }
    }
    dirs::config_dir()
        .map(|p| p.join(APP_CONFIG_DIR_NAME))
        .ok_or(CoreError::NoConfigDir)
}

pub fn config_file_path() -> Result<PathBuf> {
    Ok(config_dir()?.join("config.toml"))
}

pub fn profiles_dir() -> Result<PathBuf> {
    Ok(config_dir()?.join("profiles"))
}

fn init_dirs() -> Result<()> {
    fs::create_dir_all(config_dir()?)?;
    fs::create_dir_all(profiles_dir()?)?;
    fs::create_dir_all(app_home_dir())?;
    fs::create_dir_all(default_skill_warehouse())?;
    Ok(())
}

pub fn write_default_profiles_if_missing() -> Result<()> {
    let dir = profiles_dir()?;
    fs::create_dir_all(&dir)?;
    for (name, content) in default_profile_files() {
        let p = dir.join(format!("{name}.toml"));
        if !p.exists() {
            fs::write(p, content)?;
        }
    }
    Ok(())
}

fn default_profile_files() -> [(&'static str, &'static str); 3] {
    [
        (
            "claude",
            r#"# Claude Code style — adjust paths if your toolchain differs
id = "claude"
project_skill_root = ".claude/skills"
claude_md_target = "CLAUDE.md"
agents_md_target = "AGENTS.md"
"#,
        ),
        (
            "cursor",
            r#"# Cursor — project-local skills mirror
id = "cursor"
project_skill_root = ".cursor/skills"
claude_md_target = "CLAUDE.md"
agents_md_target = "AGENTS.md"
"#,
        ),
        (
            "codex",
            r#"# Codex / OpenAI Codex CLI style
id = "codex"
project_skill_root = ".codex/skills"
claude_md_target = "CLAUDE.md"
agents_md_target = "AGENTS.md"
"#,
        ),
    ]
}

pub fn load_app_config() -> Result<AppConfig> {
    init_dirs()?;
    write_default_profiles_if_missing()?;
    let path = config_file_path()?;
    if !path.exists() {
        let cfg = AppConfig::default();
        let s = toml::to_string_pretty(&cfg)?;
        fs::write(&path, s)?;
        return Ok(cfg);
    }
    let s = fs::read_to_string(&path)?;
    let mut cfg: AppConfig = toml::from_str(&s)?;
    if cfg.skill_warehouse.as_os_str().is_empty() {
        cfg.skill_warehouse = default_skill_warehouse();
    }
    if cfg.registry_path.as_os_str().is_empty() {
        cfg.registry_path = default_registry_path();
    }
    fs::create_dir_all(&cfg.skill_warehouse)?;
    Ok(cfg)
}

pub fn save_app_config(cfg: &AppConfig) -> Result<()> {
    init_dirs()?;
    fs::create_dir_all(&cfg.skill_warehouse)?;
    let path = config_file_path()?;
    let s = toml::to_string_pretty(cfg)?;
    fs::write(path, s)?;
    Ok(())
}

pub fn init_config_tree() -> Result<()> {
    load_app_config().map(|_| ())
}
