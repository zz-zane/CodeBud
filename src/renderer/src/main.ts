import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import { createVAutoAnimate } from '@formkit/auto-animate/vue'
import App from './App.vue'
import router from './router'
import { useSettingsStore } from './stores/settings'
import { useUpdateStore } from './stores/update'
import { useZoomStore } from './stores/zoom'
import { installSettingsDialogGuard } from './lib/settings-dialog-route'
import { startDayClock } from './lib/day-clock'
import { installRemoteMiai } from './remote/install'
import { durationMs } from './lib/motion-duration'
import './styles/tokens.css'
import './styles/motion.css'
import './styles/range-overlay.css'
import './styles/zoom.css'
import './styles/vendor/open-claude-ui/cds-pure.css'
import './styles/cds-adapter.css'
import './styles/page.css'
import './styles/phone.css'

function motionTokenMs(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name)
  return durationMs(raw, fallback)
}

// 手机浏览器没有 preload：先装上 HTTP 版 window.miai（docs/29），之后的启动流程与桌面一致
if (!window.miai) await installRemoteMiai()

const pinia = createPinia()
const app = createApp(App).use(pinia)

app.directive(
  'auto-animate',
  createVAutoAnimate({
    duration: motionTokenMs('--mi-dur', 180),
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
  })
)

const settings = useSettingsStore(pinia)
try {
  await settings.load()
} catch {
  // 读取配置失败就用默认值继续
}

window.miai.onConfigExternal((cfg) => settings.applyExternalConfig(cfg))
void useUpdateStore(pinia).init()

const zoom = useZoomStore(pinia)
watch(
  () => zoom.scale,
  (scale) => document.documentElement.style.setProperty('--mi-zoom', String(scale)),
  { immediate: true }
)

// `/settings`（侧栏、RunnerPanel、旧 /login 重定向）都翻译成「开面板」，
// 背景留在原路由上 —— 见 lib/settings-dialog-route.ts 的理据。
installSettingsDialogGuard(router, pinia)
app.use(router)
startDayClock()

app.mount('#app')
