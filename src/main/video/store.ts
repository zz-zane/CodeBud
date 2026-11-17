import { VIDEO_COPY } from '../../shared/video-copy'
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { VIDEO_FILE_VERSION, migrateVideoV1, validateVideoStructure, validateVideo, type ExplainerVideo } from '../../shared/video'
import { VIDEO_TEXT } from '../../shared/copy'

type StoredVideo = ExplainerVideo & { migratedFrom?: 1 }
type RejectedVideo = { index: number; raw: unknown }
export function createVideoStore(dir: string) {
  const file = join(dir, 'videos.json')

  function read(): { videos: StoredVideo[]; rejected: RejectedVideo[]; readOnly: boolean } {
    if (!existsSync(file)) return { videos: [], rejected: [], readOnly: false }
    let data: { version?: unknown; videos?: unknown }
    let unknownVersion = false
    try {
      data = JSON.parse(readFileSync(file, 'utf8'))
      if (data && typeof data === 'object' && 'version' in data) unknownVersion = data.version !== 1 && data.version !== VIDEO_FILE_VERSION
      if (!data || typeof data !== 'object' || !Array.isArray(data.videos) || !('version' in data)) throw new Error('invalid video file')
      const readOnly = unknownVersion
      const videos: StoredVideo[] = [], rejected: RejectedVideo[] = []
      for (const [index, item] of data.videos.entries()) {
        try {
          let video: StoredVideo
          if (data.version === 1) {
            const result = migrateVideoV1(item)
            for (const warning of result.warnings) console.warn('[video migration]', result.video.id, warning)
            video = { ...result.video, migratedFrom: 1 as const }
          } else video = item as StoredVideo
          const errors = validateVideoStructure(video)
          if (!video || video.source !== 'ai' || errors.length) throw new Error(errors.join('; ') || 'invalid source')
          videos.push(video)
        } catch (error) {
          rejected.push({ index, raw: item })
          console.warn('[video] skipped structurally invalid entry', index, error instanceof Error ? error.message : String(error))
        }
      }
      if (readOnly && data.videos.length && !videos.length) throw new Error('unreadable video file')
      return { videos, rejected, readOnly }
    } catch (error) {
      if (unknownVersion) throw new Error(VIDEO_COPY.UNKNOWN_READ, { cause: error })
      const backup = existsSync(file + '.bak') ? file + `.corrupt-${Date.now()}.bak` : file + '.bak'
      copyFileSync(file, backup)
      console.error('[video] failed to read videos; original copied to', backup, error)
      throw new Error(VIDEO_TEXT.STORE_CORRUPT, { cause: error })
    }
  }

  function write(videos: StoredVideo[], rejected: RejectedVideo[]): void {
    mkdirSync(dir, { recursive: true })
    if (existsSync(file) && JSON.parse(readFileSync(file, 'utf8')).version === 1) {
      copyFileSync(file, file + `.v1-${Date.now()}.bak`, constants.COPYFILE_EXCL)
    }
    const temp = file + '.tmp'
    const entries: unknown[] = [...videos]
    for (const { index, raw } of rejected) entries.splice(Math.min(index, entries.length), 0, raw)
    writeFileSync(temp, JSON.stringify({ version: VIDEO_FILE_VERSION, videos: entries }, null, 2), 'utf8')
    if (existsSync(file)) copyFileSync(file, file + '.bak')
    renameSync(temp, file)
  }

  function writable(): { videos: StoredVideo[]; rejected: RejectedVideo[] } {
    const result = read()
    if (result.readOnly) throw new Error(VIDEO_COPY.UNKNOWN_WRITE)
    return result
  }
  return {
    list: (): ExplainerVideo[] => read().videos,
    add(video: ExplainerVideo): void {
      if (video.source !== 'ai' || validateVideo(video).length) throw new Error(VIDEO_COPY.INVALID)
      const stored = writable()
      const videos = stored.videos.filter(item => item.id !== video.id)
      videos.push(video)
      videos.sort((a, b) => a.createdAt - b.createdAt)
      write(videos.slice(-60), stored.rejected)
    },
    delete(id: string): void { const stored = writable(); write(stored.videos.filter(video => video.id !== id), stored.rejected) }
  }
}
