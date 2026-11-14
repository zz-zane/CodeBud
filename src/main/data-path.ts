import { dirname, join, resolve } from 'node:path'

/** Keep packaged profiles beside the D-drive application, including portable builds. */
export function packagedDataDir(exe: string, portableDir?: string, explicitDir?: string): string {
  return explicitDir ? resolve(explicitDir) : join(portableDir || dirname(exe), 'data')
}
