import { resolve } from 'path'
import { readFileSync } from 'node:fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

for (const s of [process.stdout, process.stderr] as unknown as Record<string, unknown>[]) {
  if (typeof s.clearLine !== 'function') s.clearLine = () => {}
  if (typeof s.moveCursor !== 'function') s.moveCursor = () => {}
  if (typeof s.cursorTo !== 'function') s.cursorTo = () => {}
}

export default defineConfig({
  main: {
    define: {
      __STUDY_LESSON_IDS__: JSON.stringify(['content-bundle.json', 'algo-bundle.json'].flatMap(file => {
        const bundle = JSON.parse(readFileSync(resolve('src/renderer/src/generated', file), 'utf8')) as { lessons: Array<{ id: string }> }
        return bundle.lessons.map(lesson => lesson.id)
      }))
    },
    plugins: [externalizeDepsPlugin({ exclude: ['unpdf', 'electron-updater'] })],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          app: resolve('src/main/app.ts'),
          'study-math': resolve('src/main/study/math-server.ts')
        }
      }
    }
  },
  preload: {
    build: {
      isolatedEntries: true,
      externalizeDeps: false,
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [vue()],
    esbuild: {
      legalComments: 'inline'
    },
    server: {
      host: '127.0.0.1'
    }
  }
})
