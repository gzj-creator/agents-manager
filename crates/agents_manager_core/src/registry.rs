use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::config::AppConfig;
use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RegistrySkill {
    pub stable_id: u64,
    pub id: String,
    pub path: PathBuf,
    #[serde(default = "default_true")]
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SkillRegistry {
    #[serde(default = "default_next_id")]
    pub next_id: u64,
    #[serde(default)]
    pub skills: Vec<RegistrySkill>,
}

impl Default for SkillRegistry {
    fn default() -> Self {
        Self {
            next_id: 1,
            skills: Vec::new(),
        }
    }
}

fn default_next_id() -> u64 {
    1
}

fn default_true() -> bool {
    true
}

pub fn load_skill_registry(cfg: &AppConfig) -> Result<SkillRegistry> {
    if !cfg.registry_path.exists() {
        return Ok(SkillRegistry::default());
    }

    let raw = fs::read_to_string(&cfg.registry_path)?;
    Ok(toml::from_str(&raw)?)
}

pub fn save_skill_registry(cfg: &AppConfig, registry: &SkillRegistry) -> Result<()> {
    if let Some(parent) = cfg.registry_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let raw = toml::to_string_pretty(registry)?;
    fs::write(&cfg.registry_path, raw)?;
    Ok(())
}

pub fn reconcile_registry(
    cfg: &AppConfig,
    discovered: &[(String, PathBuf)],
) -> Result<SkillRegistry> {
    let mut registry = load_skill_registry(cfg)?;

    for skill in &mut registry.skills {
        skill.active = false;
    }

    for (id, path) in discovered {
        if let Some(existing) = registry.skills.iter_mut().find(|skill| skill.path == *path) {
            existing.id = id.clone();
            existing.path = path.clone();
            existing.active = true;
            continue;
        }

        registry.skills.push(RegistrySkill {
            stable_id: registry.next_id,
            id: id.clone(),
            path: path.clone(),
            active: true,
        });
        registry.next_id += 1;
    }

    registry
        .skills
        .sort_by(|left, right| left.stable_id.cmp(&right.stable_id));
    save_skill_registry(cfg, &registry)?;
    Ok(registry)
}
