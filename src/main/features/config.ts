import { handle } from '../ipc'
import { IPC } from '../../shared/ipc-channels'
import { mergeConfigPayload } from '../store/config-merge'
import { detectAll } from '../env/detect'
import type { ConfigSavePayload, PublicAppConfig } from '../../shared/types'
import type { MainFeature } from '../context'
import { assertSupportedVersion } from '../../shared/data-version'
import { CURRENT_CONFIG_VERSION } from '../../shared/types'

export const configFeature: MainFeature = {
  name: 'config',
  register(ctx) {
    const { configStore, secretStore, readConfig, readPublicConfig, broadcastPublicConfig } = ctx

    // ---- 设置（M5-01 / M6）
    //
    // ⚠️ 出口**必须**过 toPublicConfig：它会把 ai.apiKey 抹成一个 hasKey 布尔。
    // 这里是 Key 唯一的漏点 —— 直接 `return configStore.read()` 就等于把明文
    // 送进渲染进程，一次 XSS 就没了。合并与裁剪的规矩详见 store/config-merge.ts。
    handle(IPC.configGet, (): PublicAppConfig => readPublicConfig())

    handle(IPC.configSave, (_e, cfg: ConfigSavePayload) => {
      assertSupportedVersion(configStore.read(), CURRENT_CONFIG_VERSION)
      // 入参非法就抛，**一个字节都不写**。读了现有配置再合并，
      // 是因为 apiKey 是三态：空串/不传 = 保持原样（渲染进程根本不知道真 Key）。
      const current = readConfig(false)
      const saved = mergeConfigPayload(current, cfg)
      let persistedLegacyKey = current.ai.apiKey
      if (cfg.ai?.apiKey === null) {
        secretStore.clearApiKey()
        saved.ai.apiKey = ''
        persistedLegacyKey = ''
      } else if (cfg.ai?.apiKey && cfg.ai.apiKey.trim()) {
        secretStore.setApiKey(cfg.ai.apiKey)
        saved.ai.apiKey = secretStore.getApiKey()
        persistedLegacyKey = ''
      }
      configStore.write({ ...saved, ai: { ...saved.ai, apiKey: persistedLegacyKey } })
      broadcastPublicConfig()
    })

    // ---- 环境检测（M5-01）：结果写穿缓存进 config.envCache
    handle(IPC.envDetect, async () => {
      const report = await detectAll()
      const cfg = readConfig(false)
      cfg.envCache = { report, at: new Date().toISOString() }
      configStore.write(cfg)
      broadcastPublicConfig()
      return report
    })
  }
}
