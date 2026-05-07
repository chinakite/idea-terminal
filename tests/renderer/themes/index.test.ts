import { describe, it, expect } from 'vitest'
import { THEMES, DEFAULT_THEME_ID } from '../../../src/renderer/src/themes/index'

const EXPECTED_IDS = ['github-dark', 'dracula', 'tokyo-night', 'nord', 'catppuccin', 'solarized-light'] as const

describe('THEMES', () => {
  it('contains exactly 6 themes', () => {
    expect(Object.keys(THEMES)).toHaveLength(6)
  })

  it('contains all required theme IDs', () => {
    for (const id of EXPECTED_IDS) {
      expect(THEMES).toHaveProperty(id)
    }
  })

  it('each theme has a name string', () => {
    for (const id of EXPECTED_IDS) {
      expect(typeof THEMES[id].name).toBe('string')
      expect(THEMES[id].name.length).toBeGreaterThan(0)
    }
  })

  it('each theme has a dot color string', () => {
    for (const id of EXPECTED_IDS) {
      expect(typeof THEMES[id].dot).toBe('string')
      expect(THEMES[id].dot).toMatch(/^#/)
    }
  })

  it('each theme has an xterm object with required color fields', () => {
    const required = ['background', 'foreground', 'cursor'] as const
    for (const id of EXPECTED_IDS) {
      for (const field of required) {
        expect(THEMES[id].xterm).toHaveProperty(field)
        expect(typeof THEMES[id].xterm[field]).toBe('string')
      }
    }
  })

  it('DEFAULT_THEME_ID is github-dark', () => {
    expect(DEFAULT_THEME_ID).toBe('github-dark')
  })
})
