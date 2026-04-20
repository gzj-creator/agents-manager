# Desktop Shell Skills Realignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Realign the desktop shell and `Skills` page to a compact VS Code-like workbench with a narrower left rail, thinner header, and flatter split-pane workspace.

**Architecture:** Keep the existing Tauri + vanilla JS frontend. The change stays entirely in desktop presentation code: `ui.js` for shell/page markup, `main.js` for compact page metadata copy where needed, and `styles.css` for the shell and pane system. No Rust/backend changes are required.

**Tech Stack:** Vanilla JavaScript, CSS, Node test runner, Vite, Tauri 2

---

### Task 1: Add failing tests for the compact shell and split-pane skills workspace

**Files:**
- Modify: `crates/agents_manager_desktop/src/ui.test.js`
- Modify: `crates/agents_manager_desktop/src/ui.js`

**Step 1: Write the failing test**

Add focused rendering assertions that capture the new structure:

```javascript
test('createAppShellHtml renders a compact navigation rail and header strip', () => {
  const html = createAppShellHtml()

  assert.match(html, /data-role="nav-rail"/)
  assert.match(html, /data-role="page-header"/)
  assert.doesNotMatch(html, /Warehouse Client/)
  assert.doesNotMatch(html, /技能仓库、编辑、同步、迁移都通过单窗口客户端完成/)
})

test('createSkillsPageHtml renders split workspace panes instead of floating cards', () => {
  const html = createSkillsPageHtml({
    skills: [],
    selectedSkill: null
  })

  assert.match(html, /data-role="skills-workspace"/)
  assert.match(html, /data-role="skills-browse-pane"/)
  assert.match(html, /data-role="skills-details-pane"/)
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/ui.test.js`
Expected: FAIL because the current shell still renders the branded left card and the `Skills` page does not expose the new workspace pane roles.

**Step 3: Write minimal implementation**

Refactor the `createAppShellHtml` and `createSkillsPageHtml` template structure in `crates/agents_manager_desktop/src/ui.js`:

- remove the large brand copy block from the left rail
- keep a minimal product label at the top of the rail
- wrap the `Skills` page in a single workspace container
- expose explicit data roles for browse/details panes

**Step 4: Run test to verify it passes**

Run: `npm test -- src/ui.test.js`
Expected: PASS for the new shell/workspace assertions.

**Step 5: Commit**

```bash
git add crates/agents_manager_desktop/src/ui.test.js crates/agents_manager_desktop/src/ui.js
git commit -m "feat: flatten desktop shell markup"
```

### Task 2: Tighten page metadata copy so the shell stops repeating titles

**Files:**
- Modify: `crates/agents_manager_desktop/src/main.js`
- Test: `crates/agents_manager_desktop/src/ui.test.js`

**Step 1: Write the failing test**

Add a small assertion for the app shell title/header copy if needed, or a focused regression assertion around the shorter shell wording:

```javascript
test('createAppShellHtml keeps shell copy minimal', () => {
  const html = createAppShellHtml()

  assert.match(html, />agents-manager</)
  assert.doesNotMatch(html, /单窗口客户端完成/)
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/ui.test.js`
Expected: FAIL until the shell copy is shortened and the page metadata is adjusted.

**Step 3: Write minimal implementation**

In `crates/agents_manager_desktop/src/main.js`:

- shorten `PAGE_META.skills.title`
- reduce or remove verbose `PAGE_META.*.description` strings where they create hero-like weight
- keep enough context for status and navigation without a large intro block

**Step 4: Run test to verify it passes**

Run: `npm test -- src/ui.test.js`
Expected: PASS and the shell/header copy feels noticeably lighter.

**Step 5: Commit**

```bash
git add crates/agents_manager_desktop/src/main.js crates/agents_manager_desktop/src/ui.test.js
git commit -m "feat: tighten desktop shell copy"
```

### Task 3: Rewrite shell and skills layout CSS into a flatter desktop workbench

**Files:**
- Modify: `crates/agents_manager_desktop/src/styles.css`
- Test: `crates/agents_manager_desktop/src/ui.test.js`

**Step 1: Write the failing test**

Add CSS assertions for the main structural changes:

```javascript
test('styles use a narrow navigation rail and flatter skills workspace', () => {
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

  assert.match(css, /\.app-shell\s*\{[\s\S]*grid-template-columns:\s*72px minmax\(0,\s*1fr\);/)
  assert.match(css, /\.page-grid--skills\s*\{[\s\S]*gap:\s*0;/)
  assert.match(css, /\.page-grid--skills\s*\{[\s\S]*border:\s*1px solid/)
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/ui.test.js`
Expected: FAIL because the current shell still uses a wide rail and separate card spacing.

**Step 3: Write minimal implementation**

Update `crates/agents_manager_desktop/src/styles.css` to:

- shrink the left rail width and pin it visually to the left edge
- remove heavy card styling from the navigation rail
- reduce header height and spacing
- convert the `Skills` page container into a flatter split pane with an internal divider
- reduce large radii and deep shadows across shell-level surfaces

Keep existing control styling intact unless it conflicts directly with the new shell.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/ui.test.js`
Expected: PASS and the CSS reflects the new pane-based shell structure.

**Step 5: Commit**

```bash
git add crates/agents_manager_desktop/src/styles.css crates/agents_manager_desktop/src/ui.test.js
git commit -m "feat: realign desktop shell layout"
```

### Task 4: Verify the redesigned shell end-to-end in frontend tests and build output

**Files:**
- Modify: `crates/agents_manager_desktop/src/ui.js`
- Modify: `crates/agents_manager_desktop/src/main.js`
- Modify: `crates/agents_manager_desktop/src/styles.css`
- Modify: `crates/agents_manager_desktop/src/ui.test.js`

**Step 1: Run the targeted UI tests**

Run: `npm test -- src/ui.test.js`
Expected: PASS with the new compact shell and split-pane layout assertions.

**Step 2: Run the full desktop frontend tests**

Run: `npm test`
Expected: PASS for `src/ui.test.js` and `src/capabilities.test.js`.

**Step 3: Build the frontend bundle**

Run: `npm run build`
Expected: PASS and Vite emits the desktop assets bundle.

**Step 4: Compile the Tauri desktop crate**

Run: `cargo check -p agents_manager_desktop`
Expected: PASS with no frontend integration regressions.

**Step 5: Commit**

```bash
git add crates/agents_manager_desktop/src/ui.js crates/agents_manager_desktop/src/main.js crates/agents_manager_desktop/src/styles.css crates/agents_manager_desktop/src/ui.test.js
git commit -m "feat: ship compact desktop shell redesign"
```
