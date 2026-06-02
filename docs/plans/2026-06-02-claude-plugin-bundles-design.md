# Claude Plugin Bundles Design

## Goal

Support dragging a Claude plugin-style bundle into agents-manager and installing it into a project as Claude project-local resources.

## Decision

Dragged plugin bundles are stored globally under `~/.agents-manager/plugins/<plugin-id>/`. Project installation writes only the files Claude consumes:

- `commands/*.md` -> `<project>/.claude/commands/*.md`
- `agents/*.md` -> `<project>/.claude/agents/*.md`
- `skills/*` -> `<project>/.claude/skills/*`

The project should not receive an intermediate `.agents-manager/plugins/<plugin-id>` directory.

## Accepted Bundle Shape

The importer accepts a directory that contains at least one of:

- `commands/` with one or more Markdown files
- `agents/` with one or more Markdown files
- `skills/` with one or more child directories that contain `SKILL.md`

For the current scope, this is Claude-only. Codex and Cursor project layouts remain unchanged.

## Architecture

The Rust core gains a plugin warehouse module parallel to the existing skill warehouse logic. It owns preview, import, scan, and project installation behavior. The Tauri layer exposes focused commands for desktop drag-and-drop. The desktop app routes dropped plugin directories through a plugin import path and keeps the existing skill drop flow unchanged for plain skill directories or `SKILL.md` files.

Project installation should support symlink and copy modes where the existing init-project behavior already does. Conflict behavior stays conservative: if a destination path exists, fail unless the caller explicitly enables force overwrite.

## Non-Goals

- No generic plugin marketplace.
- No plugin editing UI beyond what is needed to import, list, and install.
- No Codex or Cursor plugin targets.
- No hidden project-local `.agents-manager/plugins` staging directory.

## Testing

Core tests should cover bundle detection, import into `~/.agents-manager/plugins`, rejection of invalid directories, and installation into `.claude/commands`, `.claude/agents`, and `.claude/skills`.

Desktop tests should cover drag/drop routing so plugin bundles do not get misclassified as skills.
