use std::fs;
use std::path::PathBuf;

use crate::{AppConfig, Result};

#[derive(Debug, Clone)]
pub struct EditableSettingsUpdate {
    pub skill_warehouse: Option<PathBuf>,
    pub library_roots: Option<Vec<PathBuf>>,
}

pub fn update_editable_settings(
    cfg: &AppConfig,
    update: EditableSettingsUpdate,
) -> Result<AppConfig> {
    let mut next = cfg.clone();

    if let Some(skill_warehouse) = update.skill_warehouse {
        next.skill_warehouse = skill_warehouse;
    }
    if let Some(library_roots) = update.library_roots {
        next.library_roots = library_roots;
    }

    // Ensure the configured warehouse exists before persisting.
    fs::create_dir_all(&next.skill_warehouse)?;

    // Persist updated config to config.toml (location can be overridden for tests).
    let path = crate::config::config_file_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let s = toml::to_string_pretty(&next)?;
    fs::write(path, s)?;

    Ok(next)
}
