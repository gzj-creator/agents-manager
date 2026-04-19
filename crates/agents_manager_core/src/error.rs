use std::path::PathBuf;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("TOML parse error: {0}")]
    TomlParse(#[from] toml::de::Error),
    #[error("TOML serialize error: {0}")]
    TomlSer(#[from] toml::ser::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Config directory could not be determined")]
    NoConfigDir,
    #[error("Profile not found: {0}")]
    ProfileNotFound(String),
    #[error("Skill not found in library: {0}")]
    SkillNotFound(String),
    #[error("Path is not allowed for apply (outside library roots or not a declared source): {0}")]
    PathNotAllowed(PathBuf),
    #[error("Destination exists and is not a matching symlink: {0}")]
    DestConflict(PathBuf),
    #[error("Invalid project root: {0}")]
    InvalidProject(PathBuf),
    #[error("Invalid MCP config: {0}")]
    InvalidMcpConfig(String),
    #[error("Unsupported MCP target: {0}")]
    UnsupportedMcpTarget(String),
}

pub type Result<T> = std::result::Result<T, CoreError>;
