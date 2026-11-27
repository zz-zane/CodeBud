/**
 * 资源地址前缀（docs/29 §3.3）：桌面走自定义协议，手机浏览器走同源 HTTP 路径。
 * 渲染层只在这里决定「我现在在哪」，生成真题试卷 / 音频 / 研学预览地址的地方一律经它取前缀。
 * `window.miai` 缺失（单测里）按桌面处理。
 */
export function isRemote(): boolean {
  return typeof window !== 'undefined' && window.miai?.isRemote === true
}

export function assetBase(): { cet6: string; cet4: string; study: string } {
  return isRemote()
    ? { cet6: '/cet6/', cet4: '/cet4/', study: '/study/preview/' }
    : { cet6: 'miai-cet6://', cet4: 'miai-cet4://', study: 'miai-study://preview/' }
}

/** 主进程返回的 `miai-study://preview/<id>` → 当前环境能加载的地址 */
export function studyPreviewUrl(url: string): string {
  const id = url.slice(url.lastIndexOf('/') + 1)
  return assetBase().study + id
}
