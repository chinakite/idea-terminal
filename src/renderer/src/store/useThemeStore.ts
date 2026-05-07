// src/renderer/src/store/useThemeStore.ts
import { create } from 'zustand'
import { DEFAULT_THEME_ID, THEMES, type ThemeId } from '../themes'

const LS_KEY = 'idea-terminal-theme'

function readPersistedThemeId(): ThemeId {
  try {
    const saved = localStorage.getItem(LS_KEY)
    if (saved && saved in THEMES) return saved as ThemeId
  } catch {
    // localStorage may be unavailable (e.g., test environment without mock)
  }
  return DEFAULT_THEME_ID
}

interface ThemeStore {
  themeId: ThemeId
  setTheme: (id: ThemeId) => void
}

export const useThemeStore = create<ThemeStore>()((set) => ({
  themeId: readPersistedThemeId(),

  setTheme: (id) => {
    try {
      localStorage.setItem(LS_KEY, id)
    } catch {
      // ignore
    }
    set({ themeId: id })
  }
}))
