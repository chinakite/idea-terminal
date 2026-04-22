# Logo Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain "IDEA TERMINAL" text header in the sidebar with a terminal-window SVG icon, stacked two-line name, and a version number in the bottom-right corner of the header block.

**Architecture:** Three small, sequential changes across three files: (1) teach Vite to inject `__APP_VERSION__` from `package.json` at build time; (2) declare the global constant type so TypeScript is happy; (3) swap the logo `<div>` in Sidebar with the new SVG + stacked text + version layout. No new files are created.

**Tech Stack:** electron-vite, React 18, TypeScript, Vite `define`

---

## File Map

| File | Change |
|---|---|
| `electron.vite.config.ts` | Import `package.json`; add `define: { __APP_VERSION__ }` to renderer config |
| `src/renderer/src/types/api.ts` | Add `const __APP_VERSION__: string` inside existing `declare global` block |
| `src/renderer/src/components/Sidebar/Sidebar.tsx` | Replace logo `<div>` (lines 79–84) with SVG icon + stacked text + corner version |

---

### Task 1: Wire up `__APP_VERSION__` build-time injection

**Files:**
- Modify: `electron.vite.config.ts`
- Modify: `src/renderer/src/types/api.ts`

- [ ] **Step 1: Add the version define to `electron.vite.config.ts`**

Replace the entire file with:

```typescript
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version)
    }
  }
})
```

- [ ] **Step 2: Declare the global constant type in `src/renderer/src/types/api.ts`**

The file already has a `declare global` block. Add `const __APP_VERSION__: string` inside it so every renderer file can use the constant without importing anything.

The full updated `declare global` block at the bottom of `src/renderer/src/types/api.ts` should be:

```typescript
declare global {
  interface Window {
    api: TerminalAPI
  }
  // Injected at build time via Vite define — always matches package.json version
  const __APP_VERSION__: string
}
```

(Leave everything else in the file unchanged.)

- [ ] **Step 3: Verify TypeScript compiles without errors**

Run:
```bash
npx tsc --noEmit
```

Expected: zero errors. If you see `Cannot find name '__APP_VERSION__'`, the declaration in step 2 was placed outside `declare global` — fix placement and re-run.

- [ ] **Step 4: Commit**

```bash
git add electron.vite.config.ts src/renderer/src/types/api.ts
git commit -m "feat: inject __APP_VERSION__ from package.json via Vite define"
```

---

### Task 2: Implement the logo in Sidebar.tsx

**Files:**
- Modify: `src/renderer/src/components/Sidebar/Sidebar.tsx`

- [ ] **Step 1: Replace the plain-text logo `<div>` with the new logo block**

In `src/renderer/src/components/Sidebar/Sidebar.tsx`, find and replace the current header block (lines 79–84):

```tsx
      <div style={{
        padding: '12px', color: '#e94560', fontWeight: 'bold',
        fontSize: '12px', letterSpacing: '1px', borderBottom: '1px solid #0f3460'
      }}>
        IDEA TERMINAL
      </div>
```

Replace with:

```tsx
      {/* ── Logo header ── */}
      <div style={{
        padding: '10px 12px', borderBottom: '1px solid #0f3460',
        display: 'flex', alignItems: 'center', gap: '8px'
      }}>
        {/* Terminal-window SVG icon — 22×22, inline, no external file */}
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="1" width="18" height="18" rx="3" stroke="#e94560" strokeWidth="1.5"/>
          <polyline points="5,7 9,10 5,13" stroke="#e94560" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <line x1="11" y1="13" x2="15" y2="13" stroke="#e94560" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        {/* Stacked two-line name */}
        <div style={{ flex: 1 }}>
          <div style={{ color: '#e94560', fontWeight: 700, fontSize: '11px', letterSpacing: '1.5px', lineHeight: 1.3 }}>
            IDEA
          </div>
          <div style={{ color: '#a8b2d8', fontSize: '9px', letterSpacing: '2px', opacity: 0.7 }}>
            TERMINAL
          </div>
        </div>
        {/* Version — bottom-right corner of the header block */}
        <div style={{ fontFamily: 'monospace', fontSize: '8px', color: '#484f58', alignSelf: 'flex-end', paddingBottom: '1px' }}>
          v{__APP_VERSION__}
        </div>
      </div>
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

```bash
npx tsc --noEmit
```

Expected: zero errors. A `Cannot find name '__APP_VERSION__'` error means Task 1 Step 2 was not completed — the global declaration is missing.

- [ ] **Step 3: Start the dev server and visually verify the logo**

```bash
npm run dev
```

Open the app. The sidebar header should show:
- A 22×22 terminal-window SVG icon on the left (red `#e94560` stroke, rounded rect with `>` chevron and underscore line)
- "IDEA" in bold red (`#e94560`), 11px, letter-spacing 1.5px
- "TERMINAL" below it in muted blue-grey (`#a8b2d8`), 9px, letter-spacing 2px, slightly faded
- "v1.0.0" (or current version) in tiny monospace (`#484f58`) at the bottom-right corner of the header block
- A `#0f3460` border underneath the header (same as before)

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/Sidebar/Sidebar.tsx
git commit -m "feat: replace plain text logo with SVG icon, stacked name, and version"
```
