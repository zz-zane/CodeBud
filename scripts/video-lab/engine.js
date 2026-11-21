/**
 * CodeBud Generic Spec-Driven Deterministic Video Engine (v2 — ENGINE.md)
 *
 * Pure function exports:
 *   validate(spec)            -> { ok: true, spec } | { ok: false, errors: string[] }
 *   timeline(spec)            -> { duration, acts, steps }
 *   drawFrame(ctx, spec, t)   -> void (deterministic per (spec, t))
 *
 * Zero content-bound literals, zero Date.now(), zero Math.random(), zero cross-frame state.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.VideoEngine = factory()
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict'

  const FONT_SANS = '"Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", sans-serif'
  const FONT_MONO = '"Consolas", "Cascadia Code", "Courier New", monospace'

  // ── Fixed Palette & Role Color Mapping (ENGINE.md §4) ───────────────────
  const ROLE_COLORS = {
    blue: '#2f6fd6',
    orange: '#c96a2b',
    teal: '#1f9d8b',
    purple: '#7a5af0'
  }
  const THEME = {
    bg: '#f5f4ef',
    surface: '#ffffff',
    ink: '#1a1a18',
    muted: '#66645e',
    border: '#dcd9d0',
    danger: '#d64545',
    codeKeyword: '#6b5b95'
  }

  // ── Fixed Act Order, Skins & Op Durations (SKILL.md + ENGINE.md §2/§5/§7)
  const ACT_ORDER = ['hook', 'analogy', 'reveal', 'trace', 'pitfall', 'recap']
  const ACT_ORDER_CLARIFY = ['hook', 'analogy', 'reveal', 'trace', 'pitfall', 'clarify', 'recap']
  const ANALOGY_SKINS = new Set(['locker', 'note', 'card', 'car', 'envelope', 'cup'])
  const REAL_SKINS = new Set(['memory', 'var', 'slot', 'node', 'frame', 'segment', 'page'])
  const ALL_SKINS = new Set([...ANALOGY_SKINS, ...REAL_SKINS])
  const ELEMENT_KINDS = new Set(['box', 'group', 'zone', 'output'])
  const OP_DURATIONS = {
    enter: 0.45,
    exit: 0.2,
    set: 0.6,
    morph: 1.6,
    arrow: 0.5,
    unarrow: 0.2,
    fly: 1.0,
    focus: 0.3,
    write: 0.5,
    line: 0.3,
    print: 0.4,
    break: 0.7,
    row: 0.45,
    title: 0.6,
    say: 0.45
  }
  const CLEAR_DUR = 0.2

  /**
   * Unified skin parameter table (ENGINE.md §5 & §7).
   * Every skin defines the same numeric/color schema so ANY skin morphs smoothly to ANY other.
   */
  const SKINS = {
    // Analogy skins
    locker:   { w: 250, h: 225, radius: 18, fill: '#f0e5d1', stroke: '#c4b293', strokeWidth: 3,   headerH: 52, headerFill: '#e3d3b6', tilt: 0,      foldCorner: 0,  handle: 1, slots: 3, ticks: 0, flap: 0, wheels: 0, rim: 0, spine: 0, headerAlign: 0, grid4: 0, topFold: 0 },
    note:     { w: 300, h: 170, radius: 4,  fill: '#fef6d8', stroke: '#d8be6e', strokeWidth: 3,   headerH: 46, headerFill: '#f8eab8', tilt: -0.042, foldCorner: 30, handle: 0, slots: 0, ticks: 0, flap: 0, wheels: 0, rim: 0, spine: 0, headerAlign: 0, grid4: 0, topFold: 0 },
    card:     { w: 250, h: 195, radius: 14, fill: '#fffaf0', stroke: '#d6c6a8', strokeWidth: 2.5, headerH: 46, headerFill: '#f3ead8', tilt: -0.015, foldCorner: 0,  handle: 0, slots: 0, ticks: 0, flap: 0, wheels: 0, rim: 0, spine: 0, headerAlign: 0, grid4: 0, topFold: 0 },
    car:      { w: 260, h: 190, radius: 12, fill: '#ebe8df', stroke: '#8c887d', strokeWidth: 3,   headerH: 46, headerFill: '#dcd8cc', tilt: 0,      foldCorner: 0,  handle: 0, slots: 0, ticks: 0, flap: 0, wheels: 1, rim: 0, spine: 0, headerAlign: 0, grid4: 0, topFold: 0 },
    envelope: { w: 280, h: 185, radius: 8,  fill: '#faf2e1', stroke: '#cfb891', strokeWidth: 2.5, headerH: 44, headerFill: '#f2e5cb', tilt: 0,      foldCorner: 0,  handle: 0, slots: 0, ticks: 0, flap: 1, wheels: 0, rim: 0, spine: 0, headerAlign: 0, grid4: 0, topFold: 0 },
    cup:      { w: 220, h: 215, radius: 22, fill: '#f4efe6', stroke: '#b8aa95', strokeWidth: 3,   headerH: 44, headerFill: '#e8dfd0', tilt: 0,      foldCorner: 0,  handle: 0, slots: 0, ticks: 0, flap: 0, wheels: 0, rim: 1, spine: 0, headerAlign: 0, grid4: 0, topFold: 0 },
    // Real skins
    memory:   { w: 250, h: 220, radius: 6,  fill: '#ffffff', stroke: '#d4d1c8', strokeWidth: 2.5, headerH: 52, headerFill: '#e8f0fc', tilt: 0,      foldCorner: 0,  handle: 0, slots: 0, ticks: 4, flap: 0, wheels: 0, rim: 0, spine: 0, headerAlign: 0, grid4: 0, topFold: 0 },
    var:      { w: 290, h: 170, radius: 10, fill: '#eef9f7', stroke: '#1f9d8b', strokeWidth: 2.5, headerH: 46, headerFill: '#d7f0eb', tilt: 0,      foldCorner: 0,  handle: 0, slots: 0, ticks: 0, flap: 0, wheels: 0, rim: 0, spine: 0, headerAlign: 0, grid4: 0, topFold: 0 },
    slot:     { w: 210, h: 185, radius: 6,  fill: '#ffffff', stroke: '#c7ccd4', strokeWidth: 2.5, headerH: 46, headerFill: '#eef3fb', tilt: 0,      foldCorner: 0,  handle: 0, slots: 0, ticks: 2, flap: 0, wheels: 0, rim: 0, spine: 0, headerAlign: 0, grid4: 0, topFold: 0 },
    node:     { w: 240, h: 180, radius: 28, fill: '#ffffff', stroke: '#7a5af0', strokeWidth: 2.5, headerH: 44, headerFill: '#f0ecfe', tilt: 0,      foldCorner: 0,  handle: 0, slots: 0, ticks: 0, flap: 0, wheels: 0, rim: 0, spine: 0, headerAlign: 0, grid4: 0, topFold: 0 },
    frame:    { w: 320, h: 136, radius: 10, fill: '#ffffff', stroke: '#2f6fd6', strokeWidth: 2.5, headerH: 42, headerFill: '#eaf1fc', tilt: 0,      foldCorner: 0,  handle: 0, slots: 0, ticks: 0, flap: 0, wheels: 0, rim: 0, spine: 0, headerAlign: 0, grid4: 0, topFold: 0 },
    segment:  { w: 300, h: 132, radius: 14, fill: '#ffffff', stroke: '#c7ccd4', strokeWidth: 2.5, headerH: 42, headerFill: '#eef3fb', tilt: 0,      foldCorner: 0,  handle: 0, slots: 0, ticks: 0, flap: 0, wheels: 0, rim: 0, spine: 8, headerAlign: 1, grid4: 0, topFold: 0 },
    page:     { w: 196, h: 196, radius: 8,  fill: '#ffffff', stroke: '#c7ccd4', strokeWidth: 2.5, headerH: 44, headerFill: '#eef3fb', tilt: 0,      foldCorner: 0,  handle: 0, slots: 0, ticks: 0, flap: 0, wheels: 0, rim: 0, spine: 0, headerAlign: 0, grid4: 1, topFold: 22 }
  }

  // ── Pure Math & Color Helpers ───────────────────────────────────────────
  const clamp01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x)
  const lerp = (a, b, t) => a + (b - a) * t
  /** Manim smooth(t) = 6t^5 - 15t^4 + 10t^3 */
  const smooth = (x) => {
    const t = clamp01(x)
    return t * t * t * (t * (t * 6 - 15) + 10)
  }
  const easeIn = (x) => {
    const t = clamp01(x)
    return t * t * t
  }
  const seg = (t, t0, dur) => (dur <= 0 ? (t >= t0 ? 1 : 0) : clamp01((t - t0) / dur))

  function hexToRgb(col) {
    const s = String(col).trim()
    const m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(s)
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3])]
    const h = s.replace('#', '')
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  function mixHex(a, b, t) {
    const [r1, g1, b1] = hexToRgb(a)
    const [r2, g2, b2] = hexToRgb(b)
    const k = clamp01(t)
    return `rgb(${Math.round(lerp(r1, r2, k))},${Math.round(lerp(g1, g2, k))},${Math.round(lerp(b1, b2, k))})`
  }
  function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex)
    return `rgba(${r},${g},${b},${clamp01(a).toFixed(4)})`
  }

  /** Strip {role:text} markup to measure visible character count */
  function visibleCaptionText(caption) {
    return String(caption || '').replace(/\{[A-Za-z0-9_-]+:([^}]*)\}/g, '$1')
  }
  function charLen(str) {
    return Array.from(String(str || '')).length
  }

  function roleColor(spec, roleName, fallback = THEME.ink) {
    const r = spec.roles && roleName ? spec.roles[roleName] : null
    if (r && ROLE_COLORS[r.color]) return ROLE_COLORS[r.color]
    return fallback
  }

  /** Detect duplicate keys inside a raw JSON string's "tokens" object */
  function findDuplicateTokenKeys(rawJson) {
    const dups = []
    if (typeof rawJson !== 'string') return dups
    const m = /"tokens"\s*:\s*\{([\s\S]*?)\}/.exec(rawJson)
    if (!m) return dups
    const seen = new Set()
    const keyRe = /"((?:\\.|[^"\\])*)"\s*:/g
    let km
    while ((km = keyRe.exec(m[1])) !== null) {
      const k = km[1]
      if (seen.has(k)) dups.push(k)
      seen.add(k)
    }
    return dups
  }

  // ── 1. validate(spec) ───────────────────────────────────────────────────
  function validate(input) {
    const errors = []
    let rawJson = null
    let spec = input
    if (typeof input === 'string') {
      rawJson = input
      try {
        spec = JSON.parse(input)
      } catch (e) {
        return { ok: false, errors: [`JSON 解析失败：${e.message}`] }
      }
    }
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
      return { ok: false, errors: ['spec 必须是一个 JSON 对象'] }
    }
    if (spec.unsuitable) {
      return { ok: false, errors: [`课程标记为不适合制作动画：${spec.unsuitable}`] }
    }

    if (spec.version !== 1) errors.push('version 必须为 1')
    if (typeof spec.lessonId !== 'string' || !spec.lessonId.trim()) errors.push('缺少有效的 lessonId')
    if (typeof spec.title !== 'string' || !spec.title.trim()) errors.push('缺少 title')
    else if (charLen(spec.title) > 20) errors.push(`title "${spec.title}" 超过 20 字上限（当前 ${charLen(spec.title)} 字）`)
    if (typeof spec.concept !== 'string' || !spec.concept.trim()) errors.push('缺少 concept')
    else if (charLen(spec.concept) > 20) errors.push(`concept "${spec.concept}" 超过 20 字上限（当前 ${charLen(spec.concept)} 字）`)

    // roles
    const roleKeys = spec.roles && typeof spec.roles === 'object' && !Array.isArray(spec.roles) ? Object.keys(spec.roles) : []
    if (roleKeys.length < 2 || roleKeys.length > 3) {
      errors.push(`roles 必须定义 2–3 个语义角色（当前 ${roleKeys.length} 个）`)
    }
    const usedColors = new Set()
    for (const rk of roleKeys) {
      const rv = spec.roles[rk]
      if (!rv || typeof rv !== 'object' || typeof rv.label !== 'string' || !rv.label.trim()) {
        errors.push(`roles.${rk} 缺少 label`)
      }
      if (!rv || !ROLE_COLORS[rv.color]) {
        errors.push(`roles.${rk}.color "${rv && rv.color}" 非法，只能从 blue / orange / teal / purple 四选`)
      } else if (usedColors.has(rv.color)) {
        errors.push(`roles.${rk} 复用了颜色 "${rv.color}"，每个角色必须有不同颜色`)
      } else {
        usedColors.add(rv.color)
      }
    }

    // tokens
    if (rawJson) {
      for (const dup of findDuplicateTokenKeys(rawJson)) {
        errors.push(`tokens 中记号 "${dup}" 重复定义了多个角色，每个记号只能对应一个角色`)
      }
    }
    if (!spec.tokens || typeof spec.tokens !== 'object' || Array.isArray(spec.tokens)) {
      errors.push('缺少 tokens 映射表')
    } else {
      for (const [tok, rname] of Object.entries(spec.tokens)) {
        if (typeof rname !== 'string') {
          errors.push(`tokens["${tok}"] 只能绑定单个角色字符串，不能绑定多个角色`)
        } else if (!spec.roles || !spec.roles[rname]) {
          errors.push(`tokens["${tok}"] 引用了未定义的角色 "${rname}"`)
        }
      }
    }
    if (spec.recapHeads !== undefined) {
      const h = spec.recapHeads
      if (!Array.isArray(h) || h.length < 2 || h.length > 3 || h.some((x) => typeof x !== 'string' || !x.trim() || x.length > 10)) {
        errors.push('recapHeads 必须是 2–3 个非空字符串（每个 ≤ 10 字），如 ["维度", "分段", "分页"]')
      }
    }
    if (spec.pace !== undefined && spec.pace !== 'normal' && spec.pace !== 'slow') {
      errors.push(`pace 取值 "${spec.pace}" 非法，只能是 "normal" 或 "slow"`)
    }

    // code
    const codeLines = spec.code && Array.isArray(spec.code.lines) ? spec.code.lines : null
    // 无代码模式（SKILL §7）：不写 code，整片靠画面讲；此时禁用 write / line / print，trace 不要求 line
    const noCode = spec.code === undefined
    if (noCode) {
      // 合法：后面逐个 op 检查不许出现代码类动作
    } else if (!spec.code || typeof spec.code !== 'object' || typeof spec.code.lang !== 'string' || !codeLines) {
      errors.push('缺少有效的 code 对象（需包含 lang、lines、expectedOutput）')
    } else {
      if (codeLines.length < 1 || codeLines.length > 16) {
        errors.push(`code.lines 必须为 1–16 行（当前 ${codeLines.length} 行）`)
      }
      codeLines.forEach((ln, idx) => {
        if (typeof ln !== 'string') errors.push(`code.lines[${idx}] 必须是字符串`)
        else if (charLen(ln) > 48) errors.push(`code 第 ${idx + 1} 行超过 48 字符上限（当前 ${charLen(ln)} 字符）`)
      })
      if (typeof spec.code.expectedOutput !== 'string') {
        errors.push('code.expectedOutput 必须是字符串')
      }
    }

    // acts: 6 fixed acts, or 7 with optional clarify between pitfall and recap (ENGINE.md §7)
    const hasClarify = Array.isArray(spec.acts) && spec.acts.some((a) => a && a.kind === 'clarify')
    const expectedOrder = hasClarify ? ACT_ORDER_CLARIFY : ACT_ORDER
    if (!Array.isArray(spec.acts) || spec.acts.length !== expectedOrder.length) {
      errors.push(
        hasClarify
          ? `包含 clarify 幕时 acts 必须为 7 幕且顺序为：${ACT_ORDER_CLARIFY.join(' → ')}（clarify 只能出现在 pitfall 与 recap 之间）`
          : `acts 必须包含固定 6 幕（顺序：${ACT_ORDER.join(' → ')}）`
      )
      return errors.length ? { ok: false, errors } : { ok: true, spec }
    }

    for (let i = 0; i < expectedOrder.length; i++) {
      const a = spec.acts[i]
      if (!a || a.kind !== expectedOrder[i]) {
        errors.push(`第 ${i + 1} 幕的 kind 必须是 "${expectedOrder[i]}"（当前为 "${a && a.kind}"；clarify 只能出现在 pitfall 与 recap 之间）`)
      }
      if (!a || typeof a.title !== 'string' || !a.title.trim()) {
        errors.push(`第 ${i + 1} 幕缺少 title`)
      } else if (charLen(a.title) > 16) {
        errors.push(`第 ${i + 1} 幕 title "${a.title}" 超过 16 字上限`)
      }
      if (!a || !Array.isArray(a.steps) || a.steps.length === 0) {
        errors.push(`第 ${i + 1} 幕（${a && a.kind}）缺少 steps`)
      } else if (a.kind === 'clarify' && (a.steps.length < 2 || a.steps.length > 4)) {
        errors.push(`第 ${i + 1} 幕（clarify）步数必须在 2–4 之间（当前 ${a.steps.length} 步）`)
      }
    }

    let totalSteps = 0
    const globalEnteredIds = new Set()
    let alive = new Map() // id -> { kind, skin, group }
    const analogyBoxIds = new Set()
    const revealMorphedIds = new Set()
    const missingIdMsg = (loc, opName, id) => globalEnteredIds.has(id)
      ? `${loc} ${opName} 的 id "${id}" 已在换幕清场或 exit 后退场（除 analogy→reveal 外每幕自动清场），请用新的唯一 id 重新 enter`
      : `${loc} ${opName} 的 id "${id}" 之前没有 enter`

    for (let ai = 0; ai < spec.acts.length; ai++) {
      const act = spec.acts[ai]
      if (!act || !Array.isArray(act.steps)) continue
      const prevAct = ai > 0 ? spec.acts[ai - 1] : null
      const keepPrev = prevAct && prevAct.kind === 'analogy' && act.kind === 'reveal'
      if (!keepPrev) {
        alive = new Map()
      }
      let recapRowCount = 0
      const clarifySays = []

      for (let si = 0; si < act.steps.length; si++) {
        totalSteps++
        const st = act.steps[si]
        const loc = `第 ${ai + 1} 幕（${act.kind}）第 ${si + 1} 步`
        if (!st || typeof st !== 'object') {
          errors.push(`${loc} 必须是对象`)
          continue
        }
        if (typeof st.caption !== 'string' || !st.caption.trim()) {
          errors.push(`${loc} 缺少 caption 字幕`)
        } else {
          const vis = visibleCaptionText(st.caption)
          if (charLen(vis) > 24) {
            errors.push(`${loc} 字幕 "${vis}" 超过 24 字上限（当前 ${charLen(vis)} 字）`)
          }
          // Check {role:text} tags
          const tagRe = /\{([A-Za-z0-9_-]+):([^}]*)\}/g
          let tm
          while ((tm = tagRe.exec(st.caption)) !== null) {
            if (!spec.roles || !spec.roles[tm[1]]) {
              errors.push(`${loc} 字幕引用了未定义的角色 "${tm[1]}"`)
            }
          }
        }

        if (!Array.isArray(st.do) || st.do.length < 1 || st.do.length > 4) {
          errors.push(`${loc} 的 do 必须包含 1–4 个动作`)
          continue
        }

        let hasLineOp = false
        for (const op of st.do) {
          if (!op || typeof op !== 'object' || !OP_DURATIONS[op.op]) {
            errors.push(`${loc} 含有未知动作 "${op && op.op}"`)
            continue
          }
          switch (op.op) {
            case 'enter': {
              if (typeof op.id !== 'string' || !op.id.trim()) {
                errors.push(`${loc} enter 缺少 id`)
                break
              }
              if (globalEnteredIds.has(op.id)) {
                errors.push(`${loc} enter 的 id "${op.id}" 在全片中重复，id 必须全片唯一`)
              }
              if (!ELEMENT_KINDS.has(op.kind)) {
                errors.push(`${loc} enter 的 kind "${op.kind}" 非法，只能是 box / group / zone / output`)
                break
              }
              if (op.kind === 'box') {
                if (!ALL_SKINS.has(op.skin)) {
                  errors.push(`${loc} box "${op.id}" 的 skin "${op.skin}" 非法`)
                } else if (act.kind === 'analogy' && !ANALOGY_SKINS.has(op.skin)) {
                  errors.push(`${loc} analogy 幕的 box "${op.id}" 只能使用类比皮肤，不能用 "${op.skin}"`)
                } else if (act.kind !== 'analogy' && ANALOGY_SKINS.has(op.skin)) {
                  errors.push(`${loc} ${act.kind} 幕的 box "${op.id}" 不能使用类比皮肤 "${op.skin}"`)
                }
                for (const f of ['tag', 'name', 'value']) {
                  if (op[f] !== undefined && charLen(op[f]) > 12) {
                    errors.push(`${loc} box "${op.id}" 的 ${f} "${op[f]}" 超过 12 字符上限`)
                  }
                }
                if (op.role && (!spec.roles || !spec.roles[op.role])) {
                  errors.push(`${loc} box "${op.id}" 引用了未定义角色 "${op.role}"`)
                }
                if (op.size !== undefined) {
                  if (op.skin === 'page') {
                    errors.push(`${loc} box "${op.id}"：页大小固定，page 不能写 size`)
                  } else if (typeof op.size !== 'number' || Number.isNaN(op.size) || op.size < 0.4 || op.size > 2.5) {
                    errors.push(`${loc} box "${op.id}" 的 size 必须在 0.4–2.5 之间（当前 ${op.size}）`)
                  }
                }
                if (op.group && (!alive.has(op.group) || alive.get(op.group).kind !== 'group')) {
                  errors.push(`${loc} box "${op.id}" 指定的 group "${op.group}" 尚未 enter`)
                }
                if (op.place !== undefined) {
                  const pm = /^(below|above):(.+)$/.exec(String(op.place))
                  if (!pm) {
                    errors.push(`${loc} box "${op.id}" 的 place "${op.place}" 格式非法，必须是 "below:<id>" 或 "above:<id>"`)
                  } else if (!alive.has(pm[2])) {
                    errors.push(`${loc} box "${op.id}" 的 place "${op.place}" 目标 "${pm[2]}" 之前没有 enter`)
                  }
                }
                if (act.kind === 'analogy') analogyBoxIds.add(op.id)
              } else if (op.kind === 'zone') {
                if (op.tone !== 'danger' && op.tone !== 'neutral') {
                  errors.push(`${loc} zone "${op.id}" 的 tone 必须是 danger 或 neutral`)
                }
              } else if (op.kind === 'group') {
                if (op.layout && op.layout !== 'row' && op.layout !== 'column') {
                  errors.push(`${loc} group "${op.id}" 的 layout 必须是 row 或 column`)
                }
              }
              globalEnteredIds.add(op.id)
              alive.set(op.id, { kind: op.kind, skin: op.skin, group: op.group })
              // Check same-screen caps
              let boxCount = 0, ungroupedBoxCount = 0, groupCount = 0
              for (const el of alive.values()) {
                if (el.kind === 'box') {
                  boxCount++
                  if (!el.group) ungroupedBoxCount++
                }
                if (el.kind === 'group') groupCount++
              }
              if (boxCount > 8) errors.push(`${loc} 同屏 box 数量达到 ${boxCount}，超过上限 8`)
              if (ungroupedBoxCount > 4) errors.push(`${loc} 同屏不在任何 group 里的 box 数量达到 ${ungroupedBoxCount}（上限 4），请用 group 组织成表 / 栈 / 数组 / 左右对比`)
              if (groupCount > 4) errors.push(`${loc} 同屏 group 数量达到 ${groupCount}，超过上限 4`)
              break
            }
            case 'exit': {
              if (!alive.has(op.id)) errors.push(missingIdMsg(loc, 'exit', op.id))
              else alive.delete(op.id)
              break
            }
            case 'set': {
              if (!alive.has(op.id)) {
                errors.push(missingIdMsg(loc, 'set', op.id))
              } else {
                const hasField = op.value !== undefined || op.tag !== undefined || op.name !== undefined
                if (!hasField) errors.push(`${loc} set 必须提供 value / tag / name 至少一项`)
                for (const f of ['tag', 'name', 'value']) {
                  if (op[f] !== undefined && charLen(op[f]) > 12) {
                    errors.push(`${loc} set "${op.id}" 的 ${f} "${op[f]}" 超过 12 字符上限`)
                  }
                }
              }
              break
            }
            case 'morph': {
              if (!alive.has(op.id)) {
                errors.push(missingIdMsg(loc, 'morph', op.id))
              } else if (alive.get(op.id).kind !== 'box') {
                errors.push(`${loc} morph 只能作用于 box，不能对 ${alive.get(op.id).kind} "${op.id}" 使用 morph（请删掉这条 morph）`)
              } else if (act.kind === 'reveal' && !analogyBoxIds.has(op.id)) {
                errors.push(`${loc} reveal 幕 morph 的 id "${op.id}" 不是 analogy 幕里出现过的元素`)
              } else {
                if (!REAL_SKINS.has(op.skin)) {
                  errors.push(`${loc} morph "${op.id}" 的目标 skin "${op.skin}" 必须是真实皮肤（memory/var/slot/node/frame/segment/page）`)
                }
                if (op.role !== undefined && (!spec.roles || !spec.roles[op.role])) {
                  errors.push(`${loc} morph "${op.id}" 引用了未定义角色 "${op.role}"`)
                }
                if (op.size !== undefined) {
                  if (op.skin === 'page') {
                    errors.push(`${loc} morph "${op.id}"：页大小固定，page 不能写 size`)
                  } else if (typeof op.size !== 'number' || Number.isNaN(op.size) || op.size < 0.4 || op.size > 2.5) {
                    errors.push(`${loc} morph "${op.id}" 的 size 必须在 0.4–2.5 之间（当前 ${op.size}）`)
                  }
                }
                for (const f of ['tag', 'name', 'value']) {
                  if (op[f] !== undefined && charLen(op[f]) > 12) {
                    errors.push(`${loc} morph "${op.id}" 的 ${f} "${op[f]}" 超过 12 字符上限`)
                  }
                }
                alive.get(op.id).skin = op.skin
                if (act.kind === 'reveal') revealMorphedIds.add(op.id)
              }
              break
            }
            case 'arrow':
            case 'unarrow': {
              if (!alive.has(op.from)) errors.push(missingIdMsg(loc, `${op.op}.from`, op.from))
              if (!alive.has(op.to)) errors.push(missingIdMsg(loc, `${op.op}.to`, op.to))
              if (op.role && (!spec.roles || !spec.roles[op.role])) {
                errors.push(`${loc} ${op.op} 引用了未定义角色 "${op.role}"`)
              }
              break
            }
            case 'fly': {
              if (!alive.has(op.from)) errors.push(missingIdMsg(loc, 'fly.from', op.from))
              if (!alive.has(op.to)) errors.push(missingIdMsg(loc, 'fly.to', op.to))
              if (typeof op.text !== 'string' || !op.text) errors.push(`${loc} fly 缺少 text`)
              else if (charLen(op.text) > 12) errors.push(`${loc} fly 的 text "${op.text}" 超过 12 字符上限`)
              if (!op.role || !spec.roles || !spec.roles[op.role]) {
                errors.push(`${loc} fly 引用了未定义角色 "${op.role}"`)
              }
              break
            }
            case 'focus': {
              if (!Array.isArray(op.ids)) {
                errors.push(`${loc} focus 的 ids 必须是数组`)
              } else {
                for (const fid of op.ids) {
                  if (!alive.has(fid)) errors.push(missingIdMsg(loc, 'focus', fid))
                }
              }
              break
            }
            case 'write':
            case 'line': {
              if (op.op === 'line') hasLineOp = true
              if (noCode) { errors.push(`${loc} 没有 code 的片子不能用 ${op.op}（无代码模式只用画面讲）`); break }
              const maxL = codeLines ? codeLines.length : 0
              if (!Number.isInteger(op.line) || op.line < 1 || op.line > maxL) {
                errors.push(`${loc} ${op.op} 的行号 ${op.line} 超出代码行数范围（1–${maxL}）`)
              }
              break
            }
            case 'print': {
              if (noCode) errors.push(`${loc} 没有 code 的片子不能用 print`)
              if (typeof op.text !== 'string') errors.push(`${loc} print 缺少 text 字符串`)
              break
            }
            case 'break': {
              if (!alive.has(op.id)) errors.push(missingIdMsg(loc, 'break', op.id))
              if (typeof op.text !== 'string' || !op.text.trim()) errors.push(`${loc} break 缺少错误标签 text`)
              break
            }
            case 'row': {
              if (!Array.isArray(op.cells) || op.cells.length < 2 || op.cells.length > 3) {
                errors.push(`${loc} row 的 cells 必须是 2–3 个字符串的数组`)
              }
              if (act.kind === 'recap') recapRowCount++
              break
            }
            case 'title': {
              if (typeof op.text !== 'string' || !op.text.trim()) errors.push(`${loc} title 缺少 text`)
              break
            }
            case 'say': {
              if (act.kind !== 'clarify') {
                errors.push(`${loc} say 动作只能在 clarify 幕中使用，不能出现在 ${act.kind} 幕`)
              }
              if (op.who !== 'student' && op.who !== 'teacher') {
                errors.push(`${loc} say 的 who 必须是 "student" 或 "teacher"（当前 "${op.who}"）`)
              }
              if (typeof op.text !== 'string' || !op.text.trim()) {
                errors.push(`${loc} say 缺少 text`)
              } else if (charLen(op.text) > 30) {
                errors.push(`${loc} say 的 text "${op.text}" 超过 30 字上限（当前 ${charLen(op.text)} 字）`)
              }
              if (act.kind === 'clarify') clarifySays.push(op)
              break
            }
          }
        }

        if (act.kind === 'trace' && !hasLineOp && !noCode) {
          errors.push(`${loc} 在 trace 幕中缺少 line 动作`)
        }
      }
      if (act.kind === 'clarify') {
        if (clarifySays.length === 0) {
          errors.push(`第 ${ai + 1} 幕（clarify）缺少 say 对话动作`)
        } else {
          if (clarifySays[0].who !== 'student') {
            errors.push(`第 ${ai + 1} 幕（clarify）第一个 say 必须是 student（学生先说出困惑）`)
          }
          if (clarifySays[clarifySays.length - 1].who !== 'student') {
            errors.push(`第 ${ai + 1} 幕（clarify）最后一个 say 必须是 student（学生复述判断方法）`)
          }
          if (!clarifySays.some((s) => s.who === 'teacher')) {
            errors.push(`第 ${ai + 1} 幕（clarify）至少需要一个 teacher 的 say 回复`)
          }
        }
      }
      if (act.kind === 'recap' && recapRowCount < 3) {
        errors.push(`第 ${ai + 1} 幕（recap）的 row 少于 3 行（当前 ${recapRowCount} 行），请至少写 3 行对照行`)
      }
    }

    const maxSteps = hasClarify ? 30 : 26
    if (totalSteps < 14 || totalSteps > maxSteps) {
      errors.push(`全片总步数必须在 14–${maxSteps} 之间（当前 ${totalSteps} 步）`)
    }
    for (const id of analogyBoxIds) {
      if (!revealMorphedIds.has(id)) {
        errors.push(`analogy 幕中的 box "${id}" 未在 reveal 幕中被 morph 成真实皮肤（请直接在 reveal 幕加一条 morph "${id}"，不要新 enter）`)
      }
    }

    return errors.length > 0 ? { ok: false, errors } : { ok: true, spec }
  }

  // ── 2. timeline(spec) ───────────────────────────────────────────────────
  function timeline(spec) {
    const isSlow = spec.pace === 'slow'
    const paceMult = isSlow ? 1.4 : 1
    let cursor = 0
    const acts = []
    const steps = []

    for (let ai = 0; ai < spec.acts.length; ai++) {
      const act = spec.acts[ai]
      const actStart = cursor
      const prevAct = ai > 0 ? spec.acts[ai - 1] : null
      const clearsPrev = ai > 0 && !(prevAct.kind === 'analogy' && act.kind === 'reveal')
      const actSteps = []

      for (let si = 0; si < act.steps.length; si++) {
        const st = act.steps[si]
        const stepStart = cursor
        const clearDur = si === 0 && clearsPrev ? CLEAR_DUR : 0
        let opCursor = stepStart + clearDur
        const ops = []
        for (const op of st.do) {
          const d = (OP_DURATIONS[op.op] || 0.4) * paceMult
          ops.push({ op: op.op, spec: op, start: opCursor, end: opCursor + d, dur: d })
          opCursor += d
        }
        const opsEnd = opCursor
        const visChars = charLen(visibleCaptionText(st.caption))
        const captionMin = isSlow ? (visChars / 4 + 1.8) : (visChars / 6 + 1)
        const opMin = (opsEnd - stepStart) + (isSlow ? 1.4 : 0.8)
        const dur = Math.max(Number(st.hold) || 0, captionMin, opMin)
        const stepObj = {
          act: act.kind,
          actIndex: ai + 1,
          actTitle: act.title,
          index: si,
          globalIndex: steps.length,
          caption: st.caption || '',
          start: stepStart,
          end: stepStart + dur,
          dur,
          clearDur,
          ops
        }
        cursor = stepObj.end
        actSteps.push(stepObj)
        steps.push(stepObj)
      }

      acts.push({
        kind: act.kind,
        index: ai + 1,
        title: act.title,
        start: actStart,
        end: cursor,
        dur: cursor - actStart,
        clearsPrev,
        steps: actSteps
      })
    }

    return { duration: cursor, acts, steps }
  }

  // ── State Replay (Pure, Deterministic at Time t) ────────────────────────
  function buildSceneState(spec, tl, t) {
    // Replay acts sequentially up to t, keeping a snapshot of the previous act if we're in its 0.2s clear fade
    let elements = new Map() // id -> state
    let arrows = [] // { from, to, role, style, start, end, removeAt }
    let flies = []  // { from, to, text, role, start, end }
    let rows = []   // { cells, start, end }
    let says = []   // { who, text, p, start, end }
    let writtenLines = new Map() // line -> { start, end }
    let activeLine = null
    let prevLine = null
    let lineChangeStart = -1
    let lineChangeEnd = -1
    let prints = [] // { text, start, end }
    let activeTitle = null // { text, sub, start, end }
    let focusState = { prevIds: null, ids: [], start: -1, end: -1 }
    let curAct = tl.acts[0]
    let curStep = tl.steps[0]
    let prevActSnapshot = null
    let clearFade = 0
    let revealStart = -1
    let lastExitShift = null // { prevElements, start, dur } for 0.45s smooth group reflow after exit

    function cloneElements() {
      const m = new Map()
      for (const [k, v] of elements.entries()) m.set(k, { ...v })
      return m
    }

    for (let ai = 0; ai < tl.acts.length; ai++) {
      const act = tl.acts[ai]
      if (t < act.start) break
      curAct = act
      if (act.kind === 'reveal') revealStart = act.start

      if (act.clearsPrev) {
        const firstStep = act.steps[0]
        if (t < firstStep.start + CLEAR_DUR) {
          prevActSnapshot = {
            actKind: tl.acts[ai - 1].kind,
            elements: cloneElements(),
            arrows: arrows.map((a) => ({ ...a })),
            rows: rows.map((r) => ({ ...r })),
            says: says.map((s) => ({ ...s })),
            writtenLines: new Map(writtenLines),
            activeLine,
            prints: prints.slice(),
            activeTitle: activeTitle ? { ...activeTitle } : null,
            focusState: { ...focusState }
          }
          clearFade = 1 - easeIn(seg(t, firstStep.start, CLEAR_DUR))
        } else {
          prevActSnapshot = null
          clearFade = 0
        }
        elements = new Map()
        arrows = []
        flies = []
        rows = []
        says = []
        writtenLines = new Map()
        activeLine = null
        prevLine = null
        prints = []
        activeTitle = null
        focusState = { prevIds: null, ids: [], start: -1, end: -1 }
      } else if (ai > 0 && act.kind === 'reveal') {
        // analogy -> reveal: keep elements & arrows, clear focus if any
        rows = []
      }

      for (const st of act.steps) {
        if (t < st.start) break
        curStep = st

        for (const opItem of st.ops) {
          if (t < opItem.start) break
          const op = opItem.spec
          const p = seg(t, opItem.start, opItem.dur)

          switch (op.op) {
            case 'enter': {
              elements.set(op.id, {
                id: op.id,
                kind: op.kind,
                skin: op.skin || 'memory',
                fromSkin: op.skin || 'memory',
                morphP: 1,
                tag: op.tag ?? '',
                fromTag: op.tag ?? '',
                name: op.name ?? '',
                fromName: op.name ?? '',
                value: op.value ?? '',
                fromValue: op.value ?? '',
                setP: 1,
                role: op.role || null,
                size: op.size ?? 1,
                fromSize: op.size ?? 1,
                group: op.group || null,
                place: op.place || null,
                title: op.title || '',
                layout: op.layout || 'row',
                tone: op.tone || 'neutral',
                enterP: smooth(p),
                exitP: 0,
                broken: null,
                enterOrder: elements.size,
                morphStart: -1
              })
              break
            }
            case 'exit': {
              const el = elements.get(op.id)
              if (el) {
                el.exitP = easeIn(p)
                if (p >= 1) {
                  if (el.group && t - opItem.end < 0.45) {
                    lastExitShift = { prevElements: cloneElements(), start: opItem.end, dur: 0.45 }
                  }
                  elements.delete(op.id)
                }
              }
              break
            }
            case 'set': {
              const el = elements.get(op.id)
              if (el) {
                el.fromValue = el.value
                el.fromTag = el.tag
                el.fromName = el.name
                if (op.value !== undefined) el.value = String(op.value)
                if (op.tag !== undefined) el.tag = String(op.tag)
                if (op.name !== undefined) el.name = String(op.name)
                el.setP = p
                el.setIsMorph = false
              }
              break
            }
            case 'morph': {
              const el = elements.get(op.id)
              if (el) {
                el.fromSkin = el.skin
                el.skin = op.skin
                el.fromSize = el.size ?? 1
                if (op.size !== undefined) el.size = op.size
                else if (op.skin === 'page') el.size = 1
                if (op.role !== undefined) el.role = op.role
                el.fromTag = el.tag
                el.fromName = el.name
                el.fromValue = el.value
                if (op.tag !== undefined) el.tag = String(op.tag)
                if (op.name !== undefined) el.name = String(op.name)
                if (op.value !== undefined) el.value = String(op.value)
                el.morphP = p
                el.morphStart = opItem.start
              }
              break
            }
            case 'arrow': {
              const idx = arrows.findIndex((a) => a.from === op.from && a.to === op.to)
              const entry = {
                from: op.from,
                to: op.to,
                role: op.role || null,
                style: op.style || 'solid',
                progress: smooth(p),
                drawnAt: opItem.end
              }
              if (idx >= 0) arrows[idx] = entry
              else arrows.push(entry)
              break
            }
            case 'unarrow': {
              const idx = arrows.findIndex((a) => a.from === op.from && a.to === op.to)
              if (idx >= 0) {
                arrows[idx].progress = 1 - easeIn(p)
                if (p >= 1) arrows.splice(idx, 1)
              }
              break
            }
            case 'fly': {
              flies.push({
                from: op.from,
                to: op.to,
                text: op.text,
                role: op.role,
                p
              })
              if (p >= 1) {
                const toEl = elements.get(op.to)
                if (toEl) {
                  toEl.fromValue = toEl.value
                  toEl.value = String(op.text)
                  toEl.setP = 1
                }
              }
              break
            }
            case 'focus': {
              focusState = {
                prevIds: focusState.ids,
                ids: op.ids || [],
                p: smooth(p)
              }
              break
            }
            case 'write': {
              writtenLines.set(op.line, { p: smooth(p), active: t >= opItem.start && t < st.end })
              break
            }
            case 'line': {
              prevLine = activeLine === null ? op.line : activeLine
              activeLine = op.line
              lineChangeStart = opItem.start
              lineChangeEnd = opItem.end
              break
            }
            case 'print': {
              prints.push({ text: op.text, p: smooth(p) })
              break
            }
            case 'break': {
              const el = elements.get(op.id)
              if (el) {
                el.broken = { text: op.text, p: smooth(p) }
              }
              break
            }
            case 'row': {
              rows.push({ cells: op.cells, p: smooth(p), start: opItem.start })
              break
            }
            case 'title': {
              activeTitle = { text: op.text, sub: op.sub || '', p: smooth(p), start: opItem.start }
              break
            }
            case 'say': {
              says.push({ who: op.who, text: op.text, p: smooth(p), start: opItem.start, end: opItem.end })
              break
            }
          }
        }
      }
    }

    return {
      act: curAct,
      step: curStep,
      elements,
      arrows,
      flies,
      rows,
      says,
      writtenLines,
      activeLine,
      prevLine,
      lineP: lineChangeEnd > lineChangeStart ? smooth(seg(t, lineChangeStart, lineChangeEnd - lineChangeStart)) : 1,
      prints,
      activeTitle,
      focusState,
      prevActSnapshot,
      clearFade,
      revealShiftP: revealStart >= 0 && curAct.kind === 'reveal' ? smooth(seg(t, revealStart, 0.8)) : 0,
      lastExitShift
    }
  }

  // ── 3. Automatic Layout Engine (ENGINE.md §3 — Zero Hardcoded Coords) ───
  function computeRegions(actKind, hasOutput, hasRows, revealShiftP, hasCode = true) {
    // 无代码模式的 trace 没有代码面板，和 analogy / pitfall 一样占满舞台
    if (actKind === 'trace' && !hasCode) actKind = 'pitfall'
    const stageTop = 86
    const stageBottom = 882
    const stageH = stageBottom - stageTop
    const marginX = 52

    if (actKind === 'hook') {
      if (hasOutput) {
        return {
          code:   { x: marginX + 30, y: stageTop + 56, w: 1120, h: stageH - 112 },
          output: { x: marginX + 1190, y: stageTop + 180, w: 600, h: 280 },
          stage:  { x: marginX, y: stageTop, w: 1920 - marginX * 2, h: stageH }
        }
      }
      return {
        code:   { x: 340, y: stageTop + 56, w: 1240, h: stageH - 112 },
        output: null,
        stage:  { x: marginX, y: stageTop, w: 1920 - marginX * 2, h: stageH }
      }
    }

    if (actKind === 'trace') {
      const codeW = Math.round((1920 - marginX * 2 - 36) * 0.45)
      const stageX = marginX + codeW + 36
      const stageW = 1920 - marginX - stageX
      const outH = hasOutput ? 176 : 0
      return {
        code:   { x: marginX, y: stageTop + 20, w: codeW, h: stageH - 40 },
        stage:  { x: stageX, y: stageTop + 20, w: stageW, h: stageH - 40 - (outH ? outH + 20 : 0) },
        output: hasOutput ? { x: stageX, y: stageBottom - 20 - outH, w: stageW, h: outH } : null
      }
    }

    if (actKind === 'reveal') {
      const tableW = 420
      const shift = hasRows ? lerp(0, tableW + 32, Math.max(revealShiftP, 0.0001)) : 0
      return {
        table: { x: marginX, y: stageTop + 44, w: tableW, h: 460 },
        stage: { x: marginX + shift, y: stageTop, w: 1920 - marginX * 2 - shift, h: stageH }
      }
    }

    if (actKind === 'recap') {
      return {
        table: { x: 180, y: stageTop + 90, w: 1560, h: 480 },
        title: { x: 420, y: stageTop + 625, w: 1080, h: 96 },
        stage: { x: marginX, y: stageTop, w: 1920 - marginX * 2, h: stageH }
      }
    }

    if (actKind === 'clarify') {
      const dialogW = 560
      const gapX = 28
      const stageW = 1920 - marginX * 2 - dialogW - gapX
      return {
        stage:  { x: marginX, y: stageTop, w: stageW, h: stageH },
        dialog: { x: marginX + stageW + gapX, y: stageTop + 12, w: dialogW, h: stageH - 24 }
      }
    }

    // analogy / pitfall: full stage
    return {
      stage: { x: marginX, y: stageTop, w: 1920 - marginX * 2, h: stageH }
    }
  }

  function boxSizeOf(el) {
    const s0 = el.fromSize ?? 1
    const s1 = el.size ?? 1
    return el.morphP < 1 ? lerp(s0, s1, smooth(el.morphP)) : s1
  }

  function interpSkin(a, b, p) {
    const s1 = SKINS[a] || SKINS.memory
    const s2 = SKINS[b] || SKINS.memory
    const m = smooth(p)
    return {
      w: lerp(s1.w, s2.w, m),
      h: lerp(s1.h, s2.h, m),
      radius: lerp(s1.radius, s2.radius, m),
      fill: mixHex(s1.fill, s2.fill, m),
      stroke: mixHex(s1.stroke, s2.stroke, m),
      strokeWidth: lerp(s1.strokeWidth, s2.strokeWidth, m),
      headerH: lerp(s1.headerH, s2.headerH, m),
      headerFill: mixHex(s1.headerFill, s2.headerFill, m),
      tilt: lerp(s1.tilt, s2.tilt, m),
      foldCorner: lerp(s1.foldCorner, s2.foldCorner, m),
      handle: lerp(s1.handle, s2.handle, m),
      slots: lerp(s1.slots, s2.slots, m),
      ticks: lerp(s1.ticks, s2.ticks, m),
      flap: lerp(s1.flap, s2.flap, m),
      wheels: lerp(s1.wheels, s2.wheels, m),
      rim: lerp(s1.rim, s2.rim, m),
      spine: lerp(s1.spine || 0, s2.spine || 0, m),
      headerAlign: lerp(s1.headerAlign || 0, s2.headerAlign || 0, m),
      grid4: lerp(s1.grid4 || 0, s2.grid4 || 0, m),
      topFold: lerp(s1.topFold || 0, s2.topFold || 0, m)
    }
  }

  /** Compute bounding boxes for all elements inside `stageRect` without overlap */
  function layoutStage(elements, arrows, stageRect) {
    const rects = new Map()
    const groups = []
    const zones = []
    const freeBoxes = []

    for (const el of elements.values()) {
      if (el.kind === 'group') groups.push(el)
      else if (el.kind === 'zone') zones.push(el)
      else if (el.kind === 'box' && !el.group) freeBoxes.push(el)
    }

    // Reserve right side for zones if present
    let availX = stageRect.x + 24
    let availW = stageRect.w - 48
    const availY = stageRect.y + 24
    const availH = stageRect.h - 48

    if (zones.length > 0) {
      const zoneW = Math.min(480, Math.round(availW * 0.34))
      const zoneGap = 24
      const zoneH = Math.min(340, Math.floor((availH - (zones.length - 1) * zoneGap) / zones.length))
      const totalZH = zones.length * zoneH + (zones.length - 1) * zoneGap
      const startZY = availY + (availH - totalZH) / 2
      zones.forEach((z, idx) => {
        rects.set(z.id, {
          x: stageRect.x + stageRect.w - 24 - zoneW,
          y: startZY + idx * (zoneH + zoneGap),
          w: zoneW,
          h: zoneH
        })
      })
      availW -= zoneW + 48
    }

    // Layout groups evenly left-to-right (if freeBoxes also exist, reserve bottom band for them)
    let boxAvailY = availY
    let boxAvailH = availH
    if (groups.length > 0) {
      const hasFree = freeBoxes.length > 0
      const grpAvailH = hasFree ? Math.round(availH * 0.56) : availH
      const gap = 36
      const colW = (availW - (groups.length - 1) * gap) / groups.length
      let maxGroupBottom = availY
      groups.forEach((g, gi) => {
        const gx = availX + gi * (colW + gap)
        const children = Array.from(elements.values()).filter((e) => e.kind === 'box' && e.group === g.id)
        const pad = 28
        const titleH = 54
        const innerW = colW - pad * 2
        const innerH = grpAvailH - titleH - pad * 2

        if (g.layout === 'column') {
          const hasCustomSize = children.some((c) => Math.abs(boxSizeOf(c) - 1) > 0.001)
          const hasV15Skin = children.some((c) => c.skin === 'segment' || c.skin === 'page' || c.fromSkin === 'segment' || c.fromSkin === 'page')
          if (!hasCustomSize && !hasV15Skin) {
            const itemGap = 58
            const maxH = children.length > 0 ? Math.min(144, (innerH - 36 - (children.length - 1) * itemGap) / children.length) : 140
            const boxW = Math.min(340, innerW)
            const totalH = children.length * maxH + Math.max(0, children.length - 1) * itemGap + 36
            const gh = Math.min(grpAvailH, Math.max(220, totalH + titleH + pad * 2))
            const gy = availY + (hasFree ? Math.max(0, (grpAvailH - gh) / 2) : (availH - gh) / 2)
            rects.set(g.id, { x: gx, y: gy, w: colW, h: gh })
            maxGroupBottom = Math.max(maxGroupBottom, gy + gh)
            children.forEach((ch, ci) => {
              rects.set(ch.id, {
                x: gx + (colW - boxW) / 2,
                y: gy + titleH + pad + ci * (maxH + itemGap),
                w: boxW,
                h: maxH
              })
            })
          } else {
            const anyName = children.some((c) => c.name || c.fromName)
            const itemGap = anyName ? 46 : 22
            const rawHs = children.map((ch) => {
              const sk = interpSkin(ch.fromSkin, ch.skin, ch.morphP)
              return sk.h * boxSizeOf(ch)
            })
            const sumRawH = rawHs.reduce((s, v) => s + v, 0)
            const totalGaps = Math.max(0, children.length - 1) * itemGap + (anyName ? 32 : 8)
            const availBoxH = Math.max(80, innerH - totalGaps)
            const vScale = sumRawH > availBoxH ? availBoxH / sumRawH : 1
            const totalH = sumRawH * vScale + totalGaps
            const gh = Math.min(grpAvailH, Math.max(220, totalH + titleH + pad * 2))
            const gy = availY + (hasFree ? Math.max(0, (grpAvailH - gh) / 2) : (availH - gh) / 2)
            rects.set(g.id, { x: gx, y: gy, w: colW, h: gh })
            maxGroupBottom = Math.max(maxGroupBottom, gy + gh)
            let cy = gy + titleH + pad + Math.max(0, (gh - titleH - pad * 2 - totalH) / 2)
            children.forEach((ch, ci) => {
              const sk = interpSkin(ch.fromSkin, ch.skin, ch.morphP)
              const bh = rawHs[ci] * vScale
              const isSquare = ch.skin === 'page' && ch.fromSkin === 'page'
              const bw = isSquare ? Math.min(bh, innerW) : Math.min(sk.w, innerW)
              rects.set(ch.id, { x: gx + (colW - bw) / 2, y: cy, w: bw, h: isSquare ? bw : bh })
              cy += (isSquare ? bw : bh) + itemGap
            })
          }
        } else {
          const hasArrowBetween = arrows.some((a) => children.some((c) => c.id === a.from) && children.some((c) => c.id === a.to))
          const itemGap = hasArrowBetween ? 84 : 26
          const rawW = children.reduce((s, c) => s + interpSkin(c.fromSkin, c.skin, c.morphP).w * boxSizeOf(c), 0) + Math.max(0, children.length - 1) * itemGap
          const scale = rawW > innerW ? innerW / rawW : 1
          const boxH = Math.min(220 * scale, Math.max(120, innerH - 40))
          const gh = Math.min(grpAvailH, Math.max(220, boxH + titleH + pad * 2 + 40))
          const gy = availY + (hasFree ? Math.max(0, (grpAvailH - gh) / 2) : (availH - gh) / 2)
          rects.set(g.id, { x: gx, y: gy, w: colW, h: gh })
          maxGroupBottom = Math.max(maxGroupBottom, gy + gh)
          let cx = gx + (colW - rawW * scale) / 2
          children.forEach((ch) => {
            const sk = interpSkin(ch.fromSkin, ch.skin, ch.morphP)
            const isSquare = ch.skin === 'page' && ch.fromSkin === 'page'
            let bw = sk.w * boxSizeOf(ch) * scale
            let bh = Math.min(sk.h * scale, boxH)
            if (isSquare) {
              const side = Math.min(bw, bh)
              bw = side
              bh = side
            }
            rects.set(ch.id, { x: cx, y: gy + titleH + pad + (boxH - bh) / 2, w: bw, h: bh })
            cx += bw + itemGap * scale
          })
        }
      })
      if (!hasFree) return rects
      boxAvailY = maxGroupBottom + 24
      boxAvailH = Math.max(120, availY + availH - boxAvailY)
    }

    // Layout ungrouped boxes strictly by explicit `place` (ENGINE.md §3 — NO arrow-based guessing!)
    const freeMap = new Map(freeBoxes.map((b) => [b.id, b]))
    const relMeta = new Map() // id -> { dir: 'below'|'above', targetId }
    for (const b of freeBoxes) {
      const pm = b.place ? /^(below|above):(.+)$/.exec(b.place) : null
      if (pm && freeMap.has(pm[2])) {
        relMeta.set(b.id, { dir: pm[1], targetId: pm[2] })
      }
    }

    // Resolve vertical level for every ungrouped box (supports arbitrary below/above chains)
    const boxLevel = new Map()
    const getLevel = (id, visiting = new Set()) => {
      if (boxLevel.has(id)) return boxLevel.get(id)
      if (visiting.has(id)) return 0
      visiting.add(id)
      const rel = relMeta.get(id)
      const lvl = rel ? getLevel(rel.targetId, visiting) + (rel.dir === 'below' ? 1 : -1) : 0
      boxLevel.set(id, lvl)
      return lvl
    }
    for (const b of freeBoxes) getLevel(b.id)

    const byLevel = new Map()
    for (const b of freeBoxes) {
      const lvl = boxLevel.get(b.id) || 0
      if (!byLevel.has(lvl)) byLevel.set(lvl, [])
      byLevel.get(lvl).push(b)
    }
    const levels = Array.from(byLevel.keys()).sort((a, b) => a - b)
    const rowMain = byLevel.get(0) || []

    // Reserve >= 84px gap when horizontal arrows connect boxes in the main row (ENGINE.md §3: >= 72px gap, >= 48px arrow)
    const mainIds = new Set(rowMain.map((b) => b.id))
    const hasMainHorizontalArrow = arrows.some((a) => mainIds.has(a.from) && mainIds.has(a.to))
    const hasVerticalArrow = arrows.some((a) => {
      const la = boxLevel.get(a.from)
      const lb = boxLevel.get(a.to)
      return la !== undefined && lb !== undefined && la !== lb
    })
    const gap = hasMainHorizontalArrow ? 88 : 36
    const rawMainW = rowMain.reduce((s, b) => s + interpSkin(b.fromSkin, b.skin, b.morphP).w * boxSizeOf(b), 0) + Math.max(0, rowMain.length - 1) * gap
    let scale1 = rawMainW > availW ? Math.max(0.5, availW / rawMainW) : 1

    const rawLevelH = new Map()
    for (const lvl of levels) {
      const mh = byLevel.get(lvl).reduce((m, b) => Math.max(m, interpSkin(b.fromSkin, b.skin, b.morphP).h), 0)
      rawLevelH.set(lvl, mh)
    }
    const bottomLevel = levels.length ? levels[levels.length - 1] : 0
    const bottomHasName = (byLevel.get(bottomLevel) || []).some((b) => b.name || b.fromName)
    const namePad = bottomHasName ? 42 : 0
    const baseRowGap = hasVerticalArrow ? 112 : 28
    const minRowGap = hasVerticalArrow ? 72 : 16
    const numGaps = Math.max(0, levels.length - 1)
    const sumRawH = levels.reduce((s, lvl) => s + rawLevelH.get(lvl), 0)

    let rowGap = baseRowGap
    let totalH = sumRawH * scale1 + numGaps * rowGap + namePad
    if (totalH > boxAvailH && sumRawH > 0) {
      const usableH = Math.max(80, boxAvailH - namePad)
      const vScale = Math.max(0.35, usableH / (sumRawH * scale1 + numGaps * baseRowGap))
      rowGap = Math.max(minRowGap, baseRowGap * vScale)
      const maxBoxH = Math.max(60, usableH - numGaps * rowGap)
      scale1 = Math.min(scale1, Math.max(0.35, maxBoxH / sumRawH))
      totalH = sumRawH * scale1 + numGaps * rowGap + namePad
    }

    const levelY = new Map()
    const levelH = new Map()
    let curY = boxAvailY + Math.max(4, (boxAvailH - totalH) / 2)
    for (const lvl of levels) {
      const lh = rawLevelH.get(lvl) * scale1
      levelY.set(lvl, curY)
      levelH.set(lvl, lh)
      curY += lh + rowGap
    }

    // Place level 0 (root row) horizontally centered
    let cx = availX + (availW - rawMainW * scale1) / 2
    const mainY = levelY.get(0) ?? availY
    const mainH = levelH.get(0) ?? 0
    for (const b of rowMain) {
      const sk = interpSkin(b.fromSkin, b.skin, b.morphP)
      const isSquare = b.skin === 'page' && b.fromSkin === 'page'
      let bw = sk.w * boxSizeOf(b) * scale1
      let bh = sk.h * scale1
      if (isSquare) {
        const side = Math.min(bw, bh)
        bw = side
        bh = side
      }
      rects.set(b.id, { x: cx, y: mainY + (mainH - bh) / 2, w: bw, h: bh })
      cx += bw + gap * scale1
    }

    // Place relative levels in order of distance from level 0 so targets are always placed first
    const relLevels = levels.filter((l) => l !== 0).sort((a, b) => Math.abs(a) - Math.abs(b) || a - b)
    for (const lvl of relLevels) {
      const placedSameLevel = []
      const ly = levelY.get(lvl)
      const lh = levelH.get(lvl)
      for (const b of byLevel.get(lvl)) {
        const sk = interpSkin(b.fromSkin, b.skin, b.morphP)
        const bw = sk.w * scale1
        const bh = sk.h * scale1
        const rel = relMeta.get(b.id)
        const tRect = rel ? rects.get(rel.targetId) : null
        let bx = tRect ? tRect.x + (tRect.w - bw) / 2 : availX + (availW - bw) / 2
        bx = Math.max(availX, Math.min(availX + availW - bw, bx))
        for (const p of placedSameLevel) {
          if (bx < p.x + p.w + 24 && bx + bw + 24 > p.x) bx = p.x + p.w + 24
        }
        const rect = { x: bx, y: ly + (lh - bh) / 2, w: bw, h: bh }
        placedSameLevel.push(rect)
        rects.set(b.id, rect)
      }
    }

    return rects
  }

  // ── Drawing Helpers ─────────────────────────────────────────────────────
  function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2))
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + w, y, x + w, y + h, rr)
    ctx.arcTo(x + w, y + h, x, y + h, rr)
    ctx.arcTo(x, y + h, x, y, rr)
    ctx.arcTo(x, y, x + w, y, rr)
    ctx.closePath()
  }

  function fillRoundRect(ctx, x, y, w, h, r, fill, stroke, lineWidth = 2) {
    roundRectPath(ctx, x, y, w, h, r)
    if (fill) { ctx.fillStyle = fill; ctx.fill() }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke() }
  }

  /**
   * Longest-match tokenizer driven strictly by spec.tokens -> spec.roles -> color (ENGINE.md §4).
   * Respects identifier boundaries so short tokens never match inside longer words.
   */
  const isIdentChar = (ch) => !!ch && /[A-Za-z0-9_]/.test(ch)

  function tokenizeBySpec(line, spec, highlightKeywords = true) {
    const tokenEntries = Object.entries(spec.tokens || {}).sort((a, b) => b[0].length - a[0].length)
    const keywords = new Set(['int', 'void', 'return', 'char', 'float', 'double', 'if', 'else', 'for', 'while', 'def', 'class', 'import', 'from', 'in', 'not', 'and', 'or', 'True', 'False', 'None', 'public', 'static', 'new', 'var', 'let', 'const', '#include'])
    const out = []
    let i = 0
    while (i < line.length) {
      let matched = null
      for (const [tok, role] of tokenEntries) {
        if (!tok) continue
        if (line.startsWith(tok, i)) {
          const prev = i > 0 ? line[i - 1] : ''
          const next = i + tok.length < line.length ? line[i + tok.length] : ''
          const startOk = !isIdentChar(tok[0]) || !isIdentChar(prev)
          const endOk = !isIdentChar(tok[tok.length - 1]) || !isIdentChar(next)
          if (startOk && endOk) {
            matched = { text: tok, color: roleColor(spec, role, THEME.ink), bold: true }
            break
          }
        }
      }
      if (matched) {
        out.push(matched)
        i += matched.text.length
        continue
      }

      // String literal
      if (line[i] === '"' || line[i] === "'") {
        const q = line[i]
        let j = i + 1
        while (j < line.length && line[j] !== q) {
          if (line[j] === '\\') j++
          j++
        }
        j = Math.min(line.length, j + 1)
        out.push({ text: line.slice(i, j), color: THEME.muted, bold: false })
        i = j
        continue
      }

      // Keyword / identifier
      if (highlightKeywords && (isIdentChar(line[i]) || line[i] === '#')) {
        let j = i + 1
        while (j < line.length && isIdentChar(line[j])) j++
        const word = line.slice(i, j)
        out.push({
          text: word,
          color: keywords.has(word) ? THEME.codeKeyword : THEME.ink,
          bold: false
        })
        i = j
        continue
      }

      out.push({ text: line[i], color: THEME.ink, bold: false })
      i++
    }
    return out
  }

  function drawTokenizedLine(ctx, line, x, y, fontSize, spec, charLimit = Infinity, fontFamily = FONT_MONO) {
    const tokens = tokenizeBySpec(line, spec, fontFamily === FONT_MONO)
    let cx = x
    let rem = charLimit
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    for (const tok of tokens) {
      if (rem <= 0) break
      const slice = rem >= tok.text.length ? tok.text : tok.text.slice(0, rem)
      rem -= slice.length
      ctx.font = `${tok.bold ? '700' : '500'} ${fontSize}px ${fontFamily}`
      ctx.fillStyle = tok.color
      ctx.fillText(slice, cx, y)
      cx += ctx.measureText(slice).width
    }
    return cx
  }

  /**
   * Non-overlapping sequential text swap (ENGINE.md §4):
   * Old text fades out + shifts up 8px in [0, 0.4]; new text fades in + rises from +8px in [0.6, 1.0].
   * At NO point do both texts coexist at > 0.3 alpha!
   */
  function drawSwappedText(ctx, oldText, newText, p, x, y, font, color, baseAlpha) {
    if (oldText === newText || p >= 1) {
      if (!newText) return
      ctx.save()
      ctx.globalAlpha = baseAlpha
      ctx.font = font
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(newText, x, y)
      ctx.restore()
      return
    }
    if (p < 0.4 && oldText) {
      const k = smooth(p / 0.4)
      ctx.save()
      ctx.globalAlpha = baseAlpha * (1 - k)
      ctx.font = font
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(oldText, x, y - 8 * k)
      ctx.restore()
    } else if (p > 0.6 && newText) {
      const k = smooth((p - 0.6) / 0.4)
      ctx.save()
      ctx.globalAlpha = baseAlpha * k
      ctx.font = font
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(newText, x, y + 8 * (1 - k))
      ctx.restore()
    }
  }

  function pointOnQuad(x0, y0, cx, cy, x1, y1, u) {
    const mu = 1 - u
    return {
      x: mu * mu * x0 + 2 * mu * u * cx + u * u * x1,
      y: mu * mu * y0 + 2 * mu * u * cy + u * u * y1
    }
  }

  function drawPartialArrow(ctx, x0, y0, cx, cy, x1, y1, p, color, lineWidth = 5, dashed = false) {
    const prog = clamp01(p)
    if (prog <= 0.005) return
    const steps = 44
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    if (dashed) ctx.setLineDash([14, 10])
    ctx.beginPath()
    for (let i = 0; i <= steps; i++) {
      const u = i / steps
      if (u > prog) break
      const pt = pointOnQuad(x0, y0, cx, cy, x1, y1, u)
      if (i === 0) ctx.moveTo(pt.x, pt.y)
      else ctx.lineTo(pt.x, pt.y)
    }
    const end = pointOnQuad(x0, y0, cx, cy, x1, y1, prog)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
    ctx.setLineDash([])

    const tx = 2 * (1 - prog) * (cx - x0) + 2 * prog * (x1 - cx)
    const ty = 2 * (1 - prog) * (cy - y0) + 2 * prog * (y1 - cy)
    const ang = Math.atan2(ty, tx)
    const headLen = 17 * Math.min(1, prog * 3)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(end.x, end.y)
    ctx.lineTo(end.x - headLen * Math.cos(ang - 0.42), end.y - headLen * Math.sin(ang - 0.42))
    ctx.lineTo(end.x - headLen * Math.cos(ang + 0.42), end.y - headLen * Math.sin(ang + 0.42))
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  function focusAlphaOf(focusState, id) {
    const curHas = focusState.ids && focusState.ids.length > 0
    const prevHas = focusState.prevIds && focusState.prevIds.length > 0
    const target = !curHas || focusState.ids.includes(id) ? 1 : 0.4
    const from = !prevHas || focusState.prevIds.includes(id) ? 1 : 0.4
    return lerp(from, target, focusState.p ?? 1)
  }

  // ── Draw Box (Unified Parameterized Skin Renderer) ──────────────────────
  function drawBox(ctx, el, rect, spec, t, baseAlpha, isFocused) {
    const sk = interpSkin(el.fromSkin, el.skin, el.morphP)
    const alpha = clamp01(baseAlpha * el.enterP * (1 - el.exitP))
    if (alpha <= 0.01) return

    const { x, y, w, h } = rect
    const liftY = (1 - el.enterP) * 20
    const rColor = el.role ? roleColor(spec, el.role, null) : null
    // Subtle breathing on focused border (±10% alpha, 2s period per ENGINE.md §4)
    const breathe = isFocused ? 0.9 + 0.1 * Math.sin(t * Math.PI) : 1
    // ENGINE.md §7: box.role tints border & header fill (12% role tint) on real skins; focus bolds border to 3.5
    const isRealNow = !ANALOGY_SKINS.has(el.skin)
    const roleTintP = rColor && isRealNow ? (ANALOGY_SKINS.has(el.fromSkin) && el.morphP < 1 ? smooth(el.morphP) : 1) : 0
    const strokeCol = el.broken ? THEME.danger : (roleTintP > 0.01 ? mixHex(sk.stroke, rColor, roleTintP) : sk.stroke)
    const headerBgCol = roleTintP > 0.01 ? mixHex(sk.headerFill, mixHex('#ffffff', rColor, 0.12), roleTintP) : sk.headerFill
    const borderW = isFocused ? (roleTintP > 0.01 ? 3.5 : sk.strokeWidth + 1) : sk.strokeWidth

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(x + w / 2, y + liftY + h / 2)
    if (Math.abs(sk.tilt) > 0.0005) ctx.rotate(sk.tilt)
    ctx.translate(-w / 2, -h / 2)

    ctx.shadowColor = rgba(THEME.ink, isFocused ? 0.12 : 0.07)
    ctx.shadowBlur = isFocused ? 22 : 16
    ctx.shadowOffsetY = 6

    // Main body polygon (supports bottom-right foldCorner and page top-right topFold interpolation)
    const fold = sk.foldCorner
    const topFold = sk.topFold || 0
    ctx.beginPath()
    if (fold > 1) {
      const rr = Math.min(sk.radius, 8)
      ctx.moveTo(rr, 0)
      ctx.lineTo(w - rr, 0)
      ctx.quadraticCurveTo(w, 0, w, rr)
      ctx.lineTo(w, h - fold)
      ctx.lineTo(w - fold, h)
      ctx.lineTo(rr, h)
      ctx.quadraticCurveTo(0, h, 0, h - rr)
      ctx.lineTo(0, rr)
      ctx.quadraticCurveTo(0, 0, rr, 0)
    } else if (topFold > 1) {
      const rr = Math.min(sk.radius, 8)
      ctx.moveTo(rr, 0)
      ctx.lineTo(w - topFold, 0)
      ctx.lineTo(w, topFold)
      ctx.lineTo(w, h - rr)
      ctx.quadraticCurveTo(w, h, w - rr, h)
      ctx.lineTo(rr, h)
      ctx.quadraticCurveTo(0, h, 0, h - rr)
      ctx.lineTo(0, rr)
      ctx.quadraticCurveTo(0, 0, rr, 0)
    } else {
      roundRectPath(ctx, 0, 0, w, h, sk.radius)
    }
    ctx.closePath()
    ctx.fillStyle = sk.fill
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.strokeStyle = rgba(strokeCol, breathe)
    ctx.lineWidth = borderW
    ctx.stroke()

    // Dog-ear triangle (note bottom-right)
    if (fold > 1) {
      ctx.beginPath()
      ctx.moveTo(w - fold, h)
      ctx.lineTo(w - fold, h - fold)
      ctx.lineTo(w, h - fold)
      ctx.closePath()
      ctx.fillStyle = '#ead89b'
      ctx.fill()
      ctx.strokeStyle = strokeCol
      ctx.lineWidth = 1.8
      ctx.stroke()
    }

    // Header band (for tag)
    const hasHeader = el.tag || el.fromTag
    const hh = hasHeader ? Math.min(sk.headerH, h * 0.34) : 0
    if (hh > 0) {
      ctx.save()
      roundRectPath(ctx, 0, 0, w, h, sk.radius)
      ctx.clip()
      ctx.fillStyle = headerBgCol
      ctx.fillRect(0, 0, w, hh)
      ctx.strokeStyle = rgba(strokeCol, 0.35)
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, hh)
      ctx.lineTo(w, hh)
      ctx.stroke()
      ctx.restore()
    }

    // Segment left vertical spine strip (ENGINE.md §7: 8px role-colored book spine)
    if (sk.spine > 0.5) {
      ctx.save()
      roundRectPath(ctx, 0, 0, w, h, sk.radius)
      ctx.clip()
      ctx.fillStyle = rColor || ROLE_COLORS.blue
      ctx.fillRect(0, 0, sk.spine, h)
      ctx.restore()
    }

    // Page faint 4x4 internal grid lines + top-right fold triangle (ENGINE.md §7)
    if (sk.grid4 > 0.05) {
      ctx.save()
      ctx.globalAlpha = alpha * sk.grid4 * 0.16
      ctx.strokeStyle = rColor || THEME.muted
      ctx.lineWidth = 1.2
      const gx0 = 6, gy0 = hh + 4, gw = w - 12, gh2 = h - hh - 8
      for (let i = 1; i < 4; i++) {
        ctx.beginPath()
        ctx.moveTo(gx0 + (gw / 4) * i, gy0)
        ctx.lineTo(gx0 + (gw / 4) * i, gy0 + gh2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(gx0, gy0 + (gh2 / 4) * i)
        ctx.lineTo(gx0 + gw, gy0 + (gh2 / 4) * i)
        ctx.stroke()
      }
      ctx.restore()
    }
    if (topFold > 1) {
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(w - topFold, 0)
      ctx.lineTo(w - topFold, topFold)
      ctx.lineTo(w, topFold)
      ctx.closePath()
      ctx.fillStyle = mixHex('#ffffff', strokeCol, 0.22)
      ctx.fill()
      ctx.strokeStyle = rgba(strokeCol, 0.7)
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.restore()
    }

    // Skin decorative parameters (smoothly interpolated during morph!)
    if (sk.slots > 0.05) {
      ctx.save()
      ctx.globalAlpha = alpha * clamp01(sk.slots / 3)
      ctx.fillStyle = '#bba887'
      for (let i = 0; i < 3; i++) {
        roundRectPath(ctx, 24, hh + 14 + i * 10, w - 48, 4, 2)
        ctx.fill()
      }
      ctx.restore()
    }
    if (sk.handle > 0.02) {
      ctx.save()
      ctx.globalAlpha = alpha * sk.handle
      fillRoundRect(ctx, w - 22, h * 0.54, 9, Math.min(40, h * 0.22), 4.5, '#b69767', null)
      ctx.restore()
    }
    if (sk.ticks > 0.05) {
      ctx.save()
      ctx.globalAlpha = alpha * clamp01(sk.ticks / 4) * 0.45
      ctx.strokeStyle = THEME.border
      ctx.lineWidth = 1.5
      for (let i = 1; i < 4; i++) {
        const bx = (w / 4) * i
        ctx.beginPath()
        ctx.moveTo(bx, h - 12)
        ctx.lineTo(bx, h)
        ctx.stroke()
      }
      ctx.restore()
    }
    if (sk.flap > 0.02) {
      ctx.save()
      ctx.globalAlpha = alpha * sk.flap * 0.55
      ctx.strokeStyle = sk.stroke
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(4, hh + 2)
      ctx.lineTo(w / 2, hh + 38)
      ctx.lineTo(w - 4, hh + 2)
      ctx.stroke()
      ctx.restore()
    }
    if (sk.wheels > 0.02) {
      ctx.save()
      ctx.globalAlpha = alpha * sk.wheels
      ctx.fillStyle = '#5f5e5a'
      ctx.beginPath()
      ctx.arc(44, h + 4, 12, 0, Math.PI * 2)
      ctx.arc(w - 44, h + 4, 12, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    if (sk.rim > 0.02) {
      ctx.save()
      ctx.globalAlpha = alpha * sk.rim
      fillRoundRect(ctx, -6, -4, w + 12, 12, 6, sk.stroke, null)
      ctx.restore()
    }

    // Tag text (top header): analogy skin headers use neutral ink unless matching tokens (ENGINE.md §6)
    const tagP = el.morphP < 1 ? el.morphP : el.setP
    if (hh > 0) {
      const tagColorFor = (skinName, txt) => {
        if (txt && spec.tokens && spec.tokens[txt]) return roleColor(spec, spec.tokens[txt], THEME.muted)
        if (ANALOGY_SKINS.has(skinName)) return THEME.muted
        if (txt && /^0x[0-9a-f]+$/i.test(txt) && spec.roles && spec.roles.address) return roleColor(spec, 'address', THEME.muted)
        return rColor || THEME.muted
      }
      const fromCol = tagColorFor(el.fromSkin, el.fromTag)
      const toCol = tagColorFor(el.skin, el.tag)
      const tagColor = el.morphP < 1 ? mixHex(fromCol, toCol, smooth(el.morphP)) : toCol
      const tagFont = `700 ${Math.max(24, Math.min(30, Math.floor(w / 9)))}px ${FONT_MONO}`
      if (sk.headerAlign > 0.5) {
        // Left-aligned header for segment skin (ENGINE.md §7)
        const tx = Math.round(sk.spine + 16)
        ctx.save()
        ctx.font = tagFont
        ctx.fillStyle = tagColor
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        if (tagP >= 1 || el.fromTag === el.tag) {
          ctx.globalAlpha = alpha
          ctx.fillText(el.tag || '', tx, hh / 2 + 1)
        } else if (tagP < 0.4) {
          const k = clamp01(tagP / 0.4)
          ctx.globalAlpha = alpha * (1 - k)
          ctx.fillText(el.fromTag || '', tx, hh / 2 + 1 - 8 * k)
        } else if (tagP > 0.6) {
          const k = clamp01((tagP - 0.6) / 0.4)
          ctx.globalAlpha = alpha * k
          ctx.fillText(el.tag || '', tx, hh / 2 + 1 + 8 * (1 - k))
        }
        ctx.restore()
      } else {
        drawSwappedText(ctx, el.fromTag, el.tag, tagP, w / 2, hh / 2 + 1, tagFont, tagColor, alpha)
      }
    }

    // Value text (center): auto-fit inside box width so longer values never overflow borders
    const valCenterY = hh + (h - hh) * 0.52
    const valText = el.value || ''
    const fitValText = el.morphP < 1 && el.fromValue && charLen(el.fromValue) > charLen(valText) ? el.fromValue : valText
    let valFontSize = Math.min(58, Math.max(24, Math.floor((w - 24) / Math.max(2.6, charLen(fitValText) * 0.62))))
    if (fitValText) {
      ctx.font = `700 ${valFontSize}px ${FONT_MONO}`
      while (valFontSize > 20 && ctx.measureText(fitValText).width > w - 20) {
        valFontSize -= 2
        ctx.font = `700 ${valFontSize}px ${FONT_MONO}`
      }
    }
    const valFont = `700 ${valFontSize}px ${FONT_MONO}`
    const valColor = el.role ? roleColor(spec, el.role, THEME.ink) : THEME.ink

    if (el.morphP < 1) {
      drawSwappedText(ctx, el.fromValue, el.value, el.morphP, w / 2, valCenterY, valFont, valColor, alpha)
    } else if (el.setP < 1 && el.fromValue !== el.value) {
      // Smooth vertical roll for set op
      const k = smooth(el.setP)
      ctx.save()
      roundRectPath(ctx, 8, hh + 6, w - 16, h - hh - 12, 6)
      ctx.clip()
      ctx.font = valFont
      ctx.fillStyle = valColor
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.globalAlpha = alpha * (1 - k)
      ctx.fillText(el.fromValue, w / 2, valCenterY - k * 46)
      ctx.globalAlpha = alpha * k
      ctx.fillText(el.value, w / 2, valCenterY + (1 - k) * 46)
      ctx.restore()
    } else if (valText) {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.font = valFont
      ctx.fillStyle = valColor
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(valText, w / 2, valCenterY)
      ctx.restore()
    }

    // Name text (below box): sequential swap during morph/set
    if (el.name || el.fromName) {
      const nameFont = `700 28px ${FONT_MONO}`
      drawSwappedText(ctx, el.fromName, el.name, tagP, w / 2, h + 28, nameFont, THEME.ink, alpha)
    }

    // Break overlay (cracks + red X badge)
    if (el.broken) {
      drawBreakOverlay(ctx, 0, 0, w, h, el.broken.text, el.broken.p, alpha)
    }

    ctx.restore()
  }

  function drawBreakOverlay(ctx, x, y, w, h, text, p, alpha) {
    const cx = x + w / 2, cy = y + h * 0.48
    const cracks = [
      [[cx, cy], [cx - w * 0.18, cy - h * 0.14], [cx - w * 0.34, cy - h * 0.06]],
      [[cx, cy], [cx + w * 0.2, cy - h * 0.18], [cx + w * 0.36, cy - h * 0.1]],
      [[cx, cy], [cx - w * 0.14, cy + h * 0.2], [cx - w * 0.26, cy + h * 0.34]],
      [[cx, cy], [cx + w * 0.18, cy + h * 0.18], [cx + w * 0.32, cy + h * 0.32]]
    ]
    ctx.save()
    ctx.globalAlpha = alpha * p
    ctx.strokeStyle = THEME.danger
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    for (const poly of cracks) {
      ctx.beginPath()
      ctx.moveTo(poly[0][0], poly[0][1])
      for (let k = 1; k < poly.length; k++) {
        const sp = clamp01(p * 2 - (k - 1))
        if (sp <= 0) break
        ctx.lineTo(lerp(poly[k - 1][0], poly[k][0], sp), lerp(poly[k - 1][1], poly[k][1], sp))
      }
      ctx.stroke()
    }
    let badgeSize = 26
    ctx.font = `700 ${badgeSize}px ${FONT_MONO}`
    const badgeLabel = `✕ ${text}`
    while (badgeSize > 15 && ctx.measureText(badgeLabel).width > w - 36) {
      badgeSize -= 2
      ctx.font = `700 ${badgeSize}px ${FONT_MONO}`
    }
    const tw = Math.min(w - 16, ctx.measureText(badgeLabel).width + 28)
    // 标签骑在格子下边框上：不盖住中间的 value（2026-11-21「放不下」盖住了「要0x400」）
    const by = y + h - 23
    fillRoundRect(ctx, cx - tw / 2, by, tw, 46, 10, THEME.danger, null)
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(badgeLabel, cx, by + 24)
    ctx.restore()
  }

  function drawZone(ctx, el, rect, alpha) {
    const a = clamp01(alpha * el.enterP * (1 - el.exitP))
    if (a <= 0.01) return
    const isDanger = el.tone === 'danger'
    const stroke = isDanger ? THEME.danger : THEME.border
    const bg = isDanger ? '#fdecec' : '#eceae3'
    const shake = el.broken && el.broken.p > 0 && el.broken.p < 1 ? Math.sin(el.broken.p * Math.PI * 6) * (1 - el.broken.p) * 12 : 0

    ctx.save()
    ctx.globalAlpha = a
    ctx.translate(shake, (1 - el.enterP) * 16)
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16, bg, stroke, 3)

    // Subtle diagonal stripes
    ctx.save()
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 16)
    ctx.clip()
    ctx.strokeStyle = rgba(stroke, isDanger ? 0.14 : 0.08)
    ctx.lineWidth = 18
    for (let sx = -rect.h; sx < rect.w + rect.h; sx += 54) {
      ctx.beginPath()
      ctx.moveTo(rect.x + sx, rect.y)
      ctx.lineTo(rect.x + sx + rect.h, rect.y + rect.h)
      ctx.stroke()
    }
    ctx.restore()

    ctx.font = `700 34px ${FONT_SANS}`
    ctx.fillStyle = isDanger ? THEME.danger : THEME.muted
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(el.title, rect.x + rect.w / 2, rect.y + rect.h * 0.34)

    if (el.broken) {
      drawBreakOverlay(ctx, rect.x, rect.y, rect.w, rect.h, el.broken.text, el.broken.p, a)
    }
    ctx.restore()
  }

  function drawGroup(ctx, el, rect, alpha) {
    const a = clamp01(alpha * el.enterP * (1 - el.exitP))
    if (a <= 0.01) return
    ctx.save()
    ctx.globalAlpha = a
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16, rgba(THEME.surface, 0.75), THEME.border, 2)
    ctx.font = `700 26px ${FONT_SANS}`
    ctx.fillStyle = THEME.muted
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(el.title, rect.x + 24, rect.y + 30)
    ctx.restore()
  }

  function drawCodePanel(ctx, rect, spec, state, alpha) {
    const lines = spec.code.lines
    const isHook = state.act.kind === 'hook'
    const lineCount = lines.length
    const headerH = 52
    const availH = rect.h - headerH - 36
    const lineH = Math.min(72, Math.max(42, Math.floor(availH / Math.max(1, lineCount))))
    let fontSize = Math.max(30, Math.min(36, Math.floor(lineH * 0.56)))
    const maxCodeW = rect.w - 114
    const longestLine = lines.reduce((a, b) => (b.length > a.length ? b : a), '')
    if (longestLine) {
      ctx.font = `700 ${fontSize}px ${FONT_MONO}`
      while (fontSize > 22 && ctx.measureText(longestLine).width > maxCodeW) {
        fontSize -= 1
        ctx.font = `700 ${fontSize}px ${FONT_MONO}`
      }
    }

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.shadowColor = rgba(THEME.ink, 0.07)
    ctx.shadowBlur = 22
    ctx.shadowOffsetY = 6
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16, THEME.surface, THEME.border, 2)
    ctx.shadowColor = 'transparent'

    fillRoundRect(ctx, rect.x, rect.y, rect.w, headerH, 16, '#efede6', null)
    ctx.fillRect(rect.x, rect.y + headerH - 16, rect.w, 16)
    ctx.font = `600 24px ${FONT_MONO}`
    ctx.fillStyle = THEME.muted
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`code.${spec.code.lang}`, rect.x + 26, rect.y + headerH / 2 + 1)

    const startY = rect.y + headerH + 22 + lineH / 2

    // Highlight bar in trace
    if (!isHook && state.activeLine !== null) {
      const hlIdx = lerp((state.prevLine || state.activeLine) - 1, state.activeLine - 1, state.lineP)
      const hlY = startY + hlIdx * lineH
      fillRoundRect(ctx, rect.x + 16, hlY - lineH * 0.42, rect.w - 32, lineH * 0.84, 10, rgba(ROLE_COLORS.orange, 0.11), rgba(ROLE_COLORS.orange, 0.42), 1.5)
      ctx.fillStyle = ROLE_COLORS.orange
      ctx.beginPath()
      ctx.moveTo(rect.x + 24, hlY - 7)
      ctx.lineTo(rect.x + 36, hlY)
      ctx.lineTo(rect.x + 24, hlY + 7)
      ctx.closePath()
      ctx.fill()
    }

    for (let i = 0; i < lineCount; i++) {
      const lineNo = i + 1
      const ly = startY + i * lineH
      let charLimit = Infinity
      if (isHook) {
        const wState = state.writtenLines.get(lineNo)
        if (!wState) continue
        charLimit = Math.ceil(lines[i].length * wState.p)
        if (wState.active) {
          fillRoundRect(ctx, rect.x + 16, ly - lineH * 0.42, rect.w - 32, lineH * 0.84, 10, rgba(ROLE_COLORS.orange, 0.08), null)
        }
      }
      ctx.font = `500 24px ${FONT_MONO}`
      ctx.fillStyle = rgba(THEME.muted, 0.55)
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(lineNo), rect.x + 70, ly)
      drawTokenizedLine(ctx, lines[i], rect.x + 90, ly, fontSize, spec, charLimit, FONT_MONO)
    }

    ctx.restore()
  }

  function drawOutputPanel(ctx, rect, prints, alpha) {
    ctx.save()
    ctx.globalAlpha = alpha
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14, '#1f2328', '#30363d', 2)
    ctx.font = `600 22px ${FONT_MONO}`
    ctx.fillStyle = '#8b949e'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('终端输出', rect.x + 24, rect.y + 32)

    const startY = rect.y + 78
    const gap = Math.min(44, Math.floor((rect.h - 70) / Math.max(1, prints.length)))
    prints.forEach((pr, idx) => {
      ctx.save()
      ctx.globalAlpha = alpha * pr.p
      ctx.font = `700 ${Math.min(44, Math.max(30, gap - 4))}px ${FONT_MONO}`
      ctx.fillStyle = '#7ee787'
      ctx.fillText(`> ${pr.text}`, rect.x + 28, startY + idx * gap)
      ctx.restore()
    })
    ctx.restore()
  }

  function drawMappingTable(ctx, rect, rows, spec, isRecap, alpha) {
    if (!rows.length) return
    const cols = rows[0].cells.length
    const headH = isRecap ? 68 : 52
    // recap 行高随行数收缩，4 行也不出表（2026-11-21 分段/分页片第 4 行被裁）
    const rowH = isRecap ? Math.min(110, Math.floor((rect.h - headH - 18) / rows.length)) : 72
    const totalH = Math.min(rect.h, headH + rows.length * rowH + 18)

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.shadowColor = rgba(THEME.ink, 0.07)
    ctx.shadowBlur = 20
    ctx.shadowOffsetY = 6
    fillRoundRect(ctx, rect.x, rect.y, rect.w, totalH, 16, THEME.surface, THEME.border, 2)
    ctx.shadowColor = 'transparent'

    fillRoundRect(ctx, rect.x, rect.y, rect.w, headH, 16, '#efede6', null)
    ctx.fillRect(rect.x, rect.y + headH - 16, rect.w, 16)

    ctx.textBaseline = 'middle'
    if (isRecap) {
      // 对比型主题用 spec.recapHeads（如 维度 | 分段 | 分页），且不画「↔」——两栏是对立不是等价
      const contrast = Array.isArray(spec.recapHeads)
      const headers = contrast ? spec.recapHeads : cols === 3 ? ['类比', '真实概念', '代码写法'] : ['类比', '真实概念']
      const colXs = cols === 3
        ? [rect.x + rect.w * 0.2, rect.x + rect.w * 0.52, rect.x + rect.w * 0.83]
        : [rect.x + rect.w * 0.28, rect.x + rect.w * 0.72]
      ctx.font = `700 32px ${FONT_SANS}`
      ctx.fillStyle = THEME.muted
      ctx.textAlign = 'center'
      headers.forEach((h, i) => ctx.fillText(h, colXs[i], rect.y + headH / 2 + 1))

      rows.forEach((r, ri) => {
        const ry = rect.y + headH + 8 + ri * rowH
        const midY = ry + rowH / 2
        ctx.save()
        ctx.globalAlpha = alpha * r.p
        ctx.translate(0, (1 - r.p) * 14)
        if (ri > 0) {
          ctx.strokeStyle = THEME.border
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(rect.x + 32, ry)
          ctx.lineTo(rect.x + rect.w - 32, ry)
          ctx.stroke()
        }
        r.cells.forEach((cell, ci) => {
          const tokRole = spec.tokens && spec.tokens[cell.trim()]
          const color = tokRole ? roleColor(spec, tokRole, THEME.ink) : THEME.ink
          if (tokRole) {
            ctx.font = `700 38px ${FONT_MONO}`
            const cw = Math.max(150, ctx.measureText(cell).width + 56)
            fillRoundRect(ctx, colXs[ci] - cw / 2, midY - 32, cw, 64, 14, rgba(color, 0.12), color, 2.5)
            ctx.fillStyle = color
            ctx.textAlign = 'center'
            ctx.fillText(cell, colXs[ci], midY + 1)
          } else {
            ctx.font = `${ci === 1 ? '700' : '600'} 34px ${FONT_SANS}`
            ctx.fillStyle = THEME.ink
            ctx.textAlign = 'center'
            ctx.fillText(cell, colXs[ci], midY)
          }
        })
        if (cols === 3 && !contrast) {
          ctx.font = `600 32px ${FONT_SANS}`
          ctx.fillStyle = rgba(THEME.muted, 0.55)
          ctx.textAlign = 'center'
          ctx.fillText('↔', (colXs[0] + colXs[1]) / 2, midY)
          ctx.fillText('↔', (colXs[1] + colXs[2]) / 2, midY)
        }
        ctx.restore()
      })
    } else {
      ctx.font = `700 24px ${FONT_SANS}`
      ctx.fillStyle = THEME.muted
      ctx.textAlign = 'left'
      ctx.fillText('概念对照', rect.x + 22, rect.y + headH / 2 + 1)

      rows.forEach((r, ri) => {
        const ry = rect.y + headH + 8 + ri * rowH
        const midY = ry + (rowH - 8) / 2
        ctx.save()
        ctx.globalAlpha = alpha * r.p
        const isLast = ri === rows.length - 1
        // Color by any token matched in right cell
        const rightCell = r.cells[1] || ''
        const toks = tokenizeBySpec(rightCell, spec, false)
        const accentTok = toks.find((tk) => tk.bold)
        const accentColor = accentTok ? accentTok.color : THEME.ink
        if (isLast) {
          fillRoundRect(ctx, rect.x + 12, ry, rect.w - 24, rowH - 10, 10, rgba(accentColor, 0.1), rgba(accentColor, 0.35), 1.5)
        }
        ctx.font = `600 24px ${FONT_SANS}`
        ctx.fillStyle = THEME.muted
        ctx.textAlign = 'left'
        ctx.fillText(r.cells[0] || '', rect.x + 20, midY)
        ctx.fillStyle = THEME.border
        ctx.textAlign = 'center'
        ctx.fillText('→', rect.x + 150, midY)
        const maxRightW = rect.w - 196
        ctx.font = `600 24px ${FONT_SANS}`
        const rightW = ctx.measureText(rightCell).width
        const rightFont = rightW > maxRightW ? Math.max(18, Math.floor(24 * maxRightW / rightW)) : 24
        drawTokenizedLine(ctx, rightCell, rect.x + 174, midY, rightFont, spec, Infinity, FONT_SANS)
        ctx.restore()
      })
    }
    ctx.restore()
  }

  function drawTitleCard(ctx, titleObj, region, alpha) {
    if (!titleObj) return
    ctx.save()
    ctx.globalAlpha = alpha * titleObj.p
    const cy = region ? region.y + region.h / 2 : 440
    const shiftY = (1 - titleObj.p) * 18
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (region) {
      fillRoundRect(ctx, region.x, region.y + shiftY, region.w, region.h, 48, THEME.surface, ROLE_COLORS.teal, 3)
      ctx.font = `700 40px ${FONT_SANS}`
      ctx.fillStyle = THEME.ink
      ctx.fillText(titleObj.text, region.x + region.w / 2, cy + shiftY)
    } else {
      ctx.font = `700 68px ${FONT_SANS}`
      ctx.fillStyle = THEME.ink
      ctx.fillText(titleObj.text, 960, cy + shiftY)
      if (titleObj.sub) {
        ctx.font = `500 34px ${FONT_SANS}`
        ctx.fillStyle = THEME.muted
        ctx.fillText(titleObj.sub, 960, cy + 78 + shiftY)
      }
    }
    ctx.restore()
  }

  function drawTopChrome(ctx, spec, tl, curAct, t) {
    const W = 1920
    const progress = clamp01(t / tl.duration)
    ctx.fillStyle = rgba(THEME.border, 0.7)
    ctx.fillRect(0, 0, W, 5)
    ctx.fillStyle = ROLE_COLORS.teal
    ctx.fillRect(0, 0, W * progress, 5)

    // Left act pill
    const pillText = `第 ${curAct.index} / ${tl.acts.length} 幕 · ${curAct.title}`
    ctx.font = `600 24px ${FONT_SANS}`
    const tw = ctx.measureText(pillText).width
    fillRoundRect(ctx, 48, 20, tw + 36, 42, 21, rgba(THEME.surface, 0.94), THEME.border, 1.5)
    ctx.fillStyle = THEME.muted
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(pillText, 66, 42)

    // Right role legend pills dynamically generated from spec.roles
    const roleEntries = Object.entries(spec.roles || {})
    let rx = W - 48
    ctx.font = `600 22px ${FONT_SANS}`
    for (let i = roleEntries.length - 1; i >= 0; i--) {
      const [, rv] = roleEntries[i]
      const col = ROLE_COLORS[rv.color] || THEME.ink
      const lw = ctx.measureText(rv.label).width + 46
      rx -= lw
      fillRoundRect(ctx, rx, 22, lw, 38, 19, rgba(THEME.surface, 0.92), rgba(col, 0.35), 1.5)
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.arc(rx + 20, 41, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = THEME.ink
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(rv.label, rx + 34, 42)
      rx -= 12
    }
  }

  /** Rich subtitle bar strictly in bottom safe zone y in [900, 1080] */
  function drawSubtitle(ctx, spec, step, t) {
    if (!step || !step.caption) return
    const inA = smooth(seg(t, step.start, 0.22))
    const outA = 1 - easeIn(seg(t, step.end - 0.18, 0.18))
    const alpha = Math.min(inA, outA)
    if (alpha <= 0.01) return

    // Parse {role:text} tags strictly from spec.roles
    const re = /\{([A-Za-z0-9_-]+):([^}]*)\}/g
    const parts = []
    let last = 0
    let m
    while ((m = re.exec(step.caption)) !== null) {
      if (m.index > last) parts.push({ text: step.caption.slice(last, m.index), code: false, color: THEME.ink })
      parts.push({ text: m[2], code: true, color: roleColor(spec, m[1], THEME.ink) })
      last = m.index + m[0].length
    }
    if (last < step.caption.length) parts.push({ text: step.caption.slice(last), code: false, color: THEME.ink })

    let totalW = 0
    for (const part of parts) {
      ctx.font = part.code ? `700 36px ${FONT_MONO}` : `600 38px ${FONT_SANS}`
      part.w = ctx.measureText(part.text).width + (part.code ? 14 : 0)
      totalW += part.w
    }

    const padX = 44
    const boxW = Math.min(1800, totalW + padX * 2)
    const boxH = 84
    const bx = (1920 - boxW) / 2
    const by = 990 - boxH / 2 + (1 - inA) * 10

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.shadowColor = rgba(THEME.ink, 0.08)
    ctx.shadowBlur = 20
    ctx.shadowOffsetY = 6
    fillRoundRect(ctx, bx, by, boxW, boxH, 20, rgba(THEME.surface, 0.96), THEME.border, 1.5)
    ctx.shadowColor = 'transparent'

    let cx = (1920 - totalW) / 2
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    for (const part of parts) {
      if (part.code) {
        fillRoundRect(ctx, cx, by + 16, part.w, boxH - 32, 8, rgba(part.color, 0.12), null)
        ctx.font = `700 36px ${FONT_MONO}`
        ctx.fillStyle = part.color
        ctx.fillText(part.text, cx + 7, by + boxH / 2 + 1)
      } else {
        ctx.font = `600 38px ${FONT_SANS}`
        ctx.fillStyle = part.color
        ctx.fillText(part.text, cx, by + boxH / 2 + 1)
      }
      cx += part.w
    }
    ctx.restore()
  }

  /** Wrap CJK/Latin text cleanly to fit `maxW` pixels */
  function wrapDialogText(ctx, text, maxW) {
    const lines = []
    let cur = ''
    for (const ch of Array.from(String(text || ''))) {
      const next = cur + ch
      if (cur && ctx.measureText(next).width > maxW) {
        lines.push(cur)
        cur = ch
      } else {
        cur = next
      }
    }
    if (cur) lines.push(cur)
    return lines
  }

  /** Clarify act right-side dialog panel (ENGINE.md §7: 560px wide, student left / teacher right, max 4 visible) */
  function drawDialogPanel(ctx, rect, says, spec, alpha) {
    if (!rect) return
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.shadowColor = rgba(THEME.ink, 0.06)
    ctx.shadowBlur = 18
    ctx.shadowOffsetY = 4
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, 18, rgba(THEME.surface, 0.88), THEME.border, 1.8)
    ctx.shadowColor = 'transparent'

    // Header bar
    const headH = 48
    fillRoundRect(ctx, rect.x, rect.y, rect.w, headH, 18, '#efede6', null)
    ctx.fillRect(rect.x, rect.y + headH - 18, rect.w, 18)
    ctx.font = `700 24px ${FONT_SANS}`
    ctx.fillStyle = THEME.muted
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('辨析对话', rect.x + 24, rect.y + headH / 2 + 1)

    if (!says || says.length === 0) {
      ctx.restore()
      return
    }

    // 老师气泡用中性墨色，不借任何角色色：角色色代表概念（如蓝 = 分段），借用会让观众以为老师在说分段
    const teacherAccent = THEME.ink

    // Clip bubble area
    ctx.save()
    roundRectPath(ctx, rect.x + 4, rect.y + headH + 4, rect.w - 8, rect.h - headH - 8, 14)
    ctx.clip()

    const maxVisible = 4
    const visible = says.slice(-maxVisible)
    const newest = visible[visible.length - 1]
    const overflowMsg = says.length > maxVisible ? says[says.length - maxVisible - 1] : null

    const padX = 20
    const avatarR = 22
    const avatarGap = 14
    const maxBubbleTextW = rect.w - padX * 2 - avatarR * 2 - avatarGap - 56
    const fontSize = 25
    const lineH = 34
    const bubbleGap = 20

    ctx.font = `600 ${fontSize}px ${FONT_SANS}`
    const measureMsg = (m) => {
      const lines = wrapDialogText(ctx, m.text, maxBubbleTextW)
      const textW = lines.reduce((mx, ln) => Math.max(mx, ctx.measureText(ln).width), 0)
      const bw = Math.min(maxBubbleTextW + 34, Math.max(120, textW + 34))
      const bh = Math.max(58, lines.length * lineH + 24)
      return { msg: m, lines, bw, bh }
    }

    const items = visible.map(measureMsg)
    const newestItem = items[items.length - 1]
    // Older bubbles slide upward smoothly as newest enters (p: 0 -> 1)
    const pushOffset = (1 - newest.p) * (newestItem.bh + bubbleGap)

    const renderList = overflowMsg ? [{ ...measureMsg(overflowMsg), fadeOut: 1 - newest.p }, ...items] : items
    const totalH = items.reduce((s, it) => s + it.bh, 0) + Math.max(0, items.length - 1) * bubbleGap
    const areaTop = rect.y + headH + 24
    const areaH = rect.h - headH - 48
    let baseY = areaTop + Math.max(0, (areaH - totalH) / 2) + pushOffset
    if (overflowMsg) baseY -= (renderList[0].bh + bubbleGap)

    renderList.forEach((it, idx) => {
      const isNewest = idx === renderList.length - 1
      const m = it.msg
      const isStudent = m.who === 'student'
      const msgAlpha = it.fadeOut !== undefined ? it.fadeOut : (isNewest ? m.p : 1)
      if (msgAlpha <= 0.01) {
        baseY += it.bh + bubbleGap
        return
      }
      const slideY = isNewest ? (1 - m.p) * 16 : 0
      const y = baseY + slideY

      ctx.save()
      ctx.globalAlpha = alpha * msgAlpha

      const avCx = isStudent ? (rect.x + padX + avatarR) : (rect.x + rect.w - padX - avatarR)
      const avCy = y + 26
      // Avatar circle
      ctx.beginPath()
      ctx.arc(avCx, avCy, avatarR, 0, Math.PI * 2)
      ctx.fillStyle = isStudent ? '#e4e2da' : teacherAccent
      ctx.fill()
      ctx.font = `700 20px ${FONT_SANS}`
      ctx.fillStyle = isStudent ? '#4f4d47' : '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(isStudent ? '学' : '师', avCx, avCy + 1)

      // Bubble box
      const bx = isStudent ? (avCx + avatarR + avatarGap) : (avCx - avatarR - avatarGap - it.bw)
      const fillCol = isStudent ? '#efede6' : mixHex('#ffffff', teacherAccent, 0.12)
      const strokeCol = isStudent ? '#dcd9d0' : rgba(teacherAccent, 0.4)
      fillRoundRect(ctx, bx, y, it.bw, it.bh, 16, fillCol, strokeCol, 1.8)

      // Bubble text
      ctx.font = `600 ${fontSize}px ${FONT_SANS}`
      ctx.fillStyle = THEME.ink
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      const textStartY = y + (it.bh - it.lines.length * lineH) / 2 + lineH / 2
      it.lines.forEach((ln, li) => {
        ctx.fillText(ln, bx + 17, textStartY + li * lineH)
      })
      ctx.restore()

      baseY += it.bh + bubbleGap
    })

    ctx.restore()
    ctx.restore()
  }

  function renderSceneLayer(ctx, spec, state, t, layerAlpha) {
    if (layerAlpha <= 0.01) return
    const actKind = state.act.kind
    const hasOutput = Array.from(state.elements.values()).some((e) => e.kind === 'output') || state.prints.length > 0
    const regions = computeRegions(actKind, hasOutput, state.rows.length > 0, state.revealShiftP, !!spec.code)

    // 0. Clarify dialog panel (right side 560px)
    if (regions.dialog) {
      drawDialogPanel(ctx, regions.dialog, state.says || [], spec, layerAlpha)
    }

    // 1. Code panel (hook / trace)
    if (regions.code && (actKind === 'trace' || state.writtenLines.size > 0)) {
      drawCodePanel(ctx, regions.code, spec, state, layerAlpha)
    }

    // 2. Output panel
    if (regions.output && hasOutput) {
      drawOutputPanel(ctx, regions.output, state.prints, layerAlpha)
    }

    // 3. Mapping table (reveal / recap)
    if (regions.table && state.rows.length > 0) {
      drawMappingTable(ctx, regions.table, state.rows, spec, actKind === 'recap', layerAlpha)
    }

    // 4. Title (hook intro or recap bottom pill)
    // 片头标题在第一个代码行或第一个舞台元素出现时让位（无代码模式下标题曾被压在格子后面）
    if (state.activeTitle && (actKind === 'recap' || (state.writtenLines.size === 0 && state.elements.size === 0))) {
      drawTitleCard(ctx, state.activeTitle, regions.title || null, layerAlpha)
    }

    // 5. Stage elements (groups, zones, boxes, arrows, flies)
    if (regions.stage && state.elements.size > 0) {
      const rects = layoutStage(state.elements, state.arrows, regions.stage)
      // Smooth 0.45s FLIP reflow after an element exits from a group (ENGINE.md §3)
      if (state.lastExitShift && t >= state.lastExitShift.start && t < state.lastExitShift.start + state.lastExitShift.dur) {
        const prevRects = layoutStage(state.lastExitShift.prevElements, state.arrows, regions.stage)
        const k = smooth(seg(t, state.lastExitShift.start, state.lastExitShift.dur))
        for (const [id, curR] of rects.entries()) {
          const prevR = prevRects.get(id)
          if (prevR) {
            rects.set(id, {
              x: lerp(prevR.x, curR.x, k),
              y: lerp(prevR.y, curR.y, k),
              w: lerp(prevR.w, curR.w, k),
              h: lerp(prevR.h, curR.h, k)
            })
          }
        }
      }

      // Groups first (background containers)
      for (const el of state.elements.values()) {
        if (el.kind === 'group' && rects.has(el.id)) {
          drawGroup(ctx, el, rects.get(el.id), layerAlpha * focusAlphaOf(state.focusState, el.id))
        }
      }
      // Zones
      for (const el of state.elements.values()) {
        if (el.kind === 'zone' && rects.has(el.id)) {
          drawZone(ctx, el, rects.get(el.id), layerAlpha * focusAlphaOf(state.focusState, el.id))
        }
      }
      // Boxes
      for (const el of state.elements.values()) {
        if (el.kind === 'box' && rects.has(el.id)) {
          const fa = focusAlphaOf(state.focusState, el.id)
          const isFocused = state.focusState.ids && state.focusState.ids.includes(el.id)
          drawBox(ctx, el, rects.get(el.id), spec, t, layerAlpha * fa, isFocused)
        }
      }
      // Arrows (ENGINE.md §3: straight between same-row/same-col neighbors, stop cleanly on box border, never cross name)
      for (const a of state.arrows) {
        const rFrom = rects.get(a.from)
        const rTo = rects.get(a.to)
        if (!rFrom || !rTo) continue
        const fromEl = state.elements.get(a.from)
        const toEl = state.elements.get(a.to)
        const col = a.role ? roleColor(spec, a.role, THEME.ink) : (a.style === 'dashed' ? THEME.danger : ROLE_COLORS.teal)
        const cyFrom = rFrom.y + rFrom.h / 2
        const cyTo = rTo.y + rTo.h / 2
        const cxFrom = rFrom.x + rFrom.w / 2
        const cxTo = rTo.x + rTo.w / 2
        let x0, y0, x1, y1, cx, cy
        if (Math.abs(cyFrom - cyTo) < 42) {
          // Same row: straight horizontal line between borders
          if (cxFrom < cxTo) {
            x0 = rFrom.x + rFrom.w + 6; y0 = cyFrom
            x1 = rTo.x - 6; y1 = cyTo
          } else {
            x0 = rFrom.x - 6; y0 = cyFrom
            x1 = rTo.x + rTo.w + 6; y1 = cyTo
          }
          cx = (x0 + x1) / 2; cy = (y0 + y1) / 2
        } else if (rFrom.y > rTo.y + rTo.h * 0.5) {
          // Upward vertical arrow: land directly on target box's bottom border (bypassing target's name label!)
          if (toEl && toEl.name) {
            x0 = rFrom.x + rFrom.w * 0.28
            y0 = rFrom.y - 4
            x1 = rTo.x + rTo.w * 0.22
            y1 = rTo.y + rTo.h + 4
            cx = Math.min(x0, x1) - 44
            cy = (y0 + y1) / 2
          } else {
            x0 = cxFrom; y0 = rFrom.y - 4
            x1 = cxTo; y1 = rTo.y + rTo.h + 4
            cx = (x0 + x1) / 2; cy = (y0 + y1) / 2
          }
        } else if (rTo.y > rFrom.y + rFrom.h * 0.5) {
          // Downward vertical arrow: route along right border if from has name label, else straight down
          if (fromEl && fromEl.name) {
            x0 = rFrom.x + rFrom.w + 6; y0 = rFrom.y + rFrom.h * 0.55
            x1 = rTo.x + rTo.w + 6; y1 = rTo.y + rTo.h * 0.45
            cx = Math.max(x0, x1) + 58; cy = (y0 + y1) / 2
          } else {
            x0 = cxFrom; y0 = rFrom.y + rFrom.h + 4
            x1 = cxTo; y1 = rTo.y - 4
            cx = (x0 + x1) / 2; cy = (y0 + y1) / 2
          }
        } else {
          // Diagonal / cross-group arc
          if (cxFrom < cxTo) {
            x0 = rFrom.x + rFrom.w + 6; y0 = cyFrom
            x1 = rTo.x - 6; y1 = cyTo
          } else {
            x0 = rFrom.x - 6; y0 = cyFrom
            x1 = rTo.x + rTo.w + 6; y1 = cyTo
          }
          cx = (x0 + x1) / 2; cy = Math.min(y0, y1) - 48
        }
        ctx.save()
        ctx.globalAlpha = layerAlpha * Math.min(focusAlphaOf(state.focusState, a.from), focusAlphaOf(state.focusState, a.to))
        drawPartialArrow(ctx, x0, y0, cx, cy, x1, y1, a.progress, col, 5, a.style === 'dashed')
        ctx.restore()
      }
      // Flying labels (op: "fly")
      for (const fl of state.flies) {
        if (fl.p <= 0 || fl.p >= 1) continue
        const rFrom = rects.get(fl.from)
        const rTo = rects.get(fl.to)
        if (!rFrom || !rTo) continue
        const sx = rFrom.x + rFrom.w / 2
        const sy = rFrom.y + rFrom.h * 0.45
        const ex = rTo.x + rTo.w / 2
        const ey = rTo.y + rTo.h * 0.62
        const mx = (sx + ex) / 2
        const my = Math.min(sy, ey) - 96
        const pt = pointOnQuad(sx, sy, mx, my, ex, ey, smooth(fl.p))
        const col = roleColor(spec, fl.role, ROLE_COLORS.blue)
        ctx.save()
        ctx.globalAlpha = layerAlpha
        ctx.shadowColor = rgba(col, 0.32)
        ctx.shadowBlur = 14
        ctx.font = `700 30px ${FONT_MONO}`
        const fw = Math.max(120, ctx.measureText(fl.text).width + 44)
        fillRoundRect(ctx, pt.x - fw / 2, pt.y - 26, fw, 52, 12, col, '#ffffff', 2.5)
        ctx.shadowColor = 'transparent'
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(fl.text, pt.x, pt.y + 1)
        ctx.restore()
      }
    }
  }

  // ── 3. drawFrame(ctx, spec, t) ──────────────────────────────────────────
  function drawFrame(ctx, spec, t) {
    const W = 1920, H = 1080
    const tl = timeline(spec)
    const time = Math.max(0, Math.min(t, tl.duration - 0.0001))
    const state = buildSceneState(spec, tl, time)

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 1

    // Warm off-white background + subtle deterministic dot grid
    ctx.fillStyle = THEME.bg
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = rgba(THEME.ink, 0.032)
    for (let gx = 48; gx < W; gx += 48) {
      for (let gy = 84; gy < H - 180; gy += 48) {
        ctx.fillRect(gx, gy, 2, 2)
      }
    }

    // Top chrome (act pill + role legend + progress bar)
    drawTopChrome(ctx, spec, tl, state.act, time)

    // Previous act 0.2s fade-out clear if transitioning
    if (state.prevActSnapshot && state.clearFade > 0.01) {
      renderSceneLayer(ctx, spec, {
        ...state.prevActSnapshot,
        act: { kind: state.prevActSnapshot.actKind },
        flies: [],
        lineP: 1,
        revealShiftP: 1
      }, time, state.clearFade)
    }

    // Current act scene layer
    renderSceneLayer(ctx, spec, state, time, 1)

    // Bottom subtitle bar (strictly inside y in [900, 1080])
    drawSubtitle(ctx, spec, state.step, time)

    ctx.restore()
  }

  return {
    validate,
    timeline,
    drawFrame,
    smooth,
    SKINS,
    OP_DURATIONS
  }
})
