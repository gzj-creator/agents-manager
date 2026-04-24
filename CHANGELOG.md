# Changelog

本文件记录仓库的重要变更，避免把完整 diff 直接当作发布说明。

## 如何维护

- 普通提交且不打 tag 时，把本次主线变更追加到 `## [Unreleased]`。
- 需要发版时，先把 `Unreleased` 中累计内容整理成新的版本节，再补回空的 `Unreleased`。
- 版本号遵循语义化规则：大改动升 `major`，新功能升 `minor`，修复与小改升 `patch`。
- 推荐标题格式：`## [vX.Y.Z] - YYYY-MM-DD`。
- 推荐按 `Added`、`Changed`、`Fixed`、`Docs`、`Chore` 归纳，只记录本次最重要的变更。

## [Unreleased]

## [v0.4.2] - 2026-04-24

### Fixed

- 修复 Memory 页勾选“强制覆盖”后生成 `init-memory` 命令偶发遗漏 `--force` 的问题；命令生成时会优先读取当前开关状态。

## [v0.4.1] - 2026-04-24

### Added

- 桌面端新增应用版本号展示：左侧导航底部与 Settings 页面顶部都可直接查看当前版本，便于确认 `.pkg` 覆盖安装是否生效。

## [v0.4.0] - 2026-04-24

### Added

- CLI：`init-project` 与 `init-memory` 支持 `--force`，在目标已存在时覆盖写入；`init-memory` 在未指定 `--force` 且存在冲突时可在终端交互确认后覆盖。
- 桌面端「生成 init-project / init-memory 命令」增加「强制覆盖」选项，与 CLI 的 `--force` 行为一致。

### Changed

- `init-project` 不再在项目根目录预写 `AGENTS.md` / `CLAUDE.md` 占位；memory 需通过 `init-memory` 单独落地（与 README 描述一致）。

### Fixed

- macOS 打包用 plist 单测从 `package.json` 读取版本，避免发版号与断言脱节。

## [v0.3.0] - 2026-04-22

### Added

- 桌面端 MCP 页面支持多选 server 并批量启用或禁用，同时在列表和编辑区展示启用状态。
- `sync-global-skills` 补齐同名冲突返回与逐项覆盖能力，桌面端同步到客户端时会逐个确认是否覆盖已有 Skill，并在完成后给出明确成功反馈。
- 新增稳定的 macOS 打包脚本与对应测试，可直接生成覆盖安装到 `/Applications` 的 `agents-manager.pkg`。

### Changed

- MCP 配置读写改为区分“客户端真实启用项”和“agents-manager 保存的禁用草稿”，重新启用时不会丢失已禁用 server 的配置内容。
- Codex 的 `config.toml` 现在只定向更新 `[mcp_servers]`，保留模型、profiles 等非 MCP 配置内容不被改写。

### Fixed

- 修复同步客户端时一旦遇到冲突就中断且无覆盖入口的问题，并避免在冲突确认前发生部分 Skill 已写入、部分未写入的半完成状态。

## [v0.2.0] - 2026-04-21

### Added

- 桌面端 Skills 页面支持空白区域右键菜单与内联新建 Skill，补齐仓库分组内的直接创建入口。
- 桌面端新增拖入 Skill 的同名预览与覆盖确认流程，支持按名称或 ID 忽略大小写匹配并直接覆盖现有条目。
- Memory 页面新增卡片右键菜单、应用内重命名弹窗，以及 Editor 树根节点的 Memory 重命名/删除入口。

### Changed

- 统一规范 Skill type 分组展示，合并大小写不同但语义相同的分组，并压缩 Skills 列表卡片布局以提升可视密度。
- 优化 Skills 与 Memory 命令复制反馈，复制后仅更新按钮状态，不再触发整页重渲染或滚动位置跳变。
- 扩展桌面端 Tauri 命令与 Rust core 导入能力，允许预览拖入 Skill 并在保留 stable id 的前提下原地覆盖目录或 `SKILL.md`。

### Fixed

- 修复 Memory 页面右键菜单漂移、删除确认面板拉伸，以及重命名在桌面端无法稳定工作的交互问题。
- 修复拖入目录形式的同名 Skill 时无提示、无覆盖的问题，并补齐冲突重试逻辑。

## [v0.1.1] - 2026-04-20

### Fixed

- 修复 macOS 桌面包未显式声明应用图标的问题，确保 bundle 中写入 `icon.icns` 并在 `Info.plist` 中声明图标字段。

### Changed

- 调整桌面端 Tauri bundling 配置，便于后续生成带图标资源的安装包。

## [v0.1.0] - 2026-04-20

### Added

- 新增独立 `memory` 仓库与注册表，支持扫描、创建、重命名、删除、拖拽导入，以及 `init-memory` 初始化命令。
- 桌面端新增 `Memory` 页面、对应 Tauri 命令和编辑器联动，可直接生成并复制 `init-memory` 命令。
- 桌面端新增 MCP 能力配置入口与默认 capability 文件，并补充橙黄色 AI/agents 图标源文件与多尺寸图标资源。

### Changed

- 桌面端工作台改为 `Skills`、`Editor`、`Memory`、`MCP`、`Settings` 多页面壳层，统一处理编辑器上下文、拖拽导入和目录内复制。
- CLI 与核心测试扩展到 memory 工作流，桌面端测试扩展到页面壳层、capability 和图标资源校验。

### Docs

- 更新桌面端壳层与页面化工作流的规划文档，和当前实现保持一致。

### Chore

- 忽略 `docs/plans/` 与 `.codex` 本地产物目录，减少工作区噪音。
