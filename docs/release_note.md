# Release Notes

## v0.1.0 - 2026-04-20

- 版本级别：中版本
- Git 提交消息：`feat: 打通 memory 与桌面端多页面工作流`
- Git Tag：`v0.1.0`

### 变更摘要

- 新增独立 `memory` 仓库与注册表，支持扫描、创建、重命名、删除、拖拽导入，以及 `init-memory` 初始化命令。
- 桌面端重构为 `Skills`、`Editor`、`Memory`、`MCP`、`Settings` 多页面壳层，统一编辑器上下文、拖拽导入与目录内复制流程。
- 新增 MCP 配置入口、默认 capability 文件，以及暖橙色 AI/agents 图标源文件和多尺寸桌面图标资源。
- 扩展 Rust core/CLI 与桌面端测试，覆盖 memory 工作流、桌面壳层、capability 与图标资源校验。
