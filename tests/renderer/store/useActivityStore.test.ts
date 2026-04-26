// tests/renderer/store/useActivityStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useActivityStore } from '../../../src/renderer/src/store/useActivityStore'

describe('useActivityStore', () => {
  beforeEach(() => {
    useActivityStore.setState({ unread: {} })
  })

  it('hasActivity returns false for unknown session', () => {
    expect(useActivityStore.getState().hasActivity('s1')).toBe(false)
  })

  it('markActivity sets session as unread', () => {
    useActivityStore.getState().markActivity('s1')
    expect(useActivityStore.getState().hasActivity('s1')).toBe(true)
  })

  it('clearActivity removes session from unread', () => {
    useActivityStore.getState().markActivity('s1')
    useActivityStore.getState().clearActivity('s1')
    expect(useActivityStore.getState().hasActivity('s1')).toBe(false)
  })

  it('markActivity for one session does not affect others', () => {
    useActivityStore.getState().markActivity('s1')
    expect(useActivityStore.getState().hasActivity('s2')).toBe(false)
  })

  it('clearActivity on unknown session is a no-op', () => {
    expect(() => useActivityStore.getState().clearActivity('unknown')).not.toThrow()
    expect(useActivityStore.getState().hasActivity('unknown')).toBe(false)
  })

  it('multiple sessions can be unread simultaneously', () => {
    useActivityStore.getState().markActivity('s1')
    useActivityStore.getState().markActivity('s2')
    expect(useActivityStore.getState().hasActivity('s1')).toBe(true)
    expect(useActivityStore.getState().hasActivity('s2')).toBe(true)
  })
})
