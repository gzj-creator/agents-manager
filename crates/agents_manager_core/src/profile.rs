use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::config::profiles_dir;
use crate::error::{CoreError, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub project_skill_root: PathBuf,
    #[serde(default = "default_claude")]
    pub claude_md_target: PathBuf,
    #[serde(default = "default_agents")]
    pub agents_md_target: PathBuf,
}

fn default_claude() -> PathBuf {
    PathBuf::from("CLAUDE.md")
}

fn default_agents() -> PathBuf {
    PathBuf::from("AGENTS.md")
}

pub fn list_profiles() -> Result<Vec<Profile>> {
    let dir = profiles_dir()?;
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut out = Vec::new();
    for ent in fs::read_dir(&dir)? {
        let ent = ent?;
        let path = ent.path();
        if path.extension().map(|e| e == "toml").unwrap_or(false) {
            let s = fs::read_to_string(&path)?;
            let p: Profile = toml::from_str(&s)?;
            out.push(p);
        }
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

pub fn load_profile(id: &str) -> Result<Profile> {
    let path = profiles_dir()?.join(format!("{id}.toml"));
    if !path.exists() {
        return Err(CoreError::ProfileNotFound(id.to_string()));
    }
    let s = fs::read_to_string(&path)?;
    Ok(toml::from_str(&s)?)
}

pub fn save_profile(profile: &Profile) -> Result<()> {
    let dir = profiles_dir()?;
    fs::create_dir_all(&dir)?;
    let path = dir.join(format!("{}.toml", profile.id));
    let s = toml::to_string_pretty(profile)?;
    fs::write(path, s)?;
    Ok(())
}
