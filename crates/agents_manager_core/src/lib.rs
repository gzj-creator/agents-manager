mod apply;
mod config;
#[cfg(test)]
mod core_tests;
mod doctor;
mod error;
mod init_project;
mod library;
mod migration;
mod profile;
mod registry;
mod targets;

pub use apply::{
    apply_to_project, path_allowed_for_source, sync_global_skills, ApplyReport, ApplySelections,
    GlobalSyncReport, GlobalSyncRequest, InstallMode,
};
pub use config::{
    init_config_tree, load_app_config, save_app_config, write_default_profiles_if_missing, AppConfig,
};
pub use doctor::{doctor, DoctorReport, PolicyWarning};
pub use error::{CoreError, Result};
pub use init_project::{init_project, InitMode, InitProjectReport};
pub use library::{find_skill, scan_library, scan_warehouse, SkillEntry};
pub use migration::{bootstrap_legacy_migration, migrate_legacy_skills, MigrationReport};
pub use profile::{list_profiles, load_profile, save_profile, Profile};
pub use registry::{
    load_skill_registry, reconcile_registry, save_skill_registry, RegistrySkill, SkillRegistry,
};
pub use targets::{ClientKind, ClientRoots};
