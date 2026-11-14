# open-claude-ui 界面迁移

设计来源唯一采用 `Caho1/open-claude-ui @ c1f923ae0051a871941b98a0e2e3183a545e6a85`。固定参考副本位于 `D:/project/coding/outputs/open-claude-ui-reference`，含 18 份源码与规范文件。本轮不使用旧 frontend-ui-polish 作为设计依据。

## 来源与落点

- `code-examples/cds-theme.css`、`cds-pure.css`：原样保存到 renderer/styles/vendor/open-claude-ui，作为实际导入的令牌和原生 CSS 动效层。哈希测试锁定两份 CSS 与原始 MIT LICENSE，许可另随包保存于 LICENSES。
- `CdsButton.tsx`：MiButton 对应 28/32/40px 尺寸、中性默认次级按钮、独立 paint 层、禁用/忙碌、60ms 按下与上游弹簧回弹。运行和新建笔记等主要动作才使用陶土色阶。
- `SegmentedControl.tsx`：MiTabs 对应 1px 内缩轨道、等分指示块、120ms snap；课程语言、练习、我的学习、设置统一使用此组件。保留方向键/Home/End和焦点跟随。
- CDS 原子控件与 Agent 指南：MiInput、MiSelect、MiSwitch、MiCard、弹窗与搜索面板对应单边框、四层 Surface、清晰焦点和标签。中文输入法组合态 Enter 不触发提前提交。
- v2 系统底座与桌面架构：268px 侧栏、独立课程滚动、宽窗有用的上下文工具栏、窄窗收起工具栏、固定轻量缩放底栏；保留 Windows 系统控制与拖拽区域。

## 宿主适配

`styles/cds-adapter.css` 将现有 mi 语义名称映射到 CDS，而不是为每页新造主题。Surface0/1/2/3 在浅色为 #f9f9f7/#fcfcfb/#fff/#fff，深色为 #0b0b0b/#151515/#1a1a19/#20201f。设置的原有 data-theme 同步到上游 data-mode/.dark。原生窗口颜色镜像位于 shared/theme.ts，并受测试约束。

功能 UI 使用 Segoe UI / Microsoft YaHei UI / Microsoft YaHei / system-ui。用户指定的本地 Anthropic Serif 保留用于课程阅读和展示，中文回退到清晰的 Sans；代码使用 Consolas/Cascadia Code。阅读列最大 736px，编辑器可更宽。字体来源见 [字体说明](../src/renderer/src/assets/fonts/FONT-NOTICES.md)，不将代码 MIT 许可误套到字体。

目录改为阶段列表，五语言同一行分段，状态和计数对齐；课程选择与侧栏共享 content.activeLang。我的学习使用克制的摘要、两列语言进度与去重后的五语言雷达轴；收藏和笔记共用同一分段导航。设置使用紧凑行，开关和每项输入保留可访问名称。

本轮没有修改课程/题目语义、数据格式、编译执行协议或账号恢复策略。已退休功能不重新挂载。旧源码中未挂载的退休功能仍可保留；最终包继续排除整个 out/pet-helper。未安装新依赖或编译器。

## 本地使用与证据

双击根目录 Start-MiAiCoding.cmd。启动器在子进程清除 ELECTRON_RUN_AS_NODE 后调用原有 start-local.cjs，读取项目 local-data；不覆盖数据。不要把 QA 档案复制回 local-data。

本轮日志、真实 Electron 截图及预览在 `D:/project/coding/outputs/open-claude-ui-checks`。QA 使用独立 qa-data 与真实 preload/IPC。旧 final-checks/review-r1/review-r2 截图仅为功能基线，不作为本次设计截图。
