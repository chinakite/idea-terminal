// tests/main/pty/PtyManager.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { PtyManager } from '../../../src/main/pty/PtyManager'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('PtyManager', () => {
  const manager = new PtyManager()

  afterEach(() => {
    manager.destroyAll()
  })

  it('creates a session and returns pid', () => {
    const session = manager.create({ id: 's1', cwd: process.cwd() })
    expect(session.pid).toBeGreaterThan(0)
  })

  it('lists active sessions', () => {
    manager.create({ id: 's1', cwd: process.cwd() })
    manager.create({ id: 's2', cwd: process.cwd() })
    expect(manager.list()).toHaveLength(2)
  })

  it('destroys a session by id', () => {
    manager.create({ id: 's1', cwd: process.cwd() })
    manager.destroy('s1')
    expect(manager.list()).toHaveLength(0)
  })

  it('get returns undefined for unknown id', () => {
    expect(manager.get('unknown')).toBeUndefined()
  })

  it('write does not throw for valid session', () => {
    manager.create({ id: 's1', cwd: process.cwd() })
    expect(() => manager.write('s1', 'echo hello\r')).not.toThrow()
  })

  it('destroyAll clears all sessions', () => {
    manager.create({ id: 's1', cwd: process.cwd() })
    manager.create({ id: 's2', cwd: process.cwd() })
    manager.destroyAll()
    expect(manager.list()).toHaveLength(0)
  })

  it('onData returns a disposable', () => {
    manager.create({ id: 's1', cwd: process.cwd() })
    const disposable = manager.onData('s1', () => {})
    expect(disposable).toBeDefined()
    expect(typeof disposable?.dispose).toBe('function')
  })

  it('onExit returns a disposable', () => {
    manager.create({ id: 's1', cwd: process.cwd() })
    const disposable = manager.onExit('s1', () => {})
    expect(disposable).toBeDefined()
    expect(typeof disposable?.dispose).toBe('function')
  })

  it('getCwd returns homedir for unknown session id', async () => {
    const { homedir } = await import('os')
    const cwd = await manager.getCwd('nonexistent')
    expect(cwd).toBe(homedir())
  })

  it('getCwd returns the working directory for a live session', async () => {
    manager.create({ id: 's-cwd', cwd: process.cwd() })
    const cwd = await manager.getCwd('s-cwd')
    expect(typeof cwd).toBe('string')
    expect(cwd.length).toBeGreaterThan(0)
    // Should be the cwd we launched with, or a valid fallback (homedir)
    const { homedir } = await import('os')
    expect([process.cwd(), homedir()]).toContain(cwd)
  })

  it('create with histCommands writes a temp HISTFILE', () => {
    const histPath = join(tmpdir(), 'idea-terminal-hist-s-hist')
    manager.create({ id: 's-hist', cwd: process.cwd(), histCommands: ['ls', 'pwd'] })
    expect(existsSync(histPath)).toBe(true)
  })

  it('destroy cleans up the temp HISTFILE', () => {
    const histPath = join(tmpdir(), 'idea-terminal-hist-s-hist2')
    manager.create({ id: 's-hist2', cwd: process.cwd(), histCommands: ['ls'] })
    manager.destroy('s-hist2')
    expect(existsSync(histPath)).toBe(false)
  })
})
