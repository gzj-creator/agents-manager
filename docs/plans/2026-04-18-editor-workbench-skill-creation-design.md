# Editor Workbench Skill Creation Design

**Date:** 2026-04-18

**Context**

The desktop UI already supports browsing warehouse skills, editing files inside an existing skill, and updating registry metadata. The current `Editor` page is functionally usable but visually split across large cards, oversized status summary blocks, and a file tree area that does not feel like a real editing workbench.

The product also lacks a first-class way to create a brand-new skill from the editor itself. Users who are unfamiliar with the warehouse directory structure currently have no guided flow for creating a new skill directory and initial content.

**Goal**

Redesign the desktop `Editor` page into a VS Code-inspired workbench while preserving the existing warm visual language, and add an in-editor flow for creating a new warehouse skill directory plus starter `SKILL.md` content.

## Approved Direction

The approved direction is:

- Keep the current warm palette and paper-like visual tone
- Make the `Editor` page behave more like a code editor workbench
- Move the main create flow into the left sidebar
- Support users who prefer button-driven creation over manual folder management
- Keep scope tight: no tab system, no drag-to-resize panes, no complex template gallery

## Information Architecture

The `Editor` page becomes a three-part workbench:

1. **Explorer**
   - Left sidebar
   - Shows a skill list, a primary `New Skill` entry point, and the file tree for the selected skill
   - Hosts file actions such as create file, create folder, rename, and delete

2. **Editor**
   - Center workspace
   - Shows the current file title, dirty state, save action, and editable text content
   - Becomes the visual focus of the page

3. **Inspector**
   - Right sidebar
   - Shows stable metadata fields such as stable ID, skill type, tags, and short description
   - Remains available without dominating the page

The oversized page-header selection card is removed from the main editing experience and replaced with a compact context bar that summarizes the selected skill and current file.

## Explorer Behavior

The left sidebar is the primary navigation and creation surface.

- The top of the sidebar contains a strong `新建 Skill` action
- Activating it expands a lightweight inline creation panel
- The creation panel is form-based rather than path-based
- Users only need to understand skill identity, not warehouse folder structure

The explorer then shows:

- the current skill list
- selection state for the active skill
- the selected skill's file tree
- a compact file action toolbar near the tree rather than buttons stacked at the bottom

This layout preserves a familiar IDE mental model while keeping actions obvious for less technical users.

## New Skill Creation Flow

Creating a skill should be possible entirely from the left sidebar.

### Required input

- `skill id`

### Optional input

- display name
- description
- skill type
- tags

### Validation

`skill id` is validated before submission:

- cannot be empty
- cannot contain path separators
- cannot conflict with an existing warehouse skill directory

### Creation result

On success the application:

1. creates a new directory in the warehouse
2. writes a minimal starter `SKILL.md`
3. refreshes the warehouse listing
4. selects the new skill
5. loads its file tree
6. opens `SKILL.md` in the center editor

The starter file should be minimal and editable, with frontmatter plus a short body scaffold. The flow should not expose raw filesystem complexity to the user.

## Interaction Model

The updated page should feel closer to a workbench than a form page.

- Skill switching uses active-item styling instead of large summary cards
- The center editor shows clear current-file context and save state
- File actions live near the file tree where users expect them
- Metadata editing remains explicit with a visible save action
- If a file has unsaved changes, changing the selected skill or file should prompt for confirmation before losing edits
- Inline creation errors stay near the create form and should not clear user input

## Responsive Strategy

The page remains desktop-first but adapts more intentionally:

- Wide screens: Explorer / Editor / Inspector
- Medium screens: Explorer / Editor, with Inspector moved below
- Narrow screens: stacked sections while keeping all actions available

This avoids the current problem where large summary cards distort the layout at medium widths.

## Technical Scope

This design includes:

- Tauri command support for creating a brand-new warehouse skill
- Frontend state for create-skill form, validation, and success/error handling
- `Editor` layout refactor into workbench structure
- Preservation of existing file read/write and metadata update capabilities

This design excludes:

- tabbed multi-file editing
- resizable panes
- advanced templates or template marketplace
- syntax-aware editing features

## Verification

The implementation should verify:

- new skill creation writes a new warehouse directory and starter `SKILL.md`
- UI rendering includes explorer, create panel, editor workspace, and inspector regions
- create flow auto-selects and opens the new skill
- file operations still work after the layout refactor
- metadata save still works
- dirty buffers are not lost silently
- desktop frontend tests and build continue to pass
