# Terminal Theme Support — Design Spec

**Date:** 2026-05-07  
**Status:** Approved  

---

## Goal

Allow users to switch the terminal color theme from a set of 6 built-in presets, without restarting the app. The setting persists across restarts.

---

## Scope

- **In scope:** 6 built-in theme presets, sidebar bottom toolbar icon, upward popup panel, Cmd+K command palette entry, persistent storage
- **Out of scope:** Custom color editing, per-session themes, light/dark sidebar toggle

---

## Themes

| ID | Display Name |
|---|---|
| `github-dark` | GitHub Dark |
| `dracula` | Dracula |
| `tokyo-night` | Tokyo Night |
| `nord` | Nord |
| `catppuccin` | Catppuccin Mocha |
| `solarized-light` | Solarized Light |

Each theme is a plain object with the full xterm.js `ITheme` color set (background, foreground, cursor, black, red, green, yellow, blue, magenta, cyan, white, and their bright variants).

---

## Architecture

### Data flow

```
useThemeStore (Zustand + persist)
  └─ ThemeId (string union)
  └─ setTheme(id) → writes store → triggers re-renders

SidebarBottomBar
  └─ reads themeId from store
  └─ renders swatches SVG icon button
  └─ manages open/close state of ThemePopup (local useState)

ThemePopup
  └─ renders 6 items with color dot + name
  └─ marks current theme with ✓
  └─ calls setTheme on click → closes itself

TerminalPane
  └─ subscribes to themeId
  └─ on change: term.options.theme = THEMES[themeId]  ← hot update, no recreate
```

### Persistence

`useThemeStore` uses Zustand `persist` middleware with `localStorage`. Key: `idea-terminal-theme`. The `ConfigManager`/`shared/types.ts` `theme` field is **not** changed — theme is renderer-only state, no need to write to the main-process config file.

---

## Files

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/renderer/src/themes/index.ts` | `THEMES` map and `ThemeId` union type |
| Create | `src/renderer/src/store/useThemeStore.ts` | Zustand store with persist |
| Create | `src/renderer/src/components/Sidebar/ThemePopup.tsx` | Popup with 6 theme items |
| Modify | `src/renderer/src/components/Sidebar/index.tsx` | Add `SidebarBottomBar` section |
| Create | `src/renderer/src/components/Sidebar/SidebarBottomBar.tsx` | Bottom toolbar with swatches icon |
| Modify | `src/renderer/src/components/Terminal/TerminalPane.tsx` | Subscribe to themeId, apply on change |
| Modify | `src/renderer/src/components/CommandPalette/` | Add "切换主题" commands |

---

## Component Details

### `THEMES` (`themes/index.ts`)

```ts
export type ThemeId = 'github-dark' | 'dracula' | 'tokyo-night' | 'nord' | 'catppuccin' | 'solarized-light'

export const THEMES: Record<ThemeId, { name: string; dot: string; xterm: ITheme }> = { ... }

export const DEFAULT_THEME_ID: ThemeId = 'github-dark'
```

Each entry has:
- `name` — display string
- `dot` — hex color for the color dot in the popup
- `xterm` — full xterm.js `ITheme` object

### `useThemeStore`

```ts
interface ThemeStore {
  themeId: ThemeId
  setTheme: (id: ThemeId) => void
}
// persisted to localStorage key 'idea-terminal-theme'
```

### `SidebarBottomBar`

- Fixed to bottom of sidebar, below quick commands area
- Contains one button: swatches SVG icon (four small squares, one filled)
- Icon color: `#484f58` idle, `#a8b2d8` hover/active
- On click: toggles `ThemePopup` open/closed
- Clicking outside the popup closes it (standard `useClickOutside` or `onBlur`)

### SVG Icon (swatches, 14×14)

```svg
<svg width="14" height="14" viewBox="0 0 18 18" fill="none">
  <rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
  <rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
  <rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
  <rect x="10" y="10" width="6" height="6" rx="1.5" fill="currentColor"/>
</svg>
```

### `ThemePopup`

- Positioned absolute, bottom of bottom bar, left-aligned, width ~184px
- Opens upward (above the bottom bar)
- Header: "选择主题" label
- Each item: color dot (8×8 circle) + theme name, current marked with ✓
- Click item → `setTheme(id)` → close popup
- Box shadow: `0 -4px 16px rgba(0,0,0,0.4)`

### `TerminalPane` changes

Add a `useEffect` subscribing to `themeId`:

```ts
const themeId = useThemeStore((s) => s.themeId)

useEffect(() => {
  if (!termRef.current) return
  termRef.current.options.theme = THEMES[themeId].xterm
}, [themeId])
```

This is a hot update — xterm applies theme immediately without recreating the terminal.

### Command Palette

Add 6 entries under the category "主题":

```
切换主题: GitHub Dark     → setTheme('github-dark')
切换主题: Dracula         → setTheme('dracula')
切换主题: Tokyo Night     → setTheme('tokyo-night')
切换主题: Nord            → setTheme('nord')
切换主题: Catppuccin Mocha → setTheme('catppuccin')
切换主题: Solarized Light  → setTheme('solarized-light')
```

---

## Edge Cases

1. **Unknown themeId in localStorage** (corrupted or future migration): fall back to `github-dark` silently.
2. **Terminal not yet mounted when theme changes**: the `useEffect` guards with `if (!termRef.current) return`; on mount, xterm is initialized with the current store value.
3. **Solarized Light (light theme)**: xterm area turns light while sidebar stays dark — expected, no special handling needed.
4. **Popup open during session switch**: popup is global (not per-session), stays open; click outside to dismiss.
5. **Multiple TerminalPanes**: all panes share the same store, all update simultaneously — desired behavior.

---

## Testing Strategy

| Layer | What to test |
|---|---|
| Unit | `useThemeStore`: initial value is `github-dark`, `setTheme` updates, persists to/from localStorage |
| Unit | `THEMES` object: all 6 IDs present, each has `name`, `dot`, and full `xterm` color object |
| Integration | `ThemePopup`: renders 6 items, clicking one calls `setTheme` with correct ID, current theme shows ✓ |
| Integration | `SidebarBottomBar`: clicking swatches icon opens/closes `ThemePopup` |
| Integration | Theme change triggers `term.options.theme` update in `TerminalPane` |
| Manual e2e | Switch theme, restart app, confirm theme persists |
