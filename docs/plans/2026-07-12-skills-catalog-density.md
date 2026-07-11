# Skills Catalog Density Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce the Skills catalog header footprint and give the skill list the remaining vertical space.

**Architecture:** Preserve all existing controls and IDs while grouping the search field, tag filter, and import toggle into a desktop grid. Use flex sizing and `min-height: 0` so the list owns remaining height and scrolls independently, with responsive CSS restoring a stacked layout.

**Tech Stack:** Vanilla JavaScript HTML rendering, CSS Grid/Flexbox, Node test runner, Vite.

---

### Task 1: Cover the compact toolbar structure

**Files:**
- Modify: `crates/agents_manager_desktop/src/ui.test.js`
- Test: `crates/agents_manager_desktop/src/ui.test.js`

**Step 1: Write the failing test**

Add assertions that the rendered Skills page contains a compact catalog toolbar and keeps the import panel outside the toolbar's field group.

**Step 2: Run test to verify it fails**

Run: `cd crates/agents_manager_desktop && npm test`

Expected: FAIL because the compact toolbar classes are not rendered.

### Task 2: Implement the compact catalog layout

**Files:**
- Modify: `crates/agents_manager_desktop/src/ui.js:1443`
- Modify: `crates/agents_manager_desktop/src/styles.css:330`

**Step 1: Update the rendered structure**

Wrap search, tag filtering, and the import toggle in a compact toolbar while preserving current IDs and event targets. Keep expanded import content directly below the toolbar.

**Step 2: Add minimal layout styles**

Use a desktop grid with a flexible search column, a narrower tag column, and an auto-sized action column. Reduce vertical gaps and let `.skill-list--page` fill and scroll within the catalog.

**Step 3: Add responsive fallback**

At the existing responsive breakpoint, return the toolbar to one column and remove fixed list height constraints.

### Task 3: Verify behavior

**Files:**
- Test: `crates/agents_manager_desktop/src/ui.test.js`

**Step 1: Run focused desktop tests**

Run: `cd crates/agents_manager_desktop && npm test`

Expected: PASS.

**Step 2: Build the desktop frontend**

Run: `cd crates/agents_manager_desktop && npm run build`

Expected: Vite build completes successfully.

