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

export function GroupItem({
  groupId,
  groupName,
  sessions,
  activePaneId,
  isDefault = false
}: GroupItemProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(groupName)

  useEffect(() => {
    setRenameValue(groupName)
  }, [groupName])

  const collectLeaves = useSplitStore((s) => s.collectLeaves)
  const setActivePane = useSplitStore((s) => s.setActivePane)
  const assignSession = useSplitStore((s) => s.assignSession)
  const proxies = useConfigStore((s) => s.config.proxies)
  const renameGroup = useConfigStore((s) => s.renameGroup)
  const removeGroup = useConfigStore((s) => s.removeGroup)
  const closeSession = useSessionStore((s) => s.closeSession)

  const getProxyName = (proxyId?: string): string | undefined => {
    if (!proxyId) return undefined
    return proxies.find((p) => p.id === proxyId)?.name
  }

  const handleSessionClick = (sessionId: string): void => {
    const leaves = collectLeaves()
    const existingPane = leaves.find((l) => l.sessionId === sessionId)
    if (existingPane) {
      setActivePane(existingPane.id)
    } else if (activePaneId) {
      assignSession(activePaneId, sessionId)
    }
  }

  const handleRenameConfirm = (): void => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== groupName) renameGroup(groupId, trimmed)
    setRenaming(false)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleRenameConfirm()
    if (e.key === 'Escape') { setRenaming(false); setRenameValue(groupName) }
  }

  const handleDelete = (): void => {
    if (!window.confirm(`删除分组「${groupName}」及其下所有终端？此操作不可撤销。`)) return
    // Close all sessions in this group first
    sessions.forEach((s) => closeSession(s.id))
    removeGroup(groupId)
  }

  const activePaneSessionId = collectLeaves().find((l) => l.id === activePaneId)?.sessionId

  return (
    <div style={{ marginBottom: '4px' }}>
      {/* Group header row */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '3px 6px', userSelect: 'none',
          color: '#8892a4', fontSize: '10px', letterSpacing: '0.5px',
          borderRadius: '3px', position: 'relative'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0f3460')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span
          onClick={() => setCollapsed(!collapsed)}
          style={{ fontSize: '9px', cursor: 'pointer' }}
        >
          {collapsed ? '▶' : '▼'}
        </span>

        {renaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameConfirm}
            onKeyDown={handleRenameKeyDown}
            style={{
              flex: 1, background: '#0d1117', border: '1px solid #30363d',
              borderRadius: '2px', color: '#cdd9e5', fontSize: '10px',
              padding: '1px 4px', outline: 'none'
            }}
          />
        ) : (
          <span
            onClick={() => setCollapsed(!collapsed)}
            style={{ textTransform: 'uppercase', flex: 1, cursor: 'pointer' }}
          >
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

      {/* Session list */}
      {!collapsed && sessions.map((session) => {
        const isActive = session.id === activePaneSessionId
        const proxyName = getProxyName(session.proxyId)

        return (
          <div
            key={session.id}
            onClick={() => handleSessionClick(session.id)}
            style={{
              padding: '4px 8px 4px 16px', borderRadius: '3px', cursor: 'pointer',
              fontSize: '12px', color: isActive ? '#ccd6f6' : '#8892a4',
              backgroundColor: isActive ? '#0f3460' : 'transparent',
              display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1px'
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = '#1c2128' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isActive ? '#0f3460' : 'transparent' }}
          >
            <span style={{ color: session.status === 'disconnected' ? '#f85149' : '#64ffda', fontSize: '8px' }}>●</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{session.title}</span>
            {proxyName && (
              <span title={proxyName} style={{ fontSize: '9px', color: '#64ffda', backgroundColor: '#0d2b2b', border: '1px solid #1a5050', borderRadius: '2px', padding: '0 3px', flexShrink: 0, maxWidth: '56px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {proxyName}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
