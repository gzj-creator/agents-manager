# Agents Manager Registry Redesign Design

**Date:** 2026-04-18

## Context

The current product still carries the old profile-centric model:

- skills are discovered from multiple external roots
- the desktop UI is centered on profile editing and project apply flows
- there is no application-owned warehouse for skills
- there is no first-class metadata model for grouping or tagging skills

That model does not match the intended product. The application needs one managed warehouse, one registry, explicit client sync, and a desktop workspace that feels like a dedicated skill manager instead of a form wrapper around CLI actions.

## Product Goal

Redefine `agents-manager` as a warehouse-first desktop application with:

- a single source of truth at `~/.agents-manager/skills`
- stable numeric IDs owned by the application
- registry-owned metadata for skill type and tags
- one bootstrap migration from existing client roots into the warehouse
- explicit manual migration after bootstrap through a desktop button
- client sync that always writes warehouse-managed skills back into Codex / Claude / Cursor
- a richer desktop UI for browsing, filtering, editing, and distributing skills

## Core Model

### Single Warehouse Source

All skill discovery for the product UI must come only from:

`~/.agents-manager/skills`

The desktop client must not list skills directly from `~/.codex/skills` or `~/.claude/skills`. Those paths become migration inputs and client sync targets, not ongoing listing sources.

### Stable Numeric IDs

Each warehouse skill gets a persistent numeric ID in registry metadata under `~/.agents-manager`.

Rules:

- IDs are assigned once
- IDs increase monotonically
- IDs are never reused
- deleted or missing skills retire their IDs

These IDs become the canonical references used by the CLI, generated commands, and desktop actions.

### Registry-Owned Metadata

Skill grouping metadata must live in the application registry, not in `SKILL.md`.

Each registry entry should track:

- `stable_id`
- `id`
- `path`
- `active`
- `skill_type`
- `tags`
- `source_hint`

`skill_type` and `tags` are the authoritative values used by the desktop UI for grouping and filtering. Editing them in the UI updates registry state only.

## Migration Model

### Bootstrap Migration

On first launch of the redesigned product, the application performs a one-time migration from:

- `~/.codex/skills`
- `~/.claude/skills`

This bootstrap migration moves valid skill directories into `~/.agents-manager/skills`.

The application stores a flag such as `bootstrap_migration_done` in app config so this automatic migration only happens once.

### Manual Migration

After bootstrap, migration must never run automatically again.

The desktop UI exposes a manual "migrate existing skills" action that re-runs the same migration logic on demand.

### Move Semantics

Migration uses move semantics, not copy semantics.

Reasons:

- warehouse must become the only real source of truth
- clients should not keep using stale pre-migration skill directories
- later sync operations must always push warehouse-managed content back into client roots

If the application enables a skill for a client after migration, the enabled version must come from the warehouse, not from an old leftover directory.

### Collision Resolution

Migration scans sources in deterministic order:

1. `codex`
2. `claude`

If two skills share a name:

- same content: keep one warehouse copy and remove the later duplicate from its source root
- different content: the later discovered version overwrites the earlier one in the warehouse

With the fixed scan order above, `claude` wins conflicts against `codex`.

## Client Sync Model

Client roots remain:

- Codex: `~/.codex/skills`
- Claude: `~/.claude/skills`
- Cursor: `~/.cursor/skills`

These are output targets. The product syncs selected warehouse skills into them by symlink or copy.

This means the runtime flow is:

1. migration moves legacy skills into warehouse
2. desktop edits warehouse files and registry metadata
3. sync writes chosen warehouse skills back to target clients

## Project Initialization

The new `init-project` command still generates project-local client directories from selected warehouse skill IDs.

The command should:

- accept client kind
- accept numeric skill IDs
- resolve them through warehouse-backed scan results
- create the correct client project directory
- create the correct memory file
- link or copy warehouse skills into the project-local client directory

Memory files remain:

- `claude` -> `CLAUDE.md`
- `codex` -> `AGENTS.md`
- `cursor` -> product-defined cursor memory file

## Desktop Information Architecture

The desktop client should become a warehouse workspace with four major areas:

### 1. Skill Navigator

The left rail shows warehouse skills only.

It supports:

- search by name or ID
- grouping by `skill_type`
- tag filtering
- per-skill summary chips for type, tags, and target sync state

Grouping should be visual and obvious, not just a flat list with secondary labels.

### 2. Skill Tree And Editor

The middle workspace shows:

- selected skill file tree
- selected file editor
- file/folder create, rename, delete

Phase one still limits inline editing to text files.

### 3. Metadata And Distribution Panel

The right rail shows:

- stable ID
- editable `skill_type`
- editable tags
- target client picker
- sync action
- generated `init-project` command

Metadata edits update registry only.

### 4. Migration And System Actions

The shell includes a clear migration action area with:

- one-time migration status
- manual migration button
- migration result summary

Users should understand when migration has already happened and when they are explicitly running it again.

## UI Direction

This redesign is also a visual refresh.

The new interface should:

- preserve the current warm editorial palette only if it still fits the warehouse workspace
- feel more like a toolbench than a profile form
- make grouped navigation, filters, and editing hierarchy obvious at a glance
- improve information density without collapsing into cramped admin UI
- keep strong desktop readability and usable mobile-width fallback behavior

The page should move away from "stacked forms plus output box" into a deliberate workspace layout with clearer hierarchy, stronger grouping, and more discoverable actions.

## Persistence

Recommended app-owned paths:

- `~/.agents-manager/skills/`
- `~/.agents-manager/registry.toml`
- `~/.agents-manager/config.toml`

Config should track at minimum:

- `skill_warehouse`
- `registry_path`
- `bootstrap_migration_done`

Registry should track at minimum:

- stable identity
- warehouse path
- lifecycle state
- `skill_type`
- `tags`
- `source_hint`

## Error Handling

- Missing or invalid source directories during migration should not crash startup.
- Migration reports must explicitly show imported, overwritten, skipped, and removed counts.
- Conflicting target files during client sync should be overwritten only when they correspond to the explicit sync action, not silently during unrelated operations.
- Missing registry entries should surface as invalid skill IDs, not panics.
- File editor save failures must preserve unsaved buffer state in the UI.

## Validation Criteria

The redesign is considered correct when:

- desktop skill listing only reflects `~/.agents-manager/skills`
- bootstrap migration runs once and records completion
- later launches do not auto-migrate again
- manual migration remains available and re-runnable
- migrated legacy client directories no longer remain the live source for those skills
- registry stores stable IDs, `skill_type`, and tags
- UI groups skills by type and filters by tags
- syncing a skill to Codex / Claude / Cursor writes the warehouse-managed version
- generated `init-project` commands still resolve warehouse IDs correctly

## Phase One Scope

Phase one includes:

- warehouse source root
- stable registry IDs
- registry-owned `skill_type` and tags
- one-time bootstrap migration
- manual migration action
- client sync for Codex / Claude / Cursor
- generated `init-project` command flow
- desktop grouped skill list, filters, tree view, text editor, and metadata editing
- desktop page polish aligned with the new workflow

Phase one excludes:

- binary previews
- advanced editor tooling
- background automatic reconciliation after bootstrap
- remote sync
- metadata embedded back into `SKILL.md`
