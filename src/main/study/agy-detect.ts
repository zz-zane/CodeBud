import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { win32 } from 'node:path'
import { STUDY_TEXT } from '../../shared/study-copy'

export interface AgyEnv { path?: string; localAppData?: string; programFiles?: string; programFilesX86?: string; home?: string }

/** Ordered, de-duplicated places an agy.exe may live: PATH first, then conventional install roots. Pure. */
export function agyCandidates(env: AgyEnv): string[] {
  const roots = [env.localAppData && win32.join(env.localAppData, 'Programs'), env.programFiles, env.programFilesX86, env.home && win32.join(env.home, 'AppData', 'Local', 'Programs')]
  const installs = roots.filter((r): r is string => !!r).flatMap(root => [win32.join(root, 'Antigravity', 'cli', 'bin'), win32.join(root, 'Antigravity', 'bin')])
  const dirs = [...(env.path ?? '').split(';').map(d => d.trim().replace(/^"|"$/g, '')).filter(Boolean), ...installs]
  return [...new Set(dirs.map(dir => win32.join(dir, 'agy.exe')))]
}

/** Only a version probe is ever executed. */
function probeVersion(command: string): Promise<boolean> {
  return new Promise(resolve => {
    try { execFile(command, ['--version'], { timeout: 5000, windowsHide: true }, (error, stdout) => resolve(!error && /\d+\.\d+/.test(String(stdout)))) }
    catch { resolve(false) } // a non-executable .exe makes execFile throw synchronously
  })
}

export async function detectAgy(env: AgyEnv = {
  path: process.env.PATH ?? process.env.Path, localAppData: process.env.LOCALAPPDATA,
  programFiles: process.env.ProgramFiles, programFilesX86: process.env['ProgramFiles(x86)'], home: process.env.USERPROFILE
}, exists: (path: string) => boolean = existsSync, probe: (path: string) => Promise<boolean> = probeVersion): Promise<string | null> {
  for (const candidate of agyCandidates(env)) if (exists(candidate) && await probe(candidate)) return candidate
  return null
}

/** `agy models` prints "id<TAB>name" per line after a progress line. */
export function parseAgyModels(stdout: string): Array<{ id: string; name: string }> {
  return stdout.split(/\r?\n/).map(line => line.split('\t')).filter(parts => parts.length >= 2 && /^[\w.:/-]{1,100}$/.test(parts[0].trim()))
    .map(parts => ({ id: parts[0].trim(), name: parts[1].trim().slice(0, 100) })).slice(0, 100)
}

export function listAgyModels(command: unknown): Promise<Array<{ id: string; name: string }>> {
  if (typeof command !== 'string' || !win32.isAbsolute(command) || !/^agy(\.exe)?$/i.test(win32.basename(command)) || !existsSync(command)) return Promise.reject(new Error(STUDY_TEXT.AGY_MODELS_PATH_INVALID))
  return new Promise((resolve, reject) => {
    try { execFile(command, ['models'], { timeout: 30_000, windowsHide: true }, (error, stdout) => error ? reject(new Error(STUDY_TEXT.AGY_MODELS_FAILED)) : resolve(parseAgyModels(String(stdout)))) }
    catch { reject(new Error(STUDY_TEXT.AGY_MODELS_FAILED)) }
  })
}
