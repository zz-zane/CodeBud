/**
 * 把 record-tour.cjs 抓的帧合成演示视频：烧字幕 + 每帧停留。
 *
 * 字幕用 Windows 自带微软雅黑（msyh.ttc），不依赖额外字体。
 * 每帧按 manifest 的 holdMs 停留，帧间无转场（教学视频不需要花活）。
 */
const { execFileSync } = require('node:child_process')
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('node:fs')
const { join, resolve } = require('node:path')

const root = resolve(__dirname, '../../outputs/feature-tour-20261031')
const manifestPath = join(root, 'manifest.json')
if (!existsSync(manifestPath)) {
  console.error('没有 manifest.json，先跑 scripts/record-tour.cjs')
  process.exit(1)
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
if (manifest.errors?.length) {
  console.warn(`⚠ manifest 里有 ${manifest.errors.length} 条错误，视频仍会生成，但请看 report.txt`)
}
if (!manifest.frames.length) {
  console.error('没有帧可合成')
  process.exit(1)
}

const FFMPEG = 'ffmpeg'
const FONT = 'C\\:/Windows/Fonts/msyh.ttc'

// ffmpeg drawtext 的转义：反斜杠、冒号、单引号、百分号都要处理
function esc(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
    .replace(/\n/g, ' ')
}

/** 长字幕自动折行（中文按字宽，一行约 46 个全角字符） */
function wrap(text, perLine = 46) {
  const chars = [...text]
  const lines = []
  for (let i = 0; i < chars.length; i += perLine) lines.push(chars.slice(i, i + perLine).join(''))
  return lines
}

// 有 timeline.json（配音版）时按配音时长走，否则退回 manifest 的 holdMs
const timelinePath = join(root, 'timeline.json')
const timeline = existsSync(timelinePath) ? JSON.parse(readFileSync(timelinePath, 'utf8')) : null
if (timeline) console.log(`检测到 timeline.json：这次出配音版（${timeline.length} 段）`)

const segments = []
const concatLines = []
let idx = 0

for (const frame of manifest.frames) {
  const clip = join(root, `clip-${String(idx).padStart(3, '0')}.mp4`)
  const secs = timeline
    ? timeline[idx].dur
    : Math.max(0.8, (frame.holdMs || 1500) / 1000)

  const lines = wrap(frame.caption)
  // 字幕块：底部半透明黑条 + 白字
  const lineHeight = 46
  const barHeight = lines.length * lineHeight + 34
  const filters = [
    // capturePage 出的图高 1353（奇数）；H.264 yuv420p 只吃偶数尺寸，先规整
    `scale=2160:1352:flags=lanczos`,
    // 固定像素坐标：drawbox 的 h- 表达式在 scale 之后会被算成画布高度，底条会飘到错误位置
    `drawbox=x=0:y=${1352 - barHeight}:w=2160:h=${barHeight}:color=black@0.75:t=fill`
  ]
  lines.forEach((line, i) => {
    const y = `${1352 - barHeight + 24 + i * lineHeight}`
    filters.push(
      `drawtext=fontfile='${FONT}':text='${esc(line)}':fontcolor=white:fontsize=34:line_spacing=12:x=(w-text_w)/2:y=${y}`
    )
  })
  filters.push(`format=yuv420p`)

  execFileSync(FFMPEG, [
    '-y', '-loop', '1', '-i', join(root, 'frames', frame.file),
    '-vf', filters.join(','),
    '-t', String(secs), '-r', '30',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    clip
  ], { stdio: 'inherit' })

  segments.push(clip)
  concatLines.push(`file '${clip.replace(/\\/g, '/')}'`)
  idx++
}

const listFile = join(root, 'concat.txt')
writeFileSync(listFile, concatLines.join('\n'), 'utf8')

const finalOut = timeline
  ? join(root, '咪爱编程-新增功能演示-配音版.mp4')
  : join(root, '咪爱编程-新增功能演示.mp4')

if (timeline) {
  const voiceTrack = join(root, 'voice-track.mp3')
  if (!existsSync(voiceTrack)) {
    console.error('缺 voice-track.mp3，先跑 scripts/make-tour-voice.cjs')
    process.exit(1)
  }
  // 音轨比画面短时补静音，长时裁到画面长度，确保音画同步不漂
  const totalSecs = timeline.reduce((a, s) => a + s.dur, 0)
  execFileSync(FFMPEG, [
    '-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-i', voiceTrack,
    '-t', String(totalSecs),
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
    '-map', '0:v:0', '-map', '1:a:0',
    '-movflags', '+faststart',
    finalOut
  ], { stdio: 'inherit' })
} else {
  execFileSync(FFMPEG, [
    '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-c', 'copy', '-movflags', '+faststart',
    finalOut
  ], { stdio: 'inherit' })
}

writeFileSync(join(root, 'report.txt'),
  `帧数：${manifest.frames.length}\n错误：${(manifest.errors || []).join('\n') || '无'}\n视频：${finalOut}\n`, 'utf8')

console.log(`\n✅ 视频已生成：${finalOut}`)
