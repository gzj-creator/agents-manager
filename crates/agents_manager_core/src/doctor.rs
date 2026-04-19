use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::apply::path_allowed_for_source;
use crate::config::AppConfig;
use crate::error::Result;
use crate::profile::Profile;

#[derive(Debug, Serialize)]
pub struct DoctorReport {
    pub project_root: PathBuf,
    pub broken_symlinks: Vec<PathBuf>,
    pub policy_warnings: Vec<PolicyWarning>,
    pub ok: bool,
}

#[derive(Debug, Serialize)]
pub struct PolicyWarning {
    pub path: PathBuf,
    pub detail: String,
}

pub fn doctor(project_root: &Path, profile: &Profile, cfg: &AppConfig) -> Result<DoctorReport> {
    let project_root = fs::canonicalize(project_root)?;
    let mut broken = Vec::new();
    let mut policy_warnings = Vec::new();

    let skill_root = project_root.join(&profile.project_skill_root);
    if skill_root.is_dir() {
        walk_skill_tree(&skill_root, cfg, &mut broken, &mut policy_warnings)?;
    }

    for rel in [
        profile.claude_md_target.clone(),
        profile.agents_md_target.clone(),
    ] {
        let p = project_root.join(&rel);
        check_symlink_exists_only(&p, &mut broken)?;
    }

    let ok = broken.is_empty();
    Ok(DoctorReport {
        project_root,
        broken_symlinks: broken,
        policy_warnings,
        ok,
    })
}

fn check_symlink_exists_only(path: &Path, broken: &mut Vec<PathBuf>) -> Result<()> {
    let meta = match fs::symlink_metadata(path) {
        Ok(m) => m,
        Err(_) => return Ok(()),
    };
    if !meta.file_type().is_symlink() {
        return Ok(());
    }
    if let Ok(t) = fs::read_link(path) {
        let resolved = path.parent().map(|p| p.join(&t)).unwrap_or(t);
        if !resolved.exists() {
            broken.push(path.to_path_buf());
        }
    }
    Ok(())
}

fn walk_skill_tree(
    dir: &Path,
    cfg: &AppConfig,
    broken: &mut Vec<PathBuf>,
    policy_warnings: &mut Vec<PolicyWarning>,
) -> Result<()> {
    for ent in fs::read_dir(dir)? {
        let path = ent?.path();
        let meta = match fs::symlink_metadata(&path) {
            Ok(m) => m,
            Err(_) => continue,
        };
        if meta.file_type().is_symlink() {
            if let Ok(t) = fs::read_link(&path) {
                let resolved = path.parent().map(|p| p.join(&t)).unwrap_or(t);
                if !resolved.exists() {
                    broken.push(path.clone());
                } else if !path_allowed_for_source(&resolved, cfg, &[])? {
                    policy_warnings.push(PolicyWarning {
                        path: path.clone(),
                        detail: "skill symlink target is not under configured library_roots".into(),
                    });
                }
            }
        } else if path.is_dir() {
            walk_skill_tree(&path, cfg, broken, policy_warnings)?;
        }
    }
    Ok(())
}
