// tests/main/session/SessionPersistenceManager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { SessionPersistenceManager } from '../../../src/main/session/SessionPersistenceManager'
import type { PersistedSessionData } from '../../../src/main/session/SessionPersistenceManager'

const sample: PersistedSessionData = {
  id: 'abc123',
  title: 'My Terminal',
  groupId: 'default',
  lastCwd: '/home/user',
  lastCommands: ['ls', 'pwd']
}

describe('SessionPersistenceManager', () => {
  let tmpDir: string
  let manager: SessionPersistenceManager

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'idea-terminal-session-test-'))
    manager = new SessionPersistenceManager(tmpDir)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true })
  })

  it('returns empty array when file does not exist', () => {
    expect(manager.load()).toEqual([])
  })

  it('saves and loads sessions correctly', () => {
    manager.save([sample])
    expect(manager.load()).toEqual([sample])
  })

  it('preserves all fields including optional proxyId', () => {
    const withProxy: PersistedSessionData = { ...sample, proxyId: 'p1' }
    manager.save([withProxy])
    expect(manager.load()[0].proxyId).toBe('p1')
  })

  it('saves empty array and loads it back', () => {
    manager.save([sample])
    manager.save([])
    expect(manager.load()).toEqual([])
  })

  it('returns empty array and creates backup when file is corrupt', () => {
    writeFileSync(join(tmpDir, 'sessions.json'), 'not valid json')
    expect(manager.load()).toEqual([])
    expect(existsSync(join(tmpDir, 'sessions.json.bak'))).toBe(true)
  })
})
