import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ThemeId } from '../../../src/renderer/src/themes/index'

// Mock localStorage before importing the store (store reads it at module init time)
const localStorageMock: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string): string | null => localStorageMock[k] ?? null,
  setItem: (k: string, v: string): void => { localStorageMock[k] = v },
  removeItem: (k: string): void => { delete localStorageMock[k] }
})

const { useThemeStore } = await import('../../../src/renderer/src/store/useThemeStore')

describe('useThemeStore', () => {
  beforeEach(() => {
    // Reset store to default state between tests
    useThemeStore.setState({ themeId: 'github-dark' })
    // Clear localStorage mock
    for (const key of Object.keys(localStorageMock)) delete localStorageMock[key]
  })

  it('initial themeId is github-dark', () => {
    expect(useThemeStore.getState().themeId).toBe('github-dark')
  })

  it('setTheme updates themeId in store', () => {
    useThemeStore.getState().setTheme('dracula')
    expect(useThemeStore.getState().themeId).toBe('dracula')
  })

  it('setTheme persists themeId to localStorage', () => {
    useThemeStore.getState().setTheme('nord')
    expect(localStorageMock['idea-terminal-theme']).toBe('nord')
  })

  it('setTheme updates from one theme to another', () => {
    useThemeStore.getState().setTheme('tokyo-night')
    useThemeStore.getState().setTheme('catppuccin')
    expect(useThemeStore.getState().themeId).toBe('catppuccin')
  })

  it('all 6 ThemeIds can be set without throwing', () => {
    const ids: ThemeId[] = ['github-dark', 'dracula', 'tokyo-night', 'nord', 'catppuccin', 'solarized-light']
    for (const id of ids) {
      useThemeStore.getState().setTheme(id)
      expect(useThemeStore.getState().themeId).toBe(id)
    }
  })

  it('initializes from valid localStorage value on module load', async () => {
    localStorageMock['idea-terminal-theme'] = 'dracula'
    vi.resetModules()
    const { useThemeStore: freshStore } = await import('../../../src/renderer/src/store/useThemeStore')
    expect(freshStore.getState().themeId).toBe('dracula')
  })

  it('falls back to github-dark when localStorage has an unknown theme', async () => {
    localStorageMock['idea-terminal-theme'] = 'not-a-real-theme'
    vi.resetModules()
    const { useThemeStore: freshStore } = await import('../../../src/renderer/src/store/useThemeStore')
    expect(freshStore.getState().themeId).toBe('github-dark')
  })
})
