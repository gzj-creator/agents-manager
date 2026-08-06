# Release Notes

## v1.1.3 - 2026-08-06

- 版本级别：修复版本
- Git 提交消息：`fix: 发布 agents-manager v1.1.3`
- Git Tag：`v1.1.3`

### 变更摘要

- Debian 安装包现在会同时安装 `agents-manager` CLI 到 `/usr/local/bin`。
- 修复勾选 Skill 后列表滚动位置跳回顶部的问题。
- 收紧标签筛选、客户端和同步模式选择框的宽度，减少界面空间占用。
- 完成桌面端测试、Rust 工作区测试与 Linux `.deb` 打包校验。

## v1.1.2 - 2026-08-06

- 版本级别：小版本
- Git 提交消息：`fix: 固定 Skills 与 Memory 主页面滚动并发布 v1.1.2`
- Git Tag：`v1.1.2`

### 变更摘要

- 桌面主壳层固定在视口内，Skills 与 Memory 的列表、详情分别在内部滚动，避免主页面持续向下拉动。
- 窄屏布局恢复自然页面滚动，避免固定桌面布局裁切移动端内容。
- 完成桌面端测试、Vite 生产构建与 Linux `.deb` 打包校验。

## v1.1.1 - 2026-08-06

- 版本级别：小版本
- Git 提交消息：`fix: 规范迁移包导入导出并发布 v1.1.1`
- Git Tag：`v1.1.1`

### 变更摘要

- Settings 新增“从迁移包恢复”，恢复前明确提示覆盖风险，恢复后刷新 Skills、Memories 与编辑器状态。
- 新导出包固定使用 `agents-manager-backup/` 根目录，并写入版本化 `migration-manifest.json`，包含格式标识、格式版本、应用版本与内容清单。
- Linux 与 macOS 桌面端都支持标准 zip 迁移包的导出与恢复。
- 恢复前校验 `skills`、`memories`、`plugins`、`registry.toml` 与清单版本，将 registry 中的旧设备绝对路径重定位到当前 Warehouse，保留 stable ID 和标签；恢复使用可回滚的目录替换，并兼容 v1.1.0 旧迁移包。
- 完成 Rust 工作区测试、桌面端测试、Vite 生产构建与 Linux `.deb` 打包校验。

## v0.6.0 - 2026-07-09

- 版本级别：中版本
- Git 提交消息：`feat: 支持仓库家目录配置并发布 v0.6.0`
- Git Tag：`v0.6.0`

### 变更摘要

- Settings 的路径配置改为 `Warehouse Home`，配置 `/Users/.../.agents-manager` 这样的 agents-manager 家目录后，会统一派生 `skills`、`memories`、`plugins` 和 `registry.toml`，让技能、记忆与插件/MCP 相关数据使用同一个家目录。
- 保存 Settings 后同时刷新 Skills 与 Memory 数据，避免更换家目录后部分页面继续显示旧路径内容。
- 修复 Skills 页面左右面板底部不齐、左侧列表留白过大，以及页面能继续向下滚动到空白背景的问题；详情区保留内部滚动能力。

## v0.5.0 - 2026-07-03

- 版本级别：中版本
- Git 提交消息：`feat: 支持 memory copy 模式并发布 v0.5.0`
- Git Tag：`v0.5.0`

### 变更摘要

- 新增 Claude plugin bundle 导入与初始化能力，可管理 bundle 中的 commands、agents 与 skills，并在 CLI、Rust core、Tauri 桥接和桌面端工作流中打通。
- `init-memory` 支持 `--mode copy`，可把选中 memory 的 `MEMORY.md` 内容复制成项目目标文件；桌面端 Memory 页面同步增加 symlink/copy 模式选择，并在生成命令时透传该模式。
- 修复自定义 macOS pkg 脚本只打入裸 Tauri 二进制导致 GitHub Release 安装后白屏的问题；打包流程现在复用 `tauri build --bundles app` 产出的完整 `.app`，同时安装新版 `agents-manager` CLI 到 `/usr/local/bin`。
- 修正 `init-memory --client claude|cursor` 的目标文件语义：Claude/Cursor 现在直接管理 `CLAUDE.md`，不再通过 `AGENTS.md` 中转或覆盖既有 `AGENTS.md`。
- 补充 Claude plugin bundle 设计文档，并更新 README 中 `init-memory --mode copy` 的使用说明。

## v0.4.2 - 2026-04-24

- 版本级别：小版本
- Git 提交消息：`fix: 修复桌面端白屏与 MCP 侧栏布局问题`
- Git Tag：`v0.4.2`

### 变更摘要

- 修复 Memory 页面中“强制覆盖”已勾选但生成命令缺失 `--force` 的问题；生成时改为优先读取复选框实时状态，避免状态不同步导致参数丢失。
- 修复桌面端打包后因资源基路径与入口加载方式不兼容导致的白屏问题；应用现在以相对路径加载前端资源，并在入口模块加载失败时直接展示错误信息。
- 修复 MCP 页面侧栏批量操作按钮所在区域被错误拉伸、占满列表高度的问题，并补充对应样式回归测试。

## v0.4.1 - 2026-04-24

- 版本级别：小版本
- Git 提交消息：`fix: 增加应用内版本展示以确认覆盖安装结果`
- Git Tag：`v0.4.1`

### 变更摘要

- 桌面端新增应用版本号展示能力：在左侧导航底部与 Settings 页面顶部同时展示当前版本，安装后可直接核对是否已覆盖到预期版本。
- 新增 Tauri `app_version_cmd` 命令，前端启动时读取真实应用版本并渲染到 UI，避免硬编码版本文案。

## v0.4.0 - 2026-04-24

- 版本级别：中版本
- Git 提交消息：`feat: 拆分 init 与 memory 并支持 init 覆盖与生成命令强开关`
- Git Tag：`v0.4.0`

### 变更摘要

- `init-project` 与 `init-memory` 支持 `--force` 覆盖已存在的目标；无 `--force` 时 `init-memory` 可在终端逐项确认后覆盖。核心层补齐 memory 初始化计划、冲突检测与安全删除逻辑。
- `init-project` 不再随技能安装自动写入项目根目录的 memory/文档占位，memory 由 `init-memory` 独立管理，与 README 说明对齐。
- 桌面端在生成 `init-project` / `init-memory` 命令时提供「强制覆盖」开关，并将 `force` 传入 Tauri 桥接。macOS 打包 plist 单测改为读取桌面 `package.json` 版本，避免与发版号不一致。

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

## v1.0.0 - 2026-07-12

- 版本级别：主版本（用户明确指定）
- Git 提交消息：`feat: 发布 v1.0.0 并突出 Skills 列表区域`
- Git Tag：`v1.0.0`

### 变更摘要

- Skills 页面将搜索、标签筛选和仓库导入入口整合为紧凑双行工具栏，减少顶部控制区高度，让下方技能列表获得更多可视空间并成为浏览区重点。
- 仓库导入操作展开时跨整行显示，技能列表继续占据剩余高度并独立滚动；窄屏布局自动恢复纵向排列，避免控件过度压缩。
- 新增紧凑工具栏结构回归测试，以及对应的设计和实施计划文档；桌面端全部测试和 Vite 生产构建均纳入发布验证。

## v1.1.0 - 2026-08-01

- 版本级别：次版本
- Git 提交消息：`feat: 整理 Settings 页面并支持仓库迁移备份`
- Git Tag：`v1.1.0`

### 变更摘要

- Settings 页面重新整理为仓库配置、扫描目录和迁移备份三个区域，统一卡片层级和响应式排列，减少页面视觉空白与操作分散。
- 新增一键导出迁移包能力，通过原生保存对话框将当前 `Warehouse Home`（包含隐藏文件）压缩为 zip，并保留仓库根目录层级。
- 补充迁移备份入口和 Tauri 桥接回归测试，完成桌面端测试、Vite 生产构建、Rust 编译检查及 zip 打包冒烟验证。
