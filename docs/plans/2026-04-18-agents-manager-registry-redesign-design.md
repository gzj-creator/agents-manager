# Agents Manager Registry Redesign Design

**Date:** 2026-04-18

## Context

The current project is built around scanning multiple existing client skill directories and applying selected skills into project-local targets through profiles. That model does not match the intended product.

The intended product is a single source of truth for all skills, with the desktop client managing:

- a unified skill warehouse
- stable numeric skill IDs
- client-specific global synchronization
- project initialization command generation
- full in-app editing for entire skill directories

## Product Goal

Redefine `agents-manager` as a skill warehouse manager centered on:

- source: `~/.agents-manager/skills`
- metadata: `~/.agents-manager` registry files
- targets:
  - global client skill locations for Codex / Claude / Cursor
  - per-project initialization via generated CLI commands

## Core Model

### Single Skill Source

All skills live under:

`~/.agents-manager/skills`

This is the only source directory. Existing client-specific directories are targets, not sources.

### Stable Numeric IDs

The application assigns each discovered skill a stable integer ID stored in persistent metadata under `~/.agents-manager`.

Rules:

- IDs are assigned once
- IDs are monotonically increasing
- IDs are never reused
- deleting a skill retires the ID permanently

These IDs are the canonical references used in generated CLI commands.

### Skill Identity

The product should not require authors to embed explicit IDs in `SKILL.md`.

Instead, the application owns identity through a registry file that maps:

- stable integer ID
- current skill path
- lifecycle status
- timestamps
- optional sync metadata

When a skill is renamed or moved through the application, the registry preserves its ID.

## User Flows

### Flow 1: Manage Warehouse Skills

The GUI presents the contents of `~/.agents-manager/skills` as the main skill list. Users can:

- create a new skill directory
- browse the entire directory tree
- edit any text file
- create files and folders
- rename or delete files and folders
- rename or delete skills

The app editor is responsible for the whole skill directory, not just `SKILL.md`.

### Flow 2: Sync Global Skills

The user selects one or more skills, then chooses:

- client: `codex`, `claude`, or `cursor`
- purpose: global skill

The application synchronizes the selected skills from `~/.agents-manager/skills` into the chosen client’s global skill location.

The sync behavior should prefer symlinks by default, with copy support as a fallback mode.

### Flow 3: Generate Project Initialization Command

The user selects one or more skills, then chooses:

- client: `codex`, `claude`, or `cursor`
- purpose: project skill

The GUI generates a command such as:

`agents-manager init-project --client codex --skills 1,2,3`

The user copies this command and runs it in a target project directory.

## Project Initialization Rules

The new CLI command `init-project` should:

- run in the current project directory
- accept a client type
- accept skill IDs
- resolve IDs through the registry
- create the client-specific project directory
- create the correct persistent memory file
- link or copy selected skills into the project-specific client directory

Memory file rules:

- `claude` -> `CLAUDE.md`
- `codex` -> `AGENTS.md`
- `cursor` -> the Cursor-specific memory file used by the product

The design assumes Cursor follows the same pattern of “client directory + memory file”, but its exact filename should be confirmed from product expectations during implementation if not already encoded locally.

## GUI Structure

The desktop UI should shift from the current profile/apply form into a three-pane workspace:

- left pane: skill list and search
- center pane: selected skill tree and file editor
- right pane: target client selection, global sync actions, and project command generation

This layout keeps repository management, editing, and distribution separate while preserving a direct workflow.

## Editor Scope

The built-in editor should support editing the entire skill directory:

- `SKILL.md`
- scripts
- references
- assets
- arbitrary text files

Binary files do not need inline editing in phase one. They only need safe listing and file operations.

## Data And Persistence

Recommended application-owned paths:

- `~/.agents-manager/skills/` for source skill directories
- `~/.agents-manager/registry.json` or `registry.toml` for stable IDs and status
- optional operation history or sync metadata under the same config root

The registry should track at minimum:

- numeric ID
- relative or absolute warehouse path
- active / deleted / missing state
- created timestamp
- updated timestamp

## Error Handling

- Missing skill paths referenced by the registry should surface as invalid entries, not crashes.
- Invalid skill IDs passed to `init-project` must fail with explicit diagnostics.
- Global target directories should be created automatically if missing.
- Existing conflicting files in global or project targets should not be overwritten implicitly.
- File editing failures should preserve the unsaved editor buffer in the GUI.

## Validation Criteria

The redesign is considered correct when:

- all warehouse skills are sourced only from `~/.agents-manager/skills`
- each skill gets a stable non-reused numeric ID
- global sync works for Codex / Claude / Cursor
- generated `init-project` commands resolve IDs correctly
- running `init-project` creates the client-specific directory and memory file
- the desktop UI can edit arbitrary text files under a skill directory

## Phase One Scope

Phase one should include:

- warehouse source root
- stable registry IDs
- global sync for all three clients
- `init-project` command generation and execution
- desktop skill list, tree view, and text editor

Phase one should exclude:

- advanced editor features such as tabs, syntax tooling, or binary previews
- multi-user registry coordination
- remote sync
- automatic migration of every pre-existing external skill directory
