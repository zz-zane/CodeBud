/**
 * 本机可用于手机连接的地址列表（docs/29 §3.4）。只在设置页取状态、且服务开着时才枚举（惰性），
 * 结果不落盘、不写日志。标注逻辑是纯函数，测试用写死的假数据。
 */
import { networkInterfaces } from 'node:os'
import type { RemoteAddress } from '../../shared/remote-auth'

export interface IfaceEntry {
  address: string
  family: string | number
  internal: boolean
}

/**
 * 「可能来自组网工具」的启发式，刻意保持很小：地址落在 100.64.0.0/10（Tailscale 一类用的 CGNAT 段），
 * 或网卡名像虚拟网卡 / 隧道。只是提示，不做任何联网探测；判错的代价只是一个标签。
 */
const OVERLAY_NAME = /tailscale|zerotier|wireguard|wintun|vpn|virtual|vmware|vethernet|hyper-v|\btun\b|\btap\b/i

// shortcut: 只隐藏用户指定的两个入口；网卡地址变化后需更新此列表。
const HIDDEN_ADDRESSES = new Set(['198.18.0.1', '192.168.56.1'])

function inCgnat(address: string): boolean {
  const [a, b] = address.split('.').map(Number)
  return a === 100 && b >= 64 && b <= 127
}

export function labelAddresses(ifaces: Record<string, readonly IfaceEntry[] | undefined>): RemoteAddress[] {
  const out: RemoteAddress[] = []
  for (const [name, list] of Object.entries(ifaces)) {
    for (const i of list ?? []) {
      if ((i.family === 'IPv4' || i.family === 4) && !i.internal && !HIDDEN_ADDRESSES.has(i.address)) {
        out.push({ address: i.address, name, overlay: inCgnat(i.address) || OVERLAY_NAME.test(name) })
      }
    }
  }
  return out
}

export function listAddresses(): RemoteAddress[] {
  return labelAddresses(networkInterfaces())
}
