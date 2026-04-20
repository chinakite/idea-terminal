// tests/main/config/ConfigManager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { ConfigManager } from '../../../src/main/config/ConfigManager'
import { DEFAULT_CONFIG } from '../../../src/shared/types'

describe('ConfigManager', () => {
  let tmpDir: string
  let manager: ConfigManager

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'idea-terminal-test-'))
    manager = new ConfigManager(tmpDir)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true })
  })

  it('returns default config when no file exists', () => {
    const config = manager.load()
    expect(config).toEqual(DEFAULT_CONFIG)
  })

  it('saves and loads config', () => {
    const config = manager.load()
    config.theme = 'light'
    manager.save(config)

    const loaded = manager.load()
    expect(loaded.theme).toBe('light')
  })

  it('adds a group and persists it', () => {
    const config = manager.load()
    const now = Date.now()
    config.groups.push({
      id: 'g1',
      name: 'Project A',
      createdAt: now,
      updatedAt: now,
      sessions: []
    })
    manager.save(config)

    const loaded = manager.load()
    expect(loaded.groups).toHaveLength(1)
    expect(loaded.groups[0].name).toBe('Project A')
  })

  it('returns default config on corrupted file', () => {
    writeFileSync(join(tmpDir, 'config.json'), 'not valid json')
    const config = manager.load()
    expect(config).toEqual(DEFAULT_CONFIG)
    expect(existsSync(join(tmpDir, 'config.json.bak'))).toBe(true)
  })
})
