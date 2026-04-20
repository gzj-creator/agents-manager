# Changelog

本文件记录仓库的重要变更，避免把完整 diff 直接当作发布说明。

## 如何维护

- 普通提交且不打 tag 时，把本次主线变更追加到 `## [Unreleased]`。
- 需要发版时，先把 `Unreleased` 中累计内容整理成新的版本节，再补回空的 `Unreleased`。
- 版本号遵循语义化规则：大改动升 `major`，新功能升 `minor`，修复与小改升 `patch`。
- 推荐标题格式：`## [vX.Y.Z] - YYYY-MM-DD`。
- 推荐按 `Added`、`Changed`、`Fixed`、`Docs`、`Chore` 归纳，只记录本次最重要的变更。

## [Unreleased]

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
