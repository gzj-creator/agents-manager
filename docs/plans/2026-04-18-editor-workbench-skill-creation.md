# Editor Workbench Skill Creation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the desktop editor into a VS Code-style workbench and add a sidebar flow that creates a new warehouse skill with starter content.

**Architecture:** The change stays within the existing Tauri + vanilla JS split. The Rust/Tauri layer gains one focused command for creating a new skill directory and starter `SKILL.md`, while the frontend reshapes the `Editor` page into Explorer / Editor / Inspector regions and manages create-form, selection, and dirty-buffer interactions in browser state.

**Tech Stack:** Rust, Tauri 2, vanilla JavaScript, Node test runner, Vite, CSS

---

### Task 1: Add core warehouse skill creation coverage

**Files:**
- Modify: `crates/agents_manager_core/src/core_tests.rs`
- Modify: `crates/agents_manager_core/src/lib.rs`
- Create: `crates/agents_manager_core/src/creation.rs`

**Step 1: Write the failing test**

Add a focused core test that creates a new skill and verifies both directory and starter file content:

```rust
#[test]
fn create_skill_creates_directory_and_starter_skill_md() {
    let ctx = TestCtx::new();

    let created = create_skill(
        &ctx.cfg,
        CreateSkillRequest {
            id: "new-skill".into(),
            name: Some("New Skill".into()),
            description: Some("starter description".into()),
        },
    )
    .unwrap();

    assert_eq!(created.id, "new-skill");
    assert!(ctx.cfg.skill_warehouse.join("new-skill").is_dir());

    let body = fs::read_to_string(ctx.cfg.skill_warehouse.join("new-skill/SKILL.md")).unwrap();
    assert!(body.contains("name: \"New Skill\""));
    assert!(body.contains("description: \"starter description\""));
    assert!(body.contains("# New Skill"));
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test -p agents_manager_core create_skill_creates_directory_and_starter_skill_md -- --exact`
Expected: FAIL because `create_skill`, `CreateSkillRequest`, and `creation.rs` do not exist yet

**Step 3: Write minimal implementation**

Create a small creation module that validates the skill ID, creates the directory, writes a starter `SKILL.md`, and returns the scanned warehouse entry:

```rust
pub struct CreateSkillRequest {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
}

pub fn create_skill(cfg: &AppConfig, req: CreateSkillRequest) -> Result<SkillEntry> {
    let skill_id = sanitize_skill_id(&req.id)?;
    let skill_dir = cfg.skill_warehouse.join(&skill_id);
    fs::create_dir_all(&skill_dir)?;
    fs::write(skill_dir.join("SKILL.md"), render_skill_md(&skill_id, req.name, req.description))?;

    scan_warehouse(cfg)?
        .into_iter()
        .find(|entry| entry.id == skill_id)
        .ok_or_else(|| CoreError::msg("created skill not found"))
}
```

Export the API from `crates/agents_manager_core/src/lib.rs`.

**Step 4: Run test to verify it passes**

Run: `cargo test -p agents_manager_core create_skill_creates_directory_and_starter_skill_md -- --exact`
Expected: PASS

**Step 5: Commit**

```bash
git add crates/agents_manager_core/src/core_tests.rs crates/agents_manager_core/src/lib.rs crates/agents_manager_core/src/creation.rs
git commit -m "feat: add warehouse skill creation core flow"
```

### Task 2: Harden validation and duplicate handling for new skill creation

**Files:**
- Modify: `crates/agents_manager_core/src/core_tests.rs`
- Modify: `crates/agents_manager_core/src/creation.rs`

**Step 1: Write the failing test**

Add tests for invalid IDs and duplicate directories:

```rust
#[test]
fn create_skill_rejects_invalid_or_duplicate_ids() {
    let ctx = TestCtx::new();
    ctx.create_skill("alpha");

    let duplicate = create_skill(&ctx.cfg, CreateSkillRequest { id: "alpha".into(), name: None, description: None });
    assert!(duplicate.is_err());

    let invalid = create_skill(&ctx.cfg, CreateSkillRequest { id: "../oops".into(), name: None, description: None });
    assert!(invalid.is_err());
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test -p agents_manager_core create_skill_rejects_invalid_or_duplicate_ids -- --exact`
Expected: FAIL because duplicate and invalid ID checks are incomplete

**Step 3: Write minimal implementation**

Add focused validation:

```rust
fn sanitize_skill_id(raw: &str) -> Result<String> {
    let id = raw.trim();
    if id.is_empty() || id.contains('/') || id.contains('\\') {
        return Err(CoreError::msg("invalid skill id"));
    }
    Ok(id.to_string())
}

if skill_dir.exists() {
    return Err(CoreError::msg("skill already exists"));
}
```

**Step 4: Run test to verify it passes**

Run: `cargo test -p agents_manager_core create_skill_rejects_invalid_or_duplicate_ids -- --exact`
Expected: PASS

**Step 5: Commit**

```bash
git add crates/agents_manager_core/src/core_tests.rs crates/agents_manager_core/src/creation.rs
git commit -m "feat: validate new warehouse skill ids"
```

### Task 3: Expose the create-skill command through Tauri

**Files:**
- Modify: `crates/agents_manager_desktop/src-tauri/src/main.rs`

**Step 1: Write the failing test**

Add a small command-layer serialization test near the existing command helpers:

```rust
#[test]
fn create_skill_command_returns_serializable_entry() {
    let ctx = TestCtx::new();
    let value = serde_json::to_value(
        create_skill(&ctx.cfg, CreateSkillRequest {
            id: "alpha".into(),
            name: Some("Alpha".into()),
            description: Some("desc".into()),
        })
        .unwrap(),
    )
    .unwrap();

    assert_eq!(value["id"], "alpha");
    assert_eq!(value["name"], "Alpha");
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test -p agents_manager_core create_skill_command_returns_serializable_entry -- --exact`
Expected: FAIL until the command wiring exists or the test is moved to the correct command layer fixture

**Step 3: Write minimal implementation**

Add a request payload and Tauri command:

```rust
#[derive(Debug, Deserialize)]
struct CreateSkillReq {
    id: String,
    name: Option<String>,
    description: Option<String>,
}

#[tauri::command]
fn create_skill_cmd(req: CreateSkillReq) -> Result<serde_json::Value, String> {
    let cfg = load_app_config().map_err(|e| e.to_string())?;
    let created = create_skill(
        &cfg,
        CreateSkillRequest {
            id: req.id,
            name: req.name,
            description: req.description,
        },
    )
    .map_err(|e| e.to_string())?;
    serde_json::to_value(created).map_err(|e| e.to_string())
}
```

Register the command in `tauri::generate_handler!`.

**Step 4: Run targeted verification**

Run: `cargo test -p agents_manager_core create_skill_creates_directory_and_starter_skill_md -- --exact`
Expected: PASS and command code compiles with the crate graph

**Step 5: Commit**

```bash
git add crates/agents_manager_desktop/src-tauri/src/main.rs
git commit -m "feat: expose desktop create skill command"
```

### Task 4: Add frontend state and tests for the new editor workbench shell

**Files:**
- Modify: `crates/agents_manager_desktop/src/ui.js`
- Modify: `crates/agents_manager_desktop/src/ui.test.js`

**Step 1: Write the failing test**

Replace the old editor-page assertion with workbench-specific coverage:

```javascript
test('createEditorPageHtml includes explorer, workbench editor, and inspector regions', () => {
  const html = createEditorPageHtml({
    selectedSkillName: 'alpha',
    createOpen: true,
    createError: 'duplicate',
  })

  assert.match(html, /data-role="editor-explorer"/)
  assert.match(html, /data-role="create-skill-form"/)
  assert.match(html, /data-role="editor-workbench"/)
  assert.match(html, /data-role="metadata-panel"/)
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="createEditorPageHtml includes explorer, workbench editor, and inspector regions"`
Expected: FAIL because `createEditorPageHtml` still renders the old layout

**Step 3: Write minimal implementation**

Refactor `createEditorPageHtml` to render:

```javascript
return `
  <section class="editor-workbench-layout">
    <aside data-role="editor-explorer">...</aside>
    <section data-role="editor-workbench">...</section>
    <aside data-role="metadata-panel">...</aside>
  </section>
`
```

Also add helper rendering for the inline create-skill form and compact context bar.

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="createEditorPageHtml includes explorer, workbench editor, and inspector regions"`
Expected: PASS

**Step 5: Commit**

```bash
git add crates/agents_manager_desktop/src/ui.js crates/agents_manager_desktop/src/ui.test.js
git commit -m "feat: add editor workbench view helpers"
```

### Task 5: Add frontend state transitions for create-skill and dirty-buffer protection

**Files:**
- Modify: `crates/agents_manager_desktop/src/ui.js`
- Modify: `crates/agents_manager_desktop/src/ui.test.js`

**Step 1: Write the failing test**

Add state-level tests for editor confirmation and create-form behavior:

```javascript
test('nextEditorState tracks create form and dirty confirmation state', () => {
  const open = nextEditorState(createEditorState(), { type: 'toggle-create-skill', open: true })
  assert.equal(open.createSkill.open, true)

  const dirty = nextEditorState(open, { type: 'edit', value: 'changed' })
  assert.equal(dirty.dirty, true)
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="nextEditorState tracks create form and dirty confirmation state"`
Expected: FAIL because editor state only tracks `path`, `value`, and `dirty`

**Step 3: Write minimal implementation**

Extend the editor state shape:

```javascript
export function createEditorState() {
  return {
    path: '',
    value: '',
    dirty: false,
    createSkill: {
      open: false,
      id: '',
      name: '',
      description: '',
      error: '',
    },
  }
}
```

Add focused events for create-form edits and resets, but do not add speculative state.

**Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="nextEditorState tracks create form and dirty confirmation state"`
Expected: PASS

**Step 5: Commit**

```bash
git add crates/agents_manager_desktop/src/ui.js crates/agents_manager_desktop/src/ui.test.js
git commit -m "feat: track create skill editor state"
```

### Task 6: Wire create-skill, selection, and confirmation flow in the desktop controller

**Files:**
- Modify: `crates/agents_manager_desktop/src/main.js`

**Step 1: Write the failing test**

Document the intended behavior in a small pure helper or extracted function test if needed, for example a selection guard:

```javascript
test('canSwitchEditorTarget blocks navigation when buffer is dirty', () => {
  assert.equal(canSwitchEditorTarget({ dirty: true }, () => false), false)
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="canSwitchEditorTarget blocks navigation when buffer is dirty"`
Expected: FAIL because the helper does not exist

**Step 3: Write minimal implementation**

In `main.js`:

- add `createSkill` to `ACTION_BUTTON_IDS`
- invoke `create_skill_cmd`
- refresh skills after creation
- auto-select the returned skill
- load its tree and open `SKILL.md`
- guard skill/file switching with a `window.confirm` check when `state.editor.dirty` is true

Representative shape:

```javascript
async function createSkill() {
  const req = readCreateSkillForm()
  const created = await invoke('create_skill_cmd', { req })
  await loadSkills()
  state.selectedSkillId = created.stable_id
  await loadTree(created.stable_id)
}
```

**Step 4: Run targeted frontend tests**

Run: `npm test`
Expected: PASS with updated UI/controller helpers

**Step 5: Commit**

```bash
git add crates/agents_manager_desktop/src/main.js
git commit -m "feat: wire sidebar skill creation flow"
```

### Task 7: Restyle the editor page into the approved workbench layout

**Files:**
- Modify: `crates/agents_manager_desktop/src/styles.css`

**Step 1: Write the failing test**

Use existing markup tests plus a manual checkpoint instead of brittle CSS assertions:

```text
Manual checkpoint: the editor page still shows large top-right summary cards and bottom-stacked file actions.
```

**Step 2: Run manual checkpoint to verify current behavior is wrong**

Run: `npm run build`
Expected: PASS build, but the UI still renders the old layout in the app

**Step 3: Write minimal implementation**

Refactor styles to support:

- compact editor context bar
- Explorer / Editor / Inspector layout
- inline create-skill panel
- toolbar-based file actions
- responsive collapse from 3 columns to 2 to 1

Representative CSS shape:

```css
.editor-workbench-layout {
  display: grid;
  grid-template-columns: minmax(260px, 0.8fr) minmax(0, 1.8fr) minmax(280px, 0.9fr);
}

.explorer-panel {
  display: grid;
  gap: 16px;
}
```

Keep the warm palette; change structure, density, and hierarchy rather than theme.

**Step 4: Run frontend verification**

Run: `npm run build`
Expected: PASS with the new CSS bundle emitted

**Step 5: Commit**

```bash
git add crates/agents_manager_desktop/src/styles.css
git commit -m "feat: restyle editor into workbench layout"
```

### Task 8: Full verification and documentation pass

**Files:**
- Modify: `README.md`
- Modify: `crates/agents_manager_desktop/src/ui.test.js`
- Modify: `crates/agents_manager_core/src/core_tests.rs`

**Step 1: Write the failing doc/test expectation**

Add or update docs to mention sidebar skill creation in the desktop GUI section, and ensure tests cover the new create flow at the helper/core level.

```markdown
- `Editor` 页采用 Explorer / Editor / Inspector 工作台布局
- 左侧侧边栏支持创建新 skill 并自动生成基础 `SKILL.md`
```

**Step 2: Run verification to identify remaining failures**

Run: `cargo test -p agents_manager_core`
Expected: PASS or surface any remaining compile/test gaps

Run: `npm test`
Expected: PASS

Run: `npm run build`
Expected: PASS

**Step 3: Write minimal implementation**

Update the README GUI section only as needed to reflect the new editor and create flow. Do not broaden docs beyond shipped behavior.

**Step 4: Run full verification**

Run: `cargo test -p agents_manager_core`
Expected: PASS

Run: `npm test`
Expected: PASS

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add README.md crates/agents_manager_core/src/core_tests.rs crates/agents_manager_desktop/src/ui.test.js
git commit -m "docs: describe editor workbench skill creation"
```
