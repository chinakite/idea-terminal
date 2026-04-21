# Logo Design Spec

**Date:** 2026-04-22  
**Status:** Approved

---

## Overview

Replace the plain `IDEA TERMINAL` text header in the sidebar with a proper logo: a terminal-window SVG icon, two-line stacked name, and a version number in the corner.

---

## Visual Design

The sidebar header block (padding `10px 12px`, bordered bottom `#0f3460`) contains:

```
┌─────────────────────────────────────┐
│ [icon]  IDEA               v1.0.0   │
│         TERMINAL                    │
└─────────────────────────────────────┘
```

**Icon** — 22×22 inline SVG, no external file:
- Rounded rectangle (`rx=3`, stroke `#e94560`, stroke-width `1.5`)
- `>` chevron (polyline, stroke `#e94560`, stroke-linecap round)
- Horizontal underscore line (stroke `#e94560`)

**"IDEA"** — color `#e94560`, font-weight `700`, font-size `11px`, letter-spacing `1.5px`

**"TERMINAL"** — color `#a8b2d8`, font-size `9px`, letter-spacing `2px`, opacity `0.7`

**Version** — `v{__APP_VERSION__}`, font-family monospace, font-size `8px`, color `#484f58`, aligned to `flex-end` / `self-end` in the header row, sitting at the bottom-right corner of the block

---

## Version Injection

The version string is injected at build time via Vite's `define` feature so it always matches `package.json` and requires no manual updates.

**`electron.vite.config.ts`:** Import `package.json` and add to the `renderer` config:
```typescript
import pkg from './package.json'
// inside renderer:
define: {
  __APP_VERSION__: JSON.stringify(pkg.version)
}
```

**`src/renderer/src/types/api.ts`:** Add a global declaration:
```typescript
declare const __APP_VERSION__: string
```

---

## Files Affected

| File | Change |
|---|---|
| `electron.vite.config.ts` | Add `define` with `__APP_VERSION__` to renderer section |
| `src/renderer/src/types/api.ts` | Add `declare const __APP_VERSION__: string` |
| `src/renderer/src/components/Sidebar/Sidebar.tsx` | Replace logo `<div>` with SVG icon + stacked text + version |

---

## Out of Scope

- Animated logo or hover effects
- External image/font assets
- Changing the sidebar width or overall layout
