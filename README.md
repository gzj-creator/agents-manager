# agents-manager

管理 `skills`、`CLAUDE.md`、`AGENTS.md` 的本地工具，提供：

- Rust 核心库（扫描、应用、doctor）
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
cargo run -p agents_manager_cli -- profile list
cargo run -p agents_manager_cli -- profile upsert \
  --id claude \
  --project-skill-root .claude/skills \
  --claude-md-target CLAUDE.md \
  --agents-md-target AGENTS.md

cargo run -p agents_manager_cli -- config show
cargo run -p agents_manager_cli -- config set-library-roots \
  --roots ~/.agents/skills,~/.codex/skills \
  --default-profile claude

cargo run -p agents_manager_cli -- apply \
  --project . \
  --profile claude \
  --skills skillA,skillB \
  --claude-md /abs/CLAUDE.md \
  --agents-md /abs/AGENTS.md

cargo run -p agents_manager_cli -- doctor --project . --profile claude
```

`apply` 默认 `symlink`，可用 `--mode copy`。

## Profile 示例

首次运行会在配置目录生成默认 profile（`claude` / `cursor` / `codex`）：

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

- 扫描并勾选技能
- 选择/编辑/保存 profile
- 使用系统目录选择器选择项目目录
- 填写 `CLAUDE.md` / `AGENTS.md` 来源文件
- 一键 apply 与 doctor
