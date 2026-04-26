# Terminal Activity Notification — Design Spec

## Goal

When a background terminal (e.g. running opencode or claude code) stops producing output while the user is in another app, send a macOS system notification identifying which terminal needs attention. Show a persistent orange dot on that session row in the sidebar.

## Architecture

Four-component change, all in the renderer process. No IPC or main-process changes needed: Web Notifications API works natively in Electron's renderer, and `document.hasFocus()` / `document.visibilityState` provide focus state without IPC.

## Component Design

### 1. `useActivityStore` (new)

Tracks which sessions have unread activity. Simple set of session IDs.

```typescript
interface ActivityStore {
  unread: Record<string, true>  // sessionId → true
  markActivity: (sessionId: string) => void
  clearActivity: (sessionId: string) => void
  hasActivity: (sessionId: string) => boolean
}
```

### 2. TerminalPane — activity detection + notification

In the `onData` handler, when `!isActive`:
- Call `markActivity(sessionId)` immediately (sidebar dot appears)
- Reset a 2-second quiet-period timer (via `useRef`)
- When the timer fires: if `!document.hasFocus()`, send a system notification

When `isActive` becomes `true`: call `clearActivity(sessionId)` (dot disappears).

**Notification cooldown:** A module-level `Map<sessionId, timestamp>` prevents re-notifying the same session within 30 seconds.

**Notification click handler:**
```
window.focus()
→ if session is already in a pane: setActivePane(pane.id)
→ else: assignSession(activePaneId, sessionId)
```

### 3. GroupItem — orange activity dot

When `hasActivity(session.id)` is true, render a small orange `●` immediately before the session title. Pulse animation (CSS keyframe) draws the eye. The dot disappears automatically when `clearActivity` fires (session becomes active in TerminalPane).

No explicit click handler needed on the dot — clicking the session row already triggers `handleSessionClick` which activates the session, and activation triggers `clearActivity` via TerminalPane's `isActive` effect.

### 4. App.tsx — permission request on startup

Call `Notification.requestPermission()` once in the init `useEffect`, after `loadConfig()`. If permission is already granted or denied, this is a no-op.

## Notification Content

- **Title:** `IDEA Terminal`
- **Body:** `终端「{session.title}」需要您的操作`
- **Icon:** (none — Electron uses the app icon automatically)

## Edge Cases

- **Permission denied:** Notifications silently skipped; sidebar dot still works.
- **Session closed before timer fires:** Timer callback checks `useSessionStore.getState().sessions.find(s => s.id === sessionId)` — if gone, skip notification.
- **Multiple sessions active at same time:** Each session has its own independent quiet-period timer (stored in a `useRef` map keyed by sessionId inside TerminalPane).

Wait — TerminalPane is mounted one-per-pane, not one-per-session. If a session is not assigned to any pane, there's no TerminalPane for it. Activity detection only fires for sessions currently visible in a pane but not the *active* pane. This is fine for the use case: the AI tool is running in a pane the user has moved away from.

## Files

- Create: `src/renderer/src/store/useActivityStore.ts`
- Modify: `src/renderer/src/components/Terminal/TerminalPane.tsx`
- Modify: `src/renderer/src/components/Sidebar/GroupItem.tsx`
- Modify: `src/renderer/src/App.tsx`
