# Agents Manager Registry Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild `agents-manager` around a single warehouse at `~/.agents-manager/skills`, stable numeric skill IDs, one-time legacy migration, registry-owned skill metadata, client global sync, generated `init-project` commands, and a desktop editor for whole skill directories.

**Architecture:** The Rust core owns warehouse discovery, registry metadata, migration, sync, and init-project services. The Tauri desktop app becomes a warehouse workspace with grouped skill browsing, metadata editing, migration controls, and distribution actions. Client roots are targets, not listing sources.

**Tech Stack:** Rust workspace crates, Tauri 2, Vite, vanilla JavaScript, CSS, Node built-in test runner

**Execution Note:** On the current `registry-redesign` branch, the original Task 1-3 work has already landed. Continue from the first unfinished task in this plan when executing in the current session.

---

### Task 1: Define the app-owned config and registry model

**Files:**
- Modify: `crates/agents_manager_core/src/config.rs`
- Create: `crates/agents_manager_core/src/registry.rs`
- Modify: `crates/agents_manager_core/src/lib.rs`
- Test: `crates/agents_manager_core/src/core_tests.rs`

**Step 1: Write the failing test**

Add tests asserting default app state points to `~/.agents-manager/skills` and a fresh registry starts empty with `next_id = 1`.

**Step 2: Run test to verify it fails**

Run: `cargo test -p agents_manager_core default_config_uses_agents_manager_skill_root -- --exact`

Expected: FAIL because `skill_warehouse` and `SkillRegistry` do not exist yet.

**Step 3: Write minimal implementation**

Implement:

- `AppConfig` fields for warehouse and registry paths
- `SkillRegistry` with `next_id` and persisted entries
- registry load/save helpers
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

Add a test that scans a temporary warehouse and verifies IDs are stable and never reused.

**Step 2: Run test to verify it fails**

Run: `cargo test -p agents_manager_core warehouse_scan_assigns_stable_non_reused_ids -- --exact`

Expected: FAIL because stable IDs are not tracked.

**Step 3: Write minimal implementation**

Update warehouse scanning so it:

- scans only the app-owned warehouse
- reconciles discovered directories against the registry
- assigns IDs only to new skills
- preserves IDs for existing skills
- marks missing skills inactive

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

Add a test for resolving client global target directories for `codex`, `claude`, and `cursor`.

**Step 2: Run test to verify it fails**

Run: `cargo test -p agents_manager_core client_global_targets_resolve_expected_paths -- --exact`

Expected: FAIL because client target resolution does not exist yet.

**Step 3: Write minimal implementation**

Implement:

- `ClientKind`
- client global skill roots
- sync request type for selected warehouse skills
- application logic for linking or copying selected skills into target client roots

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

### Task 4: Add registry metadata and one-time legacy migration

**Files:**
- Create: `crates/agents_manager_core/src/migration.rs`
- Modify: `crates/agents_manager_core/src/config.rs`
- Modify: `crates/agents_manager_core/src/registry.rs`
- Modify: `crates/agents_manager_core/src/lib.rs`
- Test: `crates/agents_manager_core/src/core_tests.rs`

**Step 1: Write the failing tests**

Add tests for:

- one-time bootstrap migration moving skills from `.codex/skills` and `.claude/skills` into the warehouse
- same-name same-content deduplication
- same-name different-content overwrite where the later scan wins
- registry metadata storage for `skill_type`, `tags`, and `source_hint`

Suggested test names:

```rust
#[test]
fn bootstrap_migration_moves_client_skills_into_warehouse_once() { /* ... */ }

#[test]
fn bootstrap_migration_overwrites_with_later_conflicting_skill() { /* ... */ }

#[test]
fn registry_roundtrip_preserves_type_and_tags() { /* ... */ }
```

**Step 2: Run tests to verify they fail**

Run: `cargo test -p agents_manager_core bootstrap_migration_moves_client_skills_into_warehouse_once -- --exact`

Expected: FAIL because migration and metadata fields do not exist yet.

**Step 3: Write minimal implementation**

Implement:

- `bootstrap_migration_done` in config
- registry fields `skill_type`, `tags`, `source_hint`
- migration service that scans `codex` then `claude`
- move semantics from client roots into warehouse
- same-content dedupe and later-wins overwrite behavior
- bootstrap-only automatic migration flag handling
- reusable manual migration function that does not reset bootstrap state

**Step 4: Run tests to verify they pass**

Run: `cargo test -p agents_manager_core bootstrap_migration_moves_client_skills_into_warehouse_once -- --exact`

Expected: PASS

**Step 5: Commit**

```bash
git add crates/agents_manager_core/src/migration.rs \
  crates/agents_manager_core/src/config.rs \
  crates/agents_manager_core/src/registry.rs \
  crates/agents_manager_core/src/lib.rs \
  crates/agents_manager_core/src/core_tests.rs
git commit -m "feat: add warehouse migration and metadata"
```

### Task 5: Add `init-project` command path in the Rust core

**Files:**
- Create: `crates/agents_manager_core/src/init_project.rs`
- Modify: `crates/agents_manager_core/src/lib.rs`
- Modify: `crates/agents_manager_core/src/core_tests.rs`

**Step 1: Write the failing test**

Add a test that initializes a Codex project from warehouse skill IDs and verifies client directory plus memory file creation.

**Step 2: Run test to verify it fails**

Run: `cargo test -p agents_manager_core init_project_creates_codex_dir_and_agents_md -- --exact`

Expected: FAIL because init-project support does not exist yet.

**Step 3: Write minimal implementation**

Implement:

- `init_project` request and report types
- stable ID lookup through warehouse scan results
- per-client project root creation
- memory file creation rules
- linking or copying selected warehouse skills into project-local client directories

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

### Task 6: Expose CLI commands for migration, sync, and init-project

**Files:**
- Modify: `crates/agents_manager_cli/src/main.rs`
- Modify: `README.md`
- Test: `crates/agents_manager_core/src/core_tests.rs`

**Step 1: Write the failing test**

Add a CLI parser test that expects:

```text
agents-manager init-project --client codex --skills 1,2,3
```

to parse correctly, and a second parser test for a manual migration command such as:

```text
agents-manager migrate-legacy-skills
```

**Step 2: Run test to verify it fails**

Run: `cargo test -p agents_manager_cli init_project_cli_parses_skill_ids -- --exact`

Expected: FAIL because the command surface does not exist yet.

**Step 3: Write minimal implementation**

Update the CLI to support:

- `init-project`
- `migrate-legacy-skills`
- client selection
- numeric skill ID parsing
- optional install mode

Adjust README examples so warehouse, migration, and init-project become the primary workflows.

**Step 4: Run test to verify it passes**

Run: `cargo test -p agents_manager_cli init_project_cli_parses_skill_ids -- --exact`

Expected: PASS

**Step 5: Commit**

```bash
git add crates/agents_manager_cli/src/main.rs \
  crates/agents_manager_core/src/core_tests.rs \
  README.md
git commit -m "feat: expose warehouse migration and init-project cli"
```

### Task 7: Expose Tauri commands for warehouse metadata, migration, and sync

**Files:**
- Modify: `crates/agents_manager_desktop/src-tauri/src/main.rs`
- Modify: `crates/agents_manager_core/src/lib.rs`
- Test: `crates/agents_manager_core/src/core_tests.rs`

**Step 1: Write the failing test**

Add command-layer serialization tests showing warehouse entries include `stable_id`, `skill_type`, and `tags`.

Suggested test:

```rust
#[test]
fn warehouse_entries_serialize_metadata_fields() {
    let entry = SkillEntry { /* ... */ };
    let json = serde_json::to_value(entry).unwrap();
    assert_eq!(json["stable_id"], 1);
    assert_eq!(json["skill_type"], "workflow");
    assert_eq!(json["tags"][0], "rust");
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test -p agents_manager_core warehouse_entries_serialize_metadata_fields -- --exact`

Expected: FAIL until metadata fields and Tauri command payloads exist.

**Step 3: Write minimal implementation**

Expose Tauri commands for:

- list warehouse skills
- update skill metadata
- inspect skill tree
- read and write files
- create, rename, and delete paths
- run manual legacy migration
- sync selected skills to client global directories
- generate init-project command strings

**Step 4: Run test to verify it passes**

Run: `cargo test -p agents_manager_core warehouse_entries_serialize_metadata_fields -- --exact`

Expected: PASS

**Step 5: Commit**

```bash
git add crates/agents_manager_desktop/src-tauri/src/main.rs \
  crates/agents_manager_core/src/lib.rs \
  crates/agents_manager_core/src/core_tests.rs
git commit -m "feat: expose warehouse desktop commands"
```

### Task 8: Replace the desktop information architecture and visual shell

**Files:**
- Modify: `crates/agents_manager_desktop/src/main.js`
- Modify: `crates/agents_manager_desktop/src/ui.js`
- Modify: `crates/agents_manager_desktop/src/styles.css`
- Modify: `crates/agents_manager_desktop/src/ui.test.js`

**Step 1: Write the failing test**

Add a UI helper test asserting the app shell now includes:

- grouped skill navigator
- search/filter area
- file tree
- editor
- metadata panel
- migration action area
- client action area

Suggested test:

```js
test('createAppShellHtml includes grouped navigator, editor, metadata, and migration panels', () => {
  const html = createAppShellHtml()
  assert.match(html, /data-role="skill-list"/)
  assert.match(html, /data-role="filter-bar"/)
  assert.match(html, /data-role="skill-tree"/)
  assert.match(html, /data-role="editor"/)
  assert.match(html, /data-role="metadata-panel"/)
  assert.match(html, /data-role="migration-panel"/)
})
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix crates/agents_manager_desktop test`

Expected: FAIL because the old shell is still profile-centric.

**Step 3: Write minimal implementation**

Refactor the desktop shell into:

- grouped warehouse skill navigator
- filter/search toolbar
- file tree and editor workspace
- metadata and distribution sidebar
- explicit migration area

Apply the page polish as part of this task:

- stronger layout hierarchy
- more intentional spacing and grouping
- clearer status and action affordances
- no return to generic admin-form styling

**Step 4: Run test to verify it passes**

Run: `npm --prefix crates/agents_manager_desktop test`

Expected: PASS

**Step 5: Commit**

```bash
git add crates/agents_manager_desktop/src/main.js \
  crates/agents_manager_desktop/src/ui.js \
  crates/agents_manager_desktop/src/styles.css \
  crates/agents_manager_desktop/src/ui.test.js
git commit -m "feat: redesign desktop warehouse workspace"
```

### Task 9: Add metadata editing, filters, and manual migration flows

**Files:**
- Modify: `crates/agents_manager_desktop/src/main.js`
- Modify: `crates/agents_manager_desktop/src/ui.js`
- Modify: `crates/agents_manager_desktop/src/styles.css`
- Modify: `crates/agents_manager_desktop/src/ui.test.js`

**Step 1: Write the failing tests**

Add tests for:

- grouping skills by `skill_type`
- filtering by tags
- editor state dirty tracking
- metadata update controls
- manual migration result rendering

Suggested test:

```js
test('groupSkillsByType groups entries under their registry type', () => {
  const groups = groupSkillsByType([
    { id: 'a', skill_type: 'workflow', tags: [] },
    { id: 'b', skill_type: 'tooling', tags: [] }
  ])
  assert.equal(groups[0].label, 'workflow')
})
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix crates/agents_manager_desktop test`

Expected: FAIL because grouped metadata and migration helpers do not exist yet.

**Step 3: Write minimal implementation**

Implement desktop flows for:

- grouped skill rendering
- tag filters and search
- metadata editing and saving
- manual migration button and result summary
- file selection, editing, saving
- create, rename, delete for files and folders

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
git commit -m "feat: add warehouse metadata and migration flows"
```

### Task 10: Final verification and documentation cleanup

**Files:**
- Modify: `README.md`
- Modify: `crates/agents_manager_desktop/package.json`
- Modify: `crates/agents_manager_desktop/src-tauri/tauri.conf.json`

**Step 1: Write the final verification checklist**

Confirm these commands are the required evidence:

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

- warehouse root
- one-time bootstrap migration and manual migration button
- stable ID registry
- registry-owned type/tag metadata
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
