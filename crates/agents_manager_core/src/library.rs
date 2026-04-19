use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use sha2::{Digest, Sha256};
use walkdir::WalkDir;

use crate::config::AppConfig;
use crate::error::Result;

#[derive(Debug, Clone, Serialize)]
pub struct SkillEntry {
    pub stable_id: u64,
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub skill_type: Option<String>,
    pub tags: Vec<String>,
    pub source_hint: Option<String>,
    pub path: PathBuf,
    pub skill_md_path: PathBuf,
}

/// Scan all `library_roots` for directories containing `SKILL.md`.
pub fn scan_library(cfg: &AppConfig) -> Result<Vec<SkillEntry>> {
    scan_roots(&cfg.library_roots, 0)
}

pub fn scan_warehouse(cfg: &AppConfig) -> Result<Vec<SkillEntry>> {
    let discovered = discover_skill_paths(&cfg.skill_warehouse)?;
    let pairs: Vec<(String, PathBuf)> = discovered
        .iter()
        .map(|entry| (entry.id.clone(), entry.path.clone()))
        .collect();
    let registry = crate::registry::reconcile_registry(cfg, &pairs)?;

    let mut out = Vec::new();
    for entry in discovered {
        let stable_id = registry
            .skills
            .iter()
            .find(|skill| skill.path == entry.path)
            .map(|skill| skill.stable_id)
            .unwrap_or(0);
        out.push(SkillEntry {
            stable_id,
            id: entry.id,
            name: entry.name,
            description: entry.description,
            skill_type: registry
                .skills
                .iter()
                .find(|skill| skill.path == entry.path)
                .and_then(|skill| skill.skill_type.clone()),
            tags: registry
                .skills
                .iter()
                .find(|skill| skill.path == entry.path)
                .map(|skill| skill.tags.clone())
                .unwrap_or_default(),
            source_hint: registry
                .skills
                .iter()
                .find(|skill| skill.path == entry.path)
                .and_then(|skill| skill.source_hint.clone()),
            path: entry.path,
            skill_md_path: entry.skill_md_path,
        });
    }
    out.sort_by(|a, b| a.stable_id.cmp(&b.stable_id).then_with(|| a.id.cmp(&b.id)));
    Ok(out)
}

fn scan_roots(roots: &[PathBuf], stable_id: u64) -> Result<Vec<SkillEntry>> {
    let mut by_basename: HashMap<String, Vec<PathBuf>> = HashMap::new();
    for root in roots {
        if !root.is_dir() {
            continue;
        }
        for entry in WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
            if !entry.file_type().is_file() {
                continue;
            }
            if entry.file_name() != "SKILL.md" {
                continue;
            }
            let skill_md = entry.path().to_path_buf();
            let skill_dir = skill_md
                .parent()
                .map(Path::to_path_buf)
                .unwrap_or_else(|| PathBuf::from("."));
            let base = skill_dir
                .file_name()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_else(|| "unknown".to_string());
            by_basename.entry(base).or_default().push(skill_dir);
        }
    }

    let mut out: Vec<SkillEntry> = Vec::new();
    for (basename, mut paths) in by_basename {
        paths.sort();
        if paths.len() == 1 {
            let path = paths.into_iter().next().unwrap();
            let meta = read_skill_frontmatter(&path.join("SKILL.md"))?;
            let skill_md_path = path.join("SKILL.md");
            out.push(SkillEntry {
                stable_id,
                id: basename.clone(),
                name: meta.name,
                description: meta.description,
                skill_type: None,
                tags: Vec::new(),
                source_hint: None,
                path,
                skill_md_path,
            });
        } else {
            for path in paths {
                let digest = short_hash(path.display().to_string().as_str());
                let id = format!("{basename}-{digest}");
                let meta = read_skill_frontmatter(&path.join("SKILL.md"))?;
                let skill_md_path = path.join("SKILL.md");
                out.push(SkillEntry {
                    stable_id,
                    id,
                    name: meta.name,
                    description: meta.description,
                    skill_type: None,
                    tags: Vec::new(),
                    source_hint: None,
                    path,
                    skill_md_path,
                });
            }
        }
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

fn discover_skill_paths(root: &Path) -> Result<Vec<SkillEntry>> {
    if !root.is_dir() {
        return Ok(Vec::new());
    }

    let mut out = Vec::new();
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let id = path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|| "unknown".to_string());
        let skill_md_path = path.join("SKILL.md");
        let meta = read_skill_frontmatter(&skill_md_path)?;
        out.push(SkillEntry {
            stable_id: 0,
            id,
            name: meta.name,
            description: meta.description,
            skill_type: None,
            tags: Vec::new(),
            source_hint: None,
            path,
            skill_md_path,
        });
    }

    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

fn short_hash(s: &str) -> String {
    let mut h = Sha256::new();
    h.update(s.as_bytes());
    let full = h.finalize();
    hex::encode(&full[..6])
}

struct FrontmatterMeta {
    name: Option<String>,
    description: Option<String>,
}

fn read_skill_frontmatter(skill_md: &Path) -> Result<FrontmatterMeta> {
    let s = fs::read_to_string(skill_md).unwrap_or_default(); // missing file: empty meta
    if !s.trim_start().starts_with("---") {
        return Ok(FrontmatterMeta {
            name: None,
            description: None,
        });
    }
    let rest = s.trim_start().strip_prefix("---").unwrap_or("");
    let end = rest.find("---");
    let (fm, _) = match end {
        Some(i) => (&rest[..i], &rest[i + 3..]),
        None => (rest, ""),
    };
    let mut name = None;
    let mut description = None;
    for line in fm.lines() {
        let line = line.trim();
        if let Some(v) = line.strip_prefix("name:") {
            name = Some(parse_yaml_string(v));
        } else if let Some(v) = line.strip_prefix("description:") {
            description = Some(parse_yaml_string(v));
        }
    }
    Ok(FrontmatterMeta { name, description })
}

fn parse_yaml_string(rest: &str) -> String {
    let t = rest.trim();
    t.trim_matches(|c| c == '"' || c == '\'').to_string()
}

pub fn find_skill<'a>(entries: &'a [SkillEntry], skill_id: &str) -> Option<&'a SkillEntry> {
    entries.iter().find(|e| e.id == skill_id)
}
