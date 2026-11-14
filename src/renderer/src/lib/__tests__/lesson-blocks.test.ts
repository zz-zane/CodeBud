import { describe, expect, it } from 'vitest'
import { parseFlashCards, parsePretest } from '../lesson-blocks'

describe('lesson-blocks 闪卡与小测解析器', () => {
  describe('parseFlashCards 闪卡解析', () => {
    it('正确解析合法 JSON 格式闪卡', () => {
      const json = JSON.stringify({
        title: 'Python 核心概念',
        cards: [
          { q: '什么是列表？', a: '可以自由增删元素的小鱼干收纳袋喵！', hint: '用方括号 [] 表示' },
          { q: '什么是字典？', a: '带标签的键值对盒子喵～' }
        ]
      })

      const block = parseFlashCards(json)
      expect(block).not.toBeNull()
      expect(block?.title).toBe('Python 核心概念')
      expect(block?.cards).toHaveLength(2)
      expect(block?.cards[0].front).toBe('什么是列表？')
      expect(block?.cards[0].back).toBe('可以自由增删元素的小鱼干收纳袋喵！')
      expect(block?.cards[0].hint).toBe('用方括号 [] 表示')
      expect(block?.cards[1].front).toBe('什么是字典？')
    })

    it('正确解析合法行扫描文本格式闪卡', () => {
      const raw = `title: C语言闪卡
card:
q: sizeof 是函数还是操作符？
a: 是编译期操作符，不是函数喵！
hint: 别被括号骗啦
card:
front: 指针是什么？
back: 内存门牌号喵～`

      const block = parseFlashCards(raw)
      expect(block).not.toBeNull()
      expect(block?.title).toBe('C语言闪卡')
      expect(block?.cards).toHaveLength(2)
      expect(block?.cards[0].front).toBe('sizeof 是函数还是操作符？')
      expect(block?.cards[0].back).toBe('是编译期操作符，不是函数喵！')
      expect(block?.cards[0].hint).toBe('别被括号骗啦')
      expect(block?.cards[1].front).toBe('指针是什么？')
      expect(block?.cards[1].back).toBe('内存门牌号喵～')
    })

    it('空内容、格式损坏或缺字段时安全返回 null', () => {
      expect(parseFlashCards('')).toBeNull()
      expect(parseFlashCards('    ')).toBeNull()
      expect(parseFlashCards('title: 只有标题')).toBeNull()
      expect(parseFlashCards('card:\nq: 只有问题无答案')).toBeNull()
      expect(parseFlashCards('{ "broken": json ')).toBeNull()
      expect(parseFlashCards('{ "cards": [{ "q": "" }] }')).toBeNull()
    })
  })

  describe('parsePretest 课前小测解析', () => {
    it('正确解析合法 JSON 格式小测', () => {
      const json = JSON.stringify({
        title: '课前 1 分钟测验',
        question: '数组下界索引通常从几开始？',
        options: ['从 0 开始', '从 1 开始', '随机'],
        answer: 0,
        explanation: '绝大多数现代编程语言数组索引均从 0 开始编号喵！'
      })

      const block = parsePretest(json)
      expect(block).not.toBeNull()
      expect(block?.title).toBe('课前 1 分钟测验')
      expect(block?.question).toBe('数组下界索引通常从几开始？')
      expect(block?.options).toHaveLength(3)
      expect(block?.answer).toBe(0)
      expect(block?.explanation).toContain('从 0 开始')
    })

    it('正确解析行扫描文本格式小测并支持字母答案 A/B/C/D', () => {
      const raw = `title: 二分查找小测
question: 二分查找的前提是什么？
option: 必须是有序数组
option: 必须是链表
option: 元素个数必须为偶数
answer: A
explanation: 只有数组元素单调有序时才能依据中点二分排除区间喵！`

      const block = parsePretest(raw)
      expect(block).not.toBeNull()
      expect(block?.title).toBe('二分查找小测')
      expect(block?.question).toBe('二分查找的前提是什么？')
      expect(block?.options).toHaveLength(3)
      expect(block?.answer).toBe(0) // A -> 0
      expect(block?.explanation).toContain('单调有序')
    })

    it('空内容、格式损坏、选项不足或答案越界时安全返回 null', () => {
      expect(parsePretest('')).toBeNull()
      expect(parsePretest('title: 只有标题')).toBeNull()
      expect(parsePretest('question: 只有题干\noption: 只有一个选项\nanswer: 0')).toBeNull()
      expect(parsePretest('question: 题干\noption: A\noption: B\nanswer: 5')).toBeNull() // 越界
      expect(parsePretest('{ "broken": json ')).toBeNull()
    })
  })
})
