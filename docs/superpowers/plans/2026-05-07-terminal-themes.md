# Terminal Theme Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 built-in terminal color themes switchable from a bottom-toolbar icon in the sidebar and from Cmd+K command palette, persisted across restarts.

**Architecture:** A `themes/index.ts` file owns all color data; a `useThemeStore` Zustand store holds the active theme ID and persists it to `localStorage`; `SidebarBottomBar` + `ThemePopup` components handle the UI; `TerminalPane` subscribes and hot-updates `term.options.theme` on change; `CommandPalette` exposes one command per theme.

**Tech Stack:** React 18, Zustand 4, xterm.js 5, Vitest

---

## File Map

| Action | Path |
|---|---|
| Create | `src/renderer/src/themes/index.ts` |
| Create | `src/renderer/src/store/useThemeStore.ts` |
| Create | `src/renderer/src/components/Sidebar/ThemePopup.tsx` |
| Create | `src/renderer/src/components/Sidebar/SidebarBottomBar.tsx` |
| Modify | `src/renderer/src/components/Sidebar/Sidebar.tsx` |
| Modify | `src/renderer/src/components/Terminal/TerminalPane.tsx` |
| Modify | `src/renderer/src/components/CommandPalette/CommandPalette.tsx` |
| Create | `tests/renderer/store/useThemeStore.test.ts` |
| Create | `tests/renderer/themes/index.test.ts` |

---

### Task 1: Theme definitions

**Files:**
- Create: `src/renderer/src/themes/index.ts`
- Create: `tests/renderer/themes/index.test.ts`

- [ ] **Step 1: Create the test directory and write the failing test**

```bash
mkdir -p tests/renderer/themes
```

Create `tests/renderer/themes/index.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal
npx vitest run tests/renderer/themes/index.test.ts
```

Expected: FAIL — `Cannot find module '../../../src/renderer/src/themes/index'`

- [ ] **Step 3: Create the themes file**

Create `src/renderer/src/themes/index.ts`:

```ts
// src/renderer/src/themes/index.ts
import type { ITheme } from 'xterm'

export type ThemeId =
  | 'github-dark'
  | 'dracula'
  | 'tokyo-night'
  | 'nord'
  | 'catppuccin'
  | 'solarized-light'

export interface ThemeEntry {
  name: string
  /** Hex color for the color dot in the popup UI */
  dot: string
  /** Full xterm.js ITheme color set */
  xterm: ITheme
}

export const DEFAULT_THEME_ID: ThemeId = 'github-dark'

export const THEMES: Record<ThemeId, ThemeEntry> = {
  'github-dark': {
    name: 'GitHub Dark',
    dot: '#0d1117',
    xterm: {
      background: '#0d1117',
      foreground: '#cdd9e5',
      cursor: '#cdd9e5',
      selectionBackground: '#264f78',
      black: '#484f58',   red: '#ff7b72',   green: '#3fb950',   yellow: '#d29922',
      blue: '#388bfd',   magenta: '#bc8cff', cyan: '#39c5cf',   white: '#b1bac4',
      brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364', brightYellow: '#e3b341',
      brightBlue: '#79c0ff', brightMagenta: '#d2a8ff', brightCyan: '#56d8dd', brightWhite: '#cdd9e5'
    }
  },
  'dracula': {
    name: 'Dracula',
    dot: '#282a36',
    xterm: {
      background: '#282a36',
      foreground: '#f8f8f2',
      cursor: '#f8f8f2',
      selectionBackground: '#44475a',
      black: '#21222c',   red: '#ff5555',   green: '#50fa7b',   yellow: '#f1fa8c',
      blue: '#bd93f9',   magenta: '#ff79c6', cyan: '#8be9fd',   white: '#f8f8f2',
      brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94', brightYellow: '#ffffa5',
      brightBlue: '#d6acff', brightMagenta: '#ff92df', brightCyan: '#a4ffff', brightWhite: '#ffffff'
    }
  },
  'tokyo-night': {
    name: 'Tokyo Night',
    dot: '#1a1b26',
    xterm: {
      background: '#1a1b26',
      foreground: '#a9b1d6',
      cursor: '#a9b1d6',
      selectionBackground: '#283457',
      black: '#32344a',   red: '#f7768e',   green: '#9ece6a',   yellow: '#e0af68',
      blue: '#7aa2f7',   magenta: '#ad8ee6', cyan: '#449dab',   white: '#787c99',
      brightBlack: '#444b6a', brightRed: '#ff7a93', brightGreen: '#b9f27c', brightYellow: '#ff9e64',
      brightBlue: '#7da6ff', brightMagenta: '#bb9af7', brightCyan: '#0db9d7', brightWhite: '#acb0d0'
    }
  },
  'nord': {
    name: 'Nord',
    dot: '#2e3440',
    xterm: {
      background: '#2e3440',
      foreground: '#d8dee9',
      cursor: '#d8dee9',
      selectionBackground: '#434c5e',
      black: '#3b4252',   red: '#bf616a',   green: '#a3be8c',   yellow: '#ebcb8b',
      blue: '#81a1c1',   magenta: '#b48ead', cyan: '#88c0d0',   white: '#e5e9f0',
      brightBlack: '#4c566a', brightRed: '#bf616a', brightGreen: '#a3be8c', brightYellow: '#ebcb8b',
      brightBlue: '#81a1c1', brightMagenta: '#b48ead', brightCyan: '#8fbcbb', brightWhite: '#eceff4'
    }
  },
  'catppuccin': {
    name: 'Catppuccin Mocha',
    dot: '#1e1e2e',
    xterm: {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      cursor: '#f5e0dc',
      selectionBackground: '#313244',
      black: '#45475a',   red: '#f38ba8',   green: '#a6e3a1',   yellow: '#f9e2af',
      blue: '#89b4fa',   magenta: '#f5c2e7', cyan: '#94e2d5',   white: '#bac2de',
      brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1', brightYellow: '#f9e2af',
      brightBlue: '#89b4fa', brightMagenta: '#f5c2e7', brightCyan: '#94e2d5', brightWhite: '#a6adc8'
    }
  },
  'solarized-light': {
    name: 'Solarized Light',
    dot: '#fdf6e3',
    xterm: {
      background: '#fdf6e3',
      foreground: '#657b83',
      cursor: '#586e75',
      selectionBackground: '#eee8d5',
      black: '#073642',   red: '#dc322f',   green: '#859900',   yellow: '#b58900',
      blue: '#268bd2',   magenta: '#d33682', cyan: '#2aa198',   white: '#eee8d5',
      brightBlack: '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75', brightYellow: '#657b83',
      brightBlue: '#839496', brightMagenta: '#6c71c4', brightCyan: '#93a1a1', brightWhite: '#fdf6e3'
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/renderer/themes/index.test.ts
```

Expected: PASS — 6 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/themes/index.ts tests/renderer/themes/index.test.ts
git commit -m "feat: add terminal theme definitions (6 built-in themes)"
```

---

### Task 2: useThemeStore

**Files:**
- Create: `src/renderer/src/store/useThemeStore.ts`
- Create: `tests/renderer/store/useThemeStore.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/renderer/store/useThemeStore.test.ts`:

```ts
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
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/renderer/store/useThemeStore.test.ts
```

Expected: FAIL — `Cannot find module '../../../src/renderer/src/store/useThemeStore'`

- [ ] **Step 3: Create the store**

Create `src/renderer/src/store/useThemeStore.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/renderer/store/useThemeStore.test.ts
```

Expected: PASS — 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/store/useThemeStore.ts tests/renderer/store/useThemeStore.test.ts
git commit -m "feat: add useThemeStore with localStorage persistence"
```

---

### Task 3: ThemePopup component

**Files:**
- Create: `src/renderer/src/components/Sidebar/ThemePopup.tsx`

No automated component test — the project has no jsdom/React testing setup. Manual verification in Task 7.

- [ ] **Step 1: Create ThemePopup**

Create `src/renderer/src/components/Sidebar/ThemePopup.tsx`:

```tsx
// src/renderer/src/components/Sidebar/ThemePopup.tsx
import { useThemeStore } from '../../store/useThemeStore'
import { THEMES, type ThemeId } from '../../themes'

interface ThemePopupProps {
  onClose: () => void
}

export function ThemePopup({ onClose }: ThemePopupProps): JSX.Element {
  const themeId = useThemeStore((s) => s.themeId)
  const setTheme = useThemeStore((s) => s.setTheme)

  const themeIds = Object.keys(THEMES) as ThemeId[]

  const handleSelect = (id: ThemeId): void => {
    setTheme(id)
    onClose()
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: '100%',
      left: 0,
      right: 0,
      backgroundColor: '#161b22',
      border: '1px solid #30363d',
      borderRadius: '6px 6px 0 0',
      overflow: 'hidden',
      boxShadow: '0 -4px 16px rgba(0,0,0,0.4)',
      zIndex: 10
    }}>
      <div style={{
        padding: '6px 10px',
        fontSize: '9px',
        color: '#484f58',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        borderBottom: '1px solid #21262d'
      }}>
        选择主题
      </div>
      {themeIds.map((id) => {
        const entry = THEMES[id]
        const isSelected = id === themeId
        const needsBorder = id === 'github-dark' || id === 'solarized-light'
        return (
          <div
            key={id}
            onClick={() => handleSelect(id)}
            style={{
              padding: '6px 10px',
              fontSize: '11px',
              color: isSelected ? '#64ffda' : '#8892a4',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.background = '#0f3460'
                e.currentTarget.style.color = '#cdd9e5'
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = '#8892a4'
              }
            }}
          >
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              flexShrink: 0,
              background: entry.dot,
              border: needsBorder ? '1px solid #30363d' : 'none'
            }} />
            {entry.name}
            {isSelected && ' ✓'}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

```bash
npx tsc --noEmit
```

Expected: no errors (or only pre-existing errors unrelated to the new file)

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/Sidebar/ThemePopup.tsx
git commit -m "feat: add ThemePopup component"
```

---

### Task 4: SidebarBottomBar component

**Files:**
- Create: `src/renderer/src/components/Sidebar/SidebarBottomBar.tsx`

- [ ] **Step 1: Create SidebarBottomBar**

Create `src/renderer/src/components/Sidebar/SidebarBottomBar.tsx`:

```tsx
// src/renderer/src/components/Sidebar/SidebarBottomBar.tsx
import { useState, useRef, useEffect } from 'react'
import { ThemePopup } from './ThemePopup'

export function SidebarBottomBar(): JSX.Element {
  const [popupOpen, setPopupOpen] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  // Close popup when clicking outside the bottom bar (including the popup itself)
  useEffect(() => {
    if (!popupOpen) return
    const handleMouseDown = (e: MouseEvent): void => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setPopupOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [popupOpen])

  return (
    <div
      ref={barRef}
      style={{
        position: 'relative',
        borderTop: '1px solid #0f3460',
        flexShrink: 0,
        backgroundColor: '#111827',
        borderRadius: '0 0 0 0'
      }}
    >
      {/* Popup renders above the bar; position: absolute bottom: 100% */}
      {popupOpen && <ThemePopup onClose={() => setPopupOpen(false)} />}

      <div style={{
        padding: '5px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <button
          onClick={() => setPopupOpen((o) => !o)}
          title="切换主题"
          style={{
            background: popupOpen ? '#1c2744' : 'none',
            border: 'none',
            color: popupOpen ? '#a8b2d8' : '#484f58',
            cursor: 'pointer',
            padding: '3px 5px',
            borderRadius: '4px',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center'
          }}
          onMouseEnter={(e) => {
            if (!popupOpen) {
              e.currentTarget.style.color = '#a8b2d8'
              e.currentTarget.style.background = '#1c2744'
            }
          }}
          onMouseLeave={(e) => {
            if (!popupOpen) {
              e.currentTarget.style.color = '#484f58'
              e.currentTarget.style.background = 'none'
            }
          }}
        >
          {/* Swatches SVG: three outlined squares + one filled square */}
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="10" y="10" width="6" height="6" rx="1.5" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/Sidebar/SidebarBottomBar.tsx
git commit -m "feat: add SidebarBottomBar with theme switcher icon"
```

---

### Task 5: Wire SidebarBottomBar into Sidebar

**Files:**
- Modify: `src/renderer/src/components/Sidebar/Sidebar.tsx`

The current bottom of the sidebar renders `<QuickCommands />` as the last element (line 238). Add `<SidebarBottomBar />` after it.

- [ ] **Step 1: Add import to Sidebar.tsx**

In `src/renderer/src/components/Sidebar/Sidebar.tsx`, add the import after the `QuickCommands` import (line 7):

```tsx
import { SidebarBottomBar } from './SidebarBottomBar'
```

The import block should look like:

```tsx
import { GroupItem } from './GroupItem'
import { QuickCommands } from './QuickCommands'
import { SidebarBottomBar } from './SidebarBottomBar'
import { ProxyForm } from '../Proxy/ProxyForm'
```

- [ ] **Step 2: Add SidebarBottomBar after QuickCommands**

Find the closing of the outer `<div>` in the Sidebar return (current last two lines):

```tsx
      <QuickCommands />
    </div>
```

Replace with:

```tsx
      <QuickCommands />
      <SidebarBottomBar />
    </div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors

- [ ] **Step 4: Run all tests to confirm nothing broke**

```bash
npx vitest run
```

Expected: all existing tests pass, plus the new theme and store tests pass

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/Sidebar/Sidebar.tsx
git commit -m "feat: wire SidebarBottomBar into Sidebar"
```

---

### Task 6: Apply theme in TerminalPane

**Files:**
- Modify: `src/renderer/src/components/Terminal/TerminalPane.tsx`

Two changes:
1. Read theme from store when initializing `new Terminal()` so the first render uses the persisted theme
2. Subscribe to theme changes and hot-update `term.options.theme`

- [ ] **Step 1: Add imports to TerminalPane.tsx**

At the top of `src/renderer/src/components/Terminal/TerminalPane.tsx`, add after the existing imports:

```tsx
import { useThemeStore } from '../../store/useThemeStore'
import { THEMES } from '../../themes'
```

The full import block should start with:

```tsx
import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { useSessionStore } from '../../store/useSessionStore'
import { useTerminalOutputStore } from '../../store/useTerminalOutputStore'
import { useCommandHistoryStore } from '../../store/useCommandHistoryStore'
import { useActivityStore } from '../../store/useActivityStore'
import { useSplitStore } from '../../store/useSplitStore'
import { useThemeStore } from '../../store/useThemeStore'
import { THEMES } from '../../themes'
import { scheduleSave } from '../../store/persistSessions'
import 'xterm/css/xterm.css'
```

- [ ] **Step 2: Initialize Terminal with stored theme**

In the `useEffect([sessionId])` block, find the `new Terminal({...})` call (currently lines 64–74). Replace the hardcoded theme object with the stored theme:

```tsx
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: THEMES[useThemeStore.getState().themeId].xterm
    })
```

(The `selectionBackground` field is now included inside each theme's xterm object, so remove the separate `selectionBackground` line — it was part of the old hardcoded object. Just make sure the `new Terminal` call uses `THEMES[...].xterm` and nothing else in the theme field.)

- [ ] **Step 3: Add useThemeStore subscription at the top of TerminalPane function body**

Inside the `TerminalPane` function, after the existing `const markDisconnected = ...` line, add:

```tsx
  const themeId = useThemeStore((s) => s.themeId)
```

- [ ] **Step 4: Add useEffect to hot-update theme on change**

Add a new `useEffect` after the existing `useEffect` for keyboard shortcuts (after line ~230). Place it before the `return` statement:

```tsx
  // Hot-update terminal theme when themeId changes
  useEffect(() => {
    if (!termRef.current) return
    termRef.current.options.theme = THEMES[themeId].xterm
  }, [themeId])
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors

- [ ] **Step 6: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/Terminal/TerminalPane.tsx
git commit -m "feat: apply theme from store in TerminalPane (hot-update on change)"
```

---

### Task 7: Add theme commands to CommandPalette

**Files:**
- Modify: `src/renderer/src/components/CommandPalette/CommandPalette.tsx`

- [ ] **Step 1: Add imports to CommandPalette.tsx**

In `src/renderer/src/components/CommandPalette/CommandPalette.tsx`, add after the existing imports:

```tsx
import { useThemeStore } from '../../store/useThemeStore'
import { THEMES, type ThemeId } from '../../themes'
```

- [ ] **Step 2: Subscribe to current themeId inside the component**

Inside the `CommandPalette` function body, after the existing `useSessionStore`/`useConfigStore` calls, add:

```tsx
  const currentThemeId = useThemeStore((s) => s.themeId)
  const setTheme = useThemeStore((s) => s.setTheme)
```

- [ ] **Step 3: Add theme commands to the useMemo commands array**

Inside the `useMemo` callback, after the `config.quickCommands.forEach(...)` block and before `return cmds`, add:

```tsx
    const themeIds = Object.keys(THEMES) as ThemeId[]
    themeIds.forEach((id) => {
      cmds.push({
        id: `theme-${id}`,
        label: `切换主题：${THEMES[id].name}`,
        description: id === currentThemeId ? '当前主题' : undefined,
        action: () => {
          setTheme(id)
          onClose()
        }
      })
    })
```

- [ ] **Step 4: Add currentThemeId and setTheme to the useMemo dependency array**

The existing dependency array (line ~109) ends with `onClose]`. Add `currentThemeId` and `setTheme`:

```tsx
  }, [sessions, config.quickCommands, leaves, activePaneId, addSession, splitPane, closePane, assignSession, getActivePaneSessionId, onClose, currentThemeId, setTheme])
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors

- [ ] **Step 6: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/CommandPalette/CommandPalette.tsx
git commit -m "feat: add theme switching commands to CommandPalette"
```

---

### Task 8: Manual end-to-end verification

- [ ] **Step 1: Start the app**

```bash
npm run dev
```

- [ ] **Step 2: Verify bottom toolbar icon appears**

The sidebar should show a small swatches icon (three outlined squares + one filled) at the very bottom, below the quick commands section.

- [ ] **Step 3: Verify theme popup**

Click the icon. A popup should appear above the icon with "选择主题" header and 6 items: GitHub Dark ✓, Dracula, Tokyo Night, Nord, Catppuccin Mocha, Solarized Light. Each has a color dot on the left.

- [ ] **Step 4: Switch to each theme**

Click each theme. The xterm terminal area should immediately change colors. The popup should close after selection. Re-open the popup — the newly selected theme should show ✓.

- [ ] **Step 5: Verify Cmd+K command palette**

Press Cmd+K. Type "主题". Six "切换主题：..." commands should appear. Press Enter on one — terminal theme changes.

- [ ] **Step 6: Verify persistence**

Select a non-default theme (e.g., Dracula). Quit and reopen the app. The terminal should open with the Dracula theme (purple background).

- [ ] **Step 7: Final commit if any manual fixes were needed**

```bash
git add -p
git commit -m "fix: [describe any manual fixes]"
```
