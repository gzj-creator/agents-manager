#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;

use agents_manager_core::{
    apply_to_project, doctor, init_config_tree, list_profiles, load_app_config, load_profile,
    save_profile, scan_library, ApplySelections, InstallMode, Profile,
};
use serde::Deserialize;

#[tauri::command]
fn scan_library_cmd() -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let entries = scan_library(&cfg).map_err(|e| e.to_string())?;
    serde_json::to_value(entries).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_profiles_cmd() -> Result<serde_json::Value, String> {
    let profiles = list_profiles().map_err(|e| e.to_string())?;
    serde_json::to_value(profiles).map_err(|e| e.to_string())
}

#[derive(Deserialize)]
struct SaveProfileReq {
    id: String,
    project_skill_root: PathBuf,
    claude_md_target: PathBuf,
    agents_md_target: PathBuf,
}

#[tauri::command]
fn save_profile_cmd(req: SaveProfileReq) -> Result<serde_json::Value, String> {
    let p = Profile {
        id: req.id,
        project_skill_root: req.project_skill_root,
        claude_md_target: req.claude_md_target,
        agents_md_target: req.agents_md_target,
    };
    save_profile(&p).map_err(|e| e.to_string())?;
    serde_json::to_value(p).map_err(|e| e.to_string())
}

#[derive(Deserialize)]
struct ApplyReq {
    project: PathBuf,
    profile: String,
    skills: Vec<String>,
    claude_md: Option<PathBuf>,
    agents_md: Option<PathBuf>,
    mode: Option<String>,
}

#[tauri::command]
fn apply_cmd(req: ApplyReq) -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let profile = load_profile(&req.profile).map_err(|e| e.to_string())?;
    let mode = if req.mode.as_deref() == Some("copy") {
        InstallMode::Copy
    } else {
        InstallMode::Symlink
    };
    let report = apply_to_project(
        &req.project,
        &profile,
        &cfg,
        &ApplySelections {
            skill_ids: req.skills,
            claude_md_source: req.claude_md,
            agents_md_source: req.agents_md,
            mode,
        },
    )
    .map_err(|e| e.to_string())?;
    serde_json::to_value(report).map_err(|e| e.to_string())
}

#[tauri::command]
fn doctor_cmd(project: PathBuf, profile: String) -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let profile = load_profile(&profile).map_err(|e| e.to_string())?;
    let report = doctor(&project, &profile, &cfg).map_err(|e| e.to_string())?;
    serde_json::to_value(report).map_err(|e| e.to_string())
}

#[tauri::command]
fn pick_project_dir_cmd() -> Option<String> {
    rfd::FileDialog::new()
        .pick_folder()
        .map(|p| p.display().to_string())
}

fn main() {
    init_config_tree().expect("failed to init config tree");
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            scan_library_cmd,
            list_profiles_cmd,
            save_profile_cmd,
            apply_cmd,
            doctor_cmd,
            pick_project_dir_cmd
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
