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

## Warehouse

统一仓库目录：

- `~/.agents-manager/skills`

registry 元数据保存：

- stable numeric ID
- `skill_type`
- `tags`
- `source_hint`

首次进入新工作流时，应用会执行一次 legacy migration：

- 从 `~/.codex/skills`
- 从 `~/.claude/skills`
- 移动到 `~/.agents-manager/skills`

之后不再自动迁移，但桌面端会提供手动迁移按钮。

同名冲突处理规则：

- 同名同内容：保留一份 warehouse 副本
- 同名不同内容：按固定顺序 `codex -> claude` 处理，后者覆盖前者

客户端后续启用的 skill 统一从 warehouse 同步回去，不再把原始客户端目录当作持续展示来源。

## Init Project

项目初始化命令使用 stable numeric ID：

```bash
agents-manager init-project --client codex --skills 1,2,3
```

它会：

- 解析 warehouse 中的 stable ID
- 创建目标项目下的客户端目录
- 生成对应 memory file
- 以 `symlink` 或 `copy` 方式写入选中的 skill

memory file 规则：

- `codex` -> `AGENTS.md`
- `claude` -> `CLAUDE.md`

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

当前桌面客户端为单窗口分页结构：

- 左侧固定导航：`Skills` / `Editor` / `Sync` / `Migration` / `Settings`
- `Skills` 页负责分组浏览、搜索和标签筛选
- `Editor` 页负责文件树、文本编辑和元数据维护
- `Sync` 页负责客户端同步和 `init-project` 命令生成
- `Migration` 页负责一次性迁移状态和手动迁移
- `Settings` 页负责 warehouse、registry 和客户端目录信息
