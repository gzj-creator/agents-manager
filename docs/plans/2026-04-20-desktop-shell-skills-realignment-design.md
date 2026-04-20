# Desktop Shell Skills Realignment Design

**Date:** 2026-04-20

**Context**

The desktop app already supports browsing warehouse skills, editing files, updating metadata, and managing MCP/settings flows. Functionally the product works, but the current shell styling has drifted away from the VS Code-inspired direction requested in recent feedback.

The current layout stacks too many decorative layers at once:

- a large branded left navigation card
- a large page hero header
- large rounded content cards inside the work area

This creates a page that feels visually left-heavy and editorial rather than compact and tool-like. The `Skills` page is the clearest example: the left navigation consumes disproportionate attention, `Warehouse Skills` appears more than once, and the main workspace looks split into floating cards instead of one continuous desktop surface.

**Goal**

Realign the desktop shell and `Skills` page to a compact VS Code-like workbench: narrow left navigation pinned to the edge, a thinner top bar, and a continuous split workspace with restrained styling and clearer hierarchy.

## Assumptions

- Primary users are technical or semi-technical users managing a local skill warehouse.
- The app should feel like a focused desktop tool, not a marketing surface.
- The user prefers direct manipulation, compact panes, and context menus over prominent buttons or large cards.
- Existing capabilities stay intact; this is a layout and interaction presentation redesign, not a feature expansion.

## Approved Direction

The approved direction is:

- shrink the left navigation into a compact rail
- remove the oversized brand card feel
- compress the top page header into a thinner title/status strip
- make the `Skills` page feel like one split workbench instead of two floating cards
- reduce repeated headings and decorative copy
- keep the warm palette only as a subtle tint, not as a dominant visual theme

## Information Architecture

The desktop shell should resolve to three persistent layers:

1. **Navigation rail**
   - Pinned to the far left
   - Narrow, compact, and flat
   - Contains only page switching and a minimal product label

2. **Header strip**
   - A compact top row inside the main stage
   - Shows current page title and live status
   - Does not behave like a hero section

3. **Workspace**
   - Fills the remaining area
   - Uses pane splits and dividers instead of large floating cards
   - Keeps each page feeling like part of one desktop surface

This should make the app read as “tool first” within one glance.

## Skills Page Layout

The `Skills` page should become a continuous two-pane workspace:

1. **Browse pane**
   - Search, tag filter, import section trigger, and skill list
   - Uses compact pane styling with a simple heading row
   - Keeps scrolling local to the pane

2. **Details pane**
   - Selected skill metadata, distribution controls, and entry into the editor
   - Appears as the right-side inspector of the same workspace, not as a separate card

The two panes should be separated by a thin divider rather than independent rounded cards with deep shadows.

## Shell Styling

The styling direction should shift from “warm editorial cards” to “restrained desktop workbench.”

### Keep

- light theme
- warm-neutral tint
- clear selected states
- subtle success/error status

### Remove or reduce

- oversized radii
- heavy drop shadows
- duplicate big titles
- large introductory copy blocks
- card-inside-card feeling

### Add

- flatter pane surfaces
- stronger pane dividers
- tighter spacing rhythm
- clearer active navigation and selected-row treatment
- more consistent desktop-app density

## Typography And Density

Typography should support a utilitarian tool feel:

- reduce display-style emphasis in shell and page headings
- keep labels compact and consistent
- use stronger hierarchy through spacing and pane structure, not oversized text
- keep list rows and controls denser so the workspace feels efficient

The app should feel calmer and more deliberate, not emptier.

## Interaction Model

This redesign should not introduce new workflows. Instead it should make existing actions feel more naturally placed.

- navigation remains immediate
- search and filters stay at the top of the browse pane
- skill selection remains row-based
- `打开编辑器` stays in the details pane as the main forward action
- import and migration stay available, but visually subordinate until expanded

The layout should make it clearer where to look first:

- left pane to choose
- right pane to inspect and act

## Responsive Strategy

The desktop experience remains the priority.

- Wide screens: compact nav rail, top header strip, two-pane `Skills` workspace
- Medium screens: keep two panes as long as practical, slightly reduce gaps and pane padding
- Narrow screens: stack browse over details while preserving the same flatter pane language

The redesign should improve medium-width behavior in particular, since the current card-heavy layout wastes space and exaggerates imbalance.

## Technical Scope

This design includes:

- shell markup cleanup in the desktop frontend
- `Skills` page markup adjustments to behave like split panes
- CSS redesign for shell, header, navigation, and `Skills` page surfaces
- small copy and metadata adjustments where needed to avoid repeated headings

This design excludes:

- backend command changes
- new product capabilities
- drag-resizable panes
- framework migration
- a full design-system rewrite

## Verification

Implementation should verify:

- the shell renders with a compact left rail and thinner header strip
- the `Skills` page renders as a continuous split workspace
- duplicate page-title emphasis is reduced
- the selected navigation item and selected skill remain visually clear
- existing `Skills` interactions still work
- Node UI tests still pass
- desktop frontend build still passes
