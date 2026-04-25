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

  const handleCloseSession = (session: RuntimeSession): void => {
    const leaves = collectLeaves()
    const pane = leaves.find((l) => l.sessionId === session.id)
    const remaining = useSessionStore.getState().sessions.filter((s) => s.id !== session.id)

    if (pane) {
      if (remaining.length > 0) {
        const remainingInGroup = remaining.filter((s) => s.groupId === session.groupId)
        const next = remainingInGroup[0] ?? remaining[0]
        assignSession(pane.id, next.id)
      }
      // No else needed: closeSession calls clearSession internally
    }

    closeSession(session.id)
  }

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
              // Delay opacity change so the drag ghost captures the normal appearance
              const el = e.currentTarget as HTMLElement
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

            {/* ✏ and × icons — visible on hover when not in rename mode */}
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
                    handleCloseSession(session)
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
