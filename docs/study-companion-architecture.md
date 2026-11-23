# 学习伴侣升级：当前架构与验收边界

本轮在现有本地 Electron 应用内增加学习伴侣主聊天、持久记忆和学习空间。根审已完成真实前端与后端的本地集成验收；真实 CLI 账号登录与已安装 Octave 的运算仍有外部环境边界，见下文。

主聊天使用固定 `study-main` ID。读写时保留旧会话，固定主聊天标题，并合并被过期保存遗漏的主聊天消息。渲染端也拒绝删除主聊天。原生 API 会话重启后从已落盘的近期消息恢复上下文；专题聊天保持独立。主聊天可以请求创建专题，并自动回答其中一个专题的初始问题。

`src/shared/study-companion.ts` 是共享 DTO/API 契约；`src/preload/index.ts` 通过显式 IPC 白名单暴露 StudyApi。系统能力始终在主进程，渲染端拿不到文件系统或 ipcRenderer。新数据使用 userData 下的 `study-companion.json`，采用版本号、原子替换与 `.bak`。损坏数据不能静默重建为空，恢复时保留损坏原件。该文件不替换 profile、wrongbook、memo 或旧聊天存档。

长期记忆可增加、编辑和移除。发送前读取最新记忆、当前位置、最近课程、未完成任务及有界的相关笔记。完成数量属于学习记录，不等于能力测评。上下文被标为只读参考，工具操作仍需通过类型、长度、已知 ID 和路由校验。用户资料不会通过扫描硬盘或读取 CLI 凭据文件来获取。

知识笔记的当前真源是该版本化数据文件，正文使用 Markdown 或隔离展示的 HTML；可以导出独立 `.md` / `.html` 文件。归档保留内容，再次编辑保存可恢复。当前没有 Obsidian 专有程序、插件系统或后台双向文件同步。Obsidian 本体闭源；这里实现轻量兼容格式，不复制其应用源码。

教材导入保留原件，支持 UTF-8 TXT/Markdown 及文字型 PDF。PDF 使用锁定版本的 MIT unpdf/PDF.js 路径，不执行教材中的脚本；25MB、1200 页和文字长度均有界。扫描 PDF 没有文字时明确要求先 OCR，不伪造识别结果。生成学习计划时将真实、有编号的教材节选交给选定模型；长教材抽样会明确说明覆盖范围，任务引用必须来自提供过的节选。任务由用户按自己的进度修改状态，没有定时器或截止日期。

主聊天可返回有界的 `study-actions` 操作，主进程校验并记入可见结果及本地记录。支持记忆、笔记、专题聊天、已知页面定位、教材计划和数值计算。未知工具、任意系统命令和伪造课程不会执行。专题聊天不能修改学习空间。App 自动同步全部基础课与 Hello Algo 的实际学习位置、完成数量和错题薄弱课程；主聊天导航只接受白名单页面与实际存在的课程。

HTML 笔记和显式 `study-html` 围栏由用户点击后打开交互预览。生成文档通过有界、仅内存的 `miai-study://preview/<随机ID>` 通道提供，不放宽聊天页面的 script-src。预览响应带 CSP sandbox allow-scripts、网络/表单/嵌套框架/worker 禁用，iframe 不允许 same-origin；主进程还拦截其他子框架导航及请求。运行时实测交互按钮可执行、宿主 preload 不可访问、外部导航被 CSP 拦截（ERR_BLOCKED_BY_CSP）。这属于网页内容隔离，并非操作系统虚拟机。

模型接入保留原生 API，并增加真实 ACP stdio 传输。握手、登录方法、会话、文本流、取消和退出都通过协议进程处理；文件、终端与权限扩张请求默认拒绝。登录交给适配器自己的官方账号流程；终端型登录会提示在官方 CLI 完成后重连。Windows 启动器不通过 shell 展开，Node 适配器需指定 node.exe 及脚本路径。Claude/Codex 需要实际安装的 ACP 适配器；Antigravity 见下一节。

Token 记录参考 T3 Code 的计数和去重原则，独立实现，未导入其依赖树或读取其私有数据。OpenAI 缓存为输入子集，Anthropic 缓存读写与普通输入合并一次；推理 token 不再叠加到输出。每个提供商请求轮次使用稳定 ID，重复 usage 帧不会重复增加，续写请求分开记录。没有 usage 时保留 null。ACP context-window 用量不当作账单 token；只有实际 prompt result 的计数字段进入记录。费用不猜测，剩余额度不从 token 推算。DeepSeek 余额刷新只允许官方固定地址；真实余额接口没有使用付费密钥验收。

数学工具采用应用自带 MCP stdio 服务与受限 Octave 计算：只接受有限的数值、矩阵及常用离线绘图表达式，拒绝文件、系统、网络、循环及动态数组扩张。它不是完整 MATLAB 或操作系统沙箱。MCP 服务需要 Node.js，计算需要另行可用的 GNU Octave；当前机器尚未找到 Octave。可用 `MIAI_NODE_PATH` / `MIAI_OCTAVE_PATH` 指定本地可执行文件。缺少运行时会明确报错；不得声称实际计算和绘图已通过。

验证证据位于 <本地工作区>。独立 Electron+真实 preload IPC 的两个进程共 40 项检查通过，均退出 0；这组使用空白宿主页，只证明后端。另有实际产品渲染器 31 项交互检查通过，验证无 API Key 的 ACP 聊天、记忆/笔记/任务真实落盘、Wiki/KaTeX、HTML 隔离、教材模型计划、跨语言定位、同页进度更新、切页收栏及 1000/1200/1600 深浅色布局。均使用 D 盘隔离 Profile、假 Key 和回环 Mock，没有付费模型调用。全量单测唯一失败仍是未检出的图库资源。没有提交、推送、打安装包、部署或修改旧桌面版本。

## Antigravity 连接（agy acp，2026-11-12 实机验证）

设置：连接页选“Antigravity ACP”，主进程 `src/main/study/agy-detect.ts` 在 PATH 与常见安装根（`%LOCALAPPDATA%\Programs`、Program Files 下的 `Antigravity\cli\bin`）里找 `agy.exe`，只执行 `--version` 探测，找到则自动填好命令与参数 `["acp"]`，另用 `agy models` 取模型列表填入可选的“模型”框（可手填）。点“保存并连接”即可；找不到时明确提示并允许手填路径。前提：已安装并登录 Antigravity CLI；未登录时连接会报“适配器尚未登录”，在终端运行 `agy acp --login` 后重连。应用从不读取或保存 agy 的凭据。

`agy acp` 实际行为（1.5.0）：`initialize` 协议版本 1，登录方式 oauth-personal / oauth-business / gemini-api-key / agent-platform（均无 `type`）；`session/new` 返回 `models`、`modes`、`configOptions`，未登录时返回 -32000；`session/update` 含 `available_commands_update`、`session_info_update`、`user_message_chunk`（回显）、`agent_message_chunk`；`session/prompt` 以 `stopReason` + `usage{inputTokens,…}` 结束；`session/set_model {modelId}` 可用，未知模型返回 -32602。额度用尽不是错误，而是一段以“⚠ Individual quota reached … Resets in …”开头的普通文本加 `end_turn`，客户端据此识别并报“模型额度已用完，约 … 后重置”。`agy acp` 没有 `--model`/`--mode` 启动参数，模型走 `session/set_model`。

对任何 ACP 智能体都适用的固定规则（教学场景，智能体不得操作用户电脑）：
- 客户端不声明 fs/terminal 能力；任何其他智能体发起的请求一律返回错误。
- 每个 `session/request_permission` 一律选 reject 选项（无则 cancelled），绝不批准；保存连接时拒绝 `--dangerously-skip-permissions` 及同类变体、`--mode auto|accept-edits` 等（`unsafeAcpArgs`）。被拒绝过则在回答末尾加一句中性说明。
- 工作目录是应用数据目录下 `study-agent-workspaces/<连接ID>` 的空目录。未使用 `--sandbox`：实测带它时一次要求建文件的提示 2 分钟无任何输出；也未强制 plan 模式（未能在额度耗尽前验证它仍能答题）。默认模式本身“编辑和命令都需询问”，询问一律被拒。
- 只有 `agent_message_chunk` 文本进入回答；thought、tool_call、命令列表、回显均丢弃。
- 进程在断开、退出应用、回合超时（3 分钟）、取消无响应（发送 `session/cancel` 3 秒后）时被杀；正常取消则回合干净结束、进程保留。

已知限制：未验证 `--sandbox` 与 plan 模式的实际效果；权限请求的真实消息形态未能抓取（额度耗尽，按 ACP 规范 options/optionId 处理并由假服务测试覆盖）；agy 自己会拉起 `--bg-updater` 后台进程，不属于本应用连接，也不由本应用管理；额度提示依赖英文关键词。
