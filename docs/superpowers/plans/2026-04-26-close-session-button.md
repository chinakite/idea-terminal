# Close Session Button — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `×` close button to each session row in the sidebar so users can close individual terminals.

**Architecture:** Single-file change to `GroupItem.tsx`. All required methods (`clearSession`, `assignSession`, `closeSession`, `window.api.destroy`) already exist. The close handler picks the next session in the same group to display in the vacated pane, falling back to any remaining session, or blanks the pane if none remain.

**Tech Stack:** React 18, TypeScript, Zustand, Electron IPC (`window.api.destroy`)

---

### Task 1: Add close button and handler to GroupItem

**Files:**
- Modify: `src/renderer/src/components/Sidebar/GroupItem.tsx`

**Context on existing code:**

`GroupItem.tsx` renders each session as a row. On hover it currently shows a `✏` rename button. Store subscriptions are at lines ~67–75. The session row JSX is at lines ~274–365. The hover button block (currently only `✏`) is at lines ~331–349.

The `useSplitStore` already has:
- `clearSession(sessionId)` — sets any pane showing that session to `sessionId: null`
- `assignSession(paneId, sessionId)` — assigns a session to a specific pane
- `collectLeaves()` — returns all panes with their current `sessionId`

The `useSessionStore` already has:
- `closeSession(id)` — removes session from the store and calls `saveNow()`

`window.api.destroy(id)` — IPC call that kills the PTY process in main.

---

- [ ] **Step 1: Add `clearSession` to store subscriptions**

In `GroupItem.tsx`, find the block of store subscriptions (around line 67–75):

```typescript
const collectLeaves = useSplitStore((s) => s.collectLeaves)
const setActivePane = useSplitStore((s) => s.setActivePane)
const assignSession = useSplitStore((s) => s.assignSession)
```

Add `clearSession` on the line after `assignSession`:

```typescript
const collectLeaves = useSplitStore((s) => s.collectLeaves)
const setActivePane = useSplitStore((s) => s.setActivePane)
const assignSession = useSplitStore((s) => s.assignSession)
const clearSession = useSplitStore((s) => s.clearSession)
```

---

- [ ] **Step 2: Add `handleCloseSession` handler**

Add this function in the `// ── Helpers ──` section of `GroupItem.tsx`, after `getProxyName` and before `activePaneSessionId` (around line 78):

```typescript
const handleCloseSession = async (session: RuntimeSession): Promise<void> => {
  const leaves = collectLeaves()
  const pane = leaves.find((l) => l.sessionId === session.id)
  const remaining = useSessionStore.getState().sessions.filter((s) => s.id !== session.id)

  if (pane) {
    if (remaining.length > 0) {
      // Prefer adjacent session in the same group, fall back to any remaining
      const currentIdx = sessions.findIndex((s) => s.id === session.id)
      const nextInGroup = sessions[currentIdx + 1] ?? sessions[currentIdx - 1]
      const next = nextInGroup ?? remaining[0]
      assignSession(pane.id, next.id)
    } else {
      clearSession(session.id)
    }
  }

  await window.api.destroy(session.id)
  closeSession(session.id)
}
```

Note: `useSessionStore` is already imported at the top of the file. `sessions` refers to the `sessions` prop passed to `GroupItem`.

---

- [ ] **Step 3: Add `×` button to the session row hover area**

Find the hover button block (around line 331–349). Currently it renders only the `✏` button inside `{isHovered && !isRenamingThis && (...)}`. Replace that entire block with a fragment containing both `✏` and `×`:

```tsx
{isHovered && !isRenamingThis && (
  <>
    <button
      onClick={(e) => {
        e.stopPropagation()
        setRenamingSessionId(session.id)
        setSessionRenameValue(session.title)
      }}
      title="重命名终端"
      style={{
        background: 'none', border: 'none', color: '#484f58',
        cursor: 'pointer', fontSize: '11px', padding: '0 1px',
        lineHeight: 1, flexShrink: 0
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = '#cdd9e5')}
      onMouseLeave={(e) => (e.currentTarget.style.color = '#484f58')}
    >
      ✏
    </button>
    <button
      onClick={(e) => {
        e.stopPropagation()
        handleCloseSession(session).catch(console.error)
      }}
      title="关闭终端"
      style={{
        background: 'none', border: 'none', color: '#484f58',
        cursor: 'pointer', fontSize: '13px', padding: '0 1px',
        lineHeight: 1, flexShrink: 0
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = '#f85149')}
      onMouseLeave={(e) => (e.currentTarget.style.color = '#484f58')}
    >
      ×
    </button>
  </>
)}
```

---

- [ ] **Step 4: Verify with `npm run dev`**

Run the app:
```bash
npm run dev
```

Manual test checklist:
1. Open 3 terminals. Hover over the middle one — confirm `✏ ×` both appear.
2. Click `×` on the middle terminal. Confirm:
   - The session disappears from the sidebar.
   - The pane switches to an adjacent session (not blank).
3. Click `×` on one of the remaining two. Confirm the pane switches to the last one.
4. Click `×` on the last terminal. Confirm the pane goes blank (shows the empty state).
5. Confirm the `✏` rename button still works normally after the `×` button is added.

---

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/Sidebar/GroupItem.tsx
git commit -m "feat: add close button to session rows in sidebar"
```
