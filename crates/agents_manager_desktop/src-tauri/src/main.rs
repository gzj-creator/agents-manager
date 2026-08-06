#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Component, Path, PathBuf};
#[cfg(any(target_os = "macos", target_os = "linux", test))]
use std::process::Command;

use agents_manager_core::{
    bootstrap_legacy_migration, copy_paths_into_entry, create_memory, create_skill, delete_memory,
    delete_skill, generate_init_memory_command, generate_init_project_command,
    import_dropped_memory, import_dropped_plugin, import_dropped_skill, import_git_skills,
    init_claude_plugin, load_app_config, load_managed_mcp_config, migrate_legacy_skills,
    preview_dropped_plugin, preview_dropped_skill, rename_memory, rename_skill, save_app_config,
    save_managed_mcp_config, scan_memory_warehouse, scan_plugin_warehouse, scan_warehouse,
    sync_global_skills, update_editable_settings, update_skill_metadata,
    warehouse_home_from_config, ClientKind, ClientRoots, CreateMemoryRequest, CreateSkillRequest,
    EditableSettingsUpdate, GlobalSyncRequest, InitMode, InstallMode, McpServerConfig, McpTarget,
};
#[cfg(any(target_os = "macos", target_os = "linux", test))]
use agents_manager_core::{load_skill_registry, save_skill_registry};
use rfd::FileDialog;
use serde::{Deserialize, Serialize};

#[cfg(any(target_os = "macos", target_os = "linux", test))]
const MIGRATION_ARCHIVE_ROOT: &str = "agents-manager-backup";
#[cfg(any(target_os = "macos", target_os = "linux", test))]
const MIGRATION_MANIFEST_NAME: &str = "migration-manifest.json";
#[cfg(any(target_os = "macos", target_os = "linux", test))]
const MIGRATION_FORMAT: &str = "agents-manager-warehouse";
#[cfg(any(target_os = "macos", target_os = "linux", test))]
const MIGRATION_FORMAT_VERSION: u32 = 1;
#[cfg(any(target_os = "macos", target_os = "linux", test))]
const MIGRATION_CONTENTS: [&str; 4] = ["skills", "memories", "plugins", "registry.toml"];

#[derive(Debug, Clone, Serialize)]
struct SkillTreeNode {
    name: String,
    path: String,
    kind: String,
    children: Vec<SkillTreeNode>,
}

#[derive(Debug, Deserialize)]
struct UpdateSkillMetadataReq {
    stable_id: u64,
    skill_type: Option<String>,
    tags: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct SkillPathReq {
    stable_id: u64,
    relative_path: String,
}

#[derive(Debug, Deserialize)]
struct WriteSkillFileReq {
    stable_id: u64,
    relative_path: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct MemoryPathReq {
    stable_id: u64,
    relative_path: String,
}

#[derive(Debug, Deserialize)]
struct WriteMemoryFileReq {
    stable_id: u64,
    relative_path: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct CreateSkillPathReq {
    stable_id: u64,
    relative_path: String,
    kind: String,
}

#[derive(Debug, Deserialize)]
struct RenameSkillPathReq {
    stable_id: u64,
    from: String,
    to: String,
}

#[derive(Debug, Deserialize)]
struct CreateMemoryPathReq {
    stable_id: u64,
    relative_path: String,
    kind: String,
}

#[derive(Debug, Deserialize)]
struct RenameMemoryPathReq {
    stable_id: u64,
    from: String,
    to: String,
}

#[derive(Debug, Deserialize)]
struct SyncSkillsReq {
    client: String,
    skill_ids: Vec<u64>,
    #[serde(default)]
    overwrite_skill_ids: Vec<u64>,
    mode: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DeleteSkillReq {
    stable_id: u64,
}

#[derive(Debug, Deserialize)]
struct RenameSkillReq {
    stable_id: u64,
    id: String,
}

#[derive(Debug, Deserialize)]
struct InitCommandReq {
    client: String,
    skill_ids: Vec<u64>,
    mode: Option<String>,
    #[serde(default)]
    force: bool,
}

#[derive(Debug, Deserialize)]
struct GitImportReq {
    repo_url: String,
}

#[derive(Debug, Deserialize)]
struct ImportDroppedSkillReq {
    path: String,
    overwrite_stable_id: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct ImportDroppedMemoryReq {
    path: String,
}

#[derive(Debug, Deserialize)]
struct PreviewDroppedSkillReq {
    path: String,
}

#[derive(Debug, Deserialize)]
struct ImportDroppedPluginReq {
    path: String,
}

#[derive(Debug, Deserialize)]
struct PreviewDroppedPluginReq {
    path: String,
}

#[derive(Debug, Deserialize)]
struct InitClaudePluginReq {
    project_path: String,
    plugin_id: String,
    mode: Option<String>,
    #[serde(default)]
    force: bool,
}

#[derive(Debug, Deserialize)]
struct CopyDroppedPathsReq {
    stable_id: u64,
    relative_target_dir: String,
    paths: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct CreateSkillReq {
    id: String,
    name: Option<String>,
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CreateMemoryReq {
    id: String,
}

#[derive(Debug, Deserialize)]
struct DeleteMemoryReq {
    stable_id: u64,
}

#[derive(Debug, Deserialize)]
struct RenameMemoryReq {
    stable_id: u64,
    id: String,
}

#[derive(Debug, Deserialize)]
struct InitMemoryCommandReq {
    client: String,
    memory: u64,
    mode: Option<String>,
    #[serde(default)]
    force: bool,
}

#[derive(Debug, Serialize)]
struct EditableSettingsPayload {
    warehouse_home: String,
    library_roots: Vec<String>,
    default_warehouse_home: String,
}

#[derive(Debug, Deserialize)]
struct SaveEditableSettingsReq {
    warehouse_home: String,
    library_roots: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct McpConfigReq {
    client: String,
    scope: String,
    project_path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SaveMcpConfigReq {
    client: String,
    scope: String,
    project_path: Option<String>,
    servers: Vec<McpServerConfig>,
}

#[derive(Debug, Serialize)]
struct McpConfigPayload {
    target_path: String,
    servers: Vec<McpServerConfig>,
}

#[derive(Debug, Deserialize)]
struct PickFolderReq {
    start_path: Option<String>,
}

#[cfg(any(target_os = "macos", target_os = "linux", test))]
#[derive(Debug, Deserialize, Serialize)]
struct MigrationManifest {
    format: String,
    format_version: u32,
    app_version: String,
    contents: Vec<String>,
}

#[tauri::command]
fn list_warehouse_skills_cmd() -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let entries = scan_warehouse(&cfg).map_err(|e| e.to_string())?;
    serde_json::to_value(entries).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_skill_cmd(req: CreateSkillReq) -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let created = create_skill(
        &cfg,
        CreateSkillRequest {
            id: req.id,
            name: req.name,
            description: req.description,
        },
    )
    .map_err(|e| e.to_string())?;
    serde_json::to_value(created).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_warehouse_memories_cmd() -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let entries = scan_memory_warehouse(&cfg).map_err(|e| e.to_string())?;
    serde_json::to_value(entries).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_warehouse_plugins_cmd() -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let entries = scan_plugin_warehouse(&cfg).map_err(|e| e.to_string())?;
    serde_json::to_value(entries).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_memory_cmd(req: CreateMemoryReq) -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let created =
        create_memory(&cfg, CreateMemoryRequest { id: req.id }).map_err(|e| e.to_string())?;
    serde_json::to_value(created).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_memory_cmd(req: RenameMemoryReq) -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let renamed = rename_memory(&cfg, req.stable_id, &req.id).map_err(|e| e.to_string())?;
    serde_json::to_value(renamed).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_memory_cmd(req: DeleteMemoryReq) -> Result<(), String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    delete_memory(&cfg, req.stable_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_skill_cmd(req: DeleteSkillReq) -> Result<(), String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    delete_skill(&cfg, req.stable_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_skill_cmd(req: RenameSkillReq) -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let renamed = rename_skill(&cfg, req.stable_id, &req.id).map_err(|e| e.to_string())?;
    serde_json::to_value(renamed).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_skill_metadata_cmd(req: UpdateSkillMetadataReq) -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let updated = update_skill_metadata(&cfg, req.stable_id, req.skill_type, req.tags)
        .map_err(|e| e.to_string())?;
    serde_json::to_value(updated).map_err(|e| e.to_string())
}

#[tauri::command]
fn inspect_skill_tree_cmd(stable_id: u64) -> Result<serde_json::Value, String> {
    let path = resolve_skill_root(stable_id).map_err(|e| e.to_string())?;
    let tree = build_tree(&path, Path::new("")).map_err(|e| e.to_string())?;
    serde_json::to_value(tree).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_skill_file_cmd(req: SkillPathReq) -> Result<String, String> {
    let path = resolve_skill_file(req.stable_id, &req.relative_path).map_err(|e| e.to_string())?;
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn inspect_memory_tree_cmd(stable_id: u64) -> Result<serde_json::Value, String> {
    let path = resolve_memory_root(stable_id).map_err(|e| e.to_string())?;
    let tree = build_tree(&path, Path::new("")).map_err(|e| e.to_string())?;
    serde_json::to_value(tree).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_memory_file_cmd(req: MemoryPathReq) -> Result<String, String> {
    let path = resolve_memory_file(req.stable_id, &req.relative_path).map_err(|e| e.to_string())?;
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_skill_file_cmd(req: WriteSkillFileReq) -> Result<(), String> {
    let path = resolve_skill_file(req.stable_id, &req.relative_path).map_err(|e| e.to_string())?;
    fs::write(path, req.content).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_memory_file_cmd(req: WriteMemoryFileReq) -> Result<(), String> {
    let path = resolve_memory_file(req.stable_id, &req.relative_path).map_err(|e| e.to_string())?;
    fs::write(path, req.content).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_skill_path_cmd(req: CreateSkillPathReq) -> Result<(), String> {
    let path = resolve_skill_file(req.stable_id, &req.relative_path).map_err(|e| e.to_string())?;
    match req.kind.as_str() {
        "dir" => fs::create_dir_all(path).map_err(|e| e.to_string())?,
        _ => {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::write(path, "").map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn create_memory_path_cmd(req: CreateMemoryPathReq) -> Result<(), String> {
    let path = resolve_memory_file(req.stable_id, &req.relative_path).map_err(|e| e.to_string())?;
    match req.kind.as_str() {
        "dir" => fs::create_dir_all(path).map_err(|e| e.to_string())?,
        _ => {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::write(path, "").map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn rename_skill_path_cmd(req: RenameSkillPathReq) -> Result<(), String> {
    let from = resolve_skill_file(req.stable_id, &req.from).map_err(|e| e.to_string())?;
    let to = resolve_skill_file(req.stable_id, &req.to).map_err(|e| e.to_string())?;
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::rename(from, to).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_memory_path_cmd(req: RenameMemoryPathReq) -> Result<(), String> {
    let from = resolve_memory_file(req.stable_id, &req.from).map_err(|e| e.to_string())?;
    let to = resolve_memory_file(req.stable_id, &req.to).map_err(|e| e.to_string())?;
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::rename(from, to).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_skill_path_cmd(req: SkillPathReq) -> Result<(), String> {
    let path = resolve_skill_file(req.stable_id, &req.relative_path).map_err(|e| e.to_string())?;
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.is_dir() {
        fs::remove_dir_all(path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(path).map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn delete_memory_path_cmd(req: MemoryPathReq) -> Result<(), String> {
    let path = resolve_memory_file(req.stable_id, &req.relative_path).map_err(|e| e.to_string())?;
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.is_dir() {
        fs::remove_dir_all(path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(path).map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn migrate_legacy_skills_cmd() -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let roots =
        ClientRoots::detect().ok_or_else(|| "could not resolve home directory".to_string())?;
    let report = migrate_legacy_skills(&cfg, &roots).map_err(|e| e.to_string())?;
    serde_json::to_value(report).map_err(|e| e.to_string())
}

#[tauri::command]
fn sync_global_skills_cmd(req: SyncSkillsReq) -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let roots =
        ClientRoots::detect().ok_or_else(|| "could not resolve home directory".to_string())?;
    let report = sync_global_skills(
        &cfg,
        &roots,
        &GlobalSyncRequest {
            client: parse_client(&req.client)?,
            skill_ids: req.skill_ids,
            overwrite_skill_ids: req.overwrite_skill_ids,
            mode: parse_mode(req.mode.as_deref()),
        },
    )
    .map_err(|e| e.to_string())?;
    serde_json::to_value(report).map_err(|e| e.to_string())
}

#[tauri::command]
fn generate_init_project_command_cmd(req: InitCommandReq) -> Result<String, String> {
    Ok(generate_init_project_command(
        parse_client(&req.client)?,
        &req.skill_ids,
        req.mode.as_deref(),
        req.force,
    ))
}

#[tauri::command]
fn generate_init_memory_command_cmd(req: InitMemoryCommandReq) -> Result<String, String> {
    Ok(generate_init_memory_command(
        parse_client(&req.client)?,
        req.memory,
        req.mode.as_deref(),
        req.force,
    ))
}

#[tauri::command]
fn import_dropped_skill_cmd(req: ImportDroppedSkillReq) -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let imported = import_dropped_skill(&cfg, Path::new(&req.path), req.overwrite_stable_id)
        .map_err(|e| e.to_string())?;
    serde_json::to_value(imported).map_err(|e| e.to_string())
}

#[tauri::command]
fn preview_dropped_skill_cmd(req: PreviewDroppedSkillReq) -> Result<serde_json::Value, String> {
    let preview = preview_dropped_skill(Path::new(&req.path)).map_err(|e| e.to_string())?;
    serde_json::to_value(preview).map_err(|e| e.to_string())
}

#[tauri::command]
fn preview_dropped_plugin_cmd(req: PreviewDroppedPluginReq) -> Result<serde_json::Value, String> {
    let preview = preview_dropped_plugin(Path::new(&req.path)).map_err(|e| e.to_string())?;
    serde_json::to_value(preview).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_dropped_plugin_cmd(req: ImportDroppedPluginReq) -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let imported = import_dropped_plugin(&cfg, Path::new(&req.path)).map_err(|e| e.to_string())?;
    serde_json::to_value(imported).map_err(|e| e.to_string())
}

#[tauri::command]
fn init_claude_plugin_cmd(req: InitClaudePluginReq) -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let report = init_claude_plugin(
        Path::new(&req.project_path),
        &req.plugin_id,
        parse_init_mode(req.mode.as_deref()),
        req.force,
        &cfg,
    )
    .map_err(|e| e.to_string())?;
    serde_json::to_value(report).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_dropped_memory_cmd(req: ImportDroppedMemoryReq) -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let imported = import_dropped_memory(&cfg, Path::new(&req.path)).map_err(|e| e.to_string())?;
    serde_json::to_value(imported).map_err(|e| e.to_string())
}

#[tauri::command]
fn copy_paths_into_skill_cmd(req: CopyDroppedPathsReq) -> Result<Vec<String>, String> {
    let root = resolve_skill_root(req.stable_id).map_err(|e| e.to_string())?;
    let sources = req.paths.into_iter().map(PathBuf::from).collect::<Vec<_>>();
    let copied = copy_paths_into_entry(&root, &req.relative_target_dir, &sources)
        .map_err(|e| e.to_string())?;
    Ok(copied
        .into_iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect())
}

#[tauri::command]
fn copy_paths_into_memory_cmd(req: CopyDroppedPathsReq) -> Result<Vec<String>, String> {
    let root = resolve_memory_root(req.stable_id).map_err(|e| e.to_string())?;
    let sources = req.paths.into_iter().map(PathBuf::from).collect::<Vec<_>>();
    let copied = copy_paths_into_entry(&root, &req.relative_target_dir, &sources)
        .map_err(|e| e.to_string())?;
    Ok(copied
        .into_iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect())
}

#[tauri::command]
fn import_git_skills_cmd(req: GitImportReq) -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let report = import_git_skills(&cfg, &req.repo_url).map_err(|e| e.to_string())?;
    serde_json::to_value(report).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_editable_settings_cmd() -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    serde_json::to_value(editable_settings_payload(&cfg)).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_editable_settings_cmd(req: SaveEditableSettingsReq) -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let warehouse = req.warehouse_home.trim();
    if warehouse.is_empty() {
        return Err("warehouse path is required".into());
    }

    let updated = update_editable_settings(
        &cfg,
        EditableSettingsUpdate {
            warehouse_home: Some(PathBuf::from(warehouse)),
            library_roots: Some(
                req.library_roots
                    .into_iter()
                    .map(|root| root.trim().to_string())
                    .filter(|root| !root.is_empty())
                    .map(PathBuf::from)
                    .collect(),
            ),
        },
    )
    .map_err(|e| e.to_string())?;

    serde_json::to_value(editable_settings_payload(&updated)).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_mcp_config_cmd(req: McpConfigReq) -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let target = resolve_mcp_target(&req)?;
    let target_path = target.config_path().map_err(|e| e.to_string())?;
    let config = load_managed_mcp_config(&cfg, &target).map_err(|e| e.to_string())?;
    let payload = McpConfigPayload {
        target_path: target_path.display().to_string(),
        servers: config.servers.into_values().collect(),
    };
    serde_json::to_value(payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_mcp_config_cmd(req: SaveMcpConfigReq) -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let target = resolve_mcp_target(&McpConfigReq {
        client: req.client,
        scope: req.scope,
        project_path: req.project_path,
    })?;
    let target_path = target.config_path().map_err(|e| e.to_string())?;
    let updated_cfg =
        save_managed_mcp_config(&cfg, &target, req.servers).map_err(|e| e.to_string())?;
    let config = load_managed_mcp_config(&updated_cfg, &target).map_err(|e| e.to_string())?;
    let payload = McpConfigPayload {
        target_path: target_path.display().to_string(),
        servers: config.servers.into_values().collect(),
    };
    serde_json::to_value(payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn pick_folder_cmd(req: Option<PickFolderReq>) -> Result<Option<String>, String> {
    let mut dialog = FileDialog::new();
    if let Some(start_path) = req
        .and_then(|req| req.start_path)
        .map(|path| path.trim().to_string())
        .filter(|path| !path.is_empty())
    {
        dialog = dialog.set_directory(start_path);
    }

    Ok(dialog.pick_folder().map(|path| path.display().to_string()))
}

#[tauri::command]
fn export_warehouse_archive_cmd() -> Result<Option<String>, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let warehouse_home = warehouse_home_from_config(&cfg);
    if !warehouse_home.is_dir() {
        return Err(format!(
            "warehouse directory does not exist: {}",
            warehouse_home.display()
        ));
    }

    let Some(selected_path) = FileDialog::new()
        .add_filter("ZIP archive", &["zip"])
        .set_file_name("agents-manager-backup.zip")
        .save_file()
    else {
        return Ok(None);
    };

    let archive_path = if selected_path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("zip"))
    {
        selected_path
    } else {
        selected_path.with_extension("zip")
    };

    if archive_path.exists() {
        return Err(format!(
            "archive already exists: {}",
            archive_path.display()
        ));
    }

    #[cfg(target_os = "macos")]
    {
        scan_warehouse(&cfg).map_err(|error| format!("failed to update registry: {error}"))?;
        let staging = tempfile::tempdir()
            .map_err(|error| format!("failed to create export staging directory: {error}"))?;
        let staged_home = staging.path().join(MIGRATION_ARCHIVE_ROOT);

        let copy_output = Command::new("/usr/bin/ditto")
            .arg(&warehouse_home)
            .arg(&staged_home)
            .output()
            .map_err(|error| format!("failed to start warehouse copy: {error}"))?;
        if !copy_output.status.success() {
            return Err(format!(
                "failed to stage warehouse: {}",
                String::from_utf8_lossy(&copy_output.stderr).trim()
            ));
        }
        write_migration_manifest(&staged_home)?;

        let output = Command::new("/usr/bin/ditto")
            .args(["-c", "-k", "--sequesterRsrc", "--keepParent"])
            .arg(&staged_home)
            .arg(&archive_path)
            .output()
            .map_err(|error| format!("failed to start archive tool: {error}"))?;
        if !output.status.success() {
            return Err(format!(
                "failed to create archive: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
        Ok(Some(archive_path.display().to_string()))
    }

    #[cfg(target_os = "linux")]
    {
        scan_warehouse(&cfg).map_err(|error| format!("failed to update registry: {error}"))?;
        let staging = tempfile::tempdir()
            .map_err(|error| format!("failed to create export staging directory: {error}"))?;
        let staged_home = staging.path().join(MIGRATION_ARCHIVE_ROOT);

        let copy_output = Command::new("/bin/cp")
            .args(["-a"])
            .arg(&warehouse_home)
            .arg(&staged_home)
            .output()
            .map_err(|error| format!("failed to start warehouse copy: {error}"))?;
        if !copy_output.status.success() {
            return Err(format!(
                "failed to stage warehouse: {}",
                String::from_utf8_lossy(&copy_output.stderr).trim()
            ));
        }
        write_migration_manifest(&staged_home)?;

        let output = Command::new("/usr/bin/zip")
            .args(["-r", "-y"])
            .arg(&archive_path)
            .arg(MIGRATION_ARCHIVE_ROOT)
            .current_dir(staging.path())
            .output()
            .map_err(|error| format!("failed to start archive tool: {error}"))?;
        if !output.status.success() {
            return Err(format!(
                "failed to create archive: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
        Ok(Some(archive_path.display().to_string()))
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        let _ = warehouse_home;
        Err("warehouse archive export is currently supported on macOS and Linux only".to_string())
    }
}

#[tauri::command]
fn restore_warehouse_archive_cmd() -> Result<Option<String>, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let warehouse_home = warehouse_home_from_config(&cfg);

    let Some(archive_path) = FileDialog::new()
        .add_filter("ZIP archive", &["zip"])
        .pick_file()
    else {
        return Ok(None);
    };

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        restore_warehouse_archive(&archive_path, &warehouse_home, &cfg)?;
        Ok(Some(archive_path.display().to_string()))
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        let _ = (&archive_path, &warehouse_home);
        Err("warehouse archive restore is currently supported on macOS and Linux only".to_string())
    }
}

#[cfg(any(target_os = "macos", target_os = "linux", test))]
fn restore_warehouse_archive(
    archive_path: &Path,
    warehouse_home: &Path,
    cfg: &agents_manager_core::AppConfig,
) -> Result<(), String> {
    if !archive_path.is_file() {
        return Err(format!(
            "archive does not exist: {}",
            archive_path.display()
        ));
    }
    if !warehouse_home.is_dir() {
        return Err(format!(
            "warehouse directory does not exist: {}",
            warehouse_home.display()
        ));
    }

    let parent = warehouse_home
        .parent()
        .ok_or_else(|| "warehouse directory must have a parent".to_string())?;
    let staging = tempfile::Builder::new()
        .prefix(".agents-manager-restore-")
        .tempdir_in(parent)
        .map_err(|error| format!("failed to create restore staging directory: {error}"))?;
    let extracted = staging.path().join("extracted");
    fs::create_dir(&extracted)
        .map_err(|error| format!("failed to prepare restore staging directory: {error}"))?;

    #[cfg(target_os = "macos")]
    let output = Command::new("/usr/bin/ditto")
        .args(["-x", "-k"])
        .arg(archive_path)
        .arg(&extracted)
        .output()
        .map_err(|error| format!("failed to start archive tool: {error}"))?;
    #[cfg(target_os = "linux")]
    let output = Command::new("/usr/bin/unzip")
        .args(["-q"])
        .arg(archive_path)
        .arg("-d")
        .arg(&extracted)
        .output()
        .map_err(|error| format!("failed to start archive tool: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "failed to extract archive: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }

    let restored_home = find_restored_warehouse(&extracted)?;
    prepare_restored_registry(&restored_home, warehouse_home, cfg)?;
    let previous_home = staging.path().join("previous");
    fs::rename(warehouse_home, &previous_home)
        .map_err(|error| format!("failed to stage current warehouse: {error}"))?;

    if let Err(error) = fs::rename(&restored_home, warehouse_home) {
        return match fs::rename(&previous_home, warehouse_home) {
            Ok(()) => Err(format!("failed to restore warehouse: {error}")),
            Err(rollback_error) => {
                let recovery_dir = staging.keep();
                Err(format!(
                    "failed to restore warehouse: {error}; rollback also failed: {rollback_error}; previous warehouse remains at {}",
                    recovery_dir.join("previous").display()
                ))
            }
        };
    }

    Ok(())
}

#[cfg(any(target_os = "macos", target_os = "linux", test))]
fn find_restored_warehouse(extracted: &Path) -> Result<PathBuf, String> {
    if is_warehouse_home(extracted) {
        validate_migration_manifest(extracted)?;
        return Ok(extracted.to_path_buf());
    }

    let candidates = fs::read_dir(extracted)
        .map_err(|error| format!("failed to inspect extracted archive: {error}"))?
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| path.is_dir() && is_warehouse_home(path))
        .collect::<Vec<_>>();

    match candidates.as_slice() {
        [warehouse] => {
            validate_migration_manifest(warehouse)?;
            Ok(warehouse.clone())
        }
        _ => Err(
            "invalid migration archive: expected skills, memories, and plugins directories"
                .to_string(),
        ),
    }
}

#[cfg(any(target_os = "macos", target_os = "linux", test))]
fn write_migration_manifest(warehouse: &Path) -> Result<(), String> {
    let manifest = MigrationManifest {
        format: MIGRATION_FORMAT.to_string(),
        format_version: MIGRATION_FORMAT_VERSION,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        contents: MIGRATION_CONTENTS
            .iter()
            .map(|entry| (*entry).to_string())
            .collect(),
    };
    let content = serde_json::to_string_pretty(&manifest)
        .map_err(|error| format!("failed to serialize migration manifest: {error}"))?;
    fs::write(warehouse.join(MIGRATION_MANIFEST_NAME), content)
        .map_err(|error| format!("failed to write migration manifest: {error}"))
}

#[cfg(any(target_os = "macos", target_os = "linux", test))]
fn validate_migration_manifest(warehouse: &Path) -> Result<(), String> {
    let manifest_path = warehouse.join(MIGRATION_MANIFEST_NAME);
    if !manifest_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&manifest_path)
        .map_err(|error| format!("failed to read migration manifest: {error}"))?;
    let manifest: MigrationManifest = serde_json::from_str(&content)
        .map_err(|error| format!("invalid migration manifest: {error}"))?;

    if manifest.format != MIGRATION_FORMAT {
        return Err(format!("unsupported migration format: {}", manifest.format));
    }
    if manifest.format_version != MIGRATION_FORMAT_VERSION {
        return Err(format!(
            "unsupported migration format version: {}",
            manifest.format_version
        ));
    }
    let expected_contents = MIGRATION_CONTENTS
        .iter()
        .map(|entry| (*entry).to_string())
        .collect::<Vec<_>>();
    if manifest.app_version.trim().is_empty() || manifest.contents != expected_contents {
        return Err("invalid migration manifest contents".to_string());
    }
    if !warehouse.join("registry.toml").is_file() {
        return Err("invalid migration archive: registry.toml is missing".to_string());
    }

    Ok(())
}

#[cfg(any(target_os = "macos", target_os = "linux", test))]
fn prepare_restored_registry(
    restored_home: &Path,
    destination_home: &Path,
    cfg: &agents_manager_core::AppConfig,
) -> Result<(), String> {
    let mut restored_cfg = cfg.clone();
    restored_cfg.registry_path = restored_home.join("registry.toml");
    let mut registry = load_skill_registry(&restored_cfg)
        .map_err(|error| format!("invalid migration registry: {error}"))?;

    let mut stable_ids = std::collections::HashSet::new();
    let mut skill_ids = std::collections::HashSet::new();
    for skill in &mut registry.skills {
        let mut components = Path::new(&skill.id).components();
        let valid_id =
            matches!(components.next(), Some(Component::Normal(_))) && components.next().is_none();
        if skill.stable_id == 0
            || !valid_id
            || !stable_ids.insert(skill.stable_id)
            || !skill_ids.insert(skill.id.clone())
        {
            return Err("invalid migration registry: skill IDs must be unique".to_string());
        }
        skill.path = destination_home.join("skills").join(&skill.id);
    }

    if registry
        .skills
        .iter()
        .map(|skill| skill.stable_id)
        .max()
        .is_some_and(|max_id| registry.next_id <= max_id)
    {
        return Err("invalid migration registry: next_id must exceed existing IDs".to_string());
    }

    save_skill_registry(&restored_cfg, &registry)
        .map_err(|error| format!("failed to prepare migration registry: {error}"))
}

#[cfg(any(target_os = "macos", target_os = "linux", test))]
fn is_warehouse_home(path: &Path) -> bool {
    ["skills", "memories", "plugins"]
        .iter()
        .all(|name| path.join(name).is_dir())
}

#[tauri::command]
fn app_version_cmd(app: tauri::AppHandle) -> Result<String, String> {
    Ok(app.package_info().version.to_string())
}

fn parse_client(client: &str) -> Result<ClientKind, String> {
    match client {
        "codex" => Ok(ClientKind::Codex),
        "claude" => Ok(ClientKind::Claude),
        "cursor" => Ok(ClientKind::Cursor),
        _ => Err(format!("unsupported client: {client}")),
    }
}

fn parse_mode(mode: Option<&str>) -> InstallMode {
    match mode {
        Some("copy") => InstallMode::Copy,
        _ => InstallMode::Symlink,
    }
}

fn parse_init_mode(mode: Option<&str>) -> InitMode {
    match mode {
        Some("copy") => InitMode::Copy,
        _ => InitMode::Symlink,
    }
}

fn parse_scope(scope: &str) -> Result<&str, String> {
    match scope {
        "project" => Ok("project"),
        "global" => Ok("global"),
        _ => Err(format!("unsupported scope: {scope}")),
    }
}

fn editable_settings_payload(cfg: &agents_manager_core::AppConfig) -> EditableSettingsPayload {
    let defaults = agents_manager_core::AppConfig::default();
    EditableSettingsPayload {
        warehouse_home: warehouse_home_from_config(cfg).display().to_string(),
        library_roots: cfg
            .library_roots
            .iter()
            .map(|path| path.display().to_string())
            .collect(),
        default_warehouse_home: warehouse_home_from_config(&defaults).display().to_string(),
    }
}

fn resolve_home_dir() -> Result<PathBuf, String> {
    ClientRoots::detect()
        .map(|roots| roots.home_dir().to_path_buf())
        .ok_or_else(|| "could not resolve home directory".to_string())
}

fn require_project_path(project_path: Option<&str>) -> Result<PathBuf, String> {
    let path = project_path
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .ok_or_else(|| "project path is required for project scope".to_string())?;
    Ok(PathBuf::from(path))
}

fn resolve_mcp_target(req: &McpConfigReq) -> Result<McpTarget, String> {
    let client = parse_client(&req.client)?;
    let scope = parse_scope(&req.scope)?;
    let home_dir = resolve_home_dir()?;

    match (client, scope) {
        (ClientKind::Codex, "global") => Ok(McpTarget::codex_global(home_dir)),
        (ClientKind::Codex, "project") => Ok(McpTarget::codex_project(require_project_path(
            req.project_path.as_deref(),
        )?)),
        (ClientKind::Claude, "global") => Ok(McpTarget::claude_global(home_dir)),
        (ClientKind::Claude, "project") => Ok(McpTarget::claude_project(require_project_path(
            req.project_path.as_deref(),
        )?)),
        (ClientKind::Cursor, "global") => Ok(McpTarget::cursor_global(home_dir)),
        (ClientKind::Cursor, "project") => Ok(McpTarget::cursor_project(require_project_path(
            req.project_path.as_deref(),
        )?)),
        _ => Err("unsupported MCP target".into()),
    }
}

fn resolve_skill_root(stable_id: u64) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let cfg = load_app_config()?;
    let entries = scan_warehouse(&cfg)?;
    entries
        .into_iter()
        .find(|entry| entry.stable_id == stable_id)
        .map(|entry| entry.path)
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "skill not found").into())
}

fn resolve_skill_file(
    stable_id: u64,
    relative_path: &str,
) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let root = resolve_skill_root(stable_id)?;
    let relative = sanitize_relative_path(relative_path)?;
    Ok(root.join(relative))
}

fn resolve_memory_root(stable_id: u64) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let cfg = load_app_config()?;
    let entries = scan_memory_warehouse(&cfg)?;
    entries
        .into_iter()
        .find(|entry| entry.stable_id == stable_id)
        .map(|entry| entry.path)
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "memory not found").into())
}

fn resolve_memory_file(
    stable_id: u64,
    relative_path: &str,
) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let root = resolve_memory_root(stable_id)?;
    let relative = sanitize_relative_path(relative_path)?;
    Ok(root.join(relative))
}

fn sanitize_relative_path(relative_path: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let path = Path::new(relative_path);
    let mut cleaned = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => cleaned.push(part),
            Component::CurDir => {}
            _ => {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidInput,
                    "path must stay inside selected entry",
                )
                .into())
            }
        }
    }
    Ok(cleaned)
}

fn build_tree(root: &Path, relative: &Path) -> Result<SkillTreeNode, Box<dyn std::error::Error>> {
    let current = root.join(relative);
    let metadata = fs::metadata(&current)?;
    let name = if relative.as_os_str().is_empty() {
        root.file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|| "skill".to_string())
    } else {
        current
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default()
    };

    if metadata.is_dir() {
        let mut children = Vec::new();
        let mut entries = fs::read_dir(&current)?.collect::<Result<Vec<_>, _>>()?;
        entries.sort_by_key(|entry| entry.file_name());
        for entry in entries {
            let child_relative = if relative.as_os_str().is_empty() {
                PathBuf::from(entry.file_name())
            } else {
                relative.join(entry.file_name())
            };
            children.push(build_tree(root, &child_relative)?);
        }
        Ok(SkillTreeNode {
            name,
            path: relative.to_string_lossy().into_owned(),
            kind: "dir".to_string(),
            children,
        })
    } else {
        Ok(SkillTreeNode {
            name,
            path: relative.to_string_lossy().into_owned(),
            kind: "file".to_string(),
            children: Vec::new(),
        })
    }
}

fn main() {
    let mut cfg = load_app_config().expect("failed to load app config");
    if let Some(roots) = ClientRoots::detect() {
        if !cfg.bootstrap_migration_done {
            if bootstrap_legacy_migration(&mut cfg, &roots).is_ok() {
                save_app_config(&cfg).expect("failed to persist bootstrap migration state");
            }
        }
    }

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_warehouse_skills_cmd,
            list_warehouse_plugins_cmd,
            create_skill_cmd,
            delete_skill_cmd,
            rename_skill_cmd,
            list_warehouse_memories_cmd,
            create_memory_cmd,
            rename_memory_cmd,
            delete_memory_cmd,
            update_skill_metadata_cmd,
            inspect_skill_tree_cmd,
            inspect_memory_tree_cmd,
            read_skill_file_cmd,
            read_memory_file_cmd,
            write_skill_file_cmd,
            write_memory_file_cmd,
            create_skill_path_cmd,
            create_memory_path_cmd,
            rename_skill_path_cmd,
            rename_memory_path_cmd,
            delete_skill_path_cmd,
            delete_memory_path_cmd,
            migrate_legacy_skills_cmd,
            preview_dropped_skill_cmd,
            import_dropped_skill_cmd,
            preview_dropped_plugin_cmd,
            import_dropped_plugin_cmd,
            init_claude_plugin_cmd,
            import_dropped_memory_cmd,
            copy_paths_into_skill_cmd,
            copy_paths_into_memory_cmd,
            import_git_skills_cmd,
            sync_global_skills_cmd,
            generate_init_project_command_cmd,
            generate_init_memory_command_cmd,
            load_editable_settings_cmd,
            save_editable_settings_cmd,
            load_mcp_config_cmd,
            save_mcp_config_cmd,
            pick_folder_cmd,
            export_warehouse_archive_cmd,
            restore_warehouse_archive_cmd,
            app_version_cmd
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{
        find_restored_warehouse, prepare_restored_registry, restore_warehouse_archive,
        write_migration_manifest, MIGRATION_ARCHIVE_ROOT, MIGRATION_FORMAT,
        MIGRATION_FORMAT_VERSION, MIGRATION_MANIFEST_NAME,
    };
    use std::fs;

    fn create_warehouse(path: &std::path::Path) {
        for name in ["skills", "memories", "plugins"] {
            fs::create_dir_all(path.join(name)).unwrap();
        }
    }

    #[test]
    fn macos_restore_pipeline_is_type_checked() {
        let restore = restore_warehouse_archive;
        let _ = restore;
    }

    #[test]
    fn finds_exported_warehouse_inside_archive_root() {
        let temp = tempfile::tempdir().unwrap();
        let warehouse = temp.path().join(MIGRATION_ARCHIVE_ROOT);
        create_warehouse(&warehouse);

        assert_eq!(find_restored_warehouse(temp.path()).unwrap(), warehouse);
    }

    #[test]
    fn writes_and_accepts_versioned_migration_manifest() {
        let temp = tempfile::tempdir().unwrap();
        let warehouse = temp.path().join(MIGRATION_ARCHIVE_ROOT);
        create_warehouse(&warehouse);
        fs::write(warehouse.join("registry.toml"), "next_id = 1\n").unwrap();

        write_migration_manifest(&warehouse).unwrap();

        let manifest: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(warehouse.join(MIGRATION_MANIFEST_NAME)).unwrap(),
        )
        .unwrap();
        assert_eq!(manifest["format"], MIGRATION_FORMAT);
        assert_eq!(manifest["format_version"], MIGRATION_FORMAT_VERSION);
        assert_eq!(find_restored_warehouse(temp.path()).unwrap(), warehouse);
    }

    #[test]
    fn rejects_unsupported_migration_manifest_version() {
        let temp = tempfile::tempdir().unwrap();
        let warehouse = temp.path().join(MIGRATION_ARCHIVE_ROOT);
        create_warehouse(&warehouse);
        fs::write(warehouse.join("registry.toml"), "next_id = 1\n").unwrap();
        write_migration_manifest(&warehouse).unwrap();

        let manifest_path = warehouse.join(MIGRATION_MANIFEST_NAME);
        let mut manifest: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&manifest_path).unwrap()).unwrap();
        manifest["format_version"] = serde_json::json!(MIGRATION_FORMAT_VERSION + 1);
        fs::write(manifest_path, serde_json::to_string(&manifest).unwrap()).unwrap();

        let error = find_restored_warehouse(temp.path()).unwrap_err();
        assert!(error.contains("unsupported migration format version"));
    }

    #[test]
    fn restored_registry_paths_are_rebased_to_destination_warehouse() {
        let temp = tempfile::tempdir().unwrap();
        let restored_home = temp.path().join(MIGRATION_ARCHIVE_ROOT);
        let destination_home = temp.path().join("destination");
        create_warehouse(&restored_home);
        fs::write(
            restored_home.join("registry.toml"),
            r#"next_id = 2

[[skills]]
stable_id = 1
id = "demo"
path = "/old-machine/.agents-manager/skills/demo"
active = true
tags = ["portable"]
"#,
        )
        .unwrap();

        let cfg = agents_manager_core::AppConfig::default();
        prepare_restored_registry(&restored_home, &destination_home, &cfg).unwrap();

        let mut restored_cfg = cfg;
        restored_cfg.registry_path = restored_home.join("registry.toml");
        let registry = agents_manager_core::load_skill_registry(&restored_cfg).unwrap();
        assert_eq!(registry.skills[0].stable_id, 1);
        assert_eq!(registry.skills[0].tags, ["portable"]);
        assert_eq!(
            registry.skills[0].path,
            destination_home.join("skills/demo")
        );
    }

    #[test]
    fn rejects_archive_without_warehouse_layout() {
        let temp = tempfile::tempdir().unwrap();
        fs::create_dir(temp.path().join("skills")).unwrap();

        let error = find_restored_warehouse(temp.path()).unwrap_err();
        assert!(error.contains("expected skills, memories, and plugins"));
    }
}
