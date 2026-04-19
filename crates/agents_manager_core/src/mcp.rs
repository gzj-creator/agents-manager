use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{CoreError, Result};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum JsonMcpStyle {
    Cursor,
    Claude,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum McpScope {
    Project,
    Global,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum McpTarget {
    CursorProject { project_root: PathBuf },
    CursorGlobal { home_dir: PathBuf },
    ClaudeProject { project_root: PathBuf },
    ClaudeGlobal { home_dir: PathBuf },
    CodexGlobal { home_dir: PathBuf },
    CodexProject { project_root: PathBuf },
}

impl McpTarget {
    pub fn cursor_project(project_root: impl AsRef<Path>) -> Self {
        Self::CursorProject {
            project_root: project_root.as_ref().to_path_buf(),
        }
    }

    pub fn cursor_global(home_dir: impl AsRef<Path>) -> Self {
        Self::CursorGlobal {
            home_dir: home_dir.as_ref().to_path_buf(),
        }
    }

    pub fn claude_project(project_root: impl AsRef<Path>) -> Self {
        Self::ClaudeProject {
            project_root: project_root.as_ref().to_path_buf(),
        }
    }

    pub fn claude_global(home_dir: impl AsRef<Path>) -> Self {
        Self::ClaudeGlobal {
            home_dir: home_dir.as_ref().to_path_buf(),
        }
    }

    pub fn codex_global(home_dir: impl AsRef<Path>) -> Self {
        Self::CodexGlobal {
            home_dir: home_dir.as_ref().to_path_buf(),
        }
    }

    pub fn codex_project(project_root: impl AsRef<Path>) -> Self {
        Self::CodexProject {
            project_root: project_root.as_ref().to_path_buf(),
        }
    }

    pub fn scope(&self) -> McpScope {
        match self {
            McpTarget::CursorProject { .. }
            | McpTarget::ClaudeProject { .. }
            | McpTarget::CodexProject { .. } => McpScope::Project,
            McpTarget::CursorGlobal { .. }
            | McpTarget::ClaudeGlobal { .. }
            | McpTarget::CodexGlobal { .. } => McpScope::Global,
        }
    }

    pub fn config_path(&self) -> Result<PathBuf> {
        match self {
            McpTarget::CursorProject { project_root } => {
                Ok(project_root.join(".cursor").join("mcp.json"))
            }
            McpTarget::CursorGlobal { home_dir } => Ok(home_dir.join(".cursor").join("mcp.json")),
            McpTarget::ClaudeProject { project_root } => Ok(project_root.join(".mcp.json")),
            McpTarget::ClaudeGlobal { home_dir } => Ok(home_dir.join(".claude.json")),
            McpTarget::CodexGlobal { home_dir } => Ok(home_dir.join(".codex").join("config.toml")),
            McpTarget::CodexProject { .. } => Err(CoreError::UnsupportedMcpTarget(
                "Codex does not support project-scoped MCP configuration".into(),
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct McpServerConfig {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

impl McpServerConfig {
    pub fn stdio(name: impl Into<String>, command: impl Into<String>, args: Vec<String>) -> Self {
        Self {
            name: name.into(),
            command: Some(command.into()),
            args,
            url: None,
        }
    }

    pub fn remote(name: impl Into<String>, url: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            command: None,
            args: Vec::new(),
            url: Some(url.into()),
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct McpClient {
    pub servers: BTreeMap<String, McpServerConfig>,
}

pub fn load_mcp_config(target: &McpTarget) -> Result<McpClient> {
    let path = target.config_path()?;
    let raw = read_optional_text_file(&path, "")?;
    if raw.trim().is_empty() {
        return Ok(McpClient::default());
    }

    match target {
        McpTarget::CursorProject { .. } | McpTarget::CursorGlobal { .. } => {
            load_json_mcp(&raw, "cursor mcp.json")
        }
        McpTarget::ClaudeProject { .. } | McpTarget::ClaudeGlobal { .. } => {
            load_json_mcp(&raw, "claude mcp json")
        }
        McpTarget::CodexGlobal { .. } => load_codex_global_toml(&raw),
        McpTarget::CodexProject { .. } => Err(CoreError::UnsupportedMcpTarget(
            "Codex does not support project-scoped MCP configuration".into(),
        )),
    }
}

pub fn save_mcp_config(target: &McpTarget, servers: Vec<McpServerConfig>) -> Result<()> {
    let path = target.config_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let mut next = match target {
        McpTarget::CursorProject { .. } | McpTarget::CursorGlobal { .. } => {
            let raw = read_optional_text_file(&path, "{}")?;
            save_json_mcp(&raw, servers, JsonMcpStyle::Cursor, "cursor mcp.json")?
        }
        McpTarget::ClaudeProject { .. } | McpTarget::ClaudeGlobal { .. } => {
            let raw = read_optional_text_file(&path, "{}")?;
            save_json_mcp(&raw, servers, JsonMcpStyle::Claude, "claude mcp json")?
        }
        McpTarget::CodexGlobal { .. } => {
            let raw = read_optional_text_file(&path, "")?;
            save_codex_global_toml(&raw, servers)?
        }
        McpTarget::CodexProject { .. } => Err(CoreError::UnsupportedMcpTarget(
            "Codex does not support project-scoped MCP configuration".into(),
        ))?,
    };

    if !next.ends_with('\n') {
        next.push('\n');
    }
    fs::write(path, next)?;
    Ok(())
}

fn read_optional_text_file(path: &Path, default: &str) -> Result<String> {
    match fs::read_to_string(path) {
        Ok(raw) => Ok(raw),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(default.to_string()),
        Err(error) => Err(error.into()),
    }
}

fn load_json_mcp(raw: &str, file_label: &str) -> Result<McpClient> {
    let v: serde_json::Value = serde_json::from_str(raw)?;
    let obj = v
        .as_object()
        .ok_or_else(|| {
            CoreError::InvalidMcpConfig(format!("{file_label} must be a JSON object"))
        })?;

    let mut client = McpClient::default();
    let Some(servers) = obj.get("mcpServers") else {
        return Ok(client);
    };
    let Some(servers_obj) = servers.as_object() else {
        return Err(CoreError::InvalidMcpConfig(format!(
            "{file_label} mcpServers must be an object"
        )));
    };

    for (name, entry) in servers_obj {
        let Some(entry_obj) = entry.as_object() else {
            continue;
        };
        let command = entry_obj
            .get("command")
            .and_then(|v| v.as_str())
            .filter(|command| !command.is_empty())
            .map(ToOwned::to_owned);
        let args = entry_obj
            .get("args")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let url = entry_obj
            .get("url")
            .and_then(|v| v.as_str())
            .filter(|url| !url.is_empty())
            .map(ToOwned::to_owned);

        match (command, url) {
            (Some(command), _) => {
                client.servers.insert(
                    name.to_string(),
                    McpServerConfig::stdio(name.to_string(), command, args),
                );
            }
            (None, Some(url)) => {
                client.servers.insert(name.to_string(), McpServerConfig::remote(name, url));
            }
            (None, None) => {}
        }
    }

    Ok(client)
}

fn save_json_mcp(
    raw: &str,
    servers: Vec<McpServerConfig>,
    style: JsonMcpStyle,
    file_label: &str,
) -> Result<String> {
    let mut v: serde_json::Value = if raw.trim().is_empty() {
        serde_json::json!({})
    } else {
        serde_json::from_str(raw)?
    };
    let obj = v
        .as_object_mut()
        .ok_or_else(|| {
            CoreError::InvalidMcpConfig(format!("{file_label} must be a JSON object"))
        })?;
    let servers_obj = servers
        .into_iter()
        .map(|s| {
            let mut entry = serde_json::Map::new();
            match (s.command, s.url) {
                (Some(command), _) => {
                    if matches!(style, JsonMcpStyle::Cursor | JsonMcpStyle::Claude) {
                        entry.insert("type".into(), serde_json::Value::String("stdio".into()));
                    }
                    entry.insert("command".into(), serde_json::Value::String(command));
                    entry.insert(
                        "args".into(),
                        serde_json::Value::Array(
                            s.args.into_iter().map(serde_json::Value::String).collect(),
                        ),
                    );
                }
                (None, Some(url)) => {
                    if matches!(style, JsonMcpStyle::Claude) {
                        entry.insert("type".into(), serde_json::Value::String("http".into()));
                    }
                    entry.insert("url".into(), serde_json::Value::String(url));
                }
                (None, None) => {}
            }
            (
                s.name,
                serde_json::Value::Object(entry),
            )
        })
        .collect();
    obj.insert("mcpServers".into(), serde_json::Value::Object(servers_obj));

    Ok(serde_json::to_string(&v)?)
}

fn load_codex_global_toml(raw: &str) -> Result<McpClient> {
    let v: toml::Value = toml::from_str(raw)?;
    let tbl = v.as_table().ok_or_else(|| {
        CoreError::InvalidMcpConfig("codex config.toml root must be a TOML table".into())
    })?;

    let mut client = McpClient::default();
    let Some(mcp_servers) = tbl.get("mcp_servers") else {
        return Ok(client);
    };
    let Some(mcp_tbl) = mcp_servers.as_table() else {
        return Err(CoreError::InvalidMcpConfig(
            "codex config.toml mcp_servers must be a TOML table".into(),
        ));
    };

    for (name, entry) in mcp_tbl {
        let Some(entry_tbl) = entry.as_table() else {
            continue;
        };
        let command = entry_tbl
            .get("command")
            .and_then(|v| v.as_str())
            .filter(|command| !command.is_empty())
            .map(ToOwned::to_owned);
        let args = entry_tbl
            .get("args")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let url = entry_tbl
            .get("url")
            .and_then(|v| v.as_str())
            .filter(|url| !url.is_empty())
            .map(ToOwned::to_owned);

        match (command, url) {
            (Some(command), _) => {
                client.servers.insert(
                    name.to_string(),
                    McpServerConfig::stdio(name.to_string(), command, args),
                );
            }
            (None, Some(url)) => {
                client.servers.insert(name.to_string(), McpServerConfig::remote(name, url));
            }
            (None, None) => {}
        }
    }

    Ok(client)
}

fn save_codex_global_toml(raw: &str, servers: Vec<McpServerConfig>) -> Result<String> {
    let mut root: toml::Value = if raw.trim().is_empty() {
        toml::Value::Table(toml::map::Map::new())
    } else {
        toml::from_str(raw)?
    };
    let tbl = root.as_table_mut().ok_or_else(|| {
        CoreError::InvalidMcpConfig("codex config.toml root must be a TOML table".into())
    })?;
    let mut mcp_tbl = toml::map::Map::new();
    for s in servers {
        let mut server_tbl = toml::map::Map::new();
        if let Some(command) = s.command {
            server_tbl.insert("command".into(), toml::Value::String(command));
            server_tbl.insert(
                "args".into(),
                toml::Value::Array(s.args.into_iter().map(toml::Value::String).collect()),
            );
        }
        if let Some(url) = s.url {
            server_tbl.insert("url".into(), toml::Value::String(url));
        }
        mcp_tbl.insert(s.name.clone(), toml::Value::Table(server_tbl));
    }
    tbl.insert("mcp_servers".into(), toml::Value::Table(mcp_tbl));

    Ok(toml::to_string(&root)?)
}
