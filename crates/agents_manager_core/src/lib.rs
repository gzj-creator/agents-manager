mod apply;
mod config;
#[cfg(test)]
mod core_tests;
mod doctor;
mod error;
mod library;
mod profile;
mod registry;

pub use apply::{apply_to_project, path_allowed_for_source, ApplyReport, ApplySelections, InstallMode};
pub use config::{
    init_config_tree, load_app_config, save_app_config, write_default_profiles_if_missing, AppConfig,
};
pub use doctor::{doctor, DoctorReport, PolicyWarning};
pub use error::{CoreError, Result};
pub use library::{find_skill, scan_library, SkillEntry};
pub use profile::{list_profiles, load_profile, save_profile, Profile};
pub use registry::{load_skill_registry, save_skill_registry, RegistrySkill, SkillRegistry};
