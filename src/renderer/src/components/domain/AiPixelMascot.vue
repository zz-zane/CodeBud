<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const isEntering = ref(true)
const phase = ref<'idle' | 'taking-out' | 'opening' | 'typing' | 'closing' | 'stowing'>('idle')
const isTyping = computed(() => phase.value === 'typing')

let enterTimer: ReturnType<typeof setTimeout> | null = null
let phaseTimer: ReturnType<typeof setTimeout> | null = null
let typingTimer: ReturnType<typeof setTimeout> | null = null
let lastInputAt = -Infinity
let pendingInput = false

const motionPreference =
  typeof window === 'undefined' ? null : window.matchMedia('(prefers-reduced-motion: reduce)')

function isReducedMotion(): boolean {
  return motionPreference?.matches === true
}

function takeOut(): void {
  pendingInput = false
  phase.value = 'taking-out'
  phaseTimer = setTimeout(() => {
    phase.value = 'opening'
    phaseTimer = setTimeout(() => {
      phaseTimer = null
      phase.value = 'typing'
      scheduleIdle()
    }, 180)
  }, 220)
}

function closeLaptop(): void {
  typingTimer = null
  phase.value = 'closing'
  phaseTimer = setTimeout(() => {
    phase.value = 'stowing'
    phaseTimer = setTimeout(() => {
      phaseTimer = null
      phase.value = 'idle'
      if (pendingInput && Date.now() - lastInputAt < 750) takeOut()
      else pendingInput = false
    }, 220)
  }, 160)
}

function scheduleIdle(): void {
  if (typingTimer) clearTimeout(typingTimer)
  // 单次按键也走完整动作，开盖后至少留下一个完整敲击周期。
  typingTimer = setTimeout(closeLaptop, Math.max(420, 750 - (Date.now() - lastInputAt)))
}

function onTyping(): void {
  if (isReducedMotion()) return
  if (typeof document !== 'undefined' && document.hidden) return

  lastInputAt = Date.now()
  if (isEntering.value || phase.value === 'closing' || phase.value === 'stowing') {
    pendingInput = true
  } else if (phase.value === 'idle') {
    takeOut()
  } else if (phase.value === 'typing') {
    scheduleIdle()
  }
}

function stop(): void {
  if (typingTimer) {
    clearTimeout(typingTimer)
    typingTimer = null
  }
  if (enterTimer) {
    clearTimeout(enterTimer)
    enterTimer = null
  }
  if (phaseTimer) {
    clearTimeout(phaseTimer)
    phaseTimer = null
  }
  pendingInput = false
  lastInputAt = -Infinity
  phase.value = 'idle'
  isEntering.value = false
}

function onMotionPreference(): void {
  if (motionPreference?.matches) stop()
}

function onVisibility(): void {
  if (typeof document !== 'undefined' && document.hidden) stop()
}

onMounted(() => {
  motionPreference?.addEventListener('change', onMotionPreference)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility)
  }

  if (isReducedMotion() || (typeof document !== 'undefined' && document.hidden)) {
    isEntering.value = false
  } else {
    enterTimer = setTimeout(() => {
      isEntering.value = false
      enterTimer = null
      if (pendingInput) takeOut()
    }, 1820)
  }
})

onBeforeUnmount(() => {
  motionPreference?.removeEventListener('change', onMotionPreference)
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibility)
  }
  stop()
})

defineExpose({
  onTyping,
  stop,
  isEntering,
  isTyping
})
</script>

<template>
  <div
    class="ai-pixel-mascot"
    :class="['phase-' + phase, {
      'is-entering': isEntering,
      'is-typing': isTyping
    }]"
    :data-motion-phase="phase"
    aria-hidden="true"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 25 14"
      width="80"
      height="45"
      shape-rendering="crispEdges"
    >
      <!-- 黄绿主体（x 偏移 8 单位，完全保留原始 pixel-mascot 矢量坐标） -->
      <g class="layer-body" transform="translate(8, 0)">
        <g class="body-pose">
        <path
          fill="#85b28a"
          d="M9 0h1v2h1v1h2V2h1v2h-1v1h-1v2h1v1h2v1h-3v1h-1v3h-1v-2H9v2H6v-2H5v2H2v-3H1V9H0V5h1V4h1V3h6V1h1Z"
        />
        <path
          fill="#fff8b1"
          d="M9 2h1v2h2v1h-1v1h-1v1h1v1h1v1h-2v1H8v2H7v-2H4v2H3v-2H2V9H1V5h1V4h7Z"
        />

        <!-- 待机正常眼睛 -->
        <g class="layer-eyes-normal" fill="#85b28a">
          <rect x="3" y="5" width="1" height="3" />
          <rect x="7" y="5" width="1" height="3" />
        </g>

        <g class="layer-eyes-entry-blink" fill="#85b28a">
          <rect x="3" y="6" width="2" height="1" />
          <rect x="7" y="6" width="2" height="1" />
        </g>

        <!-- 敲击专注眼睛（下移一格看向电脑） -->
        <g class="layer-eyes-typing" fill="#85b28a">
          <rect x="2" y="6" width="1" height="2" />
          <rect x="6" y="6" width="1" height="2" />
        </g>
        </g>
      </g>

      <!-- 道具在主体前方取出，键盘右缘与身体相接，待机时收回。 -->
      <g class="laptop-prop">
        <g class="layer-laptop-closed">
          <rect x="3" y="12" width="6" height="1" fill="#8e9698" />
          <rect x="3" y="11" width="6" height="1" fill="#b8bdbd" />
        </g>
        <g class="layer-laptop-half">
          <path d="M1 10h2v1h2v1h4v1H4v-1H2v-1H1Z" fill="#8e9698" />
          <rect x="5" y="11" width="4" height="1" fill="#b8bdbd" />
        </g>
        <g class="layer-laptop-open">
          <path d="M1 8h1v1h1v1h1v1h1v1h4v1H4v-1H3v-1H2v-1H1Z" fill="#8e9698" />
          <path d="M1 8h1v1h1v1H2V9H1Z" fill="#b8bdbd" />
          <rect x="5" y="11" width="4" height="1" fill="#a7afb0" />
        </g>
      </g>
      <g class="layer-hands-reach" fill="#85b28a">
        <rect x="8" y="9" width="3" height="1" />
        <rect x="7" y="10" width="2" height="1" />
      </g>
      <g class="layer-hands-tap-a" fill="#85b28a">
        <rect x="6" y="11" width="3" height="1" />
        <rect x="8" y="10" width="2" height="1" />
      </g>
      <g class="layer-hands-tap-b" fill="#85b28a">
        <rect x="6" y="10" width="3" height="1" />
        <rect x="8" y="11" width="2" height="1" />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.ai-pixel-mascot {
  position: absolute;
  right: 20px;
  top: -42px;
  width: 87px;
  height: 45px;
  pointer-events: none;
  user-select: none;
}

.ai-pixel-mascot svg {
  width: 80px;
  height: 45px;
  display: block;
  shape-rendering: crispEdges;
  image-rendering: pixelated;
  overflow: visible;
}

.ai-pixel-mascot.is-entering {
  /* 只在进场时遮住卡片边缘以下的角色，跳起时头顶保留空间。 */
  clip-path: inset(-12px -4px 3px -4px);
}
.ai-pixel-mascot.is-entering svg {
  transform-origin: 62% 93%;
  animation: animMascotEnter 1800ms both;
}

@keyframes animMascotEnter {
  0% {
    transform: translateY(44px);
    animation-timing-function: cubic-bezier(0.16, 0.7, 0.3, 1);
  }
  20% {
    transform: translateY(-8px);
    animation-timing-function: cubic-bezier(0.6, 0, 1, 0.8);
  }
  34% {
    transform: translateY(0);
    animation-timing-function: ease-out;
  }
  40% {
    transform: translateY(-2px);
  }
  46% {
    transform: translateY(0) translateX(-2px) rotate(-7deg);
    animation-timing-function: ease-in-out;
  }
  56% {
    transform: translateY(0) translateX(2px) rotate(7deg);
  }
  66% {
    transform: translateY(0) translateX(-1px) rotate(-4deg);
  }
  76% {
    transform: translateY(0) translateX(1px) rotate(3deg);
  }
  88% {
    transform: translateY(0) rotate(-1deg);
  }
  100% {
    transform: translateY(0);
  }
}

.layer-eyes-normal {
  visibility: visible;
}
.layer-eyes-typing,
.layer-eyes-entry-blink,
.layer-laptop-closed,
.layer-laptop-half,
.layer-laptop-open,
.layer-hands-reach,
.layer-hands-tap-a,
.layer-hands-tap-b {
  visibility: hidden;
}

.is-entering .layer-eyes-normal { animation: animEntryEyesOpen 1800ms steps(1) both; }
.is-entering .layer-eyes-entry-blink { animation: animEntryEyesBlink 1800ms steps(1) both; }
@keyframes animEntryEyesOpen {
  0%, 49%, 75%, 100% { visibility: visible; }
  43%, 69% { visibility: hidden; }
}
@keyframes animEntryEyesBlink {
  0%, 49%, 75%, 100% { visibility: hidden; }
  43%, 69% { visibility: visible; }
}

.phase-opening .layer-eyes-normal,
.is-typing .layer-eyes-normal,
.phase-closing .layer-eyes-normal {
  visibility: hidden;
}
.phase-opening .layer-eyes-typing,
.is-typing .layer-eyes-typing,
.phase-closing .layer-eyes-typing {
  visibility: visible;
}

.body-pose {
  transform-box: fill-box;
  transform-origin: 45% 100%;
}
.phase-opening .body-pose,
.is-typing .body-pose,
.phase-closing .body-pose {
  transform: rotate(-5deg);
}
.phase-taking-out .layer-laptop-closed,
.phase-stowing .layer-laptop-closed,
.phase-opening .layer-laptop-half,
.phase-closing .layer-laptop-half,
.is-typing .layer-laptop-open,
.phase-taking-out .layer-hands-reach,
.phase-opening .layer-hands-reach,
.phase-closing .layer-hands-reach,
.phase-stowing .layer-hands-reach {
  visibility: visible;
}

.phase-taking-out .laptop-prop { animation: animTakeOut 220ms steps(3) both; }
.phase-stowing .laptop-prop { animation: animStow 220ms steps(3) both; }
@keyframes animTakeOut {
  from { transform: translate(6px, -3px); }
  to { transform: translate(0, 0); }
}
@keyframes animStow {
  from { transform: translate(0, 0); }
  to { transform: translate(6px, -3px); }
}

.ai-pixel-mascot.is-typing .layer-hands-tap-a {
  animation: animHandsTapA 360ms steps(1) infinite;
}
.ai-pixel-mascot.is-typing .layer-hands-tap-b {
  animation: animHandsTapB 360ms steps(1) infinite;
}

@keyframes animHandsTapA {
  0%, 100% {
    visibility: visible;
  }
  50% {
    visibility: hidden;
  }
}

@keyframes animHandsTapB {
  0%, 100% {
    visibility: hidden;
  }
  50% {
    visibility: visible;
  }
}

/* 尊重 prefers-reduced-motion：静态显示，不跳不敲 */
@media (prefers-reduced-motion: reduce) {
  .ai-pixel-mascot,
  .ai-pixel-mascot.is-entering,
  .ai-pixel-mascot.is-typing,
  .ai-pixel-mascot * {
    animation: none !important;
  }
  .ai-pixel-mascot {
    transform: none !important;
  }
  .body-pose { transform: none !important; }
  .layer-eyes-normal {
    visibility: visible !important;
  }
  .layer-eyes-typing,
  .layer-eyes-entry-blink,
  .layer-laptop-closed,
  .layer-laptop-half,
  .layer-laptop-open,
  .layer-hands-reach,
  .layer-hands-tap-a,
  .layer-hands-tap-b {
    visibility: hidden !important;
  }
  .ai-pixel-mascot.is-entering { clip-path: none; }
}
</style>
