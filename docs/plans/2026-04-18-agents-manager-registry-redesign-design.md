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

The desktop client should become a single-window application with a persistent navigation rail and page-based workflows. It should feel like a desktop tool, not a dashboard that stacks every control into one screen.

### Shell Structure

The shell has three persistent layers:

1. left navigation rail
2. top header for page title, selected skill summary, and global action status
3. one focused page body at a time

This keeps all core workflows in one window while avoiding the crowding caused by the previous three-column all-in-one layout.

### Navigation Pages

#### 1. Skills

This is the default landing page.

It focuses on warehouse browsing and discovery:

- search by name or stable ID
- grouping by `skill_type`
- tag filtering
- compact skill cards with type, tags, and source summary
- quick selection that routes into the editor page

The page should prioritize scanability and discovery over editing controls.

#### 2. Editor

This page focuses on working on one selected skill.

It contains:

- selected skill summary
- file tree
- text editor
- file and folder actions
- registry metadata editing for `skill_type` and tags

Phase one still limits inline editing to text files.

#### 3. Sync

This page focuses on distribution and project setup.

It contains:

- client selection
- selected skill list
- sync action
- generated `init-project` command
- install mode and target summary where relevant

Users should understand that warehouse content is being pushed outward to clients and projects.

#### 4. Migration

This page focuses on legacy import.

It contains:

- one-time bootstrap migration state
- manual migration button
- migration result summary
- source roots being scanned

Users should understand that automatic migration only happens once and later migration is a manual action.

#### 5. Settings

This page focuses on application-owned paths and environment context.

It contains:

- warehouse path
- registry path
- client root paths
- migration state summary
- any read-only environment diagnostics needed to explain sync behavior

## UI Direction

This redesign is also a visual refresh.

The new interface should:

- feel like a dedicated desktop client with stronger structural hierarchy
- avoid equal-weight cards competing for attention on one screen
- use navigation and page transitions to separate browse, edit, sync, migration, and settings concerns
- preserve the warm material palette only where it supports clarity
- improve spacing, typography, and section rhythm so the app feels less cramped
- keep strong desktop readability and usable narrow-width fallback behavior

The visual target is a desktop tool with deliberate structure, not a generic admin form and not a single giant workspace that exposes every control at once.

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
- desktop multi-page shell with `Skills`, `Editor`, `Sync`, `Migration`, and `Settings`
- desktop page polish aligned with the new workflow

Phase one excludes:

- binary previews
- advanced editor tooling
- background automatic reconciliation after bootstrap
- remote sync
- metadata embedded back into `SKILL.md`
