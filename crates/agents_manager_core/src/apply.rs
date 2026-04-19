use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::config::AppConfig;
use crate::error::{CoreError, Result};
use crate::library::{find_skill, scan_library, scan_warehouse, SkillEntry};
use crate::profile::Profile;
use crate::targets::{ClientKind, ClientRoots};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum InstallMode {
    Symlink,
    Copy,
}

#[derive(Debug, Default, Serialize)]
pub struct ApplyReport {
    pub skills_linked: Vec<String>,
    pub skills_skipped_ok: Vec<String>,
    pub claude_md: Option<String>,
    pub agents_md: Option<String>,
    pub warnings: Vec<String>,
}

pub struct ApplySelections {
    pub skill_ids: Vec<String>,
    pub claude_md_source: Option<PathBuf>,
    pub agents_md_source: Option<PathBuf>,
    pub mode: InstallMode,
}

pub struct GlobalSyncRequest {
    pub client: ClientKind,
    pub skill_ids: Vec<u64>,
    pub mode: InstallMode,
}

#[derive(Debug, Default, Serialize)]
pub struct GlobalSyncReport {
    pub synced_skill_ids: Vec<u64>,
    pub invalid_skill_ids: Vec<u64>,
    pub target_root: PathBuf,
}

/// Returns true if `path` is allowed as a symlink/copy source: under one of `library_roots`, or equals `extra_allowed`.
pub fn path_allowed_for_source(
    path: &Path,
    cfg: &AppConfig,
    extra_allowed: &[PathBuf],
) -> Result<bool> {
    let c = match fs::canonicalize(path) {
        Ok(p) => p,
        Err(_) => return Ok(false),
    };
    for ex in extra_allowed {
        if let Ok(e) = fs::canonicalize(ex) {
            if c == e {
                return Ok(true);
            }
        }
    }
    for root in &cfg.library_roots {
        if root.is_dir() {
            if let Ok(r) = fs::canonicalize(root) {
                if c.starts_with(&r) {
                    return Ok(true);
                }
            }
        }
    }
    if cfg.skill_warehouse.is_dir() {
        if let Ok(r) = fs::canonicalize(&cfg.skill_warehouse) {
            if c.starts_with(&r) {
                return Ok(true);
            }
        }
    }
    Ok(false)
}

pub fn apply_to_project(
    project_root: &Path,
    profile: &Profile,
    cfg: &AppConfig,
    selections: &ApplySelections,
) -> Result<ApplyReport> {
    let project_root = fs::canonicalize(project_root)
        .map_err(|_| CoreError::InvalidProject(project_root.to_path_buf()))?;
    if !project_root.is_dir() {
        return Err(CoreError::InvalidProject(project_root.clone()));
    }

    let entries = scan_library(cfg)?;
    let mut report = ApplyReport::default();

    let skill_dest_root = project_root.join(&profile.project_skill_root);
    fs::create_dir_all(&skill_dest_root)?;

    for id in &resolve_skill_ids(selections, &entries)? {
        let entry = find_skill(&entries, id).ok_or_else(|| CoreError::SkillNotFound(id.clone()))?;
        if !path_allowed_for_source(&entry.path, cfg, &[])? {
            return Err(CoreError::PathNotAllowed(entry.path.clone()));
        }
        let dest_dir = skill_dest_root.join(entry.path.file_name().unwrap());
        apply_one_dir(&entry.path, &dest_dir, selections.mode, &mut report, id)?;
    }

    if let Some(ref src) = selections.claude_md_source {
        if !path_allowed_for_source(src, cfg, &[src.clone()])? {
            return Err(CoreError::PathNotAllowed(src.clone()));
        }
        let dest = project_root.join(&profile.claude_md_target);
        apply_one_file(src, &dest, selections.mode)?;
        report.claude_md = Some(dest.display().to_string());
    }

    if let Some(ref src) = selections.agents_md_source {
        if !path_allowed_for_source(src, cfg, &[src.clone()])? {
            return Err(CoreError::PathNotAllowed(src.clone()));
        }
        let dest = project_root.join(&profile.agents_md_target);
        apply_one_file(src, &dest, selections.mode)?;
        report.agents_md = Some(dest.display().to_string());
    }

    Ok(report)
}

pub fn sync_global_skills(
    cfg: &AppConfig,
    roots: &ClientRoots,
    request: &GlobalSyncRequest,
) -> Result<GlobalSyncReport> {
    let entries = scan_warehouse(cfg)?;
    let target_root = roots.global_skill_root(request.client);
    fs::create_dir_all(&target_root)?;

    let mut apply_report = ApplyReport::default();
    let mut report = GlobalSyncReport {
        target_root,
        ..GlobalSyncReport::default()
    };

    for stable_id in &request.skill_ids {
        let Some(entry) = entries.iter().find(|entry| entry.stable_id == *stable_id) else {
            report.invalid_skill_ids.push(*stable_id);
            continue;
        };

        let dest_dir = report
            .target_root
            .join(entry.path.file_name().unwrap_or_default());
        apply_one_dir(
            &entry.path,
            &dest_dir,
            request.mode,
            &mut apply_report,
            &entry.id,
        )?;
        report.synced_skill_ids.push(*stable_id);
    }

    Ok(report)
}

fn resolve_skill_ids(selections: &ApplySelections, entries: &[SkillEntry]) -> Result<Vec<String>> {
    let mut v = Vec::new();
    for id in &selections.skill_ids {
        if find_skill(entries, id).is_some() {
            v.push(id.clone());
        } else {
            return Err(CoreError::SkillNotFound(id.clone()));
        }
    }
    Ok(v)
}

fn apply_one_dir(
    src: &Path,
    dest: &Path,
    mode: InstallMode,
    report: &mut ApplyReport,
    id: &str,
) -> Result<()> {
    let src = fs::canonicalize(src)?;
    match mode {
        InstallMode::Symlink => {
            if dest.exists() || dest.symlink_metadata().is_ok() {
                if let Ok(meta) = fs::symlink_metadata(dest) {
                    if meta.file_type().is_symlink() {
                        if let Ok(t) = fs::read_link(dest) {
                            if fs::canonicalize(&t).ok().as_ref() == Some(&src) {
                                report.skills_skipped_ok.push(id.to_string());
                                return Ok(());
                            }
                        }
                    }
                }
                return Err(CoreError::DestConflict(dest.to_path_buf()));
            }
            #[cfg(unix)]
            {
                std::os::unix::fs::symlink(&src, dest)?;
            }
            #[cfg(not(unix))]
            {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::Unsupported,
                    "symlink requires Unix (macOS/Linux)",
                )
                .into());
            }
            report.skills_linked.push(id.to_string());
        }
        InstallMode::Copy => {
            if dest.exists() {
                return Err(CoreError::DestConflict(dest.to_path_buf()));
            }
            copy_dir_recursive(&src, dest)?;
            report.skills_linked.push(id.to_string());
        }
    }
    Ok(())
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<()> {
    fs::create_dir_all(dest)?;
    for ent in fs::read_dir(src)? {
        let ent = ent?;
        let p = ent.path();
        let name = ent.file_name();
        let out = dest.join(name);
        if p.is_dir() {
            copy_dir_recursive(&p, &out)?;
        } else {
            fs::copy(&p, &out)?;
        }
    }
    Ok(())
}

fn apply_one_file(src: &Path, dest: &Path, mode: InstallMode) -> Result<()> {
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)?;
    }
    let src = fs::canonicalize(src)?;
    match mode {
        InstallMode::Symlink => {
            if dest.exists() || dest.symlink_metadata().is_ok() {
                if let Ok(meta) = fs::symlink_metadata(dest) {
                    if meta.file_type().is_symlink() {
                        if let Ok(t) = fs::read_link(dest) {
                            if fs::canonicalize(&t).ok().as_ref() == Some(&src) {
                                return Ok(());
                            }
                        }
                    }
                }
                return Err(CoreError::DestConflict(dest.to_path_buf()));
            }
            #[cfg(unix)]
            {
                std::os::unix::fs::symlink(&src, dest)?;
            }
            #[cfg(not(unix))]
            {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::Unsupported,
                    "symlink requires Unix",
                )
                .into());
            }
        }
        InstallMode::Copy => {
            if dest.exists() {
                return Err(CoreError::DestConflict(dest.to_path_buf()));
            }
            fs::copy(&src, dest)?;
        }
    }
    Ok(())
}
