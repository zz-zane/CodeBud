import type { MiaiApi } from '../../shared/miai-api'

declare global {
  interface Window { miai: MiaiApi }
}
