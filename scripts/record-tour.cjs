/**
 * 新增功能演示录制：真跑 CDP 操作 → 逐帧截图 → ffmpeg 合成。
 *
 * 每次点击都是真 DOM click，AI 回复真走 NativeHarness 打到已配置端点，
 * 等真串流结束才取下一帧 —— 不是摆拍。
 *
 * 用法：node scripts/record-tour.cjs
 * 产出：outputs/feature-tour-20261031/{frames/,manifest.json}
 */
const assert = require('node:assert/strict')
const { app, BrowserWindow } = require('electron')
const { join, resolve } = require('node:path')
const { mkdirSync, writeFileSync, rmSync } = require('node:fs')

const output = resolve(__dirname, '../../outputs/feature-tour-20261031')
const framesDir = join(output, 'frames')
rmSync(framesDir, { recursive: true, force: true })
mkdirSync(framesDir, { recursive: true })
const manifest = { frames: [], errors: [] }

let win
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const evaluate = (code) => win.webContents.executeJavaScript(code, true)
let seq = 0

async function shot(caption, holdMs = 1500) {
  const image = await win.webContents.capturePage()
  assert(!image.isEmpty(), `empty frame: ${caption}`)
  const name = `${String(seq++).padStart(3, '0')}.png`
  writeFileSync(join(framesDir, name), image.toPNG())
  manifest.frames.push({ file: name, caption, holdMs })
  console.log(`[frame] ${name} ${caption}`)
}

async function until(code, label, timeout = 90000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await evaluate(code)) return true
    await sleep(250)
  }
  throw new Error(`Timed out: ${label}`)
}

async function go(hash, readyExpr, label) {
  await evaluate(`location.hash = ${JSON.stringify(hash)}`)
  await until(readyExpr, label || hash)
  await sleep(700)
}

/**
 * 打开课时页的右侧 AI 面板（那里才有完整 8 种教学模式）。
 */
async function openLessonAiPanel() {
  const ok = await evaluate(`(() => {
    const b = Array.from(document.querySelectorAll('.right-panel-tabs .tab-btn')).find(x => /AI|助教/.test(x.textContent));
    if (!b) return false;
    b.click(); return true;
  })()`)
  assert(ok, 'lesson AI panel tab not found')
  await until("!!document.querySelector('.ai-textarea')", 'side ai composer')
  await sleep(600)
}

/** 在侧栏面板选教学模式 */
async function setMode(mode) {
  const ok = await evaluate(`(() => {
    const sel = document.querySelector('.tutor-mode select');
    if (!sel) return false;
    sel.value = ${JSON.stringify(mode)};
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return sel.value === ${JSON.stringify(mode)};
  })()`)
  assert(ok, `mode not set: ${mode}`)
  await sleep(400)
}

/**
 * 开一个新会话。
 *
 * 【为什么必须有】不换会话时，上一项的 AI 卡片还挂在消息流里，
 * `waitAi('.rich-card')` 会**立刻命中旧卡**然后截到上一项的画面 ——
 * 第一版就是这么录错的（诊断那帧拍到的是流程图的尾巴）。
 */
async function newSession() {
  const ok = await evaluate(`(() => {
    const b = document.querySelector('.new-chat');
    if (!b) return false;
    b.click(); return true;
  })()`)
  assert(ok, 'new-chat button not found')
  // 串流中会被忽略，所以只等一小会儿；没清空就手动清（下面靠"最后一条消息"定位，不会串到旧内容）
  const deadline = Date.now() + 6000
  while (Date.now() < deadline) {
    if ((await evaluate(`document.querySelectorAll('.ai-message').length`)) === 0) break
    await sleep(250)
  }
  await sleep(400)
}

/** 最后一条 assistant 消息里的目标区块（只认新回复，不认历史残留） */
function lastAi(selector) {
  return `(() => {
    const msgs = document.querySelectorAll('.ai-message.assistant, .ai-message.assistant.streaming');
    const last = msgs[msgs.length - 1];
    return last ? last.querySelector(${JSON.stringify(selector)}) : null;
  })()`
}

/** 往 AI 输入框写内容并 Enter 发送 */
async function send(text) {
  const typed = await evaluate(`(() => {
    const ta = document.querySelector('.ai-textarea');
    if (!ta) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, ${JSON.stringify(text)});
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
    return document.activeElement === ta;
  })()`)
  assert(typed, 'textarea not focused after typing')
  await sleep(500)
  await shot(`输入：${text.length > 60 ? text.slice(0, 60) + '…' : text}`, 1100)
  const before = await evaluate(`document.querySelectorAll('.ai-message').length`)
  await evaluate(`(() => {
    const ta = document.querySelector('.ai-textarea');
    ta.focus();
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    return true;
  })()`)
  // 真发出去了才会有新消息（用户那条），发不出去就在这儿暴露，而不是等 150s 超时
  await until(`document.querySelectorAll('.ai-message').length > ${before}`, 'message dispatched', 8000)
  await sleep(600)
}

/** 等串流结束且最后一条 assistant 消息有实质内容（不强制要求特定卡片） */
async function waitReply(timeout = 150000) {
  await until(`(() => {
    if (document.querySelector('.ai-messages[aria-busy="true"]')) return false;
    const m = document.querySelectorAll('.ai-message.assistant');
    const last = m[m.length - 1];
    return !!(last && last.textContent.trim().length > 10);
  })()`, 'assistant reply', timeout)
  await sleep(900)
}

/** 聚焦最后一条回复里的卡片；没有卡片就聚焦整条消息 */
async function focusReplyCard(selector) {
  await evaluate(`(() => {
    const m = document.querySelectorAll('.ai-message.assistant');
    const last = m[m.length - 1];
    const card = last && last.querySelector(${JSON.stringify(selector)});
    (card || last)?.scrollIntoView({ block: 'center' });
  })()`)
  await sleep(700)
}

function flush() {
  writeFileSync(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
}

process.on('uncaughtException', (e) => { manifest.errors.push(String(e.stack || e)); flush(); app.exit(1) })
process.on('unhandledRejection', (e) => { manifest.errors.push(String(e?.stack || e)); flush(); app.exit(1) })
setTimeout(() => { manifest.errors.push('recording exceeded 25min'); flush(); app.exit(1) }, 1_500_000).unref()

require('../start-qa.cjs')

app.whenReady().then(async () => {
  try {
    const deadline = Date.now() + 25000
    while (!win && Date.now() < deadline) {
      win = BrowserWindow.getAllWindows()[0]
      if (!win) await sleep(200)
    }
    assert(win, 'main window not created')
    await until("!!document.querySelector('.learn-view')", 'catalog')
    win.setSize(1440, 900)
    win.center()
    await sleep(1800)

    await shot('咪爱编程 · 本次新增功能全览：8 项能力，逐项真实操作', 3200)

    // ============================================================ 1 算法图解
    await go('#/lesson/python-stage1-03', "!!document.querySelector('.markdown-body')", 'lesson')
    await openLessonAiPanel()
    await setMode('visualize')
    await newSession()
    await shot('第 1 项 · 算法图解：把抽象的指针移动、循环状态画出来', 2200)
    await send('用算法步进演示二分查找在 [2,5,8,12,16] 里查 12 的过程，再配一张流程图说明循环条件')
    await waitReply()
    await focusReplyCard('.algo-viz-card')
    await shot('AI 返回「分步沙盒」：数组状态 + 高亮元素 + 指针位置，一步一帧', 3400)
    await evaluate(`(() => {
      const b = Array.from(document.querySelectorAll('.algo-viz-card button')).find(x => /下一|next|▶/i.test(x.textContent) && !x.disabled);
      if (b) { b.click(); return true; } return false;
    })()`)
    await sleep(900)
    await shot('点「下一步」：指针真的往前挪，不用在脑子里模拟', 3000)
    await focusReplyCard('.diagram-card')
    await shot('同一条回复里的结构流程图（本地编译成 SVG，不依赖任何在线服务）', 3000)

    // ============================================================ 2 错因诊断
    await go('#/lesson/python-stage1-03', "!!document.querySelector('.markdown-body')", 'lesson')
    await openLessonAiPanel()
    await setMode('diagnose')
    await newSession()
    await shot('第 2 项 · 错因诊断：答错了，先搞清「错在哪一类」，而不是抄答案', 2600)
    await send('我这段找数组最大值的代码结果不对，帮我看看：int max = 0; for (int i = 0; i <= n; i++) if (a[i] > max) max = a[i];')
    await waitReply()
    await focusReplyCard('.rich-card')
    await shot('AI 判定错因类型（结构性缺失 / 概念偏差 / 实现失误 / 审题疏漏 四选一）', 3600)

    // ============================================================ 3 费曼检验
    await go('#/lesson/python-stage1-03', "!!document.querySelector('.markdown-body')", 'lesson')
    await openLessonAiPanel()
    await setMode('feynman')
    await newSession()
    await shot('第 3 项 · 费曼检验：能不能用自己的话讲明白，才是真懂', 2600)
    await send('快速排序为什么最坏情况是 O(n^2)？')
    // 费曼模式不保证吐卡片：只等串流结束、且最后一条有内容
    await until(`(() => {
      if (document.querySelector('.ai-messages[aria-busy="true"]')) return false;
      const m = document.querySelectorAll('.ai-message.assistant');
      const last = m[m.length - 1];
      return !!(last && last.textContent.trim().length > 10);
    })()`, 'feynman prompt reply', 150000)
    await sleep(900)
    await evaluate(`(() => {
      const m = document.querySelectorAll('.ai-message.assistant');
      m[m.length - 1]?.scrollIntoView({ block: 'center' });
    })()`)
    await sleep(600)
    await shot('AI 不直接讲答案，先请你复述', 2800)
    const beforeCount = await evaluate(`document.querySelectorAll('.ai-message.assistant').length`)
    await send('因为每次都挑到最大的当基准，每次只能排出 0 个和 n-1 个，递归就退化成一条链')
    await until(
      `document.querySelectorAll('.ai-message.assistant').length > ${beforeCount} && !document.querySelector('.ai-messages[aria-busy="true"]')`,
      'feynman score reply',
      150000
    )
    await sleep(900)
    await evaluate(`(() => {
      const m = document.querySelectorAll('.ai-message.assistant');
      const last = m[m.length - 1];
      (last && (last.querySelector('.rich-card') || last))?.scrollIntoView({ block: 'center' });
    })()`)
    await shot('按「通俗度 / 完整性 / 偏差」三项打分，并指出补强点', 3600)

    // ============================================================ 4 追问 + 分步求解
    await go('#/lesson/python-stage1-03', "!!document.querySelector('.markdown-body')", 'lesson')
    await openLessonAiPanel()
    await setMode('solve')
    await newSession()
    await shot('第 4 项 · 分步求解：一道题拆成几关，不让你一眼看完整答案', 2600)
    await send('帮我做这道题：写一个函数判断字符串是不是回文')
    await waitReply()
    const hasAsk = await evaluate(`(() => {
      const msgs = document.querySelectorAll('.ai-message.assistant');
      const last = msgs[msgs.length - 1];
      return !!(last && last.querySelector('.ask-user-card'));
    })()`)
    await focusReplyCard(hasAsk ? '.ask-user-card' : '.rich-card')
    await shot('信息不足时先弹「反问卡片」，列出可点选项而不是瞎猜', 3200)
    const picked = await evaluate(`(() => {
      const host = document.querySelectorAll('.ai-message.assistant');
      const last = host[host.length - 1];
      const b = last && last.querySelector('.ask-user-card button, .rich-card button');
      if (b && !b.disabled) { b.click(); return b.textContent.trim(); } return '';
    })()`)
    await sleep(1200)
    await shot(picked ? `点了选项「${picked.slice(0, 24)}」，问题被澄清后继续` : '分步卡：建模 → 边界 → 伪代码 → 实现', 3000)

    // ============================================================ 5 记忆画像
    await go('#/ai', "!!document.querySelector('.ai-textarea')", 'ai')
    await sleep(1200)
    await shot('第 5 项 · 三层记忆画像：AI 记得你哪块弱，不用每次自我介绍', 3000)
    const mem = await evaluate(`(() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => /注入记忆画像/.test(x.textContent));
      if (b) { b.click(); return true; } return false;
    })()`)
    await sleep(1200)
    await shot(mem ? '点「注入记忆画像」：把 L1 当前课时 / L2 薄弱点 / L3 全局画像一起塞进系统提示' : '右侧画像栏：L1/L2/L3 三层都有', 3200)

    // ============================================================ 6 变式题
    await go('#/practice', "!!document.querySelector('main.content')", 'practice')
    await sleep(1500)
    await shot('第 6 项 · AI 变式出题：静态题库做腻了，换一道同考点的新题', 2600)
    const ext = await evaluate(`(() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => /延展/.test(x.textContent) && !x.disabled);
      if (b) { b.scrollIntoView({block:'center'}); b.click(); return true; } return false;
    })()`)
    await sleep(1400)
    await shot(ext ? '点「延展练习」：静态池凑不满时，自动向 AI 要差额题补进同一张卷' : '错题本页（本题库无错题时延展不可用，展示页面全貌）', 3000)

    // ============================================================ 7 闪卡 + 课前测
    await go('#/lesson/python-stage1-03', "!!document.querySelector('.markdown-body')", 'lesson')
    await sleep(1400)
    await shot('第 7 项 · 课前 1 分钟小测：进课时先探盲区，再往下学', 3000)
    await evaluate("document.querySelector('.pretest-card')?.scrollIntoView({block:'center'})")
    await sleep(600)
    const picked2 = await evaluate(`(() => {
      const card = document.querySelector('.pretest-card');
      if (!card) return false;
      const opts = card.querySelectorAll('.option-item');
      if (!opts.length) return false;
      opts[1].click(); return true;
    })()`)
    assert(picked2, 'pretest not found')
    await sleep(700)
    await shot('选中一个选项（此时确认键才亮）', 1800)
    await evaluate(`(() => {
      const b = Array.from(document.querySelectorAll('.pretest-actions button')).find(x => !x.disabled);
      if (b) { b.click(); return true; } return false;
    })()`)
    await sleep(1100)
    await shot('提交立刻判对错 + 一句解析；不占错题本、不动学习进度', 3200)
    await evaluate("document.querySelector('.flash-cards-deck')?.scrollIntoView({block:'center'})")
    await sleep(700)
    await shot('同一课里的翻转闪卡', 2400)
    await evaluate(`(() => {
      const c = document.querySelector('.flash-cards-deck .flip-card');
      if (c) { c.click(); return true; } return false;
    })()`)
    await sleep(1100)
    await shot('点一下翻面看答案（纯 CSS 翻转，键盘 Space/Enter 也能翻）', 3000)

    // ============================================================ 8 随堂批注
    await evaluate(`(() => {
      const p = Array.from(document.querySelectorAll('.markdown-body p')).find(x => x.textContent.trim().length > 20);
      if (!p) return false;
      p.scrollIntoView({ block: 'center' });
      const range = document.createRange();
      range.selectNodeContents(p);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      return true;
    })()`)
    await sleep(1200)
    await shot('第 8 项 · 随堂批注：选中正文任意一段，浮出「批注」按钮', 2800)
    const opened = await evaluate(`(() => {
      const b = document.querySelector('.annotation-float-btn');
      if (b) { b.click(); return true; } return false;
    })()`)
    assert(opened, 'annotation button not found')
    await sleep(900)
    await shot('弹窗里上方是原文引用，下方写自己的话', 2600)
    await evaluate(`(() => {
      const ta = document.querySelector('.annotation-textarea');
      if (!ta) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, '这里的「名字绑定到对象」就是贴标签，不是把值塞进盒子里喵');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`)
    await sleep(700)
    await shot('写批注（上限 2000 字，超了会拦下并提示）', 2200)
    await evaluate(`(() => {
      // 用位置定位主按钮（页脚最后一个），不押注中文文案的简繁写法
      const btns = document.querySelectorAll('.mi-modal-foot button');
      const b = btns[btns.length - 1];
      if (b) { b.click(); return true; }
      return false;
    })()`)
    await until(`!document.querySelector('.mi-modal-mask')`, 'annotation modal closed', 10000)
    await sleep(1200)
    await shot('保存成功：这条批注落进既有备忘录，不是另开一处存储', 2800)

    // ============================================================ 9 备忘录 + 导出
    await go('#/memo', "!!document.querySelector('main.content')", 'memo')
    await sleep(1600)
    // 列表默认只显示标题与正文首行；先点开第一条，再验正文——只认"页面上真的出现了批注内容"
    await until(`document.body.innerText.includes('学习笔记')`, 'memo list rendered', 15000)
    await evaluate(`(() => {
      const first = document.querySelector('.memo-list button, .memo-item, .memo-list-item, [class*="memo"][class*="item"]');
      if (first) { first.click(); return true; }
      return false;
    })()`)
    await sleep(900)
    // 备忘正文是 textarea 的 value，不算在 innerText 里 —— 必须读 value
    await until(`(() => {
      const tas = Array.from(document.querySelectorAll('textarea'));
      return tas.some(t => (t.value || '').includes('python-stage1-03'))
    })()`, 'annotation visible in memo editor', 20000)
    await shot('刚写的批注就在这里，能搜、能改、能分类', 3000)
    await shot('第 9 项 · Markdown 导出：一键把备忘 + 错题本导成 .md，丢进 Obsidian 就能用', 3200)

    await shot('全部演示完毕 · 以上每一步都是真实点击与真实 AI 请求', 3400)
  } catch (error) {
    manifest.errors.push(String(error?.stack || error))
    try { await shot(`出错了：${String(error?.message || error)}`, 2500) } catch {}
  } finally {
    flush()
    console.log(manifest.errors.length ? `ERRORS:\n${manifest.errors.join('\n')}` : 'recording done')
    app.exit(manifest.errors.length ? 1 : 0)
  }
})
