import { app, shell, BrowserWindow, dialog } from 'electron'
import { join } from 'path'
import { mkdirSync, unlinkSync, writeFileSync } from 'fs'
import { STORAGE_PREFLIGHT, APP_NAME } from '../shared/copy'
import { TITLE_SYMBOL_COLOR, WINDOW_BG } from '../shared/theme'
import { registerSchemePrivileges } from './file-protocol'
import { decideNavigation, isExternalUrlAllowed } from './window-guards'
import { isHtmlPreviewUrl } from './study/html-preview'
import { createMainContext, type MainContext } from './context'
import { FEATURES } from './features'

const isDev = !app.isPackaged

/**
 * 开发期诊断开关：只有显式设了 `MIAI_DEBUG_PORT` 才开远程调试端口。
 *
 * 【为什么要留这个口子】
 * 「光标乱跳、选不中字」这类问题**没法靠读代码下结论**——它取决于真实的
 * DOM 布局和事件时序，猜出来的根因十有八九是错的。这次就是现成的例子：
 * 接上真编辑器、真的敲键盘按 Ctrl+A 之后才发现，主人报的现象里
 * **有一条是真的**（点完「运行」焦点永远回不到编辑器，所以 Ctrl+A 没反应），
 * **另一条复现不出来**（「光标一直在跳」）。没有这个端口，只能靠猜，
 * 而「照着猜出来的根因改代码」比什么都不改更危险。
 *
 * 【为什么必须用环境变量守住】
 * 这个端口能把渲染进程扒得一干二净。要是打包进用户装的版本里，
 * 等于给每个用户的机器开了个后门。所以默认**必须是关的**，
 * 只有手动设了变量才会开。
 */
const debugPort = process.env['MIAI_DEBUG_PORT']
if (debugPort) app.commandLine.appendSwitch('remote-debugging-port', debugPort)

/*
 * 自定义协议（miai-study:// / miai-cet6:// / miai-cet4://）的特权声明。
 *
 * **必须在 app ready 之前**：scheme 的 privileges 只能在 ready 前声明，
 * 晚了这个 scheme 就不是 standard/secure 上下文 —— 表现是资源加载被当成
 * 跨源脏请求挡掉，或者 scheme 根本不算合法 origin。且整个进程只能调一次。
 * 装 handler（哪些目录可访问）在 ready 后、**建窗口之前**，渲染进程出生后再装就晚了。
 */
registerSchemePrivileges()

/** The entry point selects one profile for both Chromium and application stores. */
function storageDir(): string {
  return app.getPath('userData')
}

// ---------------------------------------------------------------- 启动前置检查（D2，2026-10-17）

/**
 * 数据目录可写性前置检查 —— 只读 / 满盘时**出声退出**，绝不静默闪退。
 *
 * 【为什么用真实写探针，不用 accessSync(W_OK)】Windows 的 access() 只看文件的
 * 只读属性，**不评估 ACL**：被 icacls 拒绝写入的目录照样报「可写」，探针就成了
 * 摆设。mkdir + write + unlink 走的是真正会失败的那条系统调用，EACCES/EPERM
 * （拒绝访问）与 ENOSPC（满盘）都会如实抛出来。
 *
 * 【为什么查两个目录】storageDir() 是我们的数据落点（便携版 = exe 旁的 data/、
 * 安装版 = userData）；userData 同时是 Chromium 的 profile 目录 —— 它不可写时
 * Chromium 连 lock file 都建不出来（实测：无窗口、无对话框、静默退出 0）。两个
 * 都探，把能查到的失败一次说清。
 *
 * 【时序】模块顶层执行，早于 whenReady 与任何窗口创建；dialog.showErrorBox
 * 明确支持 ready 前调用（Electron 文档口径），且是阻塞框 —— 弹出的这一刻后续
 * 启动流程不会继续往前跑。用户点掉后 app.exit(1)，退出码不再是「成功」的 0。
 *
 * 【为什么不在 index.ts】index.ts 是薄入口（只定 userData 路径）；检查放在 app.ts，
 * 才能在 require 真正的应用之后、whenReady 之前跑，不抢在数据目录确定之前。
 */
function probeWritableDir(dir: string): string | null {
  const probe = join(dir, `.miai-write-probe-${process.pid}-${Date.now()}`)
  try {
    mkdirSync(dir, { recursive: true }) // 首启目录可能不存在：先建，否则 ENOENT 假报警
    writeFileSync(probe, 'ok')
    unlinkSync(probe)
    return null
  } catch (err) {
    try {
      unlinkSync(probe)
    } catch {
      /* 没写成、或删不掉：都交给下面这条错误信息 */
    }
    const code = (err as NodeJS.ErrnoException).code
    return `${code ? code + ': ' : ''}${err instanceof Error ? err.message : String(err)}`
  }
}

function ensureStorageWritableOrExit(): void {
  const targets: string[] = []
  const failures: string[] = []
  try {
    targets.push(app.getPath('userData'))
  } catch (err) {
    failures.push(`userData: ${err instanceof Error ? err.message : String(err)}`)
  }
  try {
    const dir = storageDir()
    if (!targets.includes(dir)) targets.push(dir)
  } catch (err) {
    failures.push(`storageDir: ${err instanceof Error ? err.message : String(err)}`)
  }
  for (const dir of targets) {
    const failure = probeWritableDir(dir)
    if (failure !== null) failures.push(STORAGE_PREFLIGHT.DETAIL(dir, failure))
  }
  if (failures.length === 0) return
  // 诊断留痕：GUI 对话框的正文不进日志，stderr 这一行是排查时唯一的机器可读证据
  console.error('[miai] storage preflight failed:', failures.join(' | '))
  // 文案统一住 shared/copy.ts（文案闸门扫整棵 src/，主进程弹框也不许写死中文）
  dialog.showErrorBox(
    STORAGE_PREFLIGHT.TITLE,
    STORAGE_PREFLIGHT.BODY_HEAD +
      STORAGE_PREFLIGHT.BODY_CAUSE +
      STORAGE_PREFLIGHT.BODY_ACTION +
      STORAGE_PREFLIGHT.TECH_HEAD +
      failures.join('\n\n')
  )
  app.exit(1)
}

ensureStorageWritableOrExit()

/**
 * 主进程上下文：stores / 配置读写 / 设备身份 / 云上行束等跨功能服务，在这里一次造好。
 * 位置是硬约束 —— 必须在可写检查**之后**（构造期会读盘：账本、设备身份、token store），
 * 且在 whenReady **之前**（原先就是模块顶层急切构造，不许变懒）。
 * `study-math.js` 路径用本文件的 `__dirname` 算（三个 rollup 入口，功能文件可能落进别的
 * 输出目录的共享 chunk，在那里重算会指错）。
 */
const ctx: MainContext = createMainContext({
  storageDir: storageDir(),
  studyMathPath: join(__dirname, 'study-math.js'),
  rendererDir: join(__dirname, '../renderer')
})

/**
 * 构造主窗（**不显示、不加载**）：「构造 / 接线 / 加载 / 显示」是四件事，
 * 显示与加载的时机在 whenReady 里（加载完 ready-to-show 才 show）。
 */
function createWindow(): BrowserWindow {
  /*
   * 原生层底色（浅色，见 shared/theme.ts）。
   *
   * 窗口是 `show: false` + `ready-to-show` 才显形的，启动那一瞬间本来就看不见白屏。
   * 真正会露出来的是**拖窗口大小的时候**：新露出的那条区域在 Chromium 补上内容之前，
   * 由原生层直接刷这个底色 —— 不设就是默认白，和界面底色（#f9f9f7）差一档，拖快了会闪。
   */
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    backgroundColor: WINDOW_BG,
    autoHideMenuBar: true,
    title: APP_NAME,
    icon: join(app.getAppPath(), 'resources/icon.png'),
    /*
     * Window Controls Overlay（顶条玻璃化，2026-10-05 主人工单）：
     * 隐掉系统标题栏、整窗交给网页画 —— 系统只把三个窗口按钮（最小化 /
     * 最大化 / 关闭）以悬浮层画在右上角。**按钮本体仍是系统画的**：命中判定
     * 在原生层先于网页发生，网页任何东西都盖不住、也拦不了它 ——
     * 这正是「透明顶条绝不能拦按钮点击」这条底线的机械保障。
     * 顶条长什么样由渲染层的 TopBar.vue 决定（玻璃底 + 拖拽区）。
     * 按钮符号色取 shared/theme.ts 的浅色值。
     */
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000', // 透明：顶端那条底由网页画，系统别刷自己的色
      symbolColor: TITLE_SYMBOL_COLOR
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // 窗口被别的窗口（例如输入法浮动工具条）挡住时，Chromium 会把页面当成隐藏、停掉 requestAnimationFrame，
      // 路由转场卡在淡出那一帧，内容区一片空白（2026-11-24 用户实测点「六级真题」后空白）。不节流就不会卡。
      backgroundThrottling: false
    }
  })

  // 显示时机不在这里：whenReady 里的 wireMainReady 拿 ready-to-show 当「主窗已就绪」
  // 信号后才 show()，别在这里直接 show。

  // 外部链接一律交给系统浏览器，应用内不打开网页。
  // 【P10.1 起不再"盲丢"】旧实现不看 URL 就 shell.openExternal —— 那是
  // 「渲染层任何一段代码（含被注入的）都能让系统执行任意 scheme」的一条缝。
  // 白名单（http/https）在 window-guards.ts（纯函数，单测在那边）；非白名单照旧 deny。
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isExternalUrlAllowed(details.url)) shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 应用内导航守卫（P10.1）：同源内跳转与 hash 变化放行（dev server 重载、路由），
  // 其余一律挡下 —— 把"整个窗口被导航去别处"这条路关死（判据同样在 window-guards.ts）。
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (decideNavigation(url, mainWindow.webContents.getURL()) === 'block') {
      event.preventDefault()
    }
  })
  // Generated lessons run in opaque srcdoc frames; never let their scripts navigate out.
  mainWindow.webContents.on('will-frame-navigate', event => {
    if (!event.isMainFrame && !isHtmlPreviewUrl(event.url)) event.preventDefault()
  })
  // 本应用没有任何 webview，出现即挡 —— 不做例外（将来真要加，走一次显式评审）
  mainWindow.webContents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })

  return mainWindow
}

/**
 * 主窗就绪承诺 —— 什么时候可以 show() 主窗。
 *
 * 三个兑现口缺一不可：
 *   ① ready-to-show        —— 正常路径（渲染进程画完第一帧）
 *   ② did-fail-load 主框架 —— 加载失败（文件缺失/URL 错）：不能干等，
 *      否则主窗永远不显示，用户盯着空屏
 *   ③ render-process-gone  —— 渲染进程崩溃：同上，如实放行
 * ② ③ 放行后主窗是个坏窗口，但「显示一个坏窗口」比「什么都不显示」
 * 可排障（用户能截图、能看到菜单）——绝不静默悬挂。
 *
 * ⚠️ 必须在建窗后**立刻**挂（一次性事件，事后挂会等不到）；
 * resolve 幂等（多个口先后触发都无害）。
 */
function wireMainReady(win: BrowserWindow): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const settle = (): void => {
      if (done) return
      done = true
      resolve()
    }
    win.once('ready-to-show', settle)
    win.webContents.on('did-fail-load', (_e, _code, desc, _url, isMainFrame) => {
      if (isMainFrame) {
        console.error('[miai] main window load failed:', desc)
        settle()
      }
    })
    win.webContents.on('render-process-gone', (_e, details) => {
      console.error('[miai] main renderer gone:', details.reason)
      settle()
    })
  })
}

/** 加载主窗内容（dev 走 Vite URL，打包走 file:// 的 index.html） */
function loadMainWindow(win: BrowserWindow): void {
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// 单实例锁：重复启动时聚焦已有窗口，不重复开窗口
/*
 * Windows 任务栏分组/通知的 AppUserModelID 必须与 electron-builder 的
 * `appId` 一致（2026-10-17 分享版）：不设的话打包后进程仍自称
 * `com.electron.app`，任务栏会按「另一个 Electron 应用」分组，钉住的图标
 * 和通知都指不到我们自己的快捷方式。必须在 whenReady 之前设。
 */
if (process.platform === 'win32') app.setAppUserModelId('com.miai.biancheng')
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // 第二次启动：把已有窗口拿到前面（最小化则还原）。
    const target = BrowserWindow.getAllWindows()[0]
    if (target) {
      if (target.isMinimized()) target.restore()
      target.focus()
    }
  })

  app.whenReady().then(() => {
    // 协议 / handler / 启动期会话恢复，按 FEATURES 的顺序注册（顺序见 features/index.ts）。
    // 全部必须在建窗口**之前**：渲染进程出生后再装协议就晚了。
    for (const feature of FEATURES) feature.register(ctx)

    // 先构造主窗（隐藏），再接就绪承诺，最后才加载 —— ready-to-show 是一次性事件，
    // 必须在加载之前挂上。
    const mainWindow = createWindow()
    const mainReady = wireMainReady(mainWindow)

    void mainReady.then(() => {
      if (!mainWindow.isDestroyed()) mainWindow.show()
    })

    loadMainWindow(mainWindow)

    app.on('activate', () => {
      // macOS 惯例；Windows 上无影响。二次开窗同样「就绪即显示」。
      if (BrowserWindow.getAllWindows().length === 0) {
        const w = createWindow()
        void wireMainReady(w).then(() => {
          if (!w.isDestroyed()) w.show()
        })

        loadMainWindow(w)
      }
    })
  })

  // 退出前按 FEATURES 顺序收摊（研学连接池 → 编译/运行子进程 → 原生编译观察器）
  app.on('before-quit', () => {
    for (const feature of FEATURES) feature.dispose?.()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
