// tests/main/proxy/buildProxyEnv.test.ts
import { describe, it, expect } from 'vitest'
import { buildProxyEnv } from '../../../src/main/proxy/buildProxyEnv'
import type { ProxyConfig } from '../../../src/shared/types'

const makeProxy = (overrides: Partial<ProxyConfig> = {}): ProxyConfig => ({
  id: 'p1',
  name: 'Test Proxy',
  type: 'http',
  host: '127.0.0.1',
  port: 7890,
  createdAt: 0,
  updatedAt: 0,
  ...overrides
})

describe('buildProxyEnv', () => {
  it('returns empty object when proxy is undefined', () => {
    expect(buildProxyEnv(undefined)).toEqual({})
  })

  it('builds http proxy URL without auth', () => {
    const env = buildProxyEnv(makeProxy())
    expect(env.HTTP_PROXY).toBe('http://127.0.0.1:7890')
    expect(env.HTTPS_PROXY).toBe('http://127.0.0.1:7890')
    expect(env.http_proxy).toBe('http://127.0.0.1:7890')
    expect(env.https_proxy).toBe('http://127.0.0.1:7890')
  })

  it('builds http proxy URL with username and password', () => {
    const env = buildProxyEnv(makeProxy({ username: 'user', password: 'pass' }))
    expect(env.HTTP_PROXY).toBe('http://user:pass@127.0.0.1:7890')
    expect(env.http_proxy).toBe('http://user:pass@127.0.0.1:7890')
  })

  it('builds socks5 proxy URL', () => {
    const env = buildProxyEnv(makeProxy({ type: 'socks5', port: 1080 }))
    expect(env.HTTP_PROXY).toBe('socks5://127.0.0.1:1080')
    expect(env.HTTPS_PROXY).toBe('socks5://127.0.0.1:1080')
  })

  it('sets NO_PROXY and no_proxy to localhost entries', () => {
    const env = buildProxyEnv(makeProxy())
    expect(env.NO_PROXY).toBe('localhost,127.0.0.1')
    expect(env.no_proxy).toBe('localhost,127.0.0.1')
  })
})
