#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Component, Path, PathBuf};

use agents_manager_core::{
    bootstrap_legacy_migration, create_skill, generate_init_project_command, import_git_skills,
    load_app_config, load_mcp_config, migrate_legacy_skills, save_app_config, save_mcp_config,
    scan_warehouse, sync_global_skills, update_editable_settings, update_skill_metadata,
    ClientKind, ClientRoots, CreateSkillRequest, EditableSettingsUpdate, GlobalSyncRequest,
    InstallMode, McpServerConfig, McpTarget,
};
use rfd::FileDialog;
use serde::{Deserialize, Serialize};

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
struct SyncSkillsReq {
    client: String,
    skill_ids: Vec<u64>,
    mode: Option<String>,
}

#[derive(Debug, Deserialize)]
struct InitCommandReq {
    client: String,
    skill_ids: Vec<u64>,
    mode: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GitImportReq {
    repo_url: String,
}

#[derive(Debug, Deserialize)]
struct CreateSkillReq {
    id: String,
    name: Option<String>,
    description: Option<String>,
}

#[derive(Debug, Serialize)]
struct EditableSettingsPayload {
    skill_warehouse: String,
    library_roots: Vec<String>,
    default_skill_warehouse: String,
}

#[derive(Debug, Deserialize)]
struct SaveEditableSettingsReq {
    skill_warehouse: String,
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
fn write_skill_file_cmd(req: WriteSkillFileReq) -> Result<(), String> {
    let path = resolve_skill_file(req.stable_id, &req.relative_path).map_err(|e| e.to_string())?;
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
fn rename_skill_path_cmd(req: RenameSkillPathReq) -> Result<(), String> {
    let from = resolve_skill_file(req.stable_id, &req.from).map_err(|e| e.to_string())?;
    let to = resolve_skill_file(req.stable_id, &req.to).map_err(|e| e.to_string())?;
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
    ))
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
    let warehouse = req.skill_warehouse.trim();
    if warehouse.is_empty() {
        return Err("warehouse path is required".into());
    }

    let updated = update_editable_settings(
        &cfg,
        EditableSettingsUpdate {
            skill_warehouse: Some(PathBuf::from(warehouse)),
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
    let target = resolve_mcp_target(&req)?;
    let target_path = target.config_path().map_err(|e| e.to_string())?;
    let config = load_mcp_config(&target).map_err(|e| e.to_string())?;
    let payload = McpConfigPayload {
        target_path: target_path.display().to_string(),
        servers: config.servers.into_values().collect(),
    };
    serde_json::to_value(payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_mcp_config_cmd(req: SaveMcpConfigReq) -> Result<serde_json::Value, String> {
    let target = resolve_mcp_target(&McpConfigReq {
        client: req.client,
        scope: req.scope,
        project_path: req.project_path,
    })?;
    let target_path = target.config_path().map_err(|e| e.to_string())?;
    save_mcp_config(&target, req.servers).map_err(|e| e.to_string())?;
    let config = load_mcp_config(&target).map_err(|e| e.to_string())?;
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

    Ok(dialog
        .pick_folder()
        .map(|path| path.display().to_string()))
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
        skill_warehouse: cfg.skill_warehouse.display().to_string(),
        library_roots: cfg
            .library_roots
            .iter()
            .map(|path| path.display().to_string())
            .collect(),
        default_skill_warehouse: defaults.skill_warehouse.display().to_string(),
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
                    "path must stay inside selected skill",
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
            create_skill_cmd,
            update_skill_metadata_cmd,
            inspect_skill_tree_cmd,
            read_skill_file_cmd,
            write_skill_file_cmd,
            create_skill_path_cmd,
            rename_skill_path_cmd,
            delete_skill_path_cmd,
            migrate_legacy_skills_cmd,
            import_git_skills_cmd,
            sync_global_skills_cmd,
            generate_init_project_command_cmd,
            load_editable_settings_cmd,
            save_editable_settings_cmd,
            load_mcp_config_cmd,
            save_mcp_config_cmd,
            pick_folder_cmd
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
