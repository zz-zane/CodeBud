import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { VIDEO_FILE_VERSION, validateVideo, type ExplainerVideo } from '../../shared/video'
import { VIDEO_TEXT } from '../../shared/copy'

export function createVideoStore(dir: string) {
  const file = join(dir, 'videos.json')

  function read(): ExplainerVideo[] {
    if (!existsSync(file)) return []
    try {
      const data: unknown = JSON.parse(readFileSync(file, 'utf8'))
      if (!data || typeof data !== 'object' || !('version' in data) || data.version !== VIDEO_FILE_VERSION ||
          !('videos' in data) || !Array.isArray(data.videos) ||
          !data.videos.every((video: unknown) => validateVideo(video).length === 0 && (video as ExplainerVideo).source === 'ai')) {
        throw new Error('invalid video file')
      }
      return data.videos as ExplainerVideo[]
    } catch (error) {
      const backup = existsSync(file + '.bak') ? file + `.corrupt-${Date.now()}.bak` : file + '.bak'
      copyFileSync(file, backup)
      console.error('[video] failed to read videos; original copied to', backup, error)
      throw new Error(VIDEO_TEXT.STORE_CORRUPT, { cause: error })
    }
  }

  function write(videos: ExplainerVideo[]): void {
    mkdirSync(dir, { recursive: true })
    const temp = file + '.tmp'
    writeFileSync(temp, JSON.stringify({ version: VIDEO_FILE_VERSION, videos }, null, 2), 'utf8')
    if (existsSync(file)) copyFileSync(file, file + '.bak')
    renameSync(temp, file)
  }

  return {
    list: read,
    add(video: ExplainerVideo): void {
      const videos = read().filter((item) => item.id !== video.id)
      videos.push(video)
      videos.sort((a, b) => a.createdAt - b.createdAt)
      write(videos.slice(-60))
    },
    delete(id: string): void { write(read().filter((video) => video.id !== id)) }
  }
}
