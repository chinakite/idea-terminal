// tests/renderer/store/useTerminalOutputStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useTerminalOutputStore } from '../../../src/renderer/src/store/useTerminalOutputStore'

describe('useTerminalOutputStore', () => {
  beforeEach(() => {
    useTerminalOutputStore.setState({ buffers: {} })
  })

  it('appendData accumulates data for session', () => {
    useTerminalOutputStore.getState().appendData('s1', 'hello\n')
    useTerminalOutputStore.getState().appendData('s1', 'world\n')
    const output = useTerminalOutputStore.getState().getOutput('s1')
    expect(output).toContain('hello')
    expect(output).toContain('world')
  })

  it('getOutput strips ANSI escape codes', () => {
    useTerminalOutputStore.getState().appendData('s1', '\x1b[32mGreen\x1b[0m text')
    expect(useTerminalOutputStore.getState().getOutput('s1')).toBe('Green text')
  })

  it('trims buffer to 5000 chars when it exceeds limit', () => {
    useTerminalOutputStore.getState().appendData('s1', 'x'.repeat(6000))
    expect(useTerminalOutputStore.getState().buffers['s1'].length).toBe(5000)
  })

  it('returns empty string for unknown session', () => {
    expect(useTerminalOutputStore.getState().getOutput('unknown')).toBe('')
  })
})
