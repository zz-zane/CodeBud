/**
 * 给演示视频配音：每帧一段旁白 → SAPI 合成 → 按帧时长对齐 → 混流。
 *
 * 【为什么用 SAPI 不用神经语音】这台机器只装了 Microsoft Huihui（zh-CN），
 * pip 也拉不到 edge-tts。Huihui 是离线引擎，Rate=3 后语速可接受。
 *
 * 【对齐策略】每帧 audio = 该帧旁白；视频段时长取 max(原时长, 旁白时长+0.6s)，
 * 保证话不会被下一帧截断。旁白比原时长长时，视频会相应拉长。
 */
const { execFileSync } = require('node:child_process')
const { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } = require('node:fs')
const { join, resolve } = require('node:path')

const root = resolve(__dirname, '../../outputs/feature-tour-20261031')
const audioDir = join(root, 'voice')
mkdirSync(audioDir, { recursive: true })

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'))
const FFMPEG = 'ffmpeg'
const FFPROBE = 'ffprobe'

/**
 * 旁白文案（下标对应 manifest.frames 的序号）。
 * 比字幕多说一层「为什么值得」和「操作结果」，字幕保持短句不抢画面。
 */
const NARRATION = {
  0: '咪爱编程这次新增八项能力，全部是真实点击、真实 AI 请求。下面逐项演示，每项都从操作到结果走一遍。',
  1: '第一项，算法图解。抽象的东西靠脑补最难，这项让 AI 把过程画出来。',
  2: '先问一句：用步进方式演示二分查找在二、五、八、十二、十六里找十二，再配一张流程图。',
  3: 'AI 返回分步沙盒。每一步都显示数组当前状态、哪些元素被高亮、指针停在哪个下标。',
  4: '点下一步，指针真的往前挪。上一步和这一步的差别一眼就能看出来，不用自己在脑子里模拟。',
  5: '同一条回复里还有一张结构流程图，由本地 TypeScript 直接编译成矢量图，不依赖任何在线服务，断网也能看。',
  6: '第二项，错因诊断。答错的时候最怕直接看答案，因为下次还会错。这项先判定错在哪一类。',
  7: '贴一段有问题的代码：找数组最大值，循环条件写成了小于等于 n。',
  8: 'AI 判定这是元认知层面的审题疏漏，同时指出两个隐患：循环越界，以及初始值假设了数组一定有非负数。给出出错位置、根因分析、修复指引，最后还留一道自检追问。',
  9: '第三项，费曼检验。能不能用自己的话讲明白，才是真懂。',
  10: '先问：快速排序为什么最坏情况是 n 的平方。',
  11: 'AI 不直接讲答案，先请你用自己的话复述。',
  12: '你回答：每次都挑到最大的当基准，每次只能排出零个和 n 减一个，递归退化成一条链。',
  13: 'AI 按通俗度、逻辑完整性、是否存在偏差三项打分，并指出还缺的补强点。',
  14: '第四项，分步求解。一道题拆成几关，不让你一眼看完整答案。',
  15: '问：写一个函数判断字符串是不是回文。',
  16: '这个问题信息不足。AI 不瞎猜，先弹出反问卡片，列出几种可能的边界要求让你点选。',
  17: '点选之后，问题被澄清，AI 才继续往下拆步骤。',
  18: '第五项，三层记忆画像。开新对话时 AI 总像第一次见你，这项就是解决这个的。',
  19: '点注入记忆画像，把当前课时、你的薄弱点、还有全局学习画像一起塞进系统提示。之后 AI 回答会带着你的水平来。',
  20: '第六项，AI 变式出题。静态题库做过两遍就记住答案了，这项按同考点换一道新题。',
  21: '入口在错题本的延展练习。静态题池凑不满时，会向 AI 要差额题目补进同一张卷。当前题库没有错题，所以这里只展示入口。',
  22: '第七项，课前小测。进课时先探一次盲区，再往下学。',
  23: '选中一个选项，确认按钮才亮起。',
  24: '提交后立刻判对错，并给一句解析。它不占错题本、也不动学习进度，纯粹是自测。',
  25: '同一课里还有翻转闪卡。',
  26: '点一下翻面看答案，纯 CSS 翻转，键盘空格或回车也能操作。',
  27: '第八项，随堂批注。看课时想到什么，直接写在原文旁边。',
  28: '选中正文任意一段，浮出批注按钮。弹窗上方是原文引用，下方写自己的话。',
  29: '输入批注。上限两千字，超了会拦下并提示，不会静默丢掉。',
  30: '保存成功。这条批注落进的是既有的备忘录，不是另开一处存储。',
  31: '到备忘录确认，刚写的内容在编辑器里，能搜、能改、能分类。',
  32: '第九项，Markdown 导出。一键把备忘和错题本导成点 md 文件，丢进 Obsidian 就能当笔记用。文件名会做安全校验，不覆盖已有文件。',
  33: '八项演示完毕。以上每一步都是真实点击、真实 AI 请求，没有任何摆拍。'
}

function psQuote(text) {
  return text.replace(/'/g, "''")
}

function synth(index, text) {
  const out = join(audioDir, `${String(index).padStart(3, '0')}.wav`)
  if (existsSync(out)) return out
  const script = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice('Microsoft Huihui Desktop')
$s.Rate = 3
$s.Volume = 100
$s.SetOutputToWaveFile('${out.replace(/\\/g, '\\\\')}')
$s.Speak('${psQuote(text)}')
$s.Dispose()
`
  execFileSync('powershell', ['-NoProfile', '-Command', script], { stdio: 'pipe' })
  return out
}

function duration(file) {
  const out = execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])
  return parseFloat(out.toString().trim())
}

const segFiles = []
const silent = join(audioDir, 'silence.wav')

for (let i = 0; i < manifest.frames.length; i++) {
  const frame = manifest.frames[i]
  const text = NARRATION[i]
  if (!text) throw new Error(`第 ${i} 帧缺旁白`)
  const wav = synth(i, text)
  const voiceDur = duration(wav)
  const videoDur = Math.max((frame.holdMs || 1500) / 1000, voiceDur + 0.6)
  console.log(`[${i}] 旁白 ${voiceDur.toFixed(1)}s → 帧时长 ${videoDur.toFixed(1)}s`)
  segFiles.push({ frame: frame.file, wav, dur: videoDur, voiceDur })
}

// 逐帧：静音底 + 旁白，输出统一采样
const parts = []
segFiles.forEach((s, i) => {
  const part = join(audioDir, `part-${String(i).padStart(3, '0')}.mp3`)
  execFileSync(FFMPEG, [
    '-y', '-i', s.wav,
    '-af', `apad=whole_dur=${s.dur},aresample=44100`,
    '-c:a', 'libmp3lame', '-b:a', '128k',
    part
  ], { stdio: 'pipe' })
  parts.push(part)
})

const listFile = join(audioDir, 'audio-concat.txt')
writeFileSync(listFile, parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'), 'utf8')
const voiceTrack = join(root, 'voice-track.mp3')
execFileSync(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', voiceTrack], { stdio: 'pipe' })

const total = segFiles.reduce((a, s) => a + s.dur, 0)
writeFileSync(join(root, 'timeline.json'), JSON.stringify(segFiles.map((s, i) => ({
  index: i, start: segFiles.slice(0, i).reduce((a, x) => a + x.dur, 0), dur: s.dur, text: NARRATION[i]
})), null, 2), 'utf8')

console.log(`\n旁白总时长 ${total.toFixed(1)}s，时间轴写入 timeline.json`)
console.log(`音轨：${voiceTrack}`)
