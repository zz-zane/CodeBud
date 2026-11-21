/**
 * CodeBud Generic Headless Electron Video Renderer (ENGINE.md)
 *
 * Usage:
 *   .\node_modules\.bin\electron.cmd scripts/video-lab/render.cjs --spec <path> --out <mp4Path> --kf <kfDir> [--det <detJson>] [--meta <metaJson>]
 */
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const { validate, timeline } = require('./engine.js')

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && argv[i + 1]) {
      args[argv[i].slice(2)] = argv[i + 1]
      i++
    }
  }
  return args
}

/** Auto-select keyframes for every act + exact morph 0% / 50% / 100% from timeline(spec) */
function autoKeyframes(spec) {
  const tl = timeline(spec)
  const kfs = []
  for (const act of tl.acts) {
    if (act.kind === 'reveal') {
      // Find first morph op in reveal to capture 0% / 50% / 100%
      let firstMorph = null
      let lastMorph = null
      for (const st of act.steps) {
        for (const op of st.ops) {
          if (op.op === 'morph') {
            if (!firstMorph) firstMorph = op
            lastMorph = op
          }
        }
      }
      if (firstMorph) {
        kfs.push({ name: 'act3_reveal_morph_00.png', t: Math.max(0, firstMorph.start - 0.05), label: `幕 3 · ${act.title}（形变 0%）` })
        kfs.push({ name: 'act3_reveal_morph_50.png', t: (firstMorph.start + firstMorph.end) / 2, label: `幕 3 · ${act.title}（形变 50%）` })
        kfs.push({ name: 'act3_reveal_morph_100.png', t: Math.min(act.end - 0.25, (lastMorph || firstMorph).end + 0.6), label: `幕 3 · ${act.title}（形变 100%）` })
      } else {
        kfs.push({ name: 'act3_reveal.png', t: act.start + act.dur * 0.5, label: `幕 3 · ${act.title}` })
      }
    } else {
      const lastStep = act.steps[act.steps.length - 1]
      const sampleT = Math.min(lastStep.end - 0.35, lastStep.start + Math.min(lastStep.dur * 0.65, 2.2))
      kfs.push({
        name: `act${act.index}_${act.kind}.png`,
        t: Math.max(act.start + 0.3, sampleT),
        label: `幕 ${act.index} · ${act.title}`
      })
    }
  }
  return kfs
}

app.whenReady().then(async () => {
  try {
    const args = parseArgs(process.argv.slice(2))
    const specPath = path.resolve(args.spec || path.join(__dirname, '..', '..', 'content', 'skills', 'explainer-video', 'examples', 'c-pointer.spec.json'))
    const outMp4 = path.resolve(args.out || path.join(__dirname, '..', '..', 'outputs', 'video-skill', 'c-pointer.mp4'))
    const kfDir = path.resolve(args.kf || path.join(path.dirname(outMp4), 'keyframes-' + path.basename(outMp4, '.mp4')))
    const detPath = path.resolve(args.det || path.join(path.dirname(outMp4), path.basename(outMp4, '.mp4') + '.determinism.json'))
    const metaPath = path.resolve(args.meta || path.join(path.dirname(outMp4), path.basename(outMp4, '.mp4') + '.json'))

    const raw = fs.readFileSync(specPath, 'utf8')
    const check = validate(raw)
    if (!check.ok) {
      console.error('Spec validation failed:\n' + check.errors.join('\n'))
      process.exitCode = 1
      app.quit()
      return
    }
    const spec = check.spec
    const keyframes = autoKeyframes(spec)

    fs.mkdirSync(path.dirname(outMp4), { recursive: true })
    fs.mkdirSync(kfDir, { recursive: true })

    const muxerPkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'node_modules', 'mp4-muxer', 'package.json'), 'utf8'))
    const muxerMjsBuf = fs.readFileSync(path.join(__dirname, 'node_modules', 'mp4-muxer', 'build', 'mp4-muxer.mjs'))

    const win = new BrowserWindow({
      width: 1920,
      height: 1080,
      show: false,
      webPreferences: { contextIsolation: false, nodeIntegration: false, backgroundThrottling: false }
    })
    win.webContents.on('console-message', (_e, _lvl, msg) => console.log('[harness]', msg))
    await win.loadFile(path.join(__dirname, 'harness.html'))

    console.log(`Rendering ${spec.lessonId} (${spec.title}) -> ${outMp4}`)
    const result = await win.webContents.executeJavaScript(
      `window.renderSpecVideo(${JSON.stringify(spec)}, ${JSON.stringify(keyframes)})`
    )

    const mp4Buf = Buffer.from(result.mp4Base64, 'base64')
    fs.writeFileSync(outMp4, mp4Buf)

    for (const kf of result.keyframes) {
      const pngBase64 = kf.dataUrl.replace(/^data:image\/png;base64,/, '')
      fs.writeFileSync(path.join(kfDir, kf.name), Buffer.from(pngBase64, 'base64'))
    }

    const allDeterministic = result.determinism.every((d) => d.identical)
    fs.writeFileSync(detPath, JSON.stringify({ allIdentical: allDeterministic, checks: result.determinism }, null, 2), 'utf8')

    const meta = {
      id: `${spec.lessonId}-explainer`,
      lessonId: spec.lessonId,
      title: spec.title,
      concept: spec.concept,
      createdAt: new Date().toISOString(),
      durationSec: result.durationSec,
      fps: result.fps,
      width: result.width,
      height: result.height,
      codec: result.codec,
      specVersion: spec.version,
      muxer: {
        name: muxerPkg.name,
        version: muxerPkg.version,
        license: muxerPkg.license,
        mjsBytes: muxerMjsBuf.length,
        mjsGzipBytes: zlib.gzipSync(muxerMjsBuf).length
      },
      renderStats: {
        totalFrames: result.totalFrames,
        totalRenderMs: result.totalRenderMs,
        avgDrawMs: result.avgDrawMs,
        mp4Bytes: mp4Buf.length
      },
      keyframes: result.keyframes.map((k) => ({ name: k.name, t: k.t, label: k.label })),
      spec
    }
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8')

    console.log(JSON.stringify({
      ok: true,
      lessonId: spec.lessonId,
      outMp4,
      mp4MB: (mp4Buf.length / 1024 / 1024).toFixed(2),
      durationSec: result.durationSec,
      totalFrames: result.totalFrames,
      codec: result.codec,
      totalRenderMs: result.totalRenderMs,
      avgDrawMs: result.avgDrawMs,
      allDeterministic,
      keyframesCount: result.keyframes.length
    }, null, 2))
    app.quit()
  } catch (err) {
    console.error('Render failed:', err)
    process.exitCode = 1
    app.quit()
  }
})
