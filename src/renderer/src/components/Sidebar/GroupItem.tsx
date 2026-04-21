// src/renderer/src/components/Sidebar/GroupItem.tsx
import { useState } from 'react'
import { useSplitStore } from '../../store/useSplitStore'
import { useConfigStore } from '../../store/useConfigStore'
import type { RuntimeSession } from '../../store/useSessionStore'

interface GroupItemProps {
  groupId: string
  groupName: string
  sessions: RuntimeSession[]
}

export function GroupItem({ groupId, groupName, sessions }: GroupItemProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const collectLeaves = useSplitStore((s) => s.collectLeaves)
  const setActivePane = useSplitStore((s) => s.setActivePane)
  const assignSession = useSplitStore((s) => s.assignSession)
  const activePaneId = useSplitStore((s) => s.activePaneId)
  const proxies = useConfigStore((s) => s.config.proxies)

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

  const activePaneSessionId = collectLeaves().find((l) => l.id === activePaneId)?.sessionId

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

      {!collapsed && sessions.map((session) => {
        const isActive = session.id === activePaneSessionId
        const proxyName = getProxyName(session.proxyId)

        return (
          <div
            key={session.id}
            onClick={() => handleSessionClick(session.id)}
            style={{
              padding: '4px 8px 4px 16px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px',
              color: isActive ? '#ccd6f6' : '#8892a4',
              backgroundColor: isActive ? '#0f3460' : 'transparent',
              display: 'flex', alignItems: 'center', gap: '6px',
              marginBottom: '1px'
            }}
            onMouseEnter={(e) => {
              if (!isActive)
                e.currentTarget.style.backgroundColor = '#1c2128'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isActive
                ? '#0f3460' : 'transparent'
            }}
          >
            <span style={{ color: session.status === 'disconnected' ? '#f85149' : '#64ffda', fontSize: '8px' }}>
              ●
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {session.title}
            </span>
            {proxyName && (
              <span
                title={proxyName}
                style={{
                  fontSize: '9px',
                  color: '#64ffda',
                  backgroundColor: '#0d2b2b',
                  border: '1px solid #1a5050',
                  borderRadius: '2px',
                  padding: '0 3px',
                  flexShrink: 0,
                  maxWidth: '56px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {proxyName}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
