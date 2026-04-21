// src/main/proxy/buildProxyEnv.ts
import type { ProxyConfig } from '../../shared/types'

export function buildProxyEnv(proxy: ProxyConfig | undefined): Record<string, string> {
  if (!proxy) return {}

  const auth = proxy.username
    ? `${proxy.username}:${proxy.password}@`
    : ''
  const url = `${proxy.type}://${auth}${proxy.host}:${proxy.port}`

  return {
    HTTP_PROXY: url,
    HTTPS_PROXY: url,
    http_proxy: url,
    https_proxy: url,
    NO_PROXY: 'localhost,127.0.0.1',
    no_proxy: 'localhost,127.0.0.1'
  }
}
