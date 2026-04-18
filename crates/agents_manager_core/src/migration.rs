use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use sha2::{Digest, Sha256};
use walkdir::WalkDir;

use crate::config::AppConfig;
use crate::error::Result;
use crate::library::scan_warehouse;
use crate::registry::{load_skill_registry, save_skill_registry};
use crate::targets::{ClientKind, ClientRoots};

#[derive(Debug, Default, Clone, Serialize, PartialEq, Eq)]
pub struct MigrationReport {
    pub imported: usize,
    pub overwritten: usize,
    pub skipped: usize,
    pub removed: usize,
}

pub fn bootstrap_legacy_migration(
    cfg: &mut AppConfig,
    roots: &ClientRoots,
) -> Result<MigrationReport> {
    if cfg.bootstrap_migration_done {
        return Ok(MigrationReport::default());
    }

    let report = migrate_legacy_skills(cfg, roots)?;
    cfg.bootstrap_migration_done = true;
    Ok(report)
}

pub fn migrate_legacy_skills(cfg: &AppConfig, roots: &ClientRoots) -> Result<MigrationReport> {
    fs::create_dir_all(&cfg.skill_warehouse)?;

    let mut report = MigrationReport::default();
    let mut source_hints = HashMap::new();

    for (client, label) in [
        (ClientKind::Codex, "codex"),
        (ClientKind::Claude, "claude"),
    ] {
        let source_root = roots.global_skill_root(client);
        if !source_root.is_dir() {
            continue;
        }

        let mut skill_dirs = collect_skill_dirs(&source_root)?;
        skill_dirs.sort();

        for source_dir in skill_dirs {
            let Some(name) = source_dir.file_name() else {
                continue;
            };
            let dest_dir = cfg.skill_warehouse.join(name);

            if dest_dir.exists() {
                if dirs_equal(&source_dir, &dest_dir)? {
                    fs::remove_dir_all(&source_dir)?;
                    report.skipped += 1;
                    report.removed += 1;
                    continue;
                }

                fs::remove_dir_all(&dest_dir)?;
                report.overwritten += 1;
            }

            fs::rename(&source_dir, &dest_dir)?;
            report.imported += 1;
            source_hints.insert(dest_dir, label.to_string());
        }
    }

    if !source_hints.is_empty() {
        let _ = scan_warehouse(cfg)?;
        let mut registry = load_skill_registry(cfg)?;
        for skill in &mut registry.skills {
            if let Some(source_hint) = source_hints.get(&skill.path) {
                skill.source_hint = Some(source_hint.clone());
            }
        }
        save_skill_registry(cfg, &registry)?;
    }

    Ok(report)
}

fn collect_skill_dirs(root: &Path) -> Result<Vec<PathBuf>> {
    let mut out = Vec::new();
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() && path.join("SKILL.md").is_file() {
            out.push(path);
        }
    }
    Ok(out)
}

fn dirs_equal(left: &Path, right: &Path) -> Result<bool> {
    Ok(dir_digest(left)? == dir_digest(right)?)
}

fn dir_digest(root: &Path) -> Result<String> {
    let mut hasher = Sha256::new();
    let mut files = Vec::new();

    for entry in WalkDir::new(root).into_iter().filter_map(|entry| entry.ok()) {
        if entry.file_type().is_file() {
            files.push(entry.into_path());
        }
    }

    files.sort();

    for file in files {
        let relative = file
            .strip_prefix(root)
            .unwrap_or(&file)
            .to_string_lossy()
            .into_owned();
        hasher.update(relative.as_bytes());
        hasher.update([0]);
        hasher.update(fs::read(&file)?);
        hasher.update([0xff]);
    }

    Ok(hex::encode(hasher.finalize()))
}
