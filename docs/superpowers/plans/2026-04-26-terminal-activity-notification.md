# Terminal Activity Notification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a background terminal stops producing output while the user is in another app, show an orange pulsing dot on the sidebar session row and send a macOS system notification identifying which session needs attention.

**Architecture:** Four-component change in the renderer process only. A new `useActivityStore` (Zustand) tracks which sessions have unread activity. `TerminalPane` detects output on non-active panes, marks activity, and fires a Web Notification after a 2-second quiet period. `GroupItem` renders an orange pulsing dot when a session has unread activity. `App.tsx` requests notification permission on startup.

**Tech Stack:** React, Zustand, Web Notifications API (`new Notification()`), `document.hasFocus()`, xterm.js `onData`

---

### Task 1: Create `useActivityStore`

**Files:**
- Create: `src/renderer/src/store/useActivityStore.ts`
- Create: `tests/renderer/store/useActivityStore.test.ts`

---

- [ ] **Step 1: Write the failing test**

Create `tests/renderer/store/useActivityStore.test.ts`:

```typescript
// tests/renderer/store/useActivityStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useActivityStore } from '../../../src/renderer/src/store/useActivityStore'

describe('useActivityStore', () => {
  beforeEach(() => {
    useActivityStore.setState({ unread: {} })
  })

  it('hasActivity returns false for unknown session', () => {
    expect(useActivityStore.getState().hasActivity('s1')).toBe(false)
  })

  it('markActivity sets session as unread', () => {
    useActivityStore.getState().markActivity('s1')
    expect(useActivityStore.getState().hasActivity('s1')).toBe(true)
  })

  it('clearActivity removes session from unread', () => {
    useActivityStore.getState().markActivity('s1')
    useActivityStore.getState().clearActivity('s1')
    expect(useActivityStore.getState().hasActivity('s1')).toBe(false)
  })

  it('markActivity for one session does not affect others', () => {
    useActivityStore.getState().markActivity('s1')
    expect(useActivityStore.getState().hasActivity('s2')).toBe(false)
  })

  it('clearActivity on unknown session is a no-op', () => {
    expect(() => useActivityStore.getState().clearActivity('unknown')).not.toThrow()
    expect(useActivityStore.getState().hasActivity('unknown')).toBe(false)
  })

  it('multiple sessions can be unread simultaneously', () => {
    useActivityStore.getState().markActivity('s1')
    useActivityStore.getState().markActivity('s2')
    expect(useActivityStore.getState().hasActivity('s1')).toBe(true)
    expect(useActivityStore.getState().hasActivity('s2')).toBe(true)
  })
})
```

---

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal && npm test -- tests/renderer/store/useActivityStore.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: 6 tests FAIL (module not found).

---

- [ ] **Step 3: Create the store**

Create `src/renderer/src/store/useActivityStore.ts`:

```typescript
// src/renderer/src/store/useActivityStore.ts
import { create } from 'zustand'

interface ActivityStore {
  unread: Record<string, true>
  markActivity: (sessionId: string) => void
  clearActivity: (sessionId: string) => void
  hasActivity: (sessionId: string) => boolean
}

export const useActivityStore = create<ActivityStore>((set, get) => ({
  unread: {},

  markActivity: (sessionId) => {
    set((state) => ({ unread: { ...state.unread, [sessionId]: true } }))
  },

  clearActivity: (sessionId) => {
    set((state) => {
      const next = { ...state.unread }
      delete next[sessionId]
      return { unread: next }
    })
  },

  hasActivity: (sessionId) => {
    return !!get().unread[sessionId]
  }
}))
```

---

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal && npm test -- tests/renderer/store/useActivityStore.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: 6 tests PASS.

---

- [ ] **Step 5: Commit**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal && git add src/renderer/src/store/useActivityStore.ts tests/renderer/store/useActivityStore.test.ts && git commit -m "feat: add useActivityStore for tracking unread terminal activity"
```

---

### Task 2: Wire activity detection and notifications into TerminalPane

**Files:**
- Modify: `src/renderer/src/components/Terminal/TerminalPane.tsx`

Context: `TerminalPane` is mounted one-per-pane. It receives `sessionId` (the currently displayed session) and `isActive` (whether this pane is the focused pane). The `onData` handler is registered inside a `useEffect([sessionId])` — so it runs once per mount and captures `sessionId` from the closure, but `isActive` would be stale. We use a `useRef` to keep `isActive` current inside the closure.

The `onData` callback is where output from the PTY arrives. When `!isActiveRef.current`, we mark activity and start a 2-second quiet timer. When the timer fires, if `!document.hasFocus()` and the session still exists and is not in cooldown, we send a system notification. Notification click navigates to the session.

A module-level `Map<sessionId, timestamp>` provides a 30-second cooldown to prevent notification spam.

---

- [ ] **Step 1: Add imports**

In `src/renderer/src/components/Terminal/TerminalPane.tsx`, change the import block from:

```typescript
import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { useSessionStore } from '../../store/useSessionStore'
import { useTerminalOutputStore } from '../../store/useTerminalOutputStore'
import { useCommandHistoryStore } from '../../store/useCommandHistoryStore'
import { scheduleSave } from '../../store/persistSessions'
import 'xterm/css/xterm.css'
```

To:

```typescript
import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { useSessionStore } from '../../store/useSessionStore'
import { useTerminalOutputStore } from '../../store/useTerminalOutputStore'
import { useCommandHistoryStore } from '../../store/useCommandHistoryStore'
import { useActivityStore } from '../../store/useActivityStore'
import { useSplitStore } from '../../store/useSplitStore'
import { scheduleSave } from '../../store/persistSessions'
import 'xterm/css/xterm.css'
```

---

- [ ] **Step 2: Add module-level cooldown constants**

After the import block (before `interface TerminalPaneProps`), add:

```typescript
/** Prevents re-notifying the same session within 30 seconds. */
const notificationCooldowns = new Map<string, number>()
const COOLDOWN_MS = 30_000
const QUIET_PERIOD_MS = 2_000
```

---

- [ ] **Step 3: Add `isActiveRef` and `quietTimerRef` inside the component**

In `TerminalPane`, after the existing refs block:
```typescript
const cleanupRef = useRef<(() => void)[]>([])
const markDisconnected = useSessionStore((s) => s.markDisconnected)
```

Add:

```typescript
/** Keeps isActive current inside the onData closure (avoids stale closure). */
const isActiveRef = useRef(isActive)
/** Timer ID for the 2-second quiet period before firing a notification. */
const quietTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

---

- [ ] **Step 4: Update the `isActive` effect to sync the ref and clear activity**

Change the existing effect:
```typescript
// Focus and fit when this pane becomes active
useEffect(() => {
  if (isActive) {
    fit()
    termRef.current?.focus()
  }
}, [isActive, fit])
```

To:

```typescript
// Sync ref so the onData closure always sees the current value
// Focus and fit when this pane becomes active; clear the activity dot
useEffect(() => {
  isActiveRef.current = isActive
  if (isActive) {
    fit()
    termRef.current?.focus()
    useActivityStore.getState().clearActivity(sessionId)
  }
}, [isActive, fit, sessionId])
```

---

- [ ] **Step 5: Add activity detection inside the `onData` callback**

In the mount `useEffect([sessionId])`, change the `removeData` registration from:

```typescript
const removeData = window.api.onData(sessionId, (data) => {
  term.write(data)
  useTerminalOutputStore.getState().appendData(sessionId, data)
})
```

To:

```typescript
const removeData = window.api.onData(sessionId, (data) => {
  term.write(data)
  useTerminalOutputStore.getState().appendData(sessionId, data)

  // Activity detection: only for non-active panes
  if (!isActiveRef.current) {
    useActivityStore.getState().markActivity(sessionId)

    // Reset the quiet-period timer on every new chunk of output
    if (quietTimerRef.current !== null) clearTimeout(quietTimerRef.current)
    quietTimerRef.current = setTimeout(() => {
      quietTimerRef.current = null

      // Skip if the app window is focused
      if (document.hasFocus()) return

      // Skip if the session no longer exists
      const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId)
      if (!session) return

      // Skip if within the 30-second cooldown
      const now = Date.now()
      const lastNotified = notificationCooldowns.get(sessionId) ?? 0
      if (now - lastNotified < COOLDOWN_MS) return

      // Send system notification
      notificationCooldowns.set(sessionId, now)
      const notification = new Notification('IDEA Terminal', {
        body: `终端「${session.title}」需要您的操作`
      })
      notification.onclick = () => {
        window.focus()
        const leaves = useSplitStore.getState().collectLeaves()
        const existingPane = leaves.find((l) => l.sessionId === sessionId)
        if (existingPane) {
          useSplitStore.getState().setActivePane(existingPane.id)
        } else {
          const { activePaneId, assignSession } = useSplitStore.getState()
          if (activePaneId) assignSession(activePaneId, sessionId)
        }
      }
    }, QUIET_PERIOD_MS)
  }
})
```

---

- [ ] **Step 6: Add timer and activity cleanup to `cleanupRef`**

After the `cleanupRef.current = [...]` assignment (before the ResizeObserver block), add these two pushes:

```typescript
cleanupRef.current.push(() => {
  if (quietTimerRef.current !== null) {
    clearTimeout(quietTimerRef.current)
    quietTimerRef.current = null
  }
})
cleanupRef.current.push(() => {
  useActivityStore.getState().clearActivity(sessionId)
})
```

---

- [ ] **Step 7: Build TypeScript to check for errors**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal && npm run typecheck 2>&1 | tail -10
```

If `typecheck` is not a script, use:

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal && npx tsc --noEmit 2>&1 | tail -20
```

Expected: No TypeScript errors.

---

- [ ] **Step 8: Run full test suite**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal && npm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: All tests pass.

---

- [ ] **Step 9: Commit**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal && git add src/renderer/src/components/Terminal/TerminalPane.tsx && git commit -m "feat: detect background terminal activity and send system notifications"
```

---

### Task 3: Add orange activity dot to GroupItem

**Files:**
- Modify: `src/renderer/src/components/Sidebar/GroupItem.tsx`

Context: `GroupItem` renders a list of session rows. Each row has a green/red status dot (`●`), the session title, and hover buttons. When `hasActivity(session.id)` is true, we show a small orange pulsing `●` immediately before the title text. The dot disappears automatically when `clearActivity` fires (triggered by `TerminalPane`'s `isActive` effect when the session becomes active).

The pulse animation is injected into `document.head` once via a module-level side effect so the keyframe is defined globally without duplicating `<style>` tags.

---

- [ ] **Step 1: Add `useActivityStore` import and CSS keyframe injection**

In `src/renderer/src/components/Sidebar/GroupItem.tsx`, change the import block from:

```typescript
// src/renderer/src/components/Sidebar/GroupItem.tsx
import { useState, useEffect } from 'react'
import { useSplitStore } from '../../store/useSplitStore'
import { useConfigStore } from '../../store/useConfigStore'
import { useSessionStore } from '../../store/useSessionStore'
import type { RuntimeSession } from '../../store/useSessionStore'
```

To:

```typescript
// src/renderer/src/components/Sidebar/GroupItem.tsx
import { useState, useEffect } from 'react'
import { useSplitStore } from '../../store/useSplitStore'
import { useConfigStore } from '../../store/useConfigStore'
import { useSessionStore } from '../../store/useSessionStore'
import { useActivityStore } from '../../store/useActivityStore'
import type { RuntimeSession } from '../../store/useSessionStore'

// Inject the pulse keyframe once into the document head
if (typeof document !== 'undefined' && !document.getElementById('activity-pulse-style')) {
  const style = document.createElement('style')
  style.id = 'activity-pulse-style'
  style.textContent = `
    @keyframes activityPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.25; }
    }
  `
  document.head.appendChild(style)
}
```

---

- [ ] **Step 2: Subscribe to `useActivityStore` in the component**

In `GroupItem`, after the existing store subscriptions block (after `const moveSession = useSessionStore(...)`), add:

```typescript
// Subscribe to the reactive unread data object (not the function reference)
// so the component re-renders on every markActivity/clearActivity call.
const unread = useActivityStore((s) => s.unread)
const hasActivity = (sessionId: string): boolean => !!unread[sessionId]
```

---

- [ ] **Step 3: Render the orange activity dot in the session row**

In the session row JSX, find the existing status dot:

```typescript
<span style={{ color: session.status === 'disconnected' ? '#f85149' : '#64ffda', fontSize: '8px', flexShrink: 0 }}>●</span>
```

After that status dot (before the title `<span>` or rename `<input>`), add the activity dot:

```typescript
{hasActivity(session.id) && (
  <span
    style={{
      color: '#ff8c00',
      fontSize: '8px',
      flexShrink: 0,
      animation: 'activityPulse 1.2s ease-in-out infinite'
    }}
    title="需要您的操作"
  >
    ●
  </span>
)}
```

The full updated section (status dot + activity dot + title/rename) should look like:

```typescript
<span style={{ color: session.status === 'disconnected' ? '#f85149' : '#64ffda', fontSize: '8px', flexShrink: 0 }}>●</span>

{hasActivity(session.id) && (
  <span
    style={{
      color: '#ff8c00',
      fontSize: '8px',
      flexShrink: 0,
      animation: 'activityPulse 1.2s ease-in-out infinite'
    }}
    title="需要您的操作"
  >
    ●
  </span>
)}

{isRenamingThis ? (
  <input ... />
) : (
  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
    {session.title}
  </span>
)}
```

---

- [ ] **Step 4: Run full test suite**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal && npm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: All tests pass.

---

- [ ] **Step 5: Commit**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal && git add src/renderer/src/components/Sidebar/GroupItem.tsx && git commit -m "feat: show orange activity dot on sidebar session rows with unread output"
```

---

### Task 4: Request notification permission on app startup

**Files:**
- Modify: `src/renderer/src/App.tsx`

Context: The Web Notifications API requires the user to grant permission once. `Notification.requestPermission()` shows the macOS permission dialog on first run and is a no-op if permission is already granted or denied. It belongs in the startup `useEffect` right after `loadConfig()`.

---

- [ ] **Step 1: Add permission request after `loadConfig()`**

In `src/renderer/src/App.tsx`, find the init async function:

```typescript
const init = async (): Promise<void> => {
  await loadConfig()

  const snapshots = await window.api.loadSessionSnapshots()
```

Change it to:

```typescript
const init = async (): Promise<void> => {
  await loadConfig()

  // Request notification permission once; no-op if already granted or denied
  if ('Notification' in window) {
    Notification.requestPermission()
  }

  const snapshots = await window.api.loadSessionSnapshots()
```

---

- [ ] **Step 2: Run full test suite**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal && npm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: All tests pass.

---

- [ ] **Step 3: Commit**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal && git add src/renderer/src/App.tsx && git commit -m "feat: request notification permission on app startup"
```
