import { session } from 'electron'
import { blockStudyFrameRequest, htmlPreviewById, installHtmlPreviewProtocol } from '../study/html-preview'
import type { MainFeature } from '../context'

/**
 * miai-study:// 预览协议。必须在 cet6 协议之前装（原 whenReady 的第一件事）、
 * 建窗口之前（渲染进程出生后再装就晚了）；scheme 特权声明在 app.ts，全进程只能调一次。
 */
export const htmlPreviewFeature: MainFeature = {
  name: 'html-preview',
  register(ctx) {
    installHtmlPreviewProtocol()
    // 手机连接：`/study/preview/<id>`；沙箱隔离靠响应头里的 CSP sandbox（见 htmlPreviewById）
    ctx.httpAssets.set('/study/preview/', (req) => htmlPreviewById(req.pathname.slice(1), req.method))
  }
}

/** 生成课程的 iframe 请求拦截；原来夹在 cet6 与 profile 之间，顺序保持 */
export const htmlPreviewFrameGuardFeature: MainFeature = {
  name: 'html-preview-frame-guard',
  register() {
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: blockStudyFrameRequest(details.url, details.resourceType, details.frame?.url) })
    })
  }
}
