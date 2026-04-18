# Desktop UI Polish Design

**Date:** 2026-04-18

**Context**

`agents-manager` already has a working Tauri desktop UI in `crates/agents_manager_desktop`, but the current frontend is a single-file vanilla DOM implementation with inline styles and minimal interaction feedback. The functionality is adequate, while the visual hierarchy, state transitions, and perceived responsiveness are still rough.

**Goal**

Polish the existing desktop UI so it feels lighter, clearer, and more responsive without changing backend behavior, introducing a frontend framework, or expanding scope into a larger product redesign.

## Constraints

- Keep the current Tauri + vanilla JS architecture.
- Preserve existing user-facing capabilities.
- Do not change Rust command interfaces.
- Do not introduce React, Vue, or another component framework.
- Keep testing and tooling lightweight.

## Chosen Direction

The approved direction is a light refined desktop workbench:

- Softer, more intentional visual design
- Better information hierarchy
- Clear primary and secondary actions
- Visible async running states
- Better success and error feedback
- Small, purposeful motion only

This sits between a simple reskin and a full product redesign.

## Visual And Layout Design

The page will move from a plain form sheet to a lightweight desktop workbench with:

- A soft atmospheric background
- A header area with product title and live status
- Card-based sections for profile editing, project selection, and skill selection
- A distinct console-style output panel

The visual language should stay light and restrained:

- Warm neutral background
- Green accent for primary actions
- Soft borders and layered shadows
- Rounded corners and consistent spacing
- Subtle glass-like surfaces where it improves depth

The layout remains single-page, but content is regrouped so that configuration and actions are easier to scan.

## Interaction Design

Every async action should provide immediate feedback. The user should always be able to tell:

- what is currently running
- which controls are temporarily disabled
- whether the action succeeded or failed
- where to read full output

Planned interaction polish:

- Loading states for all Tauri-backed actions
- Status text in the header
- Button state transitions for hover, press, disabled, and running
- Skill items rendered as larger selectable cards instead of raw checkbox rows
- Selected skill count displayed near the skill section title
- Output panel with explicit tone for info, success, and error

Animation should stay subtle and short, mainly for state transitions and small reveal effects.

## Error Handling

The frontend will add minimal, targeted validation before invoking backend commands:

- profile id required before save
- project skill root required before save
- project path required before apply and doctor

Failures should not clear user input. The screen layout should remain stable, while the UI surfaces:

- a concise failure status near the top
- detailed error text in the output panel

## Architecture

The desktop frontend should stay simple, but it should stop relying on one large inline template with scattered async behavior. The implementation should introduce a small separation:

- markup and presentation helpers
- DOM wiring and event handlers
- shared async action/state handling
- stylesheet extracted from inline styles into a dedicated CSS file

This keeps the codebase small while making future UI edits less fragile.

## Testing And Verification

Testing should remain lightweight. The preferred approach is:

- extract small pure helpers for markup and state transitions
- cover them with minimal Node-based tests
- verify the desktop frontend bundle still builds

Manual verification should confirm:

- UI renders cleanly
- primary actions show loading and disabled states
- success and failure feedback are visually distinct
- skill selection remains functional
- profile switching and saving still populate fields correctly

## Out Of Scope

- Rust backend changes
- New business features
- Persisted frontend preferences
- Multi-window UI
- Framework migration
- Full design system build-out
