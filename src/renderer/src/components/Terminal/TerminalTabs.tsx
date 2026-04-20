// src/renderer/src/components/Terminal/TerminalTabs.tsx
import { useSessionStore } from '../../store/useSessionStore'

export function TerminalTabs(): JSX.Element {
  const { sessions, activeSessionId, setActive, removeSession } = useSessionStore()

  const handleClose = (e: React.MouseEvent, id: string): void => {
    e.stopPropagation()
    window.api.destroy(id)
    removeSession(id)
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      height: '36px',
      backgroundColor: '#0d1117',
      borderBottom: '1px solid #21262d',
      overflowX: 'auto',
      flexShrink: 0
    }}>
      {sessions.map((session) => (
        <div
          key={session.id}
          onClick={() => setActive(session.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 12px',
            height: '100%',
            cursor: 'pointer',
            borderRight: '1px solid #21262d',
            backgroundColor: session.id === activeSessionId ? '#161b22' : 'transparent',
            color: session.status === 'disconnected' ? '#768390' : '#cdd9e5',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            userSelect: 'none'
          }}
        >
          <span>{session.title}</span>
          {session.status === 'disconnected' && <span style={{ color: '#f85149' }}>●</span>}
          <span
            onClick={(e) => handleClose(e, session.id)}
            style={{
              color: '#768390',
              fontSize: '12px',
              lineHeight: 1,
              padding: '2px 4px',
              borderRadius: '3px'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f85149')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#768390')}
          >
            ×
          </span>
        </div>
      ))}
    </div>
  )
}
