// tests/main/pty/PtyManager.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { PtyManager } from '../../../src/main/pty/PtyManager'

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
})
