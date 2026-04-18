# agents-manager

管理 `skills`、`CLAUDE.md`、`AGENTS.md` 的本地工具，提供：

- Rust 核心库（warehouse、迁移、同步、init-project）
- CLI：`agents-manager`
- Tauri 2 桌面 GUI

## 工作区结构

- `crates/agents_manager_core`：核心逻辑
- `crates/agents_manager_cli`：命令行
- `crates/agents_manager_desktop`：前端
- `crates/agents_manager_desktop/src-tauri`：Tauri 后端

## CLI

```bash
cargo run -p agents_manager_cli -- library scan
cargo run -p agents_manager_cli -- migrate-legacy-skills
cargo run -p agents_manager_cli -- init-project \
  --client codex \
  --skills 1,2,3
```

`library scan` 只扫描 `~/.agents-manager/skills`。

`migrate-legacy-skills` 会把 `~/.codex/skills` 和 `~/.claude/skills` 中的旧 skill 迁移进 warehouse。

`init-project` 默认 `symlink`，可用 `--mode copy`。

旧的 `profile` / `apply` / `doctor` CLI 仍保留，但不再是主工作流。

## Profile 示例

## Warehouse

统一仓库目录：

- `~/.agents-manager/skills`

registry 元数据保存：

- stable numeric ID
- `skill_type`
- `tags`
- `source_hint`

首次进入新工作流时，应用会执行一次 legacy migration。之后不再自动迁移，但桌面端会提供手动迁移按钮。

## Profile 示例

兼容旧工作流时，首次运行会在配置目录生成默认 profile（`claude` / `cursor` / `codex`）：

- `claude`：`.claude/skills`
- `cursor`：`.cursor/skills`
- `codex`：`.codex/skills`

每个 profile 还包含目标文件：

- `claude_md_target`（默认 `CLAUDE.md`）
- `agents_md_target`（默认 `AGENTS.md`）

## GUI

```bash
cd crates/agents_manager_desktop
npm install
cargo tauri dev --manifest-path src-tauri/Cargo.toml
```

GUI 支持：

- 只浏览 warehouse 中的 skill
- 对 skill 做分组、标签筛选和搜索
- 编辑整个 skill 目录中的文本文件
- 编辑 registry 中的 `type` / `tags`
- 手动迁移现有 Codex / Claude skill
- 同步 warehouse skill 到客户端目录
- 生成 `init-project` 命令
