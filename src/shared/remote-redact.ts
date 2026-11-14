/**
 * 手机端看不到电脑的本机路径（docs/29 §3.5）。远程服务在把通道返回值 / 推送交给手机之前过一遍这里；
 * 桌面窗口不经过它，所以桌面行为不变。纯函数，不改入参。
 */
import { IPC } from './ipc-channels'

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

function redactConfig(cfg: unknown): unknown {
  if (!isObj(cfg)) return cfg
  const out: Obj = { ...cfg, nativeIdePaths: { c: '', cpp: '', java: '', python: '' } }
  const cache = cfg.envCache
  if (isObj(cache) && isObj(cache.report)) {
    const report: Obj = {}
    for (const [lang, env] of Object.entries(cache.report)) {
      if (isObj(env)) {
        const { path: _path, ...rest } = env
        report[lang] = rest
      } else report[lang] = env
    }
    out.envCache = { ...cache, report }
  }
  return out
}

/** 按通道抹掉本机路径：六级音频目录、IDE / 编译器路径、研学外部连接的启动命令 */
export function redactForRemote(channel: string, data: unknown): unknown {
  if (channel === IPC.cet6GetState && isObj(data) && isObj(data.media)) return { ...data, media: { ...data.media, root: null } }
  if ((channel === IPC.configGet || channel === IPC.configExternal)) return redactConfig(data)
  if (channel === IPC.studyGetState && isObj(data) && Array.isArray(data.connections)) {
    return { ...data, connections: data.connections.map((c) => (isObj(c) ? { ...c, command: '', args: [] } : c)) }
  }
  return data
}
