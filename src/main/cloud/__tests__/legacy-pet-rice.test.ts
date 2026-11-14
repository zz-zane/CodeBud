/**
 * 旧版 pet.json 的存量饭数读口：表格固化自旧 createPetStore().load().state.rice
 * 在同一批磁盘输入上的实测输出（2026-11-10）。账本 genesis 用它，是用户可见的余额，
 * 任何一行变了都等于改了老用户升级后的饭数。
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readLegacyPetRice } from '../legacy-pet-rice'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'legacy-pet-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

/** [名字, pet.json 原文(null=不存在), pet.json.bak 原文(null=不存在), 期望饭数] */
const TABLE: Array<[string, string | null, string | null, number]> = [
  ['文件不存在', null, null, 0],
  ['空文件', '', null, 0],
  ['损坏 JSON', '{"rice": 5', null, 0],
  ['JSON null', 'null', null, 0],
  ['非对象：数字', '5', null, 0],
  ['非对象：字符串', '"rice"', null, 0],
  ['非对象：true', 'true', null, 0],
  ['数组', '[1,2]', null, 0],
  ['空对象（缺 rice）', '{}', null, 0],
  ['rice 为 null', '{"rice":null}', null, 0],
  ['rice 为字符串', '{"rice":"12"}', null, 0],
  ['rice 为布尔', '{"rice":true}', null, 0],
  ['rice 为 Infinity（1e999）', '{"rice":1e999}', null, 0],
  ['rice 为 -Infinity', '{"rice":-1e999}', null, 0],
  ['普通整数', '{"rice":12}', null, 12],
  ['零', '{"rice":0}', null, 0],
  ['负数', '{"rice":-5}', null, 0],
  ['小数四舍五入（3.5）', '{"rice":3.5}', null, 4],
  ['小数四舍五入（2.4）', '{"rice":2.4}', null, 2],
  ['-0.4 → -0（Math.round 保留负零）', '{"rice":-0.4}', null, -0],
  ['-0.6 → 0', '{"rice":-0.6}', null, 0],
  ['上限 999', '{"rice":999}', null, 999],
  ['998.5 → 999', '{"rice":998.5}', null, 999],
  ['超上限 1000', '{"rice":1000}', null, 999],
  ['巨大值 1e15', '{"rice":1e15}', null, 999],
  ['主文件损坏、备份有效', '{oops', '{"rice":7}', 7],
  ['主文件为 null、备份有效', 'null', '{"rice":5}', 5],
  ['主文件缺失、备份有效', null, '{"rice":9}', 9],
  ['主文件有效但缺 rice，不看备份', '{}', '{"rice":9}', 0],
  ['主文件有效优先于备份', '{"rice":3}', '{"rice":9}', 3],
  ['主备都损坏', '{', '{', 0],
  ['其余字段不影响', '{"satiety":1,"rice":42,"enabled":false}', null, 42]
]

describe('readLegacyPetRice', () => {
  it.each(TABLE)('%s', (_name, main, bak, expected) => {
    if (main !== null) writeFileSync(join(dir, 'pet.json'), main)
    if (bak !== null) writeFileSync(join(dir, 'pet.json.bak'), bak)
    expect(readLegacyPetRice(dir)).toBe(expected)
  })

  it('目录不存在也返回 0', () => {
    expect(readLegacyPetRice(join(dir, 'nope', 'deeper'))).toBe(0)
    expect(existsSync(join(dir, 'nope'))).toBe(false)
  })

  it('不写盘：有效主文件原样不动、不新建文件', () => {
    writeFileSync(join(dir, 'pet.json'), '{"rice":8,"x":1}')
    readLegacyPetRice(dir)
    readLegacyPetRice(dir)
    expect(readFileSync(join(dir, 'pet.json'), 'utf-8')).toBe('{"rice":8,"x":1}')
    expect(existsSync(join(dir, 'pet.json.bak'))).toBe(false)
    expect(existsSync(join(dir, 'pet.json.tmp'))).toBe(false)
  })

  it('缺失文件时不新建 pet.json', () => {
    mkdirSync(join(dir, 'sub'))
    readLegacyPetRice(join(dir, 'sub'))
    expect(existsSync(join(dir, 'sub', 'pet.json'))).toBe(false)
  })

  it('重复调用结果稳定（主文件损坏、靠备份）', () => {
    writeFileSync(join(dir, 'pet.json'), '{oops')
    writeFileSync(join(dir, 'pet.json.bak'), '{"rice":7}')
    expect(readLegacyPetRice(dir)).toBe(7)
    expect(readLegacyPetRice(dir)).toBe(7)
  })
})
