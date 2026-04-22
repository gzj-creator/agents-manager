# Release Notes

## v0.3.0 - 2026-04-22

- 版本级别：中版本
- Git 提交消息：`feat: 补齐桌面端 MCP 与客户端分发能力`
- Git Tag：`v0.3.0`

### 变更摘要

- MCP 页面升级为真正的启用/禁用管理：支持多选批量操作、启用状态展示，并把禁用 server 作为草稿保存在 agents-manager 自己的配置里，重新启用时不会丢失原有参数。
- Codex MCP 写回逻辑改为只定向更新 `[mcp_servers]`，保留 `model`、`profiles` 等非 MCP 配置内容，避免启用或禁用 MCP 时破坏客户端其他配置。
- 同步到客户端时新增逐个冲突覆盖确认与明确成功反馈，后端也会先返回冲突再执行写入，避免出现部分 Skill 已同步、部分因冲突中断的半完成状态。
- 新增稳定的 macOS 打包脚本与测试，方便直接生成可覆盖安装到 `/Applications` 的桌面安装包。

## v0.2.0 - 2026-04-21

- 版本级别：中版本
- Git 提交消息：`feat: 完善桌面端 skills 与 memory 交互`
- Git Tag：`v0.2.0`

### 变更摘要

- Skills 页面补齐空白区域右键菜单和内联新建 Skill，统一 Skill type 分组并压缩卡片布局，让仓库浏览和管理更紧凑。
- 新增拖入 Skill 的预览、同名冲突识别和覆盖确认，支持按名称或 ID 忽略大小写匹配，并在 Rust core / Tauri 桥接层支持原地覆盖导入。
- Memory 页面补齐右键菜单、应用内重命名弹窗和树根节点操作，修复右键菜单漂移、删除确认拉伸，以及命令复制后跳回顶部的问题。

## v0.1.1 - 2026-04-20

- 版本级别：小版本
- Git 提交消息：`fix: 修复 macOS 安装包图标`
- Git Tag：`v0.1.1`

### 变更摘要

- 修复 macOS 桌面 bundle 没有显式包含 `icon.icns` 的问题。
- 为桌面端补充 `Info.plist` 图标声明，确保安装后的应用显示新的 agents-manager 图标。

## v0.1.0 - 2026-04-20

- 版本级别：中版本
- Git 提交消息：`feat: 打通 memory 与桌面端多页面工作流`
- Git Tag：`v0.1.0`

### 变更摘要

- 新增独立 `memory` 仓库与注册表，支持扫描、创建、重命名、删除、拖拽导入，以及 `init-memory` 初始化命令。
- 桌面端重构为 `Skills`、`Editor`、`Memory`、`MCP`、`Settings` 多页面壳层，统一编辑器上下文、拖拽导入与目录内复制流程。
- 新增 MCP 配置入口、默认 capability 文件，以及暖橙色 AI/agents 图标源文件和多尺寸桌面图标资源。
- 扩展 Rust core/CLI 与桌面端测试，覆盖 memory 工作流、桌面壳层、capability 与图标资源校验。
