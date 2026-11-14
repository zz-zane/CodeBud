import { describe, expect, it } from 'vitest'
import { labelAddresses } from '../remote/addresses'

// 使用固定地址夹具，不读本机网卡。
describe('labelAddresses', () => {
  it('隐藏指定的代理和 VirtualBox 地址，保留组网与 Wi-Fi 地址', () => {
    expect(labelAddresses({
      Proxy: [{ address: '198.18.0.1', family: 'IPv4', internal: false }],
      Tailscale: [{ address: '100.64.0.7', family: 'IPv4', internal: false }],
      '以太网 2': [{ address: '192.168.56.1', family: 'IPv4', internal: false }],
      WLAN: [{ address: '192.0.2.10', family: 'IPv4', internal: false }]
    })).toEqual([
      { address: '100.64.0.7', name: 'Tailscale', overlay: true },
      { address: '192.0.2.10', name: 'WLAN', overlay: false }
    ])
  })

  it('只留非内部 IPv4；CGNAT 段与虚拟网卡名标为可能的组网工具', () => {
    const out = labelAddresses({
      Ethernet: [
        { address: '192.0.2.10', family: 'IPv4', internal: false },
        { address: 'fe80::1', family: 'IPv6', internal: false }
      ],
      Loopback: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
      Mesh: [{ address: '100.64.0.7', family: 'IPv4', internal: false }],
      Edge: [{ address: '100.127.255.1', family: 'IPv4', internal: false }],
      NotMesh: [{ address: '100.128.0.1', family: 'IPv4', internal: false }],
      Tailscale: [{ address: '192.0.2.77', family: 4, internal: false }],
      Empty: undefined
    })
    expect(out).toEqual([
      { address: '192.0.2.10', name: 'Ethernet', overlay: false },
      { address: '100.64.0.7', name: 'Mesh', overlay: true },
      { address: '100.127.255.1', name: 'Edge', overlay: true },
      { address: '100.128.0.1', name: 'NotMesh', overlay: false },
      { address: '192.0.2.77', name: 'Tailscale', overlay: true }
    ])
  })
})
