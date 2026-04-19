mod apply;
mod config;
#[cfg(test)]
mod core_tests;
mod creation;
mod doctor;
mod error;
mod git_import;
mod init_project;
mod library;
mod mcp;
mod migration;
mod profile;
mod registry;
mod settings;
mod targets;

pub use apply::{
    apply_to_project, path_allowed_for_source, sync_global_skills, ApplyReport, ApplySelections,
    GlobalSyncReport, GlobalSyncRequest, InstallMode,
};
pub use config::{
    init_config_tree, load_app_config, save_app_config, write_default_profiles_if_missing,
    AppConfig,
};
pub use creation::{create_skill, CreateSkillRequest};
pub use doctor::{doctor, DoctorReport, PolicyWarning};
pub use error::{CoreError, Result};
pub use git_import::{import_git_skills, GitImportDetail, GitImportReport};
pub use init_project::{generate_init_project_command, init_project, InitMode, InitProjectReport};
pub use library::{find_skill, scan_library, scan_warehouse, SkillEntry};
pub use migration::{bootstrap_legacy_migration, migrate_legacy_skills, MigrationReport};
pub use profile::{list_profiles, load_profile, save_profile, Profile};
pub use registry::{
    load_skill_registry, reconcile_registry, save_skill_registry, update_skill_metadata,
    RegistrySkill, SkillRegistry,
};
pub use settings::{update_editable_settings, EditableSettingsUpdate};
pub use targets::{ClientKind, ClientRoots};
pub use mcp::{
    load_mcp_config, save_mcp_config, McpClient, McpScope, McpServerConfig, McpTarget,
};
