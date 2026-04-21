use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};

use serde::Serialize;

use crate::{
    load_skill_registry, save_skill_registry, scan_warehouse, AppConfig, CoreError, Result,
    SkillEntry,
};

pub struct CreateSkillRequest {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct DroppedSkillPreview {
    pub id: String,
    pub name: Option<String>,
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

pub fn delete_skill(cfg: &AppConfig, stable_id: u64) -> Result<()> {
    let skill = scan_warehouse(cfg)?
        .into_iter()
        .find(|entry| entry.stable_id == stable_id)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "skill not found"))?;

    fs::remove_dir_all(skill.path)?;
    Ok(())
}

pub fn rename_skill(cfg: &AppConfig, stable_id: u64, next_id: &str) -> Result<SkillEntry> {
    let skill = scan_warehouse(cfg)?
        .into_iter()
        .find(|entry| entry.stable_id == stable_id)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "skill not found"))?;
    let next_id = sanitize_skill_id(next_id)?;
    let next_path = cfg.skill_warehouse.join(&next_id);

    if skill.id == next_id {
        return Ok(skill);
    }
    if next_path.exists() {
        return Err(io::Error::new(io::ErrorKind::AlreadyExists, "skill already exists").into());
    }

    fs::rename(&skill.path, &next_path)?;

    let mut registry = load_skill_registry(cfg)?;
    let registry_skill = registry
        .skills
        .iter_mut()
        .find(|entry| entry.stable_id == stable_id)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "skill not found"))?;
    registry_skill.id = next_id.clone();
    registry_skill.path = next_path;
    registry_skill.active = true;
    save_skill_registry(cfg, &registry)?;

    scan_warehouse(cfg)?
        .into_iter()
        .find(|entry| entry.stable_id == stable_id)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "renamed skill not found").into())
}

pub fn preview_dropped_skill(source: &Path) -> Result<DroppedSkillPreview> {
    let import_source = resolve_dropped_skill_source(source)?;
    let skill_id = import_source.skill_id()?;
    let skill_id = sanitize_skill_id(&skill_id)?;
    let name = import_source.skill_name().ok().and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    });

    Ok(DroppedSkillPreview { id: skill_id, name })
}

pub fn import_dropped_skill(
    cfg: &AppConfig,
    source: &Path,
    overwrite_stable_id: Option<u64>,
) -> Result<SkillEntry> {
    let import_source = resolve_dropped_skill_source(source)?;

    if let Some(stable_id) = overwrite_stable_id {
        return overwrite_skill_from_drop(cfg, &import_source, stable_id);
    }

    let skill_id = import_source.skill_id()?;
    let skill_id = sanitize_skill_id(&skill_id)?;
    let skill_dir = cfg.skill_warehouse.join(&skill_id);

    fs::create_dir_all(&cfg.skill_warehouse)?;
    fs::create_dir(&skill_dir)?;
    import_source.copy_into(&skill_dir)?;

    scan_warehouse(cfg)?
        .into_iter()
        .find(|entry| entry.id == skill_id)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "imported skill not found").into())
}

fn overwrite_skill_from_drop(
    cfg: &AppConfig,
    import_source: &DroppedSkillSource<'_>,
    stable_id: u64,
) -> Result<SkillEntry> {
    let target = scan_warehouse(cfg)?
        .into_iter()
        .find(|entry| entry.stable_id == stable_id)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "skill not found"))?;

    match import_source {
        DroppedSkillSource::Directory(source_dir) => {
            overwrite_skill_directory(&target.path, source_dir)?;
        }
        DroppedSkillSource::SkillFile(skill_md) => {
            overwrite_skill_file(&target.path.join("SKILL.md"), skill_md)?;
        }
    }

    scan_warehouse(cfg)?
        .into_iter()
        .find(|entry| entry.stable_id == stable_id)
        .ok_or_else(|| {
            io::Error::new(io::ErrorKind::NotFound, "overwritten skill not found").into()
        })
}

pub fn copy_paths_into_entry(
    entry_root: &Path,
    relative_target_dir: &str,
    sources: &[PathBuf],
) -> Result<Vec<PathBuf>> {
    let target_dir = entry_root.join(sanitize_entry_relative_path(relative_target_dir)?);
    fs::create_dir_all(&target_dir)?;

    let mut copied = Vec::new();
    for source in sources {
        let file_name = source.file_name().ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "source path must have a file name",
            )
        })?;
        let destination = target_dir.join(file_name);
        if destination.symlink_metadata().is_ok() {
            return Err(CoreError::DestConflict(destination));
        }

        copy_path_recursively(source, &destination)?;
        copied.push(relative_path_from_root(entry_root, &destination)?);
    }

    Ok(copied)
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

enum DroppedSkillSource<'a> {
    Directory(&'a Path),
    SkillFile(&'a Path),
}

impl DroppedSkillSource<'_> {
    fn skill_id(&self) -> Result<String> {
        match self {
            Self::Directory(skill_dir) => skill_dir
                .file_name()
                .map(|name| name.to_string_lossy().into_owned())
                .ok_or_else(|| {
                    io::Error::new(io::ErrorKind::InvalidInput, "skill directory has no name")
                        .into()
                }),
            Self::SkillFile(skill_md) => read_skill_name(skill_md).or_else(|_| {
                skill_md
                    .parent()
                    .and_then(Path::file_name)
                    .map(|name| name.to_string_lossy().into_owned())
                    .ok_or_else(|| {
                        io::Error::new(
                            io::ErrorKind::InvalidInput,
                            "SKILL.md must live in a directory",
                        )
                        .into()
                    })
            }),
        }
    }

    fn skill_name(&self) -> Result<String> {
        match self {
            Self::Directory(skill_dir) => read_skill_name(&skill_dir.join("SKILL.md")),
            Self::SkillFile(skill_md) => read_skill_name(skill_md),
        }
    }

    fn copy_into(&self, destination_dir: &Path) -> Result<()> {
        match self {
            Self::Directory(source_dir) => copy_dir_contents(source_dir, destination_dir),
            Self::SkillFile(skill_md) => {
                fs::copy(skill_md, destination_dir.join("SKILL.md"))?;
                Ok(())
            }
        }
    }
}

fn resolve_dropped_skill_source(source: &Path) -> Result<DroppedSkillSource<'_>> {
    if source.is_dir() {
        if !source.join("SKILL.md").is_file() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "dropped path does not contain SKILL.md",
            )
            .into());
        }
        return Ok(DroppedSkillSource::Directory(source));
    }

    if source
        .file_name()
        .map(|name| name == "SKILL.md")
        .unwrap_or(false)
    {
        return Ok(DroppedSkillSource::SkillFile(source));
    }

    Err(io::Error::new(
        io::ErrorKind::InvalidInput,
        "drop a skill directory or its SKILL.md file",
    )
    .into())
}

fn read_skill_name(skill_md: &Path) -> Result<String> {
    let source = fs::read_to_string(skill_md)?;
    if !source.trim_start().starts_with("---") {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "SKILL.md is missing frontmatter name",
        )
        .into());
    }

    let rest = source.trim_start().strip_prefix("---").unwrap_or("");
    let end = rest.find("---").ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            "SKILL.md frontmatter is incomplete",
        )
    })?;
    let frontmatter = &rest[..end];

    for line in frontmatter.lines() {
        let trimmed = line.trim();
        if let Some(value) = trimmed.strip_prefix("name:") {
            let name = value.trim().trim_matches(|c| c == '"' || c == '\'');
            if !name.is_empty() {
                return Ok(name.to_string());
            }
        }
    }

    Err(io::Error::new(
        io::ErrorKind::InvalidInput,
        "SKILL.md frontmatter is missing name",
    )
    .into())
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

fn overwrite_skill_directory(target_dir: &Path, source_dir: &Path) -> Result<()> {
    if paths_share_location(target_dir, source_dir) {
        return Ok(());
    }

    let backup_dir = next_backup_path(target_dir);
    fs::rename(target_dir, &backup_dir)?;
    fs::create_dir(target_dir)?;

    if let Err(error) = copy_dir_contents(source_dir, target_dir) {
        let _ = fs::remove_dir_all(target_dir);
        let _ = fs::rename(&backup_dir, target_dir);
        return Err(error);
    }

    let _ = fs::remove_dir_all(&backup_dir);
    Ok(())
}

fn overwrite_skill_file(target_skill_md: &Path, source_skill_md: &Path) -> Result<()> {
    if paths_share_location(target_skill_md, source_skill_md) {
        return Ok(());
    }

    let backup_path = if target_skill_md.symlink_metadata().is_ok() {
        let backup_path = next_backup_path(target_skill_md);
        fs::rename(target_skill_md, &backup_path)?;
        Some(backup_path)
    } else {
        None
    };

    if let Some(parent) = target_skill_md.parent() {
        fs::create_dir_all(parent)?;
    }

    if let Err(error) = fs::copy(source_skill_md, target_skill_md) {
        let _ = fs::remove_file(target_skill_md);
        if let Some(backup_path) = &backup_path {
            let _ = fs::rename(backup_path, target_skill_md);
        }
        return Err(error.into());
    }

    if let Some(backup_path) = backup_path {
        let _ = fs::remove_file(backup_path);
    }
    Ok(())
}

fn next_backup_path(target: &Path) -> PathBuf {
    let parent = target.parent().unwrap_or_else(|| Path::new("."));
    let file_name = target
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "entry".to_string());

    for index in 0.. {
        let suffix = if index == 0 {
            ".agents-manager-backup".to_string()
        } else {
            format!(".agents-manager-backup-{index}")
        };
        let candidate = parent.join(format!(".{file_name}{suffix}"));
        if candidate.symlink_metadata().is_err() {
            return candidate;
        }
    }

    unreachable!()
}

fn paths_share_location(left: &Path, right: &Path) -> bool {
    match (fs::canonicalize(left), fs::canonicalize(right)) {
        (Ok(left), Ok(right)) => left == right,
        _ => false,
    }
}

fn sanitize_entry_relative_path(relative_path: &str) -> Result<PathBuf> {
    let mut cleaned = PathBuf::new();
    for component in Path::new(relative_path).components() {
        match component {
            Component::Normal(part) => cleaned.push(part),
            Component::CurDir => {}
            _ => {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidInput,
                    "path must stay inside selected entry",
                )
                .into())
            }
        }
    }
    Ok(cleaned)
}

fn copy_path_recursively(source: &Path, destination: &Path) -> Result<()> {
    let metadata = fs::metadata(source)?;
    if metadata.is_dir() {
        fs::create_dir_all(destination)?;
        for entry in fs::read_dir(source)? {
            let entry = entry?;
            let next_source = entry.path();
            let next_destination = destination.join(entry.file_name());
            if next_destination.symlink_metadata().is_ok() {
                return Err(CoreError::DestConflict(next_destination));
            }
            copy_path_recursively(&next_source, &next_destination)?;
        }
        return Ok(());
    }

    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(source, destination)?;
    Ok(())
}

fn relative_path_from_root(root: &Path, destination: &Path) -> Result<PathBuf> {
    destination
        .strip_prefix(root)
        .map(PathBuf::from)
        .map_err(|_| {
            io::Error::new(io::ErrorKind::InvalidInput, "path must stay inside entry").into()
        })
}
