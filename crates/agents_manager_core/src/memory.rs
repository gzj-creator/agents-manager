use std::collections::HashSet;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::config::AppConfig;
use crate::error::{CoreError, Result};
use crate::targets::ClientKind;

const MEMORY_MD_NAME: &str = "MEMORY.md";
const AGENTS_MD_NAME: &str = "AGENTS.md";
const CLAUDE_MD_NAME: &str = "CLAUDE.md";
const LEGACY_MEMORY_ID_FILE_NAME: &str = ".memory-id";
const MEMORY_REGISTRY_FILE_NAME: &str = ".memory-registry.toml";

#[derive(Debug, Clone, Serialize)]
pub struct MemoryEntry {
    pub stable_id: u64,
    pub id: String,
    pub tags: Vec<String>,
    pub path: PathBuf,
    pub memory_md_path: PathBuf,
}

pub struct CreateMemoryRequest {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct MemoryRegistry {
    #[serde(default = "default_next_memory_id")]
    next_id: u64,
    #[serde(default)]
    entries: Vec<MemoryRegistryEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct MemoryRegistryEntry {
    stable_id: u64,
    id: String,
}

impl Default for MemoryRegistry {
    fn default() -> Self {
        Self {
            next_id: 1,
            entries: Vec::new(),
        }
    }
}

pub fn scan_memory_warehouse(cfg: &AppConfig) -> Result<Vec<MemoryEntry>> {
    fs::create_dir_all(&cfg.memory_warehouse)?;

    let discovered = discover_memory_ids(&cfg.memory_warehouse)?;
    let registry = reconcile_memory_registry(&cfg.memory_warehouse, &discovered)?;

    let mut out = Vec::new();
    for id in discovered {
        let stable_id = registry
            .entries
            .iter()
            .find(|entry| entry.id == id)
            .map(|entry| entry.stable_id)
            .ok_or_else(|| {
                io::Error::new(io::ErrorKind::NotFound, "memory registry entry missing")
            })?;
        let path = cfg.memory_warehouse.join(&id);
        out.push(MemoryEntry {
            stable_id,
            id,
            tags: Vec::new(),
            memory_md_path: path.join(MEMORY_MD_NAME),
            path,
        });
    }

    out.sort_by(|left, right| {
        left.stable_id
            .cmp(&right.stable_id)
            .then_with(|| left.id.cmp(&right.id))
    });
    Ok(out)
}

pub fn create_memory(cfg: &AppConfig, req: CreateMemoryRequest) -> Result<MemoryEntry> {
    let memory_id = sanitize_memory_id(&req.id)?;
    let memory_dir = cfg.memory_warehouse.join(&memory_id);

    fs::create_dir_all(&cfg.memory_warehouse)?;
    fs::create_dir(&memory_dir)?;

    scan_memory_warehouse(cfg)?
        .into_iter()
        .find(|entry| entry.id == memory_id)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "created memory not found").into())
}

pub fn rename_memory(cfg: &AppConfig, stable_id: u64, next_id: &str) -> Result<MemoryEntry> {
    let memory = scan_memory_warehouse(cfg)?
        .into_iter()
        .find(|entry| entry.stable_id == stable_id)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "memory not found"))?;
    let next_id = sanitize_memory_id(next_id)?;
    let next_path = cfg.memory_warehouse.join(&next_id);

    if memory.id == next_id {
        return Ok(memory);
    }
    if next_path.exists() {
        return Err(io::Error::new(io::ErrorKind::AlreadyExists, "memory already exists").into());
    }

    fs::rename(&memory.path, &next_path)?;

    let mut registry = load_memory_registry(&cfg.memory_warehouse)?;
    let entry = registry
        .entries
        .iter_mut()
        .find(|entry| entry.stable_id == stable_id)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "memory not found"))?;
    entry.id = next_id;
    save_memory_registry(&cfg.memory_warehouse, &registry)?;

    scan_memory_warehouse(cfg)?
        .into_iter()
        .find(|entry| entry.stable_id == stable_id)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "renamed memory not found").into())
}

pub fn delete_memory(cfg: &AppConfig, stable_id: u64) -> Result<()> {
    let memory = scan_memory_warehouse(cfg)?
        .into_iter()
        .find(|entry| entry.stable_id == stable_id)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "memory not found"))?;

    fs::remove_dir_all(&memory.path)?;

    let mut registry = load_memory_registry(&cfg.memory_warehouse)?;
    registry
        .entries
        .retain(|entry| entry.stable_id != stable_id);
    save_memory_registry(&cfg.memory_warehouse, &registry)?;
    Ok(())
}

pub fn import_dropped_memory(cfg: &AppConfig, source: &Path) -> Result<MemoryEntry> {
    let import_source = resolve_dropped_memory_source(source)?;
    if let Some(existing) = existing_memory_for_import_source(cfg, &import_source)? {
        return Ok(existing);
    }
    let memory_id = sanitize_memory_id(&import_source.memory_id()?)?;
    let imported = create_memory(cfg, CreateMemoryRequest { id: memory_id })?;
    if let Err(error) = import_source.copy_into(&imported.path) {
        delete_memory(cfg, imported.stable_id)?;
        return Err(error);
    }
    Ok(imported)
}

pub fn init_memory(
    project_root: &Path,
    client: ClientKind,
    memory_id: u64,
    cfg: &AppConfig,
) -> Result<()> {
    init_memory_with_overwrite(project_root, client, memory_id, false, cfg)
}

pub fn init_memory_conflicts(
    project_root: &Path,
    client: ClientKind,
    memory_id: u64,
    cfg: &AppConfig,
) -> Result<Vec<PathBuf>> {
    let plan = resolve_init_memory_plan(project_root, client, memory_id, cfg)?;
    Ok(plan
        .target_paths()
        .into_iter()
        .filter(|path| path.exists() || path.symlink_metadata().is_ok())
        .collect())
}

pub fn init_memory_with_overwrite(
    project_root: &Path,
    client: ClientKind,
    memory_id: u64,
    overwrite_existing: bool,
    cfg: &AppConfig,
) -> Result<()> {
    let plan = resolve_init_memory_plan(project_root, client, memory_id, cfg)?;
    let conflicts = plan
        .target_paths()
        .into_iter()
        .filter(|path| path.exists() || path.symlink_metadata().is_ok())
        .collect::<Vec<_>>();

    if !overwrite_existing {
        if let Some(path) = conflicts.into_iter().next() {
            return Err(CoreError::DestConflict(path));
        }
    } else {
        for path in conflicts {
            remove_existing_target(&path)?;
        }
    }

    ensure_memory_file_exists(&plan.memory_md_path)?;
    create_file_symlink(&plan.memory_md_path, &plan.agents_path)?;
    if let Some(alias_path) = plan.claude_alias {
        if let Err(error) = create_file_symlink(Path::new("AGENTS.md"), &alias_path) {
            let _ = fs::remove_file(&plan.agents_path);
            return Err(error.into());
        }
    }
    Ok(())
}

pub fn generate_init_memory_command(client: ClientKind, memory_id: u64, force: bool) -> String {
    let mut command = format!(
        "agents-manager init-memory --client {} --memory {} --project .",
        client_name(client),
        memory_id
    );
    if force {
        command.push_str(" --force");
    }
    command
}

fn sanitize_memory_id(id: &str) -> Result<String> {
    let trimmed = id.trim();
    if trimmed.is_empty() {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "memory id is empty").into());
    }
    if trimmed.starts_with('.') {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "memory id cannot start with '.'",
        )
        .into());
    }
    if trimmed.contains('/') || trimmed.contains('\\') || trimmed == "." || trimmed == ".." {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "memory id is not a simple directory name",
        )
        .into());
    }
    Ok(trimmed.to_string())
}

enum DroppedMemorySource {
    Directory(PathBuf),
    MemoryFile(PathBuf),
}

struct InitMemoryPlan {
    memory_md_path: PathBuf,
    agents_path: PathBuf,
    claude_alias: Option<PathBuf>,
}

impl InitMemoryPlan {
    fn target_paths(&self) -> Vec<PathBuf> {
        let mut paths = vec![self.agents_path.clone()];
        if let Some(alias_path) = &self.claude_alias {
            paths.push(alias_path.clone());
        }
        paths
    }
}

impl DroppedMemorySource {
    fn memory_id(&self) -> Result<String> {
        match self {
            Self::Directory(memory_dir) => memory_dir
                .file_name()
                .map(|name| name.to_string_lossy().into_owned())
                .ok_or_else(|| {
                    io::Error::new(io::ErrorKind::InvalidInput, "memory directory has no name")
                        .into()
                }),
            Self::MemoryFile(memory_md) => memory_md
                .parent()
                .and_then(Path::file_name)
                .map(|name| name.to_string_lossy().into_owned())
                .ok_or_else(|| {
                    io::Error::new(
                        io::ErrorKind::InvalidInput,
                        "MEMORY.md must live in a directory",
                    )
                    .into()
                }),
        }
    }

    fn copy_into(&self, destination_dir: &Path) -> Result<()> {
        match self {
            Self::Directory(source_dir) => copy_dir_contents(source_dir, destination_dir),
            Self::MemoryFile(memory_md) => {
                fs::copy(memory_md, destination_dir.join(MEMORY_MD_NAME))?;
                Ok(())
            }
        }
    }

    fn matches_existing(&self, entry: &MemoryEntry) -> bool {
        match self {
            Self::Directory(source_dir) => canonical_paths_match(source_dir, &entry.path),
            Self::MemoryFile(memory_md) => canonical_paths_match(memory_md, &entry.memory_md_path),
        }
    }
}

fn resolve_dropped_memory_source(source: &Path) -> Result<DroppedMemorySource> {
    if source.is_dir() {
        if !source.join(MEMORY_MD_NAME).is_file() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "dropped path does not contain MEMORY.md",
            )
            .into());
        }
        return Ok(DroppedMemorySource::Directory(source.to_path_buf()));
    }

    if source.is_file() {
        return resolve_dropped_memory_file_source(source);
    }

    Err(io::Error::new(
        io::ErrorKind::InvalidInput,
        "drop a memory directory, or a MEMORY.md/AGENTS.md/CLAUDE.md file",
    )
    .into())
}

fn resolve_init_memory_plan(
    project_root: &Path,
    client: ClientKind,
    memory_id: u64,
    cfg: &AppConfig,
) -> Result<InitMemoryPlan> {
    let project_root = fs::canonicalize(project_root)
        .map_err(|_| CoreError::InvalidProject(project_root.to_path_buf()))?;
    if !project_root.is_dir() {
        return Err(CoreError::InvalidProject(project_root));
    }

    let memory = scan_memory_warehouse(cfg)?
        .into_iter()
        .find(|entry| entry.stable_id == memory_id)
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "memory not found"))?;

    Ok(InitMemoryPlan {
        memory_md_path: memory.memory_md_path,
        agents_path: project_root.join("AGENTS.md"),
        claude_alias: needs_claude_alias(client).then(|| project_root.join("CLAUDE.md")),
    })
}

fn ensure_memory_file_exists(memory_md_path: &Path) -> Result<()> {
    if let Some(parent) = memory_md_path.parent() {
        fs::create_dir_all(parent)?;
    }
    if !memory_md_path.exists() && memory_md_path.symlink_metadata().is_err() {
        fs::write(memory_md_path, "")?;
    }
    Ok(())
}

fn remove_existing_target(path: &Path) -> Result<()> {
    let metadata = fs::symlink_metadata(path)?;
    let file_type = metadata.file_type();
    if file_type.is_dir() && !file_type.is_symlink() {
        fs::remove_dir_all(path)?;
    } else {
        fs::remove_file(path)?;
    }
    Ok(())
}

fn resolve_dropped_memory_file_source(source: &Path) -> Result<DroppedMemorySource> {
    let file_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "dropped file must have a valid UTF-8 name",
            )
        })?;

    if file_name == MEMORY_MD_NAME {
        return Ok(DroppedMemorySource::MemoryFile(source.to_path_buf()));
    }

    if matches!(file_name, AGENTS_MD_NAME | CLAUDE_MD_NAME) {
        return Ok(DroppedMemorySource::MemoryFile(source.to_path_buf()));
    }

    Err(io::Error::new(
        io::ErrorKind::InvalidInput,
        "drop a memory directory, or a MEMORY.md/AGENTS.md/CLAUDE.md file",
    )
    .into())
}

fn existing_memory_for_import_source(
    cfg: &AppConfig,
    import_source: &DroppedMemorySource,
) -> Result<Option<MemoryEntry>> {
    Ok(scan_memory_warehouse(cfg)?
        .into_iter()
        .find(|entry| import_source.matches_existing(entry)))
}

fn canonical_paths_match(left: &Path, right: &Path) -> bool {
    match (fs::canonicalize(left), fs::canonicalize(right)) {
        (Ok(left), Ok(right)) => left == right,
        _ => false,
    }
}

fn discover_memory_ids(warehouse_root: &Path) -> Result<Vec<String>> {
    let mut ids = Vec::new();

    for entry in fs::read_dir(warehouse_root)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let id = entry.file_name().to_string_lossy().into_owned();
        if id.starts_with('.') {
            continue;
        }

        remove_legacy_memory_id_file(&path)?;
        ids.push(id);
    }

    ids.sort();
    Ok(ids)
}

fn remove_legacy_memory_id_file(memory_dir: &Path) -> Result<()> {
    let legacy_id_path = memory_dir.join(LEGACY_MEMORY_ID_FILE_NAME);
    match fs::remove_file(&legacy_id_path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

fn reconcile_memory_registry(
    warehouse_root: &Path,
    discovered: &[String],
) -> Result<MemoryRegistry> {
    let mut registry = load_memory_registry(warehouse_root)?;
    let mut used_ids = HashSet::new();
    let mut next_id = registry
        .next_id
        .max(max_registered_memory_id(&registry).saturating_add(1))
        .max(1);
    let mut entries = Vec::new();

    for id in discovered {
        let stable_id = registry
            .entries
            .iter()
            .find(|entry| {
                entry.id == *id && entry.stable_id > 0 && used_ids.insert(entry.stable_id)
            })
            .map(|entry| entry.stable_id)
            .unwrap_or_else(|| {
                let assigned = next_unused_memory_id(&used_ids, next_id);
                used_ids.insert(assigned);
                next_id = assigned + 1;
                assigned
            });

        entries.push(MemoryRegistryEntry {
            stable_id,
            id: id.clone(),
        });
    }

    entries.sort_by(|left, right| {
        left.stable_id
            .cmp(&right.stable_id)
            .then_with(|| left.id.cmp(&right.id))
    });

    registry.entries = entries;
    registry.next_id = next_id.max(max_registered_memory_id(&registry).saturating_add(1));
    save_memory_registry(warehouse_root, &registry)?;
    Ok(registry)
}

fn next_unused_memory_id(used_ids: &HashSet<u64>, start_at: u64) -> u64 {
    let mut candidate = start_at.max(1);
    while used_ids.contains(&candidate) {
        candidate += 1;
    }
    candidate
}

fn max_registered_memory_id(registry: &MemoryRegistry) -> u64 {
    registry
        .entries
        .iter()
        .map(|entry| entry.stable_id)
        .max()
        .unwrap_or(0)
}

fn load_memory_registry(warehouse_root: &Path) -> Result<MemoryRegistry> {
    let registry_path = memory_registry_path(warehouse_root);
    if !registry_path.exists() {
        return Ok(MemoryRegistry::default());
    }

    let raw = fs::read_to_string(registry_path)?;
    Ok(toml::from_str(&raw)?)
}

fn save_memory_registry(warehouse_root: &Path, registry: &MemoryRegistry) -> Result<()> {
    let raw = toml::to_string_pretty(registry)?;
    fs::write(memory_registry_path(warehouse_root), raw)?;
    Ok(())
}

fn memory_registry_path(warehouse_root: &Path) -> PathBuf {
    warehouse_root.join(MEMORY_REGISTRY_FILE_NAME)
}

fn default_next_memory_id() -> u64 {
    1
}

fn client_name(client: ClientKind) -> &'static str {
    match client {
        ClientKind::Codex => "codex",
        ClientKind::Claude => "claude",
        ClientKind::Cursor => "cursor",
    }
}

fn needs_claude_alias(client: ClientKind) -> bool {
    matches!(client, ClientKind::Claude | ClientKind::Cursor)
}

#[cfg(unix)]
fn create_file_symlink(source: &Path, destination: &Path) -> io::Result<()> {
    std::os::unix::fs::symlink(source, destination)
}

#[cfg(windows)]
fn create_file_symlink(source: &Path, destination: &Path) -> io::Result<()> {
    std::os::windows::fs::symlink_file(source, destination)
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
