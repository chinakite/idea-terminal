// tests/main/ai/AiKeyStore.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  safeStorage: {
    encryptString: vi.fn((s: string) => Buffer.from(`enc:${s}`)),
    decryptString: vi.fn((b: Buffer) => b.toString().replace('enc:', '')),
    isEncryptionAvailable: vi.fn(() => true)
  }
}))

const { AiKeyStore } = await import('../../../src/main/ai/AiKeyStore')

describe('AiKeyStore', () => {
  let store: InstanceType<typeof AiKeyStore>

  beforeEach(() => {
    store = new AiKeyStore()
    vi.clearAllMocks()
  })

  it('encrypt returns base64 string different from input', () => {
    const encrypted = store.encrypt('sk-secret')
    expect(typeof encrypted).toBe('string')
    expect(encrypted).not.toBe('sk-secret')
  })

  it('decrypt reverses encrypt', () => {
    const encrypted = store.encrypt('sk-my-api-key')
    expect(store.decrypt(encrypted)).toBe('sk-my-api-key')
  })

  it('isAvailable returns safeStorage availability', () => {
    expect(store.isAvailable()).toBe(true)
  })
})
