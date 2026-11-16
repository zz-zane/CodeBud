/** JSON 原子写存储：损坏文件先留副本，成功后才恢复备份。 */
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { randomUUID } from 'node:crypto'
import { join } from 'path'
import { DATA_STORE } from '../../shared/copy'

export interface JsonStore<T> {
  read(): T | null
  write(data: T): void
}

export function preserveCorruptFile(file: string, reason: unknown): string {
  const saved = `${file}.corrupt-${Date.now()}-${randomUUID()}`
  console.error('[miai] invalid data file:', file, reason)
  try {
    copyFileSync(file, saved, constants.COPYFILE_EXCL)
    console.error('[miai] original preserved:', saved)
  } catch (error) {
    console.error('[miai] failed to preserve original:', file, error)
    throw new Error(DATA_STORE.UNREADABLE, { cause: error })
  }
  return saved
}

export function createJsonStore<T>(dir: string, name: string, options: { validate?: (value: unknown) => boolean } = {}): JsonStore<T> {
  const file = join(dir, name)
  const bak = file + '.bak'
  const tmp = file + '.tmp'

  function parse(path: string): T {
    const value: unknown = JSON.parse(readFileSync(path, 'utf-8'))
    if (value === null) throw new Error('JSON root is null')
    if (options.validate && !options.validate(value)) throw new Error('JSON root has invalid shape')
    return value as T
  }

  function read(): T | null {
    if (!existsSync(file) && !existsSync(bak)) return null
    let mainError: unknown
    if (existsSync(file)) {
      try { return parse(file) } catch (error) { mainError = error }
    }
    let backup: T | undefined
    let backupError: unknown
    if (existsSync(bak)) {
      try { backup = parse(bak) } catch (error) { backupError = error }
    }
    if (mainError) preserveCorruptFile(file, mainError)
    if (backupError) preserveCorruptFile(bak, backupError)
    if (backup === undefined) return null
    copyFileSync(bak, file)
    return backup
  }

  function write(data: T): void {
    if (existsSync(file) || existsSync(bak)) read()
    mkdirSync(dir, { recursive: true })
    writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
    if (existsSync(file)) copyFileSync(file, bak)
    renameSync(tmp, file)
  }

  return { read, write }
}
