# Desktop UI Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine the existing Tauri desktop UI so it feels more polished and responsive without changing backend behavior or adding a frontend framework.

**Architecture:** Keep the current vanilla JS entry point, but split UI markup/state helpers from DOM wiring, move presentation into a dedicated stylesheet, and centralize async action handling so loading, success, and error states behave consistently.

**Tech Stack:** Tauri 2, Vite, vanilla JavaScript, CSS, Node built-in test runner

---

### Task 1: Extract UI shell and style foundation

**Files:**
- Create: `crates/agents_manager_desktop/src/ui.js`
- Create: `crates/agents_manager_desktop/src/styles.css`
- Create: `crates/agents_manager_desktop/src/ui.test.js`
- Modify: `crates/agents_manager_desktop/src/main.js`
- Modify: `crates/agents_manager_desktop/package.json`

**Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createAppShellHtml } from './ui.js'

test('createAppShellHtml includes header, actions, and output regions', () => {
  const html = createAppShellHtml()
  assert.match(html, /agents-manager/)
  assert.match(html, /data-role="status"/)
  assert.match(html, /data-role="skills"/)
  assert.match(html, /data-role="output"/)
})
```

**Step 2: Run test to verify it fails**

Run: `node --test crates/agents_manager_desktop/src/ui.test.js`

Expected: FAIL because `createAppShellHtml` does not exist yet.

**Step 3: Write minimal implementation**

```js
export function createAppShellHtml() {
  return `<main>...</main>`
}
```

Also import `./styles.css` from `src/main.js` and replace the inline base template call with `createAppShellHtml()`.

**Step 4: Run test to verify it passes**

Run: `node --test crates/agents_manager_desktop/src/ui.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add crates/agents_manager_desktop/src/ui.js \
  crates/agents_manager_desktop/src/styles.css \
  crates/agents_manager_desktop/src/ui.test.js \
  crates/agents_manager_desktop/src/main.js \
  crates/agents_manager_desktop/package.json
git commit -m "feat: add desktop ui shell and styles"
```

### Task 2: Add shared action state and header status feedback

**Files:**
- Modify: `crates/agents_manager_desktop/src/ui.js`
- Modify: `crates/agents_manager_desktop/src/ui.test.js`
- Modify: `crates/agents_manager_desktop/src/main.js`

**Step 1: Write the failing test**

```js
import { createActionState, nextActionState } from './ui.js'

test('nextActionState marks an action as loading and updates status copy', () => {
  const state = createActionState()
  const next = nextActionState(state, { type: 'start', action: 'apply' })
  assert.equal(next.busy, true)
  assert.equal(next.activeAction, 'apply')
  assert.match(next.statusText, /正在应用/)
})
```

**Step 2: Run test to verify it fails**

Run: `node --test crates/agents_manager_desktop/src/ui.test.js`

Expected: FAIL because the action state helpers do not exist yet.

**Step 3: Write minimal implementation**

```js
export function createActionState() {
  return { busy: false, activeAction: null, statusTone: 'idle', statusText: '准备就绪' }
}
```

Add a single async action wrapper in `src/main.js` that:

- marks buttons disabled while an action is running
- updates the header status
- routes success and error output to the output panel

**Step 4: Run test to verify it passes**

Run: `node --test crates/agents_manager_desktop/src/ui.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add crates/agents_manager_desktop/src/ui.js \
  crates/agents_manager_desktop/src/ui.test.js \
  crates/agents_manager_desktop/src/main.js
git commit -m "feat: add desktop action status handling"
```

### Task 3: Upgrade skill selection and output presentation

**Files:**
- Modify: `crates/agents_manager_desktop/src/ui.js`
- Modify: `crates/agents_manager_desktop/src/ui.test.js`
- Modify: `crates/agents_manager_desktop/src/main.js`
- Modify: `crates/agents_manager_desktop/src/styles.css`

**Step 1: Write the failing test**

```js
import { renderSkillsHtml, formatOutputPayload } from './ui.js'

test('renderSkillsHtml shows selectable cards and selected count hook', () => {
  const html = renderSkillsHtml([{ id: 'a', name: 'Skill A', description: 'Desc' }])
  assert.match(html, /skill-card/)
  assert.match(html, /data-skill="a"/)
})

test('formatOutputPayload marks errors with error tone', () => {
  const formatted = formatOutputPayload(new Error('boom'))
  assert.equal(formatted.tone, 'error')
  assert.match(formatted.text, /boom/)
})
```

**Step 2: Run test to verify it fails**

Run: `node --test crates/agents_manager_desktop/src/ui.test.js`

Expected: FAIL because the rendering and formatting helpers do not exist yet.

**Step 3: Write minimal implementation**

```js
export function renderSkillsHtml(skills) {
  return skills.map(/* render skill cards */).join('')
}
```

Implement the matching CSS for:

- card hover and selected states
- selected count badge
- styled output panel tones for info, success, and error

**Step 4: Run test to verify it passes**

Run: `node --test crates/agents_manager_desktop/src/ui.test.js`

Expected: PASS

**Step 5: Commit**

```bash
git add crates/agents_manager_desktop/src/ui.js \
  crates/agents_manager_desktop/src/ui.test.js \
  crates/agents_manager_desktop/src/main.js \
  crates/agents_manager_desktop/src/styles.css
git commit -m "feat: polish skill selection and output panel"
```

### Task 4: Add minimal form validation and finish verification

**Files:**
- Modify: `crates/agents_manager_desktop/src/ui.js`
- Modify: `crates/agents_manager_desktop/src/ui.test.js`
- Modify: `crates/agents_manager_desktop/src/main.js`
- Modify: `crates/agents_manager_desktop/package.json`

**Step 1: Write the failing test**

```js
import { validateProfileForm, validateProjectAction } from './ui.js'

test('validateProfileForm rejects missing id and skill root', () => {
  assert.deepEqual(validateProfileForm({ id: '', project_skill_root: '' }), [
    'profile id 不能为空',
    'project_skill_root 不能为空'
  ])
})

test('validateProjectAction rejects empty project path', () => {
  assert.deepEqual(validateProjectAction({ project: '' }), ['project 路径不能为空'])
})
```

**Step 2: Run test to verify it fails**

Run: `node --test crates/agents_manager_desktop/src/ui.test.js`

Expected: FAIL because validation helpers do not exist yet.

**Step 3: Write minimal implementation**

```js
export function validateProjectAction(values) {
  return values.project ? [] : ['project 路径不能为空']
}
```

Use the validation results in `src/main.js` before invoking Tauri commands, and expose a package script:

```json
{
  "scripts": {
    "test": "node --test src/ui.test.js",
    "build": "vite build"
  }
}
```

**Step 4: Run test to verify it passes**

Run: `node --test crates/agents_manager_desktop/src/ui.test.js`

Expected: PASS

**Step 5: Run final verification**

Run: `npm --prefix crates/agents_manager_desktop test`

Expected: PASS

Run: `npm --prefix crates/agents_manager_desktop build`

Expected: PASS and produce the Vite bundle without frontend errors.

**Step 6: Commit**

```bash
git add crates/agents_manager_desktop/src/ui.js \
  crates/agents_manager_desktop/src/ui.test.js \
  crates/agents_manager_desktop/src/main.js \
  crates/agents_manager_desktop/src/styles.css \
  crates/agents_manager_desktop/package.json
git commit -m "feat: finish desktop ui polish"
```
