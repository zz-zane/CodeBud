export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'latest'; checkedAt: number }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }
  | { state: 'unsupported'; reason: 'dev' | 'platform' }

export interface UpdateSnapshot {
  version: string
  status: UpdateStatus
  manual: boolean
}
