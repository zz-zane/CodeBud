/**
 * Verify engine.validate(spec) rejects 10 intentionally broken specs with readable Chinese errors (ENGINE.md §6).
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { validate } = require('./engine.js')

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const BASE_PATH = path.join(ROOT, 'content', 'skills', 'explainer-video', 'examples', 'c-pointer.spec.json')
const OUT_PATH = path.join(ROOT, 'outputs', 'video-skill', 'bad-specs-result.json')

const base = JSON.parse(fs.readFileSync(BASE_PATH, 'utf8'))
const clone = () => JSON.parse(JSON.stringify(base))

// First verify base spec itself passes!
const baseCheck = validate(fs.readFileSync(BASE_PATH, 'utf8'))
if (!baseCheck.ok) {
  console.error('BASE SPEC FAILED:', baseCheck.errors)
  process.exit(1)
}

const cases = [
  {
    name: '1_unentered_id_in_morph',
    desc: 'morph 引用了从未 enter 的 id',
    build: () => {
      const s = clone()
      s.acts[2].steps[0].do[0].id = 'cell-ghost'
      return s
    }
  },
  {
    name: '2_more_than_8_boxes',
    desc: '同屏超过 8 个 box',
    build: () => {
      const s = clone()
      s.acts[1].steps[0].do = [
        { op: 'enter', id: 'b1', kind: 'box', skin: 'locker', tag: '1', value: '1' },
        { op: 'enter', id: 'b2', kind: 'box', skin: 'locker', tag: '2', value: '2' },
        { op: 'enter', id: 'b3', kind: 'box', skin: 'locker', tag: '3', value: '3' },
        { op: 'enter', id: 'b4', kind: 'box', skin: 'locker', tag: '4', value: '4' }
      ]
      s.acts[1].steps[1].do = [
        { op: 'enter', id: 'b5', kind: 'box', skin: 'locker', tag: '5', value: '5' },
        { op: 'enter', id: 'b6', kind: 'box', skin: 'locker', tag: '6', value: '6' },
        { op: 'enter', id: 'b7', kind: 'box', skin: 'locker', tag: '7', value: '7' },
        { op: 'enter', id: 'b8', kind: 'box', skin: 'locker', tag: '8', value: '8' }
      ]
      s.acts[1].steps[2].do = [
        { op: 'enter', id: 'b9', kind: 'box', skin: 'locker', tag: '9', value: '9' }
      ]
      return s
    }
  },
  {
    name: '3_caption_over_24_chars',
    desc: '字幕超过 24 字（30 字）',
    build: () => {
      const s = clone()
      s.acts[0].steps[0].caption = '这是一句故意写得非常非常长的三十个字用来测试字幕长度校验的句子'
      return s
    }
  },
  {
    name: '4_missing_reveal_act',
    desc: '缺少 reveal 幕（只有 5 幕）',
    build: () => {
      const s = clone()
      s.acts.splice(2, 1)
      return s
    }
  },
  {
    name: '5_morph_id_not_from_analogy',
    desc: 'reveal 幕 morph 的 id 不是 analogy 幕的元素',
    build: () => {
      const s = clone()
      s.acts[2].steps[0].do = [
        { op: 'enter', id: 'new-in-reveal', kind: 'box', skin: 'memory', tag: '0x1', value: '1' },
        { op: 'morph', id: 'new-in-reveal', skin: 'var' }
      ]
      return s
    }
  },
  {
    name: '6_duplicate_token_two_roles',
    desc: 'tokens 中同一记号绑定两个角色（原始 JSON 重复键）',
    build: () => {
      const raw = JSON.stringify(clone(), null, 2)
      return raw.replace('"*p": "value",', '"*p": "value",\n    "*p": "pointer",')
    }
  },
  {
    name: '7_real_skin_in_analogy',
    desc: 'analogy 幕非法使用了真实皮肤 memory',
    build: () => {
      const s = clone()
      s.acts[1].steps[0].do[0].skin = 'memory'
      return s
    }
  },
  {
    name: '8_trace_step_missing_line',
    desc: 'trace 幕某一步缺少 line 动作',
    build: () => {
      const s = clone()
      s.acts[3].steps[0].do = [{ op: 'enter', id: 'tr-a', kind: 'box', skin: 'memory', tag: '0x7ffd10', value: '5' }]
      return s
    }
  },
  {
    name: '9_unknown_role_in_caption',
    desc: '字幕引用了未定义的角色名',
    build: () => {
      const s = clone()
      s.acts[0].steps[1].caption = '变量 {ghost:a} 存入数值'
      return s
    }
  },
  {
    name: '10_total_steps_below_14',
    desc: '全片总步数少于 14 步',
    build: () => {
      const s = clone()
      for (const a of s.acts) a.steps = [a.steps[0]]
      return s
    }
  },
  {
    name: '11_more_than_4_ungrouped_boxes',
    desc: '同屏不在 group 里的 box 超过 4 个（5 个散落 box）',
    build: () => {
      const s = clone()
      s.acts[1].steps[0].do = [
        { op: 'enter', id: 'u1', kind: 'box', skin: 'locker', tag: '1', value: '1' },
        { op: 'enter', id: 'u2', kind: 'box', skin: 'locker', tag: '2', value: '2' },
        { op: 'enter', id: 'u3', kind: 'box', skin: 'locker', tag: '3', value: '3' },
        { op: 'enter', id: 'u4', kind: 'box', skin: 'locker', tag: '4', value: '4' }
      ]
      s.acts[1].steps[1].do = [
        { op: 'enter', id: 'u5', kind: 'box', skin: 'locker', tag: '5', value: '5' }
      ]
      return s
    }
  },
  {
    name: '12_recap_less_than_3_rows',
    desc: 'recap 幕的 row 少于 3 行（只有 2 行）',
    build: () => {
      const s = clone()
      const recap = s.acts.find((a) => a.kind === 'recap')
      recap.steps[0].do = recap.steps[0].do.filter((op) => op.op === 'row').slice(0, 2)
      return s
    }
  },
  {
    name: '13_page_skin_with_size',
    desc: 'page 皮肤非法写了 size',
    build: () => {
      const s = clone()
      s.acts[3].steps[0].do.push({ op: 'enter', id: 'bad-pg', kind: 'box', skin: 'page', tag: 'P0', value: '4K', size: 1.5 })
      return s
    }
  },
  {
    name: '14_invalid_pace',
    desc: 'pace 写了非法值 fast',
    build: () => {
      const s = clone()
      s.pace = 'fast'
      return s
    }
  },
  {
    name: '15_clarify_wrong_position',
    desc: 'clarify 幕放错位置（放在 trace 和 pitfall 之间）',
    build: () => {
      const s = clone()
      s.acts.splice(4, 0, {
        kind: 'clarify',
        title: '辨析一下',
        steps: [
          { caption: '先问', do: [{ op: 'say', who: 'student', text: '这两个有什么区别？' }] },
          { caption: '再答', do: [{ op: 'say', who: 'teacher', text: '看切法不同。' }] },
          { caption: '复述', do: [{ op: 'say', who: 'student', text: '明白了！' }] }
        ]
      })
      return s
    }
  },
  {
    name: '16_clarify_first_not_student',
    desc: 'clarify 幕第一个 say 不是 student',
    build: () => {
      const s = clone()
      s.acts.splice(5, 0, {
        kind: 'clarify',
        title: '辨析一下',
        steps: [
          { caption: '老师先讲', do: [{ op: 'say', who: 'teacher', text: '我先来总结一下。' }] },
          { caption: '学生复述', do: [{ op: 'say', who: 'student', text: '明白了！' }] }
        ]
      })
      return s
    }
  },
  {
    name: '17_say_outside_clarify',
    desc: 'say 出现在 clarify 以外的幕（pitfall）',
    build: () => {
      const s = clone()
      s.acts[4].steps[0].do = [{ op: 'say', who: 'student', text: '这里不能说话' }]
      return s
    }
  },
  {
    name: '18_say_over_30_chars',
    desc: 'say 的 text 超过 30 字上限',
    build: () => {
      const s = clone()
      s.acts.splice(5, 0, {
        kind: 'clarify',
        title: '辨析一下',
        steps: [
          { caption: '问太长', do: [{ op: 'say', who: 'student', text: '这是一句故意写得非常非常长用来测试超过三十个字上限的学生提问气泡内容' }] },
          { caption: '再答', do: [{ op: 'say', who: 'teacher', text: '简短回答。' }] },
          { caption: '复述', do: [{ op: 'say', who: 'student', text: '懂了。' }] }
        ]
      })
      return s
    }
  }
]

const results = []
let allRejected = true
for (const c of cases) {
  const res = validate(c.build())
  if (res.ok) allRejected = false
  results.push({
    name: c.name,
    desc: c.desc,
    rejected: !res.ok,
    errors: res.ok ? [] : res.errors
  })
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
fs.writeFileSync(OUT_PATH, JSON.stringify({ baseValid: baseCheck.ok, totalCases: cases.length, allRejected, results }, null, 2), 'utf8')
console.log(JSON.stringify({ baseValid: baseCheck.ok, totalCases: cases.length, allRejected }, null, 2))
for (const r of results) {
  console.log(`- [${r.rejected ? 'PASS' : 'FAIL'}] ${r.name}: ${r.errors[0] || 'NO ERROR'}`)
}
if (!allRejected) process.exit(1)
