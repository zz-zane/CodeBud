// 六级真题（docs/27）：cet6.json 存储、miai-cet6:// 协议、IPC。
//   miai-cet6://data/<rel>  → <app>/content/cet6/<rel>（随应用打包的试卷与附图）
//   miai-cet6://media/<rel> → 用户设置的音频目录，支持 Range（拖动进度条）
import { app, BrowserWindow, dialog, protocol } from 'electron'
import type { IpcMainInvokeEvent, OpenDialogOptions } from 'electron'
import { copyFileSync, createReadStream, existsSync, statSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { CET6_MAIN } from '../shared/copy'
import {
  CET6_EXAM_ID,
  asMode,
  sanitizeRecord,
  type Cet6Mode,
  type Cet6File,
  type Cet6MediaStatus,
  type Cet6Record,
  type Cet6State
} from '../shared/cet6'
import { createJsonStore, type JsonStore } from './store/json-store'
import { corsHeaders, mimeFor, parseRange, pathFence, resolveUnder } from './file-protocol'


type ResponseBody = ConstructorParameters<typeof Response>[0]

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

export interface Cet6Service {
  load(): Cet6File
  mediaStatus(): Cet6MediaStatus
  state(): Cet6State
  saveRecord(examId: unknown, record: unknown): void
  resetRecord(examId: unknown): void
  setMediaRoot(root: string): Cet6MediaStatus
  setLastMode(mode: unknown): Cet6Mode
  mediaRoot(): string | null
}

export function createCet6Service(dir: string): Cet6Service {
  const store: JsonStore<Cet6File> = createJsonStore<Cet6File>(dir, 'cet6.json')
  const file = join(dir, 'cet6.json')
  let backedUp = false

  function load(): Cet6File {
    const raw = store.read()
    if (raw === null) {
      if (existsSync(file) && !backedUp) {
        // 文件在但读不出：留日志并把坏文件另存一份，绝不静默用空档覆盖
        backedUp = true
        console.error('[miai] cet6| cet6.json unreadable, keeping a copy as cet6.json.corrupt')
        try {
          copyFileSync(file, file + '.corrupt')
        } catch (err) {
          console.error('[miai] cet6| backup of corrupt cet6.json failed', err)
        }
      }
      return { version: 1, mediaRoot: null, lastMode: 'practice', records: {} }
    }
    const records: Record<string, Cet6Record> = {}
    for (const [id, rec] of Object.entries(raw.records ?? {})) {
      const clean = CET6_EXAM_ID.test(id) ? sanitizeRecord(rec) : null
      if (clean) records[id] = clean
      else console.warn(`[miai] cet6| dropped invalid record ${id}`)
    }
    return { version: 1, mediaRoot: typeof raw.mediaRoot === 'string' ? raw.mediaRoot : null, lastMode: asMode(raw.lastMode), records }
  }

  function mediaRoot(): string | null {
    return load().mediaRoot
  }

  function mediaStatus(): Cet6MediaStatus {
    const root = mediaRoot()
    return { root, ok: root !== null && isDir(root) }
  }

  function assertId(examId: unknown): string {
    if (typeof examId !== 'string' || !CET6_EXAM_ID.test(examId)) throw new Error('cet6: invalid exam id')
    return examId
  }

  return {
    load,
    mediaStatus,
    mediaRoot,
    state: () => {
      const cur = load()
      return { records: cur.records, media: mediaStatus(), lastMode: cur.lastMode }
    },
    saveRecord(examId, record) {
      const id = assertId(examId)
      const clean = sanitizeRecord(record)
      if (!clean) throw new Error('cet6: invalid record')
      const cur = load()
      store.write({ ...cur, records: { ...cur.records, [id]: clean } })
    },
    resetRecord(examId) {
      const id = assertId(examId)
      const cur = load()
      const { [id]: _drop, ...rest } = cur.records
      void _drop
      store.write({ ...cur, records: rest })
    },
    setLastMode(mode) {
      if (mode !== 'practice' && mode !== 'exam') throw new Error('cet6: invalid mode')
      store.write({ ...load(), lastMode: mode })
      return mode
    },
    setMediaRoot(root) {
      const cur = load()
      store.write({ ...cur, mediaRoot: root })
      return mediaStatus()
    }
  }
}

export interface Cet6AssetRequest {
  kind: 'data' | 'media'
  /** 以 / 开头的相对路径（如 /exams/x.json），尚未解码 */
  pathname: string
  method: string
  range: string | null
}

/**
 * 试卷数据 / 听力音频 → Response。与传输无关：`miai-cet6://` 协议与手机连接的
 * `/cet6/*` HTTP 路由各包一层，路径围栏与 Range 只此一份实现。
 * `extra`：传输层自己要加的头（协议加 CORS 头；HTTP 不开 CORS，只带 Accept-Ranges）。
 */
export async function cet6AssetResponse(
  req: Cet6AssetRequest,
  roots: { dataRoot: string; mediaRoot: string | null },
  extra: Record<string, string>
): Promise<Response> {
  const deny = (status: number, why: string): Response =>
    new Response(why, { status, headers: { ...extra, 'Content-Type': 'text/plain' } })
  const method = req.method || 'GET'
  if (method !== 'GET' && method !== 'HEAD') return deny(405, 'method not allowed')

  const fence = pathFence(req.pathname)
  if (!fence.ok) return deny(403, fence.why)
  const root = req.kind === 'data' ? roots.dataRoot : roots.mediaRoot
  if (!root) return deny(404, 'no media root')
  const full = resolveUnder(root, fence.segs)
  if (!full) return deny(403, 'outside-root')

  let st
  try {
    st = await stat(full)
  } catch {
    return deny(404, 'not found')
  }
  if (!st.isFile()) return deny(404, 'not a file')

  const size = st.size
  const base = { ...extra, 'Content-Type': mimeFor(full), 'Cache-Control': 'no-store' }
  const range = parseRange(req.range, size)
  if (range === 'invalid') {
    return new Response(null, { status: 416, headers: { ...base, 'Content-Range': `bytes */${size}` } })
  }
  if (range) {
    const len = range.end - range.start + 1
    const headers = { ...base, 'Content-Range': `bytes ${range.start}-${range.end}/${size}`, 'Content-Length': String(len) }
    if (method === 'HEAD') return new Response(null, { status: 206, headers })
    const body = Readable.toWeb(createReadStream(full, { start: range.start, end: range.end }))
    return new Response(body as unknown as ResponseBody, { status: 206, headers })
  }
  const headers = { ...base, 'Content-Length': String(size) }
  if (method === 'HEAD') return new Response(null, { status: 200, headers })
  return new Response(Readable.toWeb(createReadStream(full)) as unknown as ResponseBody, { status: 200, headers })
}

/** 内置试卷目录（随应用打包）；依赖 app.getAppPath()，所以是函数不是常量 */
export function cet6DataRoot(): string {
  return join(app.getAppPath(), 'content', 'cet6')
}

/** 必须在 app ready 之后、窗口出生之前调用（scheme 特权已在 registerSchemePrivileges 里注册） */
export function installCet6Protocol(mediaRootOf: () => string | null): void {
  protocol.handle('miai-cet6', async (request) => {
    const cors = corsHeaders()
    const deny = (status: number, why: string): Response =>
      new Response(why, { status, headers: { ...cors, 'Content-Type': 'text/plain' } })
    let u: URL
    try {
      u = new URL(request.url)
    } catch {
      return deny(400, 'bad url')
    }
    const method = request.method || 'GET'
    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (u.host !== 'data' && u.host !== 'media') return deny(404, 'unknown host')
    return cet6AssetResponse(
      { kind: u.host, pathname: u.pathname, method, range: request.headers.get('range') },
      { dataRoot: cet6DataRoot(), mediaRoot: mediaRootOf() },
      cors
    )
  })
}

/** 弹目录选择框；取消 = 保持原状。IPC 注册在 features/cet6.ts（ipc-contract 测试对账） */
export async function pickCet6MediaRoot(event: IpcMainInvokeEvent, svc: Cet6Service): Promise<Cet6MediaStatus> {
  const win = BrowserWindow.fromWebContents(event.sender)
  const options: OpenDialogOptions = { title: CET6_MAIN.PICK_MEDIA_TITLE, properties: ['openDirectory'] }
  const { canceled, filePaths } = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  const picked = filePaths[0]
  return canceled || !picked ? svc.mediaStatus() : svc.setMediaRoot(picked)
}
