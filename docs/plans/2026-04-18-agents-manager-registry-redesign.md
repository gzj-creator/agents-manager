# Agents Manager Registry Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild `agents-manager` around a single warehouse at `~/.agents-manager/skills`, stable numeric skill IDs, client global sync, generated `init-project` commands, and a desktop editor for whole skill directories.

**Architecture:** Replace the current multi-root skill scanning model with an application-owned warehouse plus registry metadata. Extend the Rust core with registry, target, and init-project services, then reorganize the Tauri desktop UI around warehouse browsing, editing, and distribution actions.

**Tech Stack:** Rust workspace crates, Tauri 2, Vite, vanilla JavaScript, CSS, Node built-in test runner

---

### Task 1: Define the new app-owned config and registry model

**Files:**
- Modify: `crates/agents_manager_core/src/config.rs`
- Create: `crates/agents_manager_core/src/registry.rs`
- Modify: `crates/agents_manager_core/src/lib.rs`
- Test: `crates/agents_manager_core/src/core_tests.rs`

**Step 1: Write the failing test**

Add a Rust test asserting that default app state points to `~/.agents-manager/skills` and that a fresh registry starts empty but supports a next ID counter.

```rust
#[test]
fn default_config_uses_agents_manager_skill_root() {
    let cfg = AppConfig::default();
    assert!(cfg.library_roots.is_empty());
    assert!(cfg.skill_warehouse.ends_with(".agents-manager/skills"));
}

#[test]
fn fresh_registry_starts_with_next_id_one() {
    let reg = SkillRegistry::default();
    assert_eq!(reg.next_id, 1);
    assert!(reg.skills.is_empty());
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test -p agents_manager_core default_config_uses_agents_manager_skill_root -- --exact`

Expected: FAIL because `skill_warehouse` and `SkillRegistry` do not exist yet.

**Step 3: Write minimal implementation**

Implement:

- `AppConfig` fields for application-owned warehouse and registry paths
- `SkillRegistry` type with `next_id` and persistent entries
- load/save helpers for registry state
- exports from `lib.rs`

**Step 4: Run test to verify it passes**

Run: `cargo test -p agents_manager_core fresh_registry_starts_with_next_id_one -- --exact`

Expected: PASS

**Step 5: Commit**

```bash
git add crates/agents_manager_core/src/config.rs \
  crates/agents_manager_core/src/registry.rs \
  crates/agents_manager_core/src/lib.rs \
  crates/agents_manager_core/src/core_tests.rs
git commit -m "feat: add agents-manager registry model"
```

### Task 2: Replace skill scanning with warehouse-backed registry discovery

**Files:**
- Modify: `crates/agents_manager_core/src/library.rs`
- Modify: `crates/agents_manager_core/src/registry.rs`
- Modify: `crates/agents_manager_core/src/lib.rs`
- Test: `crates/agents_manager_core/src/core_tests.rs`

**Step 1: Write the failing test**

Add a test that creates two skills under a temporary warehouse and verifies they receive stable numeric IDs, and that deleting one does not renumber the other.

```rust
#[test]
fn warehouse_scan_assigns_stable_non_reused_ids() {
    let ctx = TestCtx::new();
    ctx.create_skill("alpha");
    ctx.create_skill("beta");

    let first = scan_warehouse(&ctx.cfg).unwrap();
    assert_eq!(first[0].stable_id, 1);
    assert_eq!(first[1].stable_id, 2);

    ctx.remove_skill("alpha");
    ctx.create_skill("gamma");

    let second = scan_warehouse(&ctx.cfg).unwrap();
    assert!(second.iter().any(|e| e.id == "beta" && e.stable_id == 2));
    assert!(second.iter().any(|e| e.id == "gamma" && e.stable_id == 3));
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test -p agents_manager_core warehouse_scan_assigns_stable_non_reused_ids -- --exact`

Expected: FAIL because stable IDs are not tracked.

**Step 3: Write minimal implementation**

Update warehouse scanning so it:

- scans only the application-owned warehouse
- reconciles discovered skill directories against the registry
- assigns IDs only to new skills
- preserves IDs for existing skills
- marks missing skills as inactive or missing

Extend `SkillEntry` with stable numeric ID data.

**Step 4: Run test to verify it passes**

Run: `cargo test -p agents_manager_core warehouse_scan_assigns_stable_non_reused_ids -- --exact`

Expected: PASS

**Step 5: Commit**

```bash
git add crates/agents_manager_core/src/library.rs \
  crates/agents_manager_core/src/registry.rs \
  crates/agents_manager_core/src/lib.rs \
  crates/agents_manager_core/src/core_tests.rs
git commit -m "feat: assign stable ids to warehouse skills"
```

### Task 3: Add client target resolution for global sync

**Files:**
- Create: `crates/agents_manager_core/src/targets.rs`
- Modify: `crates/agents_manager_core/src/apply.rs`
- Modify: `crates/agents_manager_core/src/lib.rs`
- Test: `crates/agents_manager_core/src/core_tests.rs`

**Step 1: Write the failing test**

Add a test for resolving global target directories for `codex`, `claude`, and `cursor`.

```rust
#[test]
fn client_global_targets_resolve_expected_paths() {
    let roots = ClientRoots::from_home(Path::new("/tmp/home"));
    assert_eq!(roots.global_skill_root(ClientKind::Codex), PathBuf::from("/tmp/home/.codex/skills"));
    assert_eq!(roots.global_skill_root(ClientKind::Claude), PathBuf::from("/tmp/home/.claude/skills"));
    assert_eq!(roots.global_skill_root(ClientKind::Cursor), PathBuf::from("/tmp/home/.cursor/skills"));
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test -p agents_manager_core client_global_targets_resolve_expected_paths -- --exact`

Expected: FAIL because client target resolution does not exist yet.

**Step 3: Write minimal implementation**

Implement:

- `ClientKind`
- client global skill roots
- sync request type for selected warehouse skills
- application logic for linking or copying selected skills into the correct global target

Do not bundle project init into this task.

**Step 4: Run test to verify it passes**

Run: `cargo test -p agents_manager_core client_global_targets_resolve_expected_paths -- --exact`

Expected: PASS

**Step 5: Commit**

```bash
git add crates/agents_manager_core/src/targets.rs \
  crates/agents_manager_core/src/apply.rs \
  crates/agents_manager_core/src/lib.rs \
  crates/agents_manager_core/src/core_tests.rs
git commit -m "feat: add client global target sync"
```

### Task 4: Add `init-project` command path in the Rust core

**Files:**
- Create: `crates/agents_manager_core/src/init_project.rs`
- Modify: `crates/agents_manager_core/src/lib.rs`
- Modify: `crates/agents_manager_core/src/core_tests.rs`

**Step 1: Write the failing test**

Add a test that runs init logic for Codex and Claude in a temporary project and verifies client directory plus memory file creation.

```rust
#[test]
fn init_project_creates_codex_dir_and_agents_md() {
    let ctx = TestCtx::new();
    ctx.create_skill("alpha");
    let scan = scan_warehouse(&ctx.cfg).unwrap();
    let alpha = scan.iter().find(|s| s.id == "alpha").unwrap();

    let report = init_project(
        &ctx.project,
        ClientKind::Codex,
        vec![alpha.stable_id],
        InitMode::Symlink,
        &ctx.cfg,
    ).unwrap();

    assert!(ctx.project.join(".codex").exists());
    assert!(ctx.project.join("AGENTS.md").exists());
    assert!(!report.invalid_skill_ids.len() > 0);
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test -p agents_manager_core init_project_creates_codex_dir_and_agents_md -- --exact`

Expected: FAIL because init-project support does not exist yet.

**Step 3: Write minimal implementation**

Implement:

- `init_project` request and report types
- skill ID lookup through the registry-backed scan results
- per-client project root creation
- memory file creation rules
- linking or copying selected skills into the project client directory

Keep invalid ID reporting explicit.

**Step 4: Run test to verify it passes**

Run: `cargo test -p agents_manager_core init_project_creates_codex_dir_and_agents_md -- --exact`

Expected: PASS

**Step 5: Commit**

```bash
git add crates/agents_manager_core/src/init_project.rs \
  crates/agents_manager_core/src/lib.rs \
  crates/agents_manager_core/src/core_tests.rs
git commit -m "feat: add project init workflow"
```

### Task 5: Expose new CLI commands and de-emphasize old profile-centric flow

**Files:**
- Modify: `crates/agents_manager_cli/src/main.rs`
- Test: `crates/agents_manager_core/src/core_tests.rs`
- Modify: `README.md`

**Step 1: Write the failing test**

Add a CLI-facing test or parser test that expects:

```text
agents-manager init-project --client codex --skills 1,2,3
```

to parse into the new init request.

**Step 2: Run test to verify it fails**

Run: `cargo test -p agents_manager_cli init_project_cli_parses_skill_ids -- --exact`

Expected: FAIL because the command does not exist yet.

**Step 3: Write minimal implementation**

Update CLI surface to support:

- `init-project`
- client selection
- skill ID parsing
- optional install mode

Adjust README examples so the warehouse and init-project workflows become the primary documented entry points.

**Step 4: Run test to verify it passes**

Run: `cargo test -p agents_manager_cli init_project_cli_parses_skill_ids -- --exact`

Expected: PASS

**Step 5: Commit**

```bash
git add crates/agents_manager_cli/src/main.rs \
  crates/agents_manager_core/src/core_tests.rs \
  README.md
git commit -m "feat: expose warehouse init-project cli"
```

### Task 6: Add Tauri commands for warehouse browsing and global sync

**Files:**
- Modify: `crates/agents_manager_desktop/src-tauri/src/main.rs`
- Modify: `crates/agents_manager_core/src/lib.rs`
- Test: `crates/agents_manager_core/src/core_tests.rs`

**Step 1: Write the failing test**

Add tests for new command-layer request shapes, for example global sync and file-tree listing payload serialization.

```rust
#[test]
fn warehouse_entries_serialize_stable_id_and_path() {
    let entry = SkillEntry { /* ... */ };
    let json = serde_json::to_value(entry).unwrap();
    assert_eq!(json["stable_id"], 1);
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test -p agents_manager_core warehouse_entries_serialize_stable_id_and_path -- --exact`

Expected: FAIL until the new fields and commands exist.

**Step 3: Write minimal implementation**

Expose Tauri commands for:

- list warehouse skills
- inspect a skill tree
- read a file
- write a file
- create a file or folder
- rename a path
- delete a path
- sync selected skills to a client global directory
- generate an init-project command string

**Step 4: Run test to verify it passes**

Run: `cargo test -p agents_manager_core warehouse_entries_serialize_stable_id_and_path -- --exact`

Expected: PASS

**Step 5: Commit**

```bash
git add crates/agents_manager_desktop/src-tauri/src/main.rs \
  crates/agents_manager_core/src/lib.rs \
  crates/agents_manager_core/src/core_tests.rs
git commit -m "feat: expose warehouse desktop commands"
```

### Task 7: Replace the desktop UI information architecture

**Files:**
- Modify: `crates/agents_manager_desktop/src/main.js`
- Modify: `crates/agents_manager_desktop/src/ui.js`
- Modify: `crates/agents_manager_desktop/src/styles.css`
- Modify: `crates/agents_manager_desktop/src/ui.test.js`

**Step 1: Write the failing test**

Add a UI helper test asserting the app shell now includes skill list, file tree, editor, client picker, and command output areas.

```js
test('createAppShellHtml includes warehouse list, tree, editor, and action panel', () => {
  const html = createAppShellHtml()
  assert.match(html, /data-role="skill-list"/)
  assert.match(html, /data-role="skill-tree"/)
  assert.match(html, /data-role="editor"/)
  assert.match(html, /data-role="client-actions"/)
})
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix crates/agents_manager_desktop test`

Expected: FAIL because the old UI shell does not contain the new workspace.

**Step 3: Write minimal implementation**

Refactor the desktop UI into:

- skill warehouse list
- selected skill tree
- inline text editor
- client target and purpose controls
- global sync action
- generated project command output

Do not implement final polish before the new workflow is functional.

**Step 4: Run test to verify it passes**

Run: `npm --prefix crates/agents_manager_desktop test`

Expected: PASS

**Step 5: Commit**

```bash
git add crates/agents_manager_desktop/src/main.js \
  crates/agents_manager_desktop/src/ui.js \
  crates/agents_manager_desktop/src/styles.css \
  crates/agents_manager_desktop/src/ui.test.js
git commit -m "feat: redesign desktop ui around warehouse workflow"
```

### Task 8: Add desktop file-tree editing flows

**Files:**
- Modify: `crates/agents_manager_desktop/src/main.js`
- Modify: `crates/agents_manager_desktop/src/ui.js`
- Modify: `crates/agents_manager_desktop/src/styles.css`
- Modify: `crates/agents_manager_desktop/src/ui.test.js`

**Step 1: Write the failing test**

Add tests for editor helpers that track selected file, dirty state, and save button state.

```js
test('nextEditorState marks buffer dirty after text edit', () => {
  const next = nextEditorState(createEditorState(), { type: 'edit', value: 'changed' })
  assert.equal(next.dirty, true)
})
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix crates/agents_manager_desktop test`

Expected: FAIL because editor state helpers do not exist yet.

**Step 3: Write minimal implementation**

Implement desktop flows for:

- selecting files
- reading file contents
- editing text buffers
- saving files
- creating files and folders
- renaming and deleting paths

Only support text editing in phase one.

**Step 4: Run test to verify it passes**

Run: `npm --prefix crates/agents_manager_desktop test`

Expected: PASS

**Step 5: Commit**

```bash
git add crates/agents_manager_desktop/src/main.js \
  crates/agents_manager_desktop/src/ui.js \
  crates/agents_manager_desktop/src/styles.css \
  crates/agents_manager_desktop/src/ui.test.js
git commit -m "feat: add desktop skill editor flows"
```

### Task 9: Final verification and documentation cleanup

**Files:**
- Modify: `README.md`
- Modify: `crates/agents_manager_desktop/package.json`
- Modify: `crates/agents_manager_desktop/src-tauri/tauri.conf.json`

**Step 1: Write the final verification checklist**

Confirm the following commands are the required evidence:

```bash
cargo test -p agents_manager_core
cargo test -p agents_manager_cli
npm --prefix crates/agents_manager_desktop test
npm --prefix crates/agents_manager_desktop run build
```

**Step 2: Run full verification**

Run: `cargo test -p agents_manager_core`
Expected: PASS

Run: `cargo test -p agents_manager_cli`
Expected: PASS

Run: `npm --prefix crates/agents_manager_desktop test`
Expected: PASS

Run: `npm --prefix crates/agents_manager_desktop run build`
Expected: PASS

**Step 3: Update docs**

Rewrite README so it explains:

- the warehouse root
- stable ID registry
- global sync flow
- init-project flow
- desktop editing capabilities

**Step 4: Commit**

```bash
git add README.md \
  crates/agents_manager_desktop/package.json \
  crates/agents_manager_desktop/src-tauri/tauri.conf.json
git commit -m "docs: document warehouse-driven workflow"
```
