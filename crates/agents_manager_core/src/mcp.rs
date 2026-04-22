use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use toml_edit::{value, Array, DocumentMut, Item, Table};

use crate::config::{save_app_config, AppConfig};
use crate::error::{CoreError, Result};

fn default_mcp_enabled() -> bool {
    true
}

fn is_true(value: &bool) -> bool {
    *value
}

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
    #[serde(default = "default_mcp_enabled", skip_serializing_if = "is_true")]
    pub enabled: bool,
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
            enabled: true,
            command: Some(command.into()),
            args,
            url: None,
        }
    }

    pub fn remote(name: impl Into<String>, url: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            enabled: true,
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

    let enabled_servers = servers
        .into_iter()
        .filter(|server| server.enabled)
        .collect::<Vec<_>>();

    let mut next = match target {
        McpTarget::CursorProject { .. } | McpTarget::CursorGlobal { .. } => {
            let raw = read_optional_text_file(&path, "{}")?;
            save_json_mcp(
                &raw,
                enabled_servers,
                JsonMcpStyle::Cursor,
                "cursor mcp.json",
            )?
        }
        McpTarget::ClaudeProject { .. } | McpTarget::ClaudeGlobal { .. } => {
            let raw = read_optional_text_file(&path, "{}")?;
            save_json_mcp(
                &raw,
                enabled_servers,
                JsonMcpStyle::Claude,
                "claude mcp json",
            )?
        }
        McpTarget::CodexGlobal { .. } => {
            let raw = read_optional_text_file(&path, "")?;
            save_codex_global_toml(&raw, enabled_servers)?
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

pub fn load_managed_mcp_config(cfg: &AppConfig, target: &McpTarget) -> Result<McpClient> {
    let mut client = load_mcp_config(target)?;
    let target_key = target.config_path()?.display().to_string();

    if let Some(disabled_servers) = cfg.mcp_disabled_servers.get(&target_key) {
        for server in disabled_servers {
            if client.servers.contains_key(&server.name) {
                continue;
            }

            let mut disabled_server = server.clone();
            disabled_server.enabled = false;
            client
                .servers
                .insert(disabled_server.name.clone(), disabled_server);
        }
    }

    Ok(client)
}

pub fn save_managed_mcp_config(
    cfg: &AppConfig,
    target: &McpTarget,
    servers: Vec<McpServerConfig>,
) -> Result<AppConfig> {
    let target_key = target.config_path()?.display().to_string();
    let mut enabled_servers = Vec::new();
    let mut disabled_servers = Vec::new();

    for mut server in servers {
        if server.enabled {
            server.enabled = true;
            enabled_servers.push(server);
        } else {
            server.enabled = false;
            disabled_servers.push(server);
        }
    }

    save_mcp_config(target, enabled_servers)?;

    let mut next_cfg = cfg.clone();
    if disabled_servers.is_empty() {
        next_cfg.mcp_disabled_servers.remove(&target_key);
    } else {
        next_cfg
            .mcp_disabled_servers
            .insert(target_key, disabled_servers);
    }
    save_app_config(&next_cfg)?;

    Ok(next_cfg)
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
    let obj = v.as_object().ok_or_else(|| {
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
                client
                    .servers
                    .insert(name.to_string(), McpServerConfig::remote(name, url));
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
    let obj = v.as_object_mut().ok_or_else(|| {
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
            (s.name, serde_json::Value::Object(entry))
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
                client
                    .servers
                    .insert(name.to_string(), McpServerConfig::remote(name, url));
            }
            (None, None) => {}
        }
    }

    Ok(client)
}

fn save_codex_global_toml(raw: &str, servers: Vec<McpServerConfig>) -> Result<String> {
    let mut document = if raw.trim().is_empty() {
        DocumentMut::new()
    } else {
        raw.parse::<DocumentMut>().map_err(|error| {
            CoreError::InvalidMcpConfig(format!("codex config.toml parse error: {error}"))
        })?
    };

    if servers.is_empty() {
        document.remove("mcp_servers");
        return Ok(document.to_string());
    }

    let mut mcp_table = Table::new();
    for server in servers {
        let mut server_table = Table::new();
        if let Some(command) = server.command {
            server_table["command"] = value(command);
            let mut args = Array::new();
            for arg in server.args {
                args.push(arg);
            }
            server_table["args"] = value(args);
        }
        if let Some(url) = server.url {
            server_table["url"] = value(url);
        }
        mcp_table[&server.name] = Item::Table(server_table);
    }

    document["mcp_servers"] = Item::Table(mcp_table);
    Ok(document.to_string())
}
