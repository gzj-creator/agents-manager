# Memory Sidebar And Entry Drag Import Design

**Date:** 2026-04-20

**Context**

The desktop app already has a strong warehouse workflow for skills, plus separate `MCP` and `Settings` pages. Recent user feedback has converged on a clear interaction direction:

- the UI should feel closer to VS Code
- the shell should stay compact and tool-like
- context menus should carry rename/delete/new actions instead of large button clusters
- selecting a skill or memory entry should move into a file-tree layer with a clear way back
- drag and drop should behave predictably instead of guessing the wrong intent

The current implementation only supports one global drag/drop behavior: dropping a `SKILL.md` file or a skill folder imports a new skill into the warehouse. It does not support dropping ordinary files or folders into an already selected skill, and there is no `Memory` page yet for managing long-term memory entries.

At the core layer, the app already knows client-specific target files:

- `Codex` -> `AGENTS.md`
- `Claude` -> `CLAUDE.md`
- `Cursor` -> `AGENTS.md`

However, that logic is currently only used to create an empty file during `init-project`. There is no dedicated memory warehouse, no memory entry model, and no command that writes a selected memory entry into a project target file.

**Goal**

Add a top-level `Memory` sidebar peer to `MCP`, allow dropping files or folders into the currently selected skill or memory entry, and generate client-specific commands that initialize `CLAUDE.md` or `AGENTS.md` from a selected memory entry.

## Assumptions

- The user wants `Memory` to manage multiple entries, not a single global file.
- Each memory entry represents the full contents of the target memory file rather than composable fragments.
- The user wants to copy the generated command into a project terminal and run it manually.
- The desktop shell should stay compact and avoid large cards, repeated prompt copy, or extra action buttons.
- First release should prefer safe non-destructive behavior over convenience when name conflicts happen.

## Approved Direction

The approved direction is:

- add `Memory` as a new top-level page, parallel to `Skills`, `MCP`, and `Settings`
- keep the page visually aligned with the VS Code-like shell direction
- model each memory entry as a directory in a dedicated memory warehouse
- use a fixed `MEMORY.md` file inside each memory entry as the canonical full memory body
- allow dropping files or folders into the active skill or memory tree
- keep warehouse-list drag/drop for entry import only
- generate a dedicated `init-memory` command instead of overloading `init-project`

## Information Architecture

The shell should expose five top-level destinations:

- `Skills`
- `Memory`
- `Editor`
- `MCP`
- `Settings`

### Skills

`Skills` remains the warehouse browser for skill entries. It continues to support grouped browsing, right-click actions, and moving into the file-tree layer for a selected skill.

### Memory

`Memory` becomes the equivalent warehouse browser for long-term memory entries.

- It should be visually parallel to `Skills`, not embedded inside it.
- It should use grouped lists by tags in the same general style as the skill warehouse.
- Selecting a memory entry should move into the editor tree layer.
- The page should provide a client selector and a compact command-generation area for the currently selected memory entry.

### Editor

`Editor` remains the single file-tree editing workspace, but it should stop assuming the active entry is always a skill.

- It should be able to open either a skill entry or a memory entry.
- It should preserve the current compact, context-menu-first interaction model.
- It should have a clear back action to return to the parent warehouse page.

## Memory Data Model

The app should gain a dedicated memory warehouse, parallel to the existing skill warehouse.

### Storage

- Config adds `memory_warehouse`.
- Default path should be `~/.agents-manager/memories`.
- Each memory entry is one directory under that warehouse.
- The directory name is the memory id.
- The canonical primary file inside the directory is `MEMORY.md`.

### Entry semantics

- `MEMORY.md` is the complete source body for client memory initialization.
- The entry may also contain attachments, notes, or subdirectories.
- Missing `MEMORY.md` should not hide the entry from the warehouse; it should scan as an empty entry and allow the user to create the file later.

### Metadata

Memory entries should support the same lightweight metadata concepts already used for skills where practical:

- stable ids
- optional tags for grouping
- optional source hints if needed later

The first implementation should avoid inventing memory-only metadata beyond what is necessary to browse, identify, and initialize the entry.

## Drag And Drop Model

Drag/drop should be split by context so the UI always has one meaning.

### Warehouse list pages

List-page drop is import-only.

- In `Skills`, only a dropped `SKILL.md` file or a directory containing `SKILL.md` should import a skill.
- In `Memory`, only a dropped `MEMORY.md` file or a directory containing `MEMORY.md` should import a memory entry.
- Ordinary files dropped onto a warehouse list should be rejected instead of being misinterpreted.

This prevents the previous failure mode where dropping a content file caused an unrelated import flow.

### Tree editor pages

Tree-page drop is copy-into-entry.

- When a skill entry is active in the tree editor, dropping files or folders copies them into that skill root or the hovered subdirectory.
- When a memory entry is active in the tree editor, dropping files or folders copies them into that memory root or the hovered subdirectory.
- Dropping on a folder node copies into that folder.
- Dropping on empty editor/tree space copies into the entry root.

### Conflict behavior

- Name collisions should fail by default.
- The app should not overwrite existing files or directories silently.
- Multi-file drops should report partial success and per-path conflicts rather than collapsing everything into one opaque error.

### Post-drop behavior

- A successful single dropped text file should auto-open in the editor.
- A successful folder drop or multi-file drop should refresh the tree and highlight the new entries without changing the current editor focus unnecessarily.
- Valid drop targets should show clear acceptance feedback.
- Invalid drop targets should not pretend to accept the drop.

## Command Model

Memory initialization should use a dedicated command instead of extending `init-project`.

### CLI

Add a new command:

```bash
agents-manager init-memory --client claude --memory 12 --project .
```

Behavior:

- `--project` defaults to the current directory.
- `--memory` refers to the selected memory stable id.
- `--client claude` writes to `CLAUDE.md`.
- `--client codex` and `--client cursor` write to `AGENTS.md`.
- The command reads the selected entry's `MEMORY.md`.
- The command writes the full contents into the project target file.
- If the target file already exists, the command returns a conflict error and does not overwrite.

The first release should not add `--force`. If overwrite support is needed later, it can be added deliberately.

### Desktop command generation

The desktop app should generate the full CLI command string for the selected memory entry.

- It should include the current client choice.
- It should include the current memory stable id.
- It should not attempt to execute the command automatically.
- The generated command should be copyable with the existing copy affordance pattern.

## Core And Desktop Architecture

The cleanest approach is to mirror the existing skill pipeline rather than special-case memory inside unrelated modules.

### Core

Add memory-specific core functions parallel to skill creation/import flows:

- scan memory warehouse
- create memory entry
- rename memory entry
- delete memory entry
- import dropped memory entry
- initialize project memory file from selected entry
- generate `init-memory` command

Shared file-copy behavior for drag/drop into entries should be extracted into a reusable helper that accepts:

- entry root path
- optional target subdirectory
- dropped paths

Both skill-tree and memory-tree drop actions should call the same helper.

### Desktop Tauri bridge

Add new commands for:

- listing warehouse memories
- creating, renaming, deleting memories
- inspecting a memory tree
- reading and writing memory files
- importing dropped memory entries
- copying dropped files or folders into a selected skill or memory entry
- generating the `init-memory` command

Skill commands should stay intact; memory should be added beside them rather than merged into ambiguous mixed handlers.

### Desktop frontend state

The frontend state should stop assuming the editor always belongs to a skill.

Recommended approach:

- keep `skills` page state for skill warehouse behavior
- add a parallel `memory` page state
- introduce an explicit active editor entry descriptor, for example `{ kind: 'skill' | 'memory', stableId }`
- update tree/file actions to route through the current entry descriptor instead of `selectedSkillId` alone

This keeps the existing editor surface while making it reusable for both entry types.

## UI Behavior

The UI should stay aligned with earlier feedback:

- no oversized cards for descriptions or prompts
- no repeated warehouse headings
- use dividers and compact sections instead of stacked card chrome
- rely on context menus for rename/delete/new
- keep a prominent back action in the tree layer

### Memory page

The `Memory` page should feel like the peer of `MCP`, but with a warehouse-style list.

- grouped entries are expanded by default
- empty directories are not emphasized
- the page should reserve most vertical space for the list rather than metadata prose
- the command-generation strip should stay compact

## Testing Strategy

Implementation should add targeted tests at each layer.

### Core tests

Add coverage for:

- scanning memory warehouse entries
- creating, renaming, deleting memory entries
- importing a dropped `MEMORY.md` file or memory directory
- initializing `CLAUDE.md` or `AGENTS.md` from a memory entry
- conflict behavior when the target file already exists
- copying dropped files or folders into skill and memory entries without overwrite

### CLI tests

Add parsing coverage for:

- `init-memory --client claude --memory 12`
- default `--project .`
- unsupported client rejection

### Desktop UI tests

Add coverage for:

- top-level navigation including `memory`
- page normalization for the new `memory` page
- memory page shell markup
- memory command-generation controls
- drag/drop routing based on page context and active entry type

## Verification

Implementation should verify all of the following before completion:

- the shell exposes a working `Memory` top-level page
- a memory entry can be created, renamed, deleted, and opened in the editor tree
- dropping `SKILL.md` into `Skills` imports a skill and does not mis-handle plain files
- dropping `MEMORY.md` into `Memory` imports a memory entry and does not mis-handle plain files
- dropping plain files or folders into an active skill tree copies them into that skill
- dropping plain files or folders into an active memory tree copies them into that memory
- generating a memory command returns the right target file for each client
- running `init-memory` writes the selected memory into the expected project file
- existing desktop tests, new tests, and relevant Rust/CLI checks pass

## Out Of Scope

This design does not include:

- automatic command execution from the desktop UI
- force-overwrite behavior for existing project memory files
- drag-reordering entries inside the warehouse
- merging skills and memories into one warehouse model
- a broader redesign of the editor beyond what is needed to support both entry types
