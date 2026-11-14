import { STUDY_TEXT } from '../../shared/study-copy'
import { execFile, spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { objectInput, textInput } from './store'

const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'abs', 'exp', 'log', 'log10', 'sum', 'mean', 'min', 'max', 'norm', 'det', 'inv', 'rank', 'eig', 'size', 'length', 'disp', 'zeros', 'ones', 'eye', 'rand', 'linspace', 'plot', 'bar', 'scatter', 'hist'])
const CONSTANTS = new Set(['pi', 'e', 'i', 'j', 'Inf', 'NaN'])

export function validateMathScript(input: unknown): { script: string; plot: boolean } {
  const data = objectInput(input)
  const script = textInput(data.script, 3000)
  if (data.plot !== undefined && typeof data.plot !== 'boolean') throw new Error(STUDY_TEXT.MATH_PLOT_INVALID)
  if (!/^[\w\s+\-*/^=.,;()[\]'<>~]+$/.test(script) || /\b(?:system|eval|evalin|feval|builtin|function|for|while|do|if|switch|try|catch|global|persistent|clear|load|save|fopen|delete|cd|run|source|addpath|set|get|quit|exit)\b/i.test(script)) throw new Error(STUDY_TEXT.MATH_SCOPE_RESTRICTED)
  if (/\)\s*=/.test(script)) throw new Error(STUDY_TEXT.MATH_INDEX_GROWTH)
  const withoutNumbers = script.replace(/\b\d+(?:\.\d*)?(?:e[+-]?\d+)?\b/gi, '0')
  if (/\[[^\]]*[A-Za-z_][^\]]*\]/.test(withoutNumbers)) throw new Error(STUDY_TEXT.MATH_DYNAMIC_MATRIX)
  const variables = new Set([...script.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\s*=(?!=)/g)].map(match => match[1]))
  if (variables.size > 30) throw new Error(STUDY_TEXT.MATH_VARIABLE_LIMIT)
  for (const match of withoutNumbers.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
    if (!FUNCTIONS.has(match[0]) && !CONSTANTS.has(match[0]) && !variables.has(match[0])) throw new Error(STUDY_TEXT.MATH_NAME_UNSUPPORTED(match[0]))
  }
  for (const match of script.matchAll(/\b(zeros|ones|eye|rand|linspace)\s*\(([^)]*)\)/g)) {
    const parts = match[2].split(',').map(value => value.trim())
    if (parts.some(part => !/^-?\d+(?:\.\d+)?$/.test(part))) throw new Error(STUDY_TEXT.MATH_LITERAL_DIMENSIONS)
    const values = parts.map(Number)
    if (match[1] === 'linspace') {
      if (values.length < 2 || values.length > 3 || (values[2] !== undefined && (!Number.isInteger(values[2]) || values[2] < 1 || values[2] > 1000))) throw new Error(STUDY_TEXT.MATH_POINT_LIMIT)
    } else if (values.length < 1 || values.length > 2 || values.some(value => !Number.isInteger(value) || value < 1) || (values.length === 1 ? values[0] ** 2 : values[0] * values[1]) > 4000) throw new Error(STUDY_TEXT.MATH_ARRAY_LIMIT)
  }
  return { script, plot: data.plot === true }
}

export async function runOctave(input: unknown, directory: string): Promise<{ output: string; plots: string[] }> {
  const { script, plot } = validateMathScript(input)
  const executable = process.env.MIAI_OCTAVE_PATH || 'octave-cli.exe'
  mkdirSync(directory, { recursive: true })
  const work = mkdtempSync(join(directory, 'octave-'))
  try {
    const plotCode = plot ? "; if (isempty(get(0, 'children'))), error('No plot was generated'); endif; print('-dpng', 'result.png');" : ''
    const code = `set(0, 'defaultfigurevisible', 'off');\n${script}\n${plotCode}`
    const output = await new Promise<string>((resolve, reject) => {
      execFile(executable, ['--no-init-file', '--no-site-file', '--no-history', '--quiet', '--eval', code], { cwd: work, windowsHide: true, timeout: 15_000, maxBuffer: 512_000 }, (error, stdout) => {
        if (error) {
          reject(new Error((error as NodeJS.ErrnoException).code === 'ENOENT' ? STUDY_TEXT.OCTAVE_MISSING : STUDY_TEXT.OCTAVE_EXECUTION_FAILED))
        } else resolve(stdout)
      })
    })
    const file = join(work, 'result.png')
    const plots: string[] = []
    if (plot && existsSync(file)) {
      const bytes = readFileSync(file)
      if (bytes.length > 5_000_000) throw new Error(STUDY_TEXT.MATH_PLOT_TOO_LARGE)
      plots.push('data:image/png;base64,' + bytes.toString('base64'))
    }
    return { output, plots }
  } finally {
    const base = resolve(directory)
    if (!resolve(work).startsWith(base + '\\') && !resolve(work).startsWith(base + '/')) throw new Error('Invalid math cleanup path')
    rmSync(work, { recursive: true, force: true })
  }
}

export function runMathViaMcp(input: unknown, serverFile: string, directory: string): Promise<{ output: string; plots: string[] }> {
  const validated = validateMathScript(input)
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.MIAI_NODE_PATH || 'node.exe', [serverFile], { cwd: directory, shell: false, windowsHide: true, env: { ...process.env, MIAI_MATH_DIR: join(directory, 'study-math') }, stdio: 'pipe' })
    let buffer = ''
    let result: { output: string; plots: string[] } | undefined
    let failure: Error | undefined
    child.stdin.on('error', () => { failure ??= new Error(STUDY_TEXT.MCP_INPUT_CLOSED); child.kill() })
    const timer = setTimeout(() => { failure = new Error(STUDY_TEXT.MCP_TIMEOUT); child.kill() }, 25_000)
    const send = (id: number, method: string, params: unknown) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    child.stdout.setEncoding('utf8')
    child.stderr.resume()
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk
      if (buffer.length > 8_000_000) { failure = new Error(STUDY_TEXT.MCP_RESULT_TOO_LONG); child.kill(); return }
      let newline: number
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline)
        buffer = buffer.slice(newline + 1)
        try {
          const message = JSON.parse(line)
          if (message.error) throw new Error(STUDY_TEXT.MCP_PROTOCOL_ERROR)
          if (message.id === 1) {
            child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
            send(2, 'tools/call', { name: 'octave_calculate', arguments: validated })
          } else if (message.id === 2) {
            if (message.result.isError) throw new Error(String(message.result.content?.[0]?.text || STUDY_TEXT.MATH_FAILED))
            result = JSON.parse(message.result.content[0].text)
            child.stdin.end()
          }
        } catch (error) { failure = error instanceof Error ? error : new Error(STUDY_TEXT.MCP_RESULT_INVALID); child.kill() }
      }
    })
    child.on('error', () => { failure = new Error(STUDY_TEXT.NODE_MISSING) })
    child.on('close', code => {
      clearTimeout(timer)
      if (failure) reject(failure)
      else if (result && code === 0) resolve(result)
      else reject(new Error(STUDY_TEXT.MCP_INCOMPLETE))
    })
    send(1, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'miai-learning', version: '1.0.0' } })
  })
}
