use std::fs;
use std::io;

use crate::{scan_warehouse, AppConfig, Result, SkillEntry};

pub struct CreateSkillRequest {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
}

pub fn create_skill(cfg: &AppConfig, req: CreateSkillRequest) -> Result<SkillEntry> {
    let skill_id = sanitize_skill_id(&req.id)?;
    let skill_dir = cfg.skill_warehouse.join(&skill_id);

    // Ensure the warehouse root exists, but rely on OS-enforced non-clobber operations for
    // the skill directory itself.
    fs::create_dir_all(&cfg.skill_warehouse)?;
    fs::create_dir(&skill_dir)?;

    scan_warehouse(cfg)?
        .into_iter()
        .find(|entry| entry.id == skill_id)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "created skill not found").into())
}

fn sanitize_skill_id(id: &str) -> Result<String> {
    let trimmed = id.trim();
    if trimmed.is_empty() {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "skill id is empty").into());
    }
    if trimmed.contains('/') || trimmed.contains('\\') || trimmed == "." || trimmed == ".." {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "skill id is not a simple directory name",
        )
        .into());
    }
    Ok(trimmed.to_string())
}
