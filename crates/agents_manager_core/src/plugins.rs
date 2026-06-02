use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::{AppConfig, CoreError, InitMode, Result};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct PluginEntry {
    pub id: String,
    pub path: PathBuf,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct DroppedPluginPreview {
    pub id: String,
    pub command_count: usize,
    pub agent_count: usize,
    pub skill_count: usize,
}

#[derive(Debug, Default, Clone, Serialize, PartialEq, Eq)]
pub struct PluginInstallReport {
    pub installed_commands: Vec<String>,
    pub installed_agents: Vec<String>,
    pub installed_skills: Vec<String>,
}

pub fn preview_dropped_plugin(source: &Path) -> Result<DroppedPluginPreview> {
    let bundle = resolve_dropped_plugin_bundle(source)?;
    let id = plugin_id_from_dir(bundle)?;
    let summary = summarize_plugin_bundle(bundle)?;

    Ok(DroppedPluginPreview {
        id,
        command_count: summary.command_count,
        agent_count: summary.agent_count,
        skill_count: summary.skill_count,
    })
}

pub fn import_dropped_plugin(cfg: &AppConfig, source: &Path) -> Result<PluginEntry> {
    let bundle = resolve_dropped_plugin_bundle(source)?;
    let id = plugin_id_from_dir(bundle)?;
    let destination = cfg.plugin_warehouse.join(&id);

    fs::create_dir_all(&cfg.plugin_warehouse)?;
    fs::create_dir(&destination)?;
    copy_dir_contents(bundle, &destination)?;

    Ok(PluginEntry {
        id,
        path: destination,
    })
}

pub fn scan_plugin_warehouse(cfg: &AppConfig) -> Result<Vec<PluginEntry>> {
    if !cfg.plugin_warehouse.exists() {
        return Ok(Vec::new());
    }

    let mut entries = Vec::new();
    for entry in fs::read_dir(&cfg.plugin_warehouse)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_dir() || summarize_plugin_bundle(&path).is_err() {
            continue;
        }
        let id = plugin_id_from_dir(&path)?;
        entries.push(PluginEntry { id, path });
    }
    entries.sort_by(|left, right| left.id.cmp(&right.id));
    Ok(entries)
}

pub fn init_claude_plugin(
    project_root: &Path,
    plugin_id: &str,
    mode: InitMode,
    force: bool,
    cfg: &AppConfig,
) -> Result<PluginInstallReport> {
    let project_root = fs::canonicalize(project_root)
        .map_err(|_| CoreError::InvalidProject(project_root.to_path_buf()))?;
    if !project_root.is_dir() {
        return Err(CoreError::InvalidProject(project_root));
    }

    let plugin_id = sanitize_plugin_id(plugin_id)?;
    let plugin_dir = cfg.plugin_warehouse.join(&plugin_id);
    if !plugin_dir.is_dir() {
        return Err(io::Error::new(io::ErrorKind::NotFound, "plugin not found").into());
    }
    summarize_plugin_bundle(&plugin_dir)?;

    let mut report = PluginInstallReport::default();
    install_markdown_files(
        &plugin_dir.join("commands"),
        &project_root.join(".claude").join("commands"),
        mode,
        force,
        &mut report.installed_commands,
    )?;
    install_markdown_files(
        &plugin_dir.join("agents"),
        &project_root.join(".claude").join("agents"),
        mode,
        force,
        &mut report.installed_agents,
    )?;
    install_skill_dirs(
        &plugin_dir.join("skills"),
        &project_root.join(".claude").join("skills"),
        mode,
        force,
        &mut report.installed_skills,
    )?;

    Ok(report)
}

struct PluginBundleSummary {
    command_count: usize,
    agent_count: usize,
    skill_count: usize,
}

fn resolve_dropped_plugin_bundle(source: &Path) -> Result<&Path> {
    if !source.is_dir() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "drop a Claude plugin bundle directory",
        )
        .into());
    }

    summarize_plugin_bundle(source)?;
    Ok(source)
}

fn summarize_plugin_bundle(source: &Path) -> Result<PluginBundleSummary> {
    let summary = PluginBundleSummary {
        command_count: count_markdown_files(&source.join("commands"))?,
        agent_count: count_markdown_files(&source.join("agents"))?,
        skill_count: count_skill_dirs(&source.join("skills"))?,
    };

    if summary.command_count == 0 && summary.agent_count == 0 && summary.skill_count == 0 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "drop a Claude plugin bundle directory",
        )
        .into());
    }

    Ok(summary)
}

fn count_markdown_files(dir: &Path) -> Result<usize> {
    if !dir.exists() {
        return Ok(0);
    }
    if !dir.is_dir() {
        return Ok(0);
    }

    let mut count = 0;
    for entry in fs::read_dir(dir)? {
        let path = entry?.path();
        if path.is_file()
            && path
                .extension()
                .map(|extension| extension.eq_ignore_ascii_case("md"))
                .unwrap_or(false)
        {
            count += 1;
        }
    }
    Ok(count)
}

fn count_skill_dirs(dir: &Path) -> Result<usize> {
    if !dir.exists() {
        return Ok(0);
    }
    if !dir.is_dir() {
        return Ok(0);
    }

    let mut count = 0;
    for entry in fs::read_dir(dir)? {
        let path = entry?.path();
        if path.is_dir() && path.join("SKILL.md").is_file() {
            count += 1;
        }
    }
    Ok(count)
}

fn plugin_id_from_dir(dir: &Path) -> Result<String> {
    let id = dir
        .file_name()
        .map(|name| name.to_string_lossy().into_owned());
    sanitize_plugin_id(id.as_deref().unwrap_or(""))
}

fn sanitize_plugin_id(id: &str) -> Result<String> {
    let trimmed = id.trim();
    if trimmed.is_empty() {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "plugin id is empty").into());
    }
    if trimmed.contains('/') || trimmed.contains('\\') || trimmed == "." || trimmed == ".." {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "plugin id is not a simple directory name",
        )
        .into());
    }
    Ok(trimmed.to_string())
}

fn copy_dir_contents(from: &Path, to: &Path) -> Result<()> {
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let source_path = entry.path();
        let destination_path = to.join(entry.file_name());
        let metadata = entry.metadata()?;

        if metadata.is_dir() {
            fs::create_dir_all(&destination_path)?;
            copy_dir_contents(&source_path, &destination_path)?;
        } else {
            fs::copy(&source_path, &destination_path)?;
        }
    }

    Ok(())
}

fn install_markdown_files(
    source_dir: &Path,
    target_dir: &Path,
    mode: InitMode,
    force: bool,
    installed: &mut Vec<String>,
) -> Result<()> {
    if !source_dir.is_dir() {
        return Ok(());
    }
    fs::create_dir_all(target_dir)?;

    let mut files = markdown_files(source_dir)?;
    files.sort();
    for source in files {
        let file_name = source
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "file has no name"))?;
        install_path(&source, &target_dir.join(&file_name), mode, force)?;
        installed.push(file_name);
    }

    Ok(())
}

fn install_skill_dirs(
    source_dir: &Path,
    target_dir: &Path,
    mode: InitMode,
    force: bool,
    installed: &mut Vec<String>,
) -> Result<()> {
    if !source_dir.is_dir() {
        return Ok(());
    }
    fs::create_dir_all(target_dir)?;

    let mut dirs = skill_dirs(source_dir)?;
    dirs.sort();
    for source in dirs {
        let dir_name = source
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "skill has no name"))?;
        install_path(&source, &target_dir.join(&dir_name), mode, force)?;
        installed.push(dir_name);
    }

    Ok(())
}

fn markdown_files(dir: &Path) -> Result<Vec<PathBuf>> {
    if !dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    for entry in fs::read_dir(dir)? {
        let path = entry?.path();
        if path.is_file()
            && path
                .extension()
                .map(|extension| extension.eq_ignore_ascii_case("md"))
                .unwrap_or(false)
        {
            files.push(path);
        }
    }
    Ok(files)
}

fn skill_dirs(dir: &Path) -> Result<Vec<PathBuf>> {
    if !dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut dirs = Vec::new();
    for entry in fs::read_dir(dir)? {
        let path = entry?.path();
        if path.is_dir() && path.join("SKILL.md").is_file() {
            dirs.push(path);
        }
    }
    Ok(dirs)
}

fn install_path(src: &Path, dest: &Path, mode: InitMode, force: bool) -> Result<()> {
    let src = fs::canonicalize(src)?;
    if force && target_exists(dest) {
        remove_existing_path(dest)?;
    }
    if target_exists(dest) {
        return Err(CoreError::DestConflict(dest.to_path_buf()));
    }

    match mode {
        InitMode::Symlink => {
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
            if src.is_dir() {
                fs::create_dir_all(dest)?;
                copy_dir_contents(&src, dest)?;
            } else {
                fs::copy(&src, dest)?;
            }
        }
    }
    Ok(())
}

fn target_exists(path: &Path) -> bool {
    path.exists() || path.symlink_metadata().is_ok()
}

fn remove_existing_path(path: &Path) -> Result<()> {
    let metadata = fs::symlink_metadata(path)?;
    let file_type = metadata.file_type();
    if file_type.is_dir() && !file_type.is_symlink() {
        fs::remove_dir_all(path)?;
    } else {
        fs::remove_file(path)?;
    }
    Ok(())
}
