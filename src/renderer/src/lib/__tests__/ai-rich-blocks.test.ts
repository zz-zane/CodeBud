import { describe, expect, it } from 'vitest'
import {
  compileMermaidToSvg,
  parseAiRichBlocks,
  sanitizeSvg
} from '../ai-rich-blocks'

it('parses valid animation cards and leaves malformed data as markdown', () => {
  expect(parseAiRichBlocks('```anim-card\n{"videoId":"abc"}\n```')[0]).toMatchObject({ type: 'anim-card', videoId: 'abc' })
  expect(parseAiRichBlocks('```anim-card\n{"videoId":42}\n```')[0].type).toBe('markdown')
})

describe('ai-rich-blocks parser and compiler', () => {
  it('parses pure markdown without special blocks', () => {
    const raw = '# Hello\n\nThis is a standard explanation.'
    const segments = parseAiRichBlocks(raw)
    expect(segments).toHaveLength(1)
    expect(segments[0].type).toBe('markdown')
    if (segments[0].type === 'markdown') expect(segments[0].content).toBe(raw)
  })

  it('parses valid diagnosis block into structured data', () => {
    const raw = [
      '前置分析：',
      '\`\`\`diagnosis',
      '{',
      '  "errorType": "deviation",',
      '  "title": "二分查找区间收缩错误",',
      '  "location": "right = mid",',
      '  "rootCause": "闭区间模板下未能避开已排除的 mid 元素导致死循环",',
      '  "remediation": "将 right = mid 改为 right = mid - 1",',
      '  "checkQuestion": "为什么左闭右闭区间在 mid 不匹配时必须排除 mid？"',
      '}',
      '\`\`\`',
      '请根据上述建议调整代码。'
    ].join('\n')

    const segments = parseAiRichBlocks(raw)
    expect(segments).toHaveLength(3)
    expect(segments[0].type).toBe('markdown')
    expect(segments[1].type).toBe('diagnosis')
    if (segments[1].type === 'diagnosis') {
      expect(segments[1].data.errorType).toBe('deviation')
      expect(segments[1].data.title).toBe('二分查找区间收缩错误')
      expect(segments[1].data.location).toBe('right = mid')
    }
    expect(segments[2].type).toBe('markdown')
  })

  it('parses valid feynman block into structured data', () => {
    const raw = [
      '\`\`\`feynman',
      '{',
      '  "passed": true,',
      '  "score": 92,',
      '  "concept": "快速排序基准分区",',
      '  "feedback": "复述非常通俗生动，准确抓住了哨兵划分的不变量",',
      '  "gap": "核心逻辑完整，无明显认知盲区",',
      '  "followUpPrompt": "若数组本身已经基本有序，基准选在最左端会导致什么问题？"',
      '}',
      '\`\`\`'
    ].join('\n')

    const segments = parseAiRichBlocks(raw)
    expect(segments).toHaveLength(1)
    expect(segments[0].type).toBe('feynman')
    if (segments[0].type === 'feynman') {
      expect(segments[0].data.passed).toBe(true)
      expect(segments[0].data.score).toBe(92)
      expect(segments[0].data.concept).toBe('快速排序基准分区')
    }
  })

  it('parses valid algo-viz stepper block', () => {
    const raw = [
      '\`\`\`algo-viz',
      '{',
      '  "title": "二分查找执行过程",',
      '  "subtitle": "时间复杂度 O(log n)",',
      '  "steps": [',
      '    {',
      '      "label": "步骤 1: 初始化指针",',
      '      "items": [1, 3, 5, 7, 9],',
      '      "highlights": [0, 4],',
      '      "pointers": { "0": "left", "2": "mid", "4": "right" },',
      '      "note": "区间 [0, 4], target = 7"',
      '    },',
      '    {',
      '      "label": "步骤 2: 排除左半部分",',
      '      "items": [1, 3, 5, 7, 9],',
      '      "highlights": [3, 4],',
      '      "pointers": { "3": "left", "3": "mid", "4": "right" },',
      '      "note": "nums[mid] < target, left 移至 mid + 1"',
      '    }',
      '  ]',
      '}',
      '\`\`\`'
    ].join('\n')

    const segments = parseAiRichBlocks(raw)
    expect(segments).toHaveLength(1)
    expect(segments[0].type).toBe('algo-viz')
    if (segments[0].type === 'algo-viz') {
      expect(segments[0].data.title).toBe('二分查找执行过程')
      expect(segments[0].data.steps).toHaveLength(2)
      expect(segments[0].data.steps[0].pointers?.['0']).toBe('left')
    }
  })

  it('compiles flowchart TD and LR into SVG', () => {
    const tdCode = [
      'flowchart TD',
      '  A["开始"] --> B["计算 mid"]',
      '  B --> C{"nums[mid] == target?"}',
      '  C -->|是| D["返回索引"]',
      '  C -->|否| E["收缩边界"]'
    ].join('\n')

    const tdSvg = compileMermaidToSvg(tdCode)
    expect(tdSvg).toContain('<svg')
    expect(tdSvg).toContain('viewBox=')
    expect(tdSvg).toContain('开始')
    expect(tdSvg).toContain('返回索引')

    const lrCode = 'graph LR\n  Head --> Node1 --> Node2 --> Null'
    const lrSvg = compileMermaidToSvg(lrCode)
    expect(lrSvg).toContain('<svg')
    expect(lrSvg).toContain('Node1')
  })

  it('compiles sequenceDiagram into SVG', () => {
    const seqCode = [
      'sequenceDiagram',
      '  participant Client as 客户端',
      '  participant Server as 服务端',
      '  Client->>Server: SYN',
      '  Server-->>Client: SYN-ACK',
      '  Client->>Server: ACK'
    ].join('\n')

    const seqSvg = compileMermaidToSvg(seqCode)
    expect(seqSvg).toContain('<svg')
    expect(seqSvg).toContain('客户端')
    expect(seqSvg).toContain('SYN-ACK')
  })

  it('compiles mindmap into SVG', () => {
    const mapCode = [
      'mindmap',
      '  root((二分查找))',
      '    前置条件',
      '      有序数组',
      '    核心变量',
      '      left',
      '      right',
      '      mid'
    ].join('\n')

    const mapSvg = compileMermaidToSvg(mapCode)
    expect(mapSvg).toContain('<svg')
    expect(mapSvg).toContain('二分查找')
    expect(mapSvg).toContain('有序数组')
  })

  it('sanitizes SVG against XSS and unsafe tags', () => {
    const malicious = [
      '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">',
      "  <script>alert('xss')</script>",
      '  <foreignObject width="100" height="100"><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject>',
      '  <circle cx="50" cy="50" r="40" onclick="alert(2)" />',
      '  <a href="javascript:alert(3)"><text>Click</text></a>',
      '</svg>'
    ].join('\n')

    const clean = sanitizeSvg(malicious)
    expect(clean).toContain('<circle')
    expect(clean).not.toContain('<script')
    expect(clean).not.toContain('<foreignObject')
    expect(clean).not.toContain('onclick')
    expect(clean).not.toContain('javascript:')
  })

  it('parses valid ask-user block and handles malformed gracefully', () => {
    const raw = [
      '在开始写代码前，我需要和你确认一下：',
      '```ask-user',
      '{',
      '  "question": "你需要查找的元素是否可能存在重复值？",',
      '  "reason": "存在重复值时需要确定是返回最左侧下标还是任意一个下标",',
      '  "options": [',
      '    { "label": "数组中保证无重复元素", "description": "标准二分查找" },',
      '    { "label": "存在重复，需返回最左侧", "description": "左边界二分查找" }',
      '  ]',
      '}',
      '```',
      '请点击选项或告诉我你的想法。'
    ].join('\n')

    const segments = parseAiRichBlocks(raw)
    expect(segments).toHaveLength(3)
    expect(segments[0].type).toBe('markdown')
    expect(segments[1].type).toBe('ask-user')
    if (segments[1].type === 'ask-user') {
      expect(segments[1].data.question).toContain('重复值')
      expect(segments[1].data.options).toHaveLength(2)
      expect(segments[1].data.options[0].label).toBe('数组中保证无重复元素')
    }
    expect(segments[2].type).toBe('markdown')

    // Malformed JSON should degrade to markdown without throwing
    const bad = '```ask-user\n{ "question": \n```'
    const fallback = parseAiRichBlocks(bad)
    expect(fallback).toHaveLength(1)
    expect(fallback[0].type).toBe('markdown')
  })

  it('parses valid solve-steps block into progressive steps', () => {
    const raw = [
      '```solve-steps',
      '{',
      '  "title": "两数之和（Two Sum）解题步骤",',
      '  "strategy": "利用哈希表将寻找靶数的开销从 O(N) 降至 O(1)",',
      '  "steps": [',
      '    {',
      '      "title": "步骤 1: 暴力法思路与瓶颈分析",',
      '      "hint": "双重循环为什么会超时？",',
      '      "detail": "两层遍历时间复杂度为 O(N^2)，瓶颈在于对每个数都要向后线性查找",',
      '      "code": "for i in range(n): for j in range(i+1, n): ..."',
      '    },',
      '    {',
      '      "title": "步骤 2: 哈希表反向查找设计",',
      '      "hint": "能不能边遍历边记录看过的数字？",',
      '      "detail": "用字典记录 val -> index，遍历到 x 时直接查 target - x 是否已在字典中",',
      '      "code": "seen = {}\\nif target - x in seen: return [seen[target - x], i]"',
      '    }',
      '  ]',
      '}',
      '```'
    ].join('\n')

    const segments = parseAiRichBlocks(raw)
    expect(segments).toHaveLength(1)
    expect(segments[0].type).toBe('solve-steps')
    if (segments[0].type === 'solve-steps') {
      expect(segments[0].data.title).toBe('两数之和（Two Sum）解题步骤')
      expect(segments[0].data.strategy).toContain('哈希表')
      expect(segments[0].data.steps).toHaveLength(2)
      expect(segments[0].data.steps[0].title).toContain('步骤 1')
      expect(segments[0].data.steps[1].code).toContain('target - x in seen')
    }
  })


  it('handles cyclic flowcharts without infinite loops within 50ms (P0 regression)', () => {
    const t0 = performance.now()
    const cycle2 = compileMermaidToSvg('flowchart TD\nA-->B\nB-->A')
    const cycle3 = compileMermaidToSvg('flowchart TD\nA-->B\nB-->C\nC-->A')
    const elapsed = performance.now() - t0

    expect(elapsed).toBeLessThan(50)
    expect(cycle2).toContain('<svg')
    expect(cycle2).toContain('A')
    expect(cycle2).toContain('B')
    expect(cycle3).toContain('<svg')
    expect(cycle3).toContain('C')
  })

  /**
   * 模型常按 mermaid 习惯在节点标签里写 `<br/>`。原实现直接 escapeXml，
   * 结果是用户在图上看到字面量 "返回 mid<br/>查找成功"（录屏时实拍到的）。
   */
  it('renders <br/> inside node labels as a real line break, not literal text', () => {
    const svg = compileMermaidToSvg('flowchart TD\nA["返回 mid<br/>查找成功"]-->B["left = mid + 1<br>收缩到右半区"]')
    expect(svg).not.toContain('&lt;br')
    expect(svg).not.toContain('br/&gt;')
    // 两行文字用两个 tspan 承载
    expect(svg).toContain('返回 mid')
    expect(svg).toContain('查找成功')
    expect((svg.match(/<tspan/g) || []).length).toBeGreaterThanOrEqual(4)
  })

  it('strictly neutralizes advanced SVG XSS bypass samples (P1 regression)', () => {
    // 1. /onload bypass
    const sample1 = '<svg/onload=alert(1)><circle r="10"/></svg>'
    const res1 = sanitizeSvg(sample1)
    expect(res1).not.toContain('onload')
    expect(res1).not.toContain('alert')

    // 2. Unclosed <script> bypass
    const sample2 = '<svg><script>alert(2)<circle r="10"/></svg>'
    const res2 = sanitizeSvg(sample2)
    expect(res2).not.toContain('script')
    expect(res2).not.toContain('alert')

    // 3. SMIL animate / href to javascript bypass
    const sample3 = '<svg><animate attributeName="href" to="javascript:alert(4)"/><rect width="10"/></svg>'
    const res3 = sanitizeSvg(sample3)
    expect(res3).not.toContain('animate')
    expect(res3).not.toContain('javascript:')
    expect(res3).not.toContain('alert')
  })

  it('generates distinct marker IDs for multiple charts and protects against NaN score (P2)', () => {
    const chart1 = compileMermaidToSvg('flowchart TD\nA-->B')
    const chart2 = compileMermaidToSvg('flowchart TD\nC-->D')
    const marker1 = chart1.match(/id="(mm-arrow-[a-z0-9]+)"/)?.[1]
    const marker2 = chart2.match(/id="(mm-arrow-[a-z0-9]+)"/)?.[1]
    expect(marker1).toBeDefined()
    expect(marker2).toBeDefined()
    expect(marker1).not.toBe(marker2)

    // Feynman score NaN protection
    const feynmanNan = '```feynman\n{ "concept": "递归", "score": "not_a_number", "feedback": "ok" }\n```'
    const segs = parseAiRichBlocks(feynmanNan)
    expect(segs[0].type).toBe('feynman')
    if (segs[0].type === 'feynman') {
      expect(segs[0].data.score).toBe(0)
      expect(Number.isFinite(segs[0].data.score)).toBe(true)
    }
  })


  it('safely normalizes ask-user options containing strings, nulls, or incomplete objects (P2)', () => {
    const raw = '```ask-user\n{\n  "question": "Choose an approach",\n  "options": [\n    "Option A as string",\n    null,\n    { "missing_label": 123 },\n    { "label": "Option B", "description": "Desc B" },\n    ""\n  ]\n}\n```'
    const segs = parseAiRichBlocks(raw)
    expect(segs[0].type).toBe('ask-user')
    if (segs[0].type === 'ask-user') {
      expect(segs[0].data.options).toEqual([
        { label: 'Option A as string' },
        { label: 'Option B', description: 'Desc B' }
      ])
    }
  })

  it('safely normalizes solve-steps with missing detail, hint, or title fields without crashing (P2)', () => {
    const raw = '```solve-steps\n{\n  "steps": [\n    {},\n    { "title": "Step 2" },\n    { "hint": "Think carefully", "code": "const x = 1;" }\n  ]\n}\n```'
    const segs = parseAiRichBlocks(raw)
    expect(segs[0].type).toBe('solve-steps')
    if (segs[0].type === 'solve-steps') {
      expect(segs[0].data.steps).toHaveLength(3)
      expect(segs[0].data.steps[0]).toEqual({
        title: '#1',
        hint: '',
        detail: ''
      })
      expect(segs[0].data.steps[1]).toEqual({
        title: 'Step 2',
        hint: '',
        detail: ''
      })
      expect(segs[0].data.steps[2]).toEqual({
        title: '#3',
        hint: 'Think carefully',
        detail: '',
        code: 'const x = 1;'
      })
    }
  })

})

describe('图文积木 flow / points', () => {
  it('flow：节点规范化、未知图标丢掉、字符串节点可用、最多 9 个', () => {
    const nodes = [{ label: '美国服务器', sub: '图片拆成数据包', icon: 'server', tone: 'start' }, '骨干网', { label: '海底光缆', zone: true, via: '光信号', icon: 'nope' }]
    const many = Array.from({ length: 12 }, (_, i) => `n${i}`)
    const segs = parseAiRichBlocks('前文\n```flow\n' + JSON.stringify({ title: 'T', nodes, caption: '示意' }) + '\n```\n后文')
    expect(segs.map((s) => s.type)).toEqual(['markdown', 'flow', 'markdown'])
    if (segs[1].type !== 'flow') return
    expect(segs[1].data.nodes).toEqual([
      { label: '美国服务器', sub: '图片拆成数据包', icon: 'server', tone: 'start' },
      { label: '骨干网' },
      { label: '海底光缆', zone: true, via: '光信号' }
    ])
    expect(segs[1].data.caption).toBe('示意')
    const big = parseAiRichBlocks('```flow\n' + JSON.stringify({ nodes: many }) + '\n```')
    expect(big[0].type === 'flow' && big[0].data.nodes.length).toBe(9)
  })

  it('points：缺标题和说明的条目丢掉；JSON 坏了退回成代码块', () => {
    const segs = parseAiRichBlocks('```points\n{"items":[{"icon":"cable","title":"海底光缆","text":"内部是光纤"},{},{"title":"中继器"}]}\n```')
    expect(segs[0].type === 'points' && segs[0].data.items).toEqual([{ icon: 'cable', title: '海底光缆', text: '内部是光纤' }, { title: '中继器', text: '' }])
    expect(parseAiRichBlocks('```flow\n{ bad json\n```')[0].type).toBe('markdown')
    expect(parseAiRichBlocks('```points\n{"items":[]}\n```')[0].type).toBe('markdown')
  })
})

describe('互动示意 widget', () => {
  it('完整的 widget 块原样交给沙盒；空块退回代码块', () => {
    const segs = parseAiRichBlocks('看图：\n```widget\n<svg viewBox="0 0 10 10"></svg>\n<script>1</script>\n```\n结束')
    expect(segs.map((s) => s.type)).toEqual(['markdown', 'widget', 'markdown'])
    expect(segs[1].type === 'widget' && segs[1].html).toBe('<svg viewBox="0 0 10 10"></svg>\n<script>1</script>')
    expect(parseAiRichBlocks('```widget\n\n```')[0].type).toBe('markdown')
  })

  it('生成中（没有收尾的 ```widget）不露出半截 HTML，换成占位', () => {
    const segs = parseAiRichBlocks('## 一、原理\n说明\n```widget\n<svg viewBox="0 0')
    expect(segs.map((s) => s.type)).toEqual(['markdown', 'widget-pending'])
    expect(segs[0].type === 'markdown' && segs[0].content).toBe('## 一、原理\n说明\n')
  })
})
