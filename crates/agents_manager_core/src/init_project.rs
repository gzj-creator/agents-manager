use std::fs;
use std::path::Path;

use serde::Serialize;

use crate::apply::InstallMode;
use crate::error::{CoreError, Result};
use crate::library::scan_warehouse;
use crate::targets::ClientKind;
use crate::AppConfig;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum InitMode {
    Symlink,
    Copy,
}

#[derive(Debug, Default, Clone, Serialize, PartialEq, Eq)]
pub struct InitProjectReport {
    pub initialized_skill_ids: Vec<u64>,
    pub invalid_skill_ids: Vec<u64>,
}

pub fn init_project(
    project_root: &Path,
    client: ClientKind,
    skill_ids: Vec<u64>,
    mode: InitMode,
    cfg: &AppConfig,
) -> Result<InitProjectReport> {
    let project_root = fs::canonicalize(project_root)
        .map_err(|_| CoreError::InvalidProject(project_root.to_path_buf()))?;
    if !project_root.is_dir() {
        return Err(CoreError::InvalidProject(project_root));
    }

    let entries = scan_warehouse(cfg)?;
    let (skill_root, memory_file) = project_layout(client);
    let target_root = project_root.join(skill_root);
    fs::create_dir_all(&target_root)?;

    let memory_path = project_root.join(memory_file);
    if !memory_path.exists() {
        fs::write(&memory_path, "")?;
    }

    let mut report = InitProjectReport::default();
    for skill_id in skill_ids {
        let Some(entry) = entries.iter().find(|entry| entry.stable_id == skill_id) else {
            report.invalid_skill_ids.push(skill_id);
            continue;
        };

        let dest_dir = target_root.join(entry.path.file_name().unwrap_or_default());
        install_dir(&entry.path, &dest_dir, mode)?;
        report.initialized_skill_ids.push(skill_id);
    }

    Ok(report)
}

pub fn generate_init_project_command(
    client: ClientKind,
    skill_ids: &[u64],
    mode: Option<&str>,
) -> String {
    let joined_ids = skill_ids
        .iter()
        .map(u64::to_string)
        .collect::<Vec<_>>()
        .join(",");
    let mut command = format!(
        "agents-manager init-project --client {} --skills {}",
        client_name(client),
        joined_ids
    );
    if matches!(mode, Some("copy")) {
        command.push_str(" --mode copy");
    }
    command
}

fn project_layout(client: ClientKind) -> (&'static str, &'static str) {
    match client {
        ClientKind::Codex => (".codex/skills", "AGENTS.md"),
        ClientKind::Claude => (".claude/skills", "CLAUDE.md"),
        ClientKind::Cursor => (".cursor/skills", "AGENTS.md"),
    }
}

fn client_name(client: ClientKind) -> &'static str {
    match client {
        ClientKind::Codex => "codex",
        ClientKind::Claude => "claude",
        ClientKind::Cursor => "cursor",
    }
}

fn install_dir(src: &Path, dest: &Path, mode: InitMode) -> Result<()> {
    let src = fs::canonicalize(src)?;
    match mode {
        InitMode::Symlink => {
            if dest.exists() || dest.symlink_metadata().is_ok() {
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
        }
        InitMode::Copy => {
            if dest.exists() {
                return Err(CoreError::DestConflict(dest.to_path_buf()));
            }
            copy_dir_recursive(&src, dest)?;
        }
    }
    Ok(())
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<()> {
    fs::create_dir_all(dest)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let out = dest.join(entry.file_name());
        if path.is_dir() {
            copy_dir_recursive(&path, &out)?;
        } else {
            fs::copy(&path, &out)?;
        }
    }
    Ok(())
}

impl From<InitMode> for InstallMode {
    fn from(value: InitMode) -> Self {
        match value {
            InitMode::Symlink => InstallMode::Symlink,
            InitMode::Copy => InstallMode::Copy,
        }
    }
}
