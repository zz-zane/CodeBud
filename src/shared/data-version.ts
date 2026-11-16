import { DATA_STORE } from './copy'

export class NewerDataVersionError extends Error {
  constructor() { super(DATA_STORE.NEWER_VERSION); this.name = 'NewerDataVersionError' }
}

export function assertSupportedVersion(value: unknown, current: number): void {
  if (value && typeof value === 'object' && 'version' in value &&
      typeof value.version === 'number' && value.version > current) throw new NewerDataVersionError()
}
