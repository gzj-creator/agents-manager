use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ClientKind {
    Codex,
    Claude,
    Cursor,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClientRoots {
    home: PathBuf,
}

impl ClientRoots {
    pub fn from_home(home: &Path) -> Self {
        Self {
            home: home.to_path_buf(),
        }
    }

    pub fn detect() -> Option<Self> {
        dirs::home_dir().as_deref().map(Self::from_home)
    }

    pub fn home_dir(&self) -> &Path {
        &self.home
    }

    pub fn global_skill_root(&self, client: ClientKind) -> PathBuf {
        match client {
            ClientKind::Codex => self.home.join(".codex").join("skills"),
            ClientKind::Claude => self.home.join(".claude").join("skills"),
            ClientKind::Cursor => self.home.join(".cursor").join("skills"),
        }
    }
}
