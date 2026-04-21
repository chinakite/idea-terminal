# Session Rename & Drag-and-Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users rename any terminal session inline from the sidebar, and drag sessions between groups with a precise insert-line indicator.

**Architecture:** Two store actions are added to `useSessionStore` (`renameSession`, `moveSession`). `GroupItem.tsx` gains per-session rename state (✏ icon on hover, same pattern as group rename) and HTML5 drag-and-drop state (insert-line indicator, group-header fallback drop zone). No new files needed.

**Tech Stack:** React 18, Zustand 4, TypeScript, Vitest, HTML5 Drag-and-Drop API

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/renderer/src/store/useSessionStore.ts` | **Modify** | Add `renameSession` and `moveSession` actions |
| `src/renderer/src/components/Sidebar/GroupItem.tsx` | **Modify** | Add session rename UI + drag-and-drop with insert-line indicator |
| `tests/renderer/store/useSessionStore.test.ts` | **Create** | Tests for `renameSession` and `moveSession` |

---

## Task 1: Add `renameSession` and `moveSession` to `useSessionStore`

**Files:**
- Modify: `src/renderer/src/store/useSessionStore.ts`
- Create: `tests/renderer/store/useSessionStore.test.ts`

---

- [ ] **Step 1: Write failing tests**

Create `tests/renderer/store/useSessionStore.test.ts`:

```typescript
// tests/renderer/store/useSessionStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from '../../../src/renderer/src/store/useSessionStore'
import type { RuntimeSession } from '../../../src/renderer/src/store/useSessionStore'

const s = (id: string, groupId: string, title: string): RuntimeSession => ({
  id, title, groupId, pid: 1, status: 'running'
})

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({ sessions: [], activeSessionId: null })
  })

  // ── renameSession ──────────────────────────────────────────────────────────

  describe('renameSession', () => {
    it('updates the title of the matching session', () => {
      useSessionStore.setState({ sessions: [s('s1', 'default', '终端 1')] })
      useSessionStore.getState().renameSession('s1', 'My Server')
      expect(useSessionStore.getState().sessions[0].title).toBe('My Server')
    })

    it('does not affect other sessions', () => {
      useSessionStore.setState({ sessions: [s('s1', 'default', '终端 1'), s('s2', 'default', '终端 2')] })
      useSessionStore.getState().renameSession('s1', 'Renamed')
      expect(useSessionStore.getState().sessions[1].title).toBe('终端 2')
    })

    it('does nothing when session id does not exist', () => {
      useSessionStore.setState({ sessions: [s('s1', 'default', '终端 1')] })
      useSessionStore.getState().renameSession('nonexistent', 'Renamed')
      expect(useSessionStore.getState().sessions[0].title).toBe('终端 1')
    })
  })

  // ── moveSession ────────────────────────────────────────────────────────────

  describe('moveSession', () => {
    beforeEach(() => {
      useSessionStore.setState({
        sessions: [
          s('a1', 'grp-a', 'A1'),
          s('a2', 'grp-a', 'A2'),
          s('b1', 'grp-b', 'B1'),
          s('b2', 'grp-b', 'B2'),
        ]
      })
    })

    it('updates the groupId of the moved session', () => {
      useSessionStore.getState().moveSession('a1', 'grp-b', 'b2')
      const moved = useSessionStore.getState().sessions.find((s) => s.id === 'a1')
      expect(moved?.groupId).toBe('grp-b')
    })

    it('inserts immediately after insertAfterId', () => {
      useSessionStore.getState().moveSession('a1', 'grp-b', 'b1')
      const ids = useSessionStore.getState().sessions.map((s) => s.id)
      expect(ids.indexOf('a1')).toBe(ids.indexOf('b1') + 1)
    })

    it('inserts before the first session of target group when insertAfterId is null', () => {
      useSessionStore.getState().moveSession('a1', 'grp-b', null)
      const ids = useSessionStore.getState().sessions.map((s) => s.id)
      expect(ids.indexOf('a1')).toBeLessThan(ids.indexOf('b1'))
    })

    it('appends to end when insertAfterId is null and target group has no sessions', () => {
      useSessionStore.getState().moveSession('a1', 'grp-empty', null)
      const moved = useSessionStore.getState().sessions.find((s) => s.id === 'a1')
      expect(moved?.groupId).toBe('grp-empty')
    })

    it('handles same-group reorder: move a1 after a2 within grp-a', () => {
      useSessionStore.getState().moveSession('a1', 'grp-a', 'a2')
      const ids = useSessionStore.getState().sessions.map((s) => s.id)
      expect(ids.indexOf('a1')).toBe(ids.indexOf('a2') + 1)
    })

    it('does nothing when session id does not exist', () => {
      const before = useSessionStore.getState().sessions.map((s) => s.id)
      useSessionStore.getState().moveSession('nonexistent', 'grp-b', null)
      const after = useSessionStore.getState().sessions.map((s) => s.id)
      expect(after).toEqual(before)
    })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal
npm test -- --reporter=verbose 2>&1 | grep -E "(FAIL|renameSession|moveSession)" | head -20
```

Expected: FAIL — `renameSession` and `moveSession` are not defined on the store yet.

- [ ] **Step 3: Add the two actions to `useSessionStore.ts`**

Replace the entire file:

```typescript
// src/renderer/src/store/useSessionStore.ts
import { create } from 'zustand'
import { useSplitStore } from './useSplitStore'

export interface RuntimeSession {
  id: string
  title: string
  groupId: string
  pid: number
  status: 'running' | 'disconnected'
  proxyId?: string
}

interface SessionStore {
  sessions: RuntimeSession[]
  activeSessionId: string | null
  addSession: (session: RuntimeSession) => void
  removeSession: (id: string) => void
  /** Atomically removes the session and nullifies any pane that was showing it. */
  closeSession: (id: string) => void
  setActive: (id: string) => void
  markDisconnected: (id: string) => void
  /** Updates the display title of an existing session. */
  renameSession: (id: string, title: string) => void
  /**
   * Moves a session to a different group and repositions it in the flat sessions array.
   * @param id             Session to move
   * @param targetGroupId  Destination group id
   * @param insertAfterId  Insert after this session id, or null to insert before the
   *                       first session already in targetGroupId (appends if group is empty)
   */
  moveSession: (id: string, targetGroupId: string, insertAfterId: string | null) => void
}

export const useSessionStore = create<SessionStore>((set) => ({
  sessions: [],
  activeSessionId: null,

  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: state.activeSessionId ?? session.id
    })),

  removeSession: (id) =>
    set((state) => {
      const remaining = state.sessions.filter((s) => s.id !== id)
      return {
        sessions: remaining,
        activeSessionId:
          state.activeSessionId === id ? (remaining[0]?.id ?? null) : state.activeSessionId
      }
    }),

  closeSession: (id) => {
    window.api.destroy(id)
    useSessionStore.getState().removeSession(id)
    useSplitStore.getState().clearSession(id)
  },

  setActive: (id) => set({ activeSessionId: id }),

  markDisconnected: (id) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, status: 'disconnected' } : s))
    })),

  renameSession: (id, title) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, title } : s))
    })),

  moveSession: (id, targetGroupId, insertAfterId) =>
    set((state) => {
      const session = state.sessions.find((s) => s.id === id)
      if (!session) return state
      const updated = { ...session, groupId: targetGroupId }
      // Remove from current position
      const remaining = state.sessions.filter((s) => s.id !== id)

      if (insertAfterId === null) {
        // Insert before the first existing session of targetGroupId
        const firstIdx = remaining.findIndex((s) => s.groupId === targetGroupId)
        if (firstIdx === -1) {
          // Target group has no sessions — append to end
          return { sessions: [...remaining, updated] }
        }
        const next = [...remaining]
        next.splice(firstIdx, 0, updated)
        return { sessions: next }
      }

      // Insert after insertAfterId
      const afterIdx = remaining.findIndex((s) => s.id === insertAfterId)
      if (afterIdx === -1) {
        // insertAfterId not found (should not happen in normal use) — append
        return { sessions: [...remaining, updated] }
      }
      const next = [...remaining]
      next.splice(afterIdx + 1, 0, updated)
      return { sessions: next }
    })
}))
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```

Expected:
```
✓ tests/renderer/store/useSessionStore.test.ts  (9 tests)
Test Files  11 passed (11)
Tests       91 passed (91)
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/store/useSessionStore.ts \
        tests/renderer/store/useSessionStore.test.ts
git commit -m "feat: add renameSession and moveSession to useSessionStore"
```

---

## Task 2: Update `GroupItem.tsx` — rename UI and drag-and-drop

**Files:**
- Modify: `src/renderer/src/components/Sidebar/GroupItem.tsx`

There are no pure-logic unit tests for the UI component (it requires a browser DOM). Verification is by TypeScript + the existing 91-test suite staying green.

---

- [ ] **Step 1: Replace `GroupItem.tsx` in full**

```typescript
// src/renderer/src/components/Sidebar/GroupItem.tsx
import { useState, useEffect } from 'react'
import { useSplitStore } from '../../store/useSplitStore'
import { useConfigStore } from '../../store/useConfigStore'
import { useSessionStore } from '../../store/useSessionStore'
import type { RuntimeSession } from '../../store/useSessionStore'

interface GroupItemProps {
  groupId: string
  groupName: string
  sessions: RuntimeSession[]
  activePaneId: string | null
  isDefault?: boolean
}

/** Blue horizontal line shown between session rows during drag-and-drop. */
function InsertLine(): JSX.Element {
  return (
    <div
      style={{
        height: 2, background: '#1a73e8', margin: '1px 0 1px 16px',
        borderRadius: 1, position: 'relative', pointerEvents: 'none'
      }}
    >
      <div style={{
        position: 'absolute', left: -4, top: -3,
        width: 8, height: 8, background: '#1a73e8', borderRadius: '50%'
      }} />
    </div>
  )
}

export function GroupItem({
  groupId,
  groupName,
  sessions,
  activePaneId,
  isDefault = false
}: GroupItemProps): JSX.Element {
  // ── Group-level state ──────────────────────────────────────────────────────
  const [collapsed, setCollapsed] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(groupName)

  useEffect(() => { setRenameValue(groupName) }, [groupName])

  // ── Session-level state ────────────────────────────────────────────────────
  /** Which session row is currently being renamed (id), or null. */
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null)
  const [sessionRenameValue, setSessionRenameValue] = useState('')
  /** Which session row the mouse is hovering over (for showing the ✏ icon). */
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null)

  // ── Drag-and-drop state ────────────────────────────────────────────────────
  /**
   * Non-null while a drag is in progress over this group's session list.
   * Tracks where the insert-line indicator should appear.
   */
  const [dragInsert, setDragInsert] = useState<{
    targetSessionId: string
    position: 'before' | 'after'
  } | null>(null)
  /** True when the drag cursor is over the group header (fallback drop zone). */
  const [isGroupHeaderDragOver, setIsGroupHeaderDragOver] = useState(false)

  // ── Store subscriptions ────────────────────────────────────────────────────
  const collectLeaves = useSplitStore((s) => s.collectLeaves)
  const setActivePane = useSplitStore((s) => s.setActivePane)
  const assignSession = useSplitStore((s) => s.assignSession)
  const proxies = useConfigStore((s) => s.config.proxies)
  const renameGroup = useConfigStore((s) => s.renameGroup)
  const removeGroup = useConfigStore((s) => s.removeGroup)
  const closeSession = useSessionStore((s) => s.closeSession)
  const renameSession = useSessionStore((s) => s.renameSession)
  const moveSession = useSessionStore((s) => s.moveSession)

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getProxyName = (proxyId?: string): string | undefined =>
    proxyId ? proxies.find((p) => p.id === proxyId)?.name : undefined

  const activePaneSessionId = collectLeaves().find((l) => l.id === activePaneId)?.sessionId

  // ── Session click ──────────────────────────────────────────────────────────
  const handleSessionClick = (sessionId: string): void => {
    if (renamingSessionId === sessionId) return
    const leaves = collectLeaves()
    const existingPane = leaves.find((l) => l.sessionId === sessionId)
    if (existingPane) {
      setActivePane(existingPane.id)
    } else if (activePaneId) {
      assignSession(activePaneId, sessionId)
    }
  }

  // ── Group rename ───────────────────────────────────────────────────────────
  const handleGroupRenameConfirm = (): void => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== groupName) renameGroup(groupId, trimmed)
    setRenaming(false)
  }

  const handleGroupRenameKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleGroupRenameConfirm()
    if (e.key === 'Escape') { setRenaming(false); setRenameValue(groupName) }
  }

  // ── Group delete ───────────────────────────────────────────────────────────
  const handleDelete = (): void => {
    if (!window.confirm(`删除分组「${groupName}」及其下所有终端？此操作不可撤销。`)) return
    sessions.forEach((s) => closeSession(s.id))
    removeGroup(groupId)
  }

  // ── Session rename ─────────────────────────────────────────────────────────
  const handleSessionRenameConfirm = (session: RuntimeSession): void => {
    const trimmed = sessionRenameValue.trim()
    if (trimmed && trimmed !== session.title) renameSession(session.id, trimmed)
    setRenamingSessionId(null)
  }

  const handleSessionRenameKeyDown = (e: React.KeyboardEvent, session: RuntimeSession): void => {
    if (e.key === 'Enter') handleSessionRenameConfirm(session)
    if (e.key === 'Escape') setRenamingSessionId(null)
  }

  // ── Drag-and-drop ──────────────────────────────────────────────────────────
  const clearDragState = (): void => {
    setDragInsert(null)
    setIsGroupHeaderDragOver(false)
  }

  const handleSessionDragOver = (e: React.DragEvent, targetSession: RuntimeSession): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    setDragInsert({ targetSessionId: targetSession.id, position })
    setIsGroupHeaderDragOver(false)
  }

  const handleSessionDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    const sessionId = e.dataTransfer.getData('sessionId')
    if (!sessionId || !dragInsert) return

    const { targetSessionId, position } = dragInsert

    // Dropped on itself — no-op
    if (targetSessionId === sessionId) { setDragInsert(null); return }

    // Calculate insertAfterId relative to sessions WITHOUT the dragged item
    // (handles same-group reordering correctly)
    const sessionsWithoutDragged = sessions.filter((s) => s.id !== sessionId)
    const targetIdx = sessionsWithoutDragged.findIndex((s) => s.id === targetSessionId)

    let insertAfterId: string | null
    if (position === 'before') {
      insertAfterId = targetIdx <= 0 ? null : sessionsWithoutDragged[targetIdx - 1].id
    } else {
      insertAfterId = targetSessionId
    }

    moveSession(sessionId, groupId, insertAfterId)
    setDragInsert(null)
  }

  const handleGroupHeaderDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsGroupHeaderDragOver(true)
    setDragInsert(null)
  }

  const handleGroupHeaderDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    const sessionId = e.dataTransfer.getData('sessionId')
    if (!sessionId) return
    // Append to end of this group
    const lastId = sessions.length > 0 ? sessions[sessions.length - 1].id : null
    moveSession(sessionId, groupId, lastId)
    clearDragState()
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{ marginBottom: '4px' }}
      onDragLeave={(e) => {
        // Only clear when the cursor truly leaves the group container
        if (!e.currentTarget.contains(e.relatedTarget as Node)) clearDragState()
      }}
    >
      {/* ── Group header row ── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '3px 6px', userSelect: 'none',
          color: '#8892a4', fontSize: '10px', letterSpacing: '0.5px',
          borderRadius: '3px', position: 'relative',
          backgroundColor: isGroupHeaderDragOver ? '#0f3460' : 'transparent',
          border: isGroupHeaderDragOver ? '1px dashed #1a73e8' : '1px solid transparent'
        }}
        onMouseEnter={(e) => { if (!isGroupHeaderDragOver) e.currentTarget.style.backgroundColor = '#0f3460' }}
        onMouseLeave={(e) => { if (!isGroupHeaderDragOver) e.currentTarget.style.backgroundColor = 'transparent' }}
        onDragOver={handleGroupHeaderDragOver}
        onDragLeave={(e) => {
          e.stopPropagation()
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsGroupHeaderDragOver(false)
        }}
        onDrop={handleGroupHeaderDrop}
      >
        <span onClick={() => setCollapsed(!collapsed)} style={{ fontSize: '9px', cursor: 'pointer' }}>
          {collapsed ? '▶' : '▼'}
        </span>

        {renaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleGroupRenameConfirm}
            onKeyDown={handleGroupRenameKeyDown}
            style={{
              flex: 1, background: '#0d1117', border: '1px solid #30363d',
              borderRadius: '2px', color: '#cdd9e5', fontSize: '10px',
              padding: '1px 4px', outline: 'none'
            }}
          />
        ) : (
          <span onClick={() => setCollapsed(!collapsed)} style={{ textTransform: 'uppercase', flex: 1, cursor: 'pointer' }}>
            {groupName}
          </span>
        )}

        <span style={{ color: '#484f58' }}>{sessions.length}</span>

        {!isDefault && !renaming && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setRenaming(true); setRenameValue(groupName) }}
              title="重命名分组"
              style={{ background: 'none', border: 'none', color: '#484f58', cursor: 'pointer', fontSize: '11px', padding: '0 1px', lineHeight: 1 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#cdd9e5')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#484f58')}
            >
              ✏
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete() }}
              title="删除分组"
              style={{ background: 'none', border: 'none', color: '#484f58', cursor: 'pointer', fontSize: '11px', padding: '0 1px', lineHeight: 1 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#f85149')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#484f58')}
            >
              🗑
            </button>
          </>
        )}
      </div>

      {/* ── Session list ── */}
      {!collapsed && sessions.flatMap((session) => {
        const isActive = session.id === activePaneSessionId
        const isHovered = hoveredSessionId === session.id
        const isRenamingThis = renamingSessionId === session.id
        const proxyName = getProxyName(session.proxyId)
        const rows: JSX.Element[] = []

        // Insert-before indicator
        if (dragInsert?.targetSessionId === session.id && dragInsert.position === 'before') {
          rows.push(<InsertLine key={`ins-before-${session.id}`} />)
        }

        rows.push(
          <div
            key={session.id}
            draggable={!isRenamingThis}
            onClick={() => handleSessionClick(session.id)}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.backgroundColor = '#1c2128'
              setHoveredSessionId(session.id)
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isActive ? '#0f3460' : 'transparent'
              setHoveredSessionId(null)
            }}
            onDragStart={(e) => {
              e.dataTransfer.setData('sessionId', session.id)
              e.dataTransfer.effectAllowed = 'move'
              const el = e.currentTarget as HTMLElement
              // Delay opacity change so the drag ghost captures the normal appearance
              setTimeout(() => { el.style.opacity = '0.4' }, 0)
            }}
            onDragEnd={(e) => {
              ;(e.currentTarget as HTMLElement).style.opacity = '1'
              clearDragState()
            }}
            onDragOver={(e) => handleSessionDragOver(e, session)}
            onDrop={handleSessionDrop}
            style={{
              padding: '4px 8px 4px 16px', borderRadius: '3px', cursor: 'pointer',
              fontSize: '12px', color: isActive ? '#ccd6f6' : '#8892a4',
              backgroundColor: isActive ? '#0f3460' : 'transparent',
              display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '1px',
              userSelect: 'none'
            }}
          >
            <span style={{ color: session.status === 'disconnected' ? '#f85149' : '#64ffda', fontSize: '8px', flexShrink: 0 }}>●</span>

            {isRenamingThis ? (
              <input
                autoFocus
                value={sessionRenameValue}
                onChange={(e) => setSessionRenameValue(e.target.value)}
                onBlur={() => handleSessionRenameConfirm(session)}
                onKeyDown={(e) => handleSessionRenameKeyDown(e, session)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  flex: 1, background: 'transparent', border: 'none',
                  borderBottom: '1px solid #30363d', color: '#cdd9e5',
                  fontSize: '12px', outline: 'none', padding: '0', minWidth: 0
                }}
              />
            ) : (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {session.title}
              </span>
            )}

            {/* ✏ icon — visible on hover when not in rename mode */}
            {isHovered && !isRenamingThis && (
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
            )}

            {proxyName && !isRenamingThis && (
              <span
                title={proxyName}
                style={{
                  fontSize: '9px', color: '#64ffda', backgroundColor: '#0d2b2b',
                  border: '1px solid #1a5050', borderRadius: '2px', padding: '0 3px',
                  flexShrink: 0, maxWidth: '56px', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}
              >
                {proxyName}
              </span>
            )}
          </div>
        )

        // Insert-after indicator
        if (dragInsert?.targetSessionId === session.id && dragInsert.position === 'after') {
          rows.push(<InsertLine key={`ins-after-${session.id}`} />)
        }

        return rows
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (zero errors).

- [ ] **Step 3: Run the full test suite**

```bash
npm test 2>&1 | tail -10
```

Expected:
```
Test Files  11 passed (11)
Tests       91 passed (91)
```

- [ ] **Step 4: Manual smoke test**

Run the app and verify:

**Rename:**
- Create two terminals. Hover over one in the sidebar — ✏ icon appears on the right of the row.
- Click ✏ — title becomes an editable input, pre-filled with the current name.
- Type a new name and press Enter — the row shows the new name, the pane header updates.
- Click ✏ again, clear the field, press Enter — the name is NOT erased (silently reverts to the previous name).
- Click ✏ again, type something, press Escape — the name reverts.

**Drag-and-drop:**
- Create a second group from the sidebar.
- Drag a terminal from the default group onto the second group's header — it appears in the second group.
- Drag it back; hover over a session row in the default group — the blue insert-line appears between rows.
- Drop it before the first session — it moves to that position.
- Drag a session within the same group to reorder it.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/Sidebar/GroupItem.tsx
git commit -m "feat: add session rename and drag-and-drop reorder between groups"
```
