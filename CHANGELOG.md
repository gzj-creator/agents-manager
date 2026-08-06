# Changelog

本文件记录仓库的重要变更，避免把完整 diff 直接当作发布说明。

## 如何维护

- 普通提交且不打 tag 时，把本次主线变更追加到 `## [Unreleased]`。
- 需要发版时，先把 `Unreleased` 中累计内容整理成新的版本节，再补回空的 `Unreleased`。
- 版本号遵循语义化规则：大改动升 `major`，新功能升 `minor`，修复与小改升 `patch`。
- 推荐标题格式：`## [vX.Y.Z] - YYYY-MM-DD`。
- 推荐按 `Added`、`Changed`、`Fixed`、`Docs`、`Chore` 归纳，只记录本次最重要的变更。

## [Unreleased]

## [v1.1.1] - 2026-08-06

### Added

- Settings 新增从迁移包恢复 Warehouse 的入口，恢复后自动刷新 Skills 与 Memories。
- 新导出的迁移包包含 `migration-manifest.json`，明确记录格式、格式版本、应用版本与必需内容。

### Changed

- 迁移包固定使用 `agents-manager-backup/` 根目录，导出前同步 `registry.toml`，恢复时校验清单和 Warehouse 完整结构。
- 恢复采用同盘临时目录解压与目录替换，并将 registry 中的旧设备绝对路径重定位到当前 Warehouse，保留 stable ID 和标签；失败时回滚原 Warehouse，同时继续兼容 `v1.1.0` 无清单迁移包。
- Linux 桌面端与 macOS 一样使用标准 zip 工具完成迁移包导出与恢复，不再点击后直接返回“仅支持 macOS”。

### Tests

- 补充迁移包结构、清单版本、旧包兼容和桌面端恢复桥接回归测试。

## [v1.1.0] - 2026-08-01

### Added

- Settings 新增一键导出迁移包功能，可将当前 `Warehouse Home`（含隐藏文件）压缩为 zip，方便在设备之间迁移。

### Changed

- 重排 Settings 页面，将仓库配置、扫描目录和迁移备份整理为清晰的分区布局，并改善窄屏下的排列方式。
- 调整 Memory 列表布局，避免侧栏内容被固定高度和空白区域拉伸。

### Tests

- 补充迁移备份入口与 Tauri 桥接回归测试，并通过桌面端测试、Vite 生产构建和 Rust 编译检查。

## [v1.0.0] - 2026-07-12

### Changed

- Skills 页面将搜索、标签筛选和仓库导入入口收敛为紧凑双行工具栏，显著减少顶部控制区占用，让技能列表成为左侧浏览区的视觉重点。
- 仓库导入面板展开后跨越工具栏整行显示，技能列表继续占据剩余高度并独立滚动；窄屏下自动恢复纵向排列，保持控件可读性。

### Tests

- 补充 Skills 紧凑工具栏结构回归测试，并通过桌面端全部测试与 Vite 生产构建。

### Docs

- 新增 Skills 列表密度调整的设计与实施计划文档。

## [v0.6.0] - 2026-07-09

### Changed

- Settings 的路径配置改为 `Warehouse Home`，保存 `/Users/.../.agents-manager` 这类家目录后统一派生 `skills`、`memories`、`plugins` 和 `registry.toml`，让 Skills、Memory、MCP/插件相关数据都能从同一个 agents-manager 家目录找到。
- 保存 Settings 后同时刷新 Skills 与 Memory 数据，避免切换仓库家目录后 Memory 页面仍停留在旧路径数据。

### Fixed

- 修复 Skills 页面左右面板底部不齐、左侧列表留白过大，以及页面可继续向下滚动到空白背景的问题；Skills 详情区改为面板内部滚动。

## [v0.5.0] - 2026-07-03

### Added

- 新增 Claude plugin bundle 导入与初始化能力，可管理 bundle 中的 commands、agents 与 skills，并在 CLI、Rust core、Tauri 桥接和桌面端工作流中打通。
- `init-memory` 支持 `--mode copy`，可把选中 memory 的 `MEMORY.md` 内容复制成项目目标文件；桌面端 Memory 页面同步增加 symlink/copy 模式选择，并在生成命令时透传该模式。

### Fixed

- 修复自定义 macOS pkg 脚本只打入裸 Tauri 二进制导致 GitHub Release 安装后白屏的问题；打包流程现在复用 `tauri build --bundles app` 产出的完整 `.app`，同时安装新版 `agents-manager` CLI 到 `/usr/local/bin`，并兼容 `CI=1/0` 与自定义 `CARGO_TARGET_DIR`。
- 修正 `init-memory --client claude|cursor` 的目标文件语义：Claude/Cursor 现在直接管理 `CLAUDE.md`，不再通过 `AGENTS.md` 中转或覆盖既有 `AGENTS.md`。

### Docs

- 补充 Claude plugin bundle 设计文档，并更新 README 中 `init-memory --mode copy` 的使用说明。

## [v0.4.2] - 2026-04-26

### Fixed

- 修复 Memory 页勾选“强制覆盖”后生成 `init-memory` 命令偶发遗漏 `--force` 的问题；命令生成时会优先读取当前开关状态。
- 修复桌面端打包后因资源基路径与入口加载方式不兼容导致的白屏问题；应用现在以相对路径加载前端资源，并在入口模块加载失败时直接展示错误信息。
- 修复 MCP 页面侧栏批量操作按钮所在区域被错误拉伸、占满列表高度的问题，并补充对应样式回归测试。

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
