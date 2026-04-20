// src/renderer/src/components/Sidebar/GroupItem.tsx
import { useState } from 'react'
import { RuntimeSession } from '../../store/useSessionStore'
import { useSplitStore } from '../../store/useSplitStore'

interface GroupItemProps {
  groupId: string
  groupName: string
  sessions: RuntimeSession[]
  activePaneId: string | null
}

export function GroupItem({ groupId, groupName, sessions, activePaneId }: GroupItemProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const { panes, assignSession, setActivePane, getActivePaneSessionId } = useSplitStore()

  const handleSessionClick = (sessionId: string): void => {
    const existingPane = panes.find((p) => p.sessionId === sessionId)
    if (existingPane) {
      setActivePane(existingPane.id)
      return
    }
    if (activePaneId) {
      assignSession(activePaneId, sessionId)
    }
  }

  const isSessionActive = (sessionId: string): boolean =>
    getActivePaneSessionId() === sessionId

  return (
    <div style={{ marginBottom: '4px' }}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '3px 6px', cursor: 'pointer', userSelect: 'none',
          color: '#8892a4', fontSize: '10px', letterSpacing: '0.5px',
          borderRadius: '3px'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0f3460')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span style={{ fontSize: '9px' }}>{collapsed ? '▶' : '▼'}</span>
        <span style={{ textTransform: 'uppercase' }}>{groupName}</span>
        <span style={{ marginLeft: 'auto', color: '#484f58' }}>{sessions.length}</span>
      </div>

      {!collapsed && sessions.map((session) => (
        <div
          key={session.id}
          onClick={() => handleSessionClick(session.id)}
          style={{
            padding: '4px 8px 4px 16px',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
            color: isSessionActive(session.id) ? '#ccd6f6' : '#8892a4',
            backgroundColor: isSessionActive(session.id) ? '#0f3460' : 'transparent',
            display: 'flex', alignItems: 'center', gap: '6px',
            marginBottom: '1px'
          }}
          onMouseEnter={(e) => {
            if (!isSessionActive(session.id))
              e.currentTarget.style.backgroundColor = '#1c2128'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isSessionActive(session.id)
              ? '#0f3460' : 'transparent'
          }}
        >
          <span style={{ color: session.status === 'disconnected' ? '#f85149' : '#64ffda', fontSize: '8px' }}>
            ●
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.title}
          </span>
        </div>
      ))}
    </div>
  )
}
