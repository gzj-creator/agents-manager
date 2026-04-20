use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use sha2::{Digest, Sha256};
use walkdir::{DirEntry, WalkDir};

use crate::config::AppConfig;
use crate::error::Result;
use crate::library::scan_warehouse;
use crate::registry::{load_skill_registry, save_skill_registry};

#[derive(Debug, Default, Clone, Serialize, PartialEq, Eq)]
pub struct GitImportReport {
    pub repo_url: String,
    pub discovered: usize,
    pub imported: usize,
    pub skipped: usize,
    pub conflicts: usize,
    pub details: Vec<GitImportDetail>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct GitImportDetail {
    pub relative_path: String,
    pub destination_id: String,
    pub status: String,
}

pub fn import_git_skills(cfg: &AppConfig, repo_url: &str) -> Result<GitImportReport> {
    fs::create_dir_all(&cfg.skill_warehouse)?;

    let checkout = TempCheckout::new()?;
    clone_repo(repo_url, checkout.path())?;

    let discovered = discover_repo_skills(checkout.path())?;
    let mut report = GitImportReport {
        repo_url: repo_url.to_string(),
        discovered: discovered.len(),
        ..GitImportReport::default()
    };
    let mut imported_source_hints = Vec::new();

    for relative_path in discovered {
        let source_dir = checkout.path().join(&relative_path);
        let destination_id = flatten_relative_path(&relative_path);
        let destination_dir = cfg.skill_warehouse.join(&destination_id);
        let relative_text = relative_path.to_string_lossy().into_owned();

        if destination_dir.exists() {
            if dir_digest(&source_dir)? == dir_digest(&destination_dir)? {
                report.skipped += 1;
                report.details.push(GitImportDetail {
                    relative_path: relative_text,
                    destination_id,
                    status: "skipped".into(),
                });
                continue;
            }

            report.conflicts += 1;
            report.details.push(GitImportDetail {
                relative_path: relative_text,
                destination_id,
                status: "conflict".into(),
            });
            continue;
        }

        copy_dir_all(&source_dir, &destination_dir)?;
        imported_source_hints.push((destination_dir, format!("git:{repo_url}#{relative_text}")));
        report.imported += 1;
        report.details.push(GitImportDetail {
            relative_path: relative_text,
            destination_id,
            status: "imported".into(),
        });
    }

    if !imported_source_hints.is_empty() {
        let _ = scan_warehouse(cfg)?;
        let mut registry = load_skill_registry(cfg)?;
        for skill in &mut registry.skills {
            if let Some((_, source_hint)) = imported_source_hints
                .iter()
                .find(|(path, _)| *path == skill.path)
            {
                skill.source_hint = Some(source_hint.clone());
            }
        }
        save_skill_registry(cfg, &registry)?;
    }

    Ok(report)
}

fn clone_repo(repo_url: &str, destination: &Path) -> Result<()> {
    let output = Command::new("git")
        .args(["clone", "--quiet", repo_url])
        .arg(destination)
        .output()?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(std::io::Error::other(format!("git clone failed: {stderr}")).into())
}

fn discover_repo_skills(root: &Path) -> Result<Vec<PathBuf>> {
    let mut discovered = Vec::new();

    for entry in WalkDir::new(root)
        .into_iter()
        .filter_entry(|entry| !is_git_dir(entry))
        .filter_map(|entry| entry.ok())
    {
        if !entry.file_type().is_file() || entry.file_name() != "SKILL.md" {
            continue;
        }

        let Some(parent) = entry.path().parent() else {
            continue;
        };
        if let Ok(relative) = parent.strip_prefix(root) {
            discovered.push(relative.to_path_buf());
        }
    }

    discovered.sort();
    Ok(discovered)
}

fn flatten_relative_path(path: &Path) -> String {
    let parts: Vec<String> = path
        .components()
        .filter_map(|component| match component {
            std::path::Component::Normal(part) => Some(part.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect();

    if parts.is_empty() {
        "imported-skill".to_string()
    } else {
        parts.join("-")
    }
}

fn copy_dir_all(source: &Path, destination: &Path) -> Result<()> {
    fs::create_dir_all(destination)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        let metadata = entry.metadata()?;
        if metadata.is_dir() {
            copy_dir_all(&source_path, &destination_path)?;
        } else {
            fs::copy(&source_path, &destination_path)?;
        }
    }
    Ok(())
}

fn dir_digest(root: &Path) -> Result<String> {
    let mut hasher = Sha256::new();
    let mut files = Vec::new();

    for entry in WalkDir::new(root)
        .into_iter()
        .filter_map(|entry| entry.ok())
    {
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

fn is_git_dir(entry: &DirEntry) -> bool {
    entry.file_type().is_dir() && entry.file_name() == ".git"
}

struct TempCheckout {
    path: PathBuf,
}

impl TempCheckout {
    fn new() -> Result<Self> {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "agents-manager-import-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&path)?;
        Ok(Self { path })
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TempCheckout {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}
