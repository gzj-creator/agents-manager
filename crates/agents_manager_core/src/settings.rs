use std::fs;
use std::path::PathBuf;

use crate::{AppConfig, Result};

#[derive(Debug, Clone)]
pub struct EditableSettingsUpdate {
    pub warehouse_home: Option<PathBuf>,
    pub library_roots: Option<Vec<PathBuf>>,
}

pub fn warehouse_home_from_config(cfg: &AppConfig) -> PathBuf {
    if cfg
        .skill_warehouse
        .file_name()
        .is_some_and(|name| name == "skills")
    {
        return cfg
            .skill_warehouse
            .parent()
            .map(PathBuf::from)
            .unwrap_or_else(|| cfg.skill_warehouse.clone());
    }

    cfg.skill_warehouse.clone()
}

pub fn update_editable_settings(
    cfg: &AppConfig,
    update: EditableSettingsUpdate,
) -> Result<AppConfig> {
    let mut next = cfg.clone();

    if let Some(warehouse_home) = update.warehouse_home {
        next.skill_warehouse = warehouse_home.join("skills");
        next.memory_warehouse = warehouse_home.join("memories");
        next.plugin_warehouse = warehouse_home.join("plugins");
        next.registry_path = warehouse_home.join("registry.toml");
    }
    if let Some(library_roots) = update.library_roots {
        next.library_roots = library_roots;
    }

    // Ensure the configured warehouses exist before persisting.
    fs::create_dir_all(&next.skill_warehouse)?;
    fs::create_dir_all(&next.memory_warehouse)?;
    fs::create_dir_all(&next.plugin_warehouse)?;

    // Persist updated config to config.toml (location can be overridden for tests).
    let path = crate::config::config_file_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let s = toml::to_string_pretty(&next)?;
    fs::write(path, s)?;

    Ok(next)
}
