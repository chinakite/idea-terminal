// src/renderer/src/components/Sidebar/Sidebar.tsx
import { useState } from 'react'
import { useSessionStore } from '../../store/useSessionStore'

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function Sidebar(): JSX.Element {
  const { sessions, activeSessionId, setActive } = useSessionStore()
  const addSession = useSessionStore((s) => s.addSession)
  const [isCreating, setIsCreating] = useState(false)

  const handleNewTerminal = async (): Promise<void> => {
    if (isCreating) return
    setIsCreating(true)
    try {
      const id = generateId()
      const homedir = await window.api.getHomedir()
      const { pid } = await window.api.create({ id, cwd: homedir })
      addSession({
        id,
        title: `终端 ${sessions.length + 1}`,
        groupId: 'default',
        pid,
        status: 'running'
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div style={{
      width: '200px',
      height: '100%',
      backgroundColor: '#16213e',
      borderRight: '1px solid #0f3460',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0
    }}>
      <div style={{
        padding: '12px',
        color: '#e94560',
        fontWeight: 'bold',
        fontSize: '12px',
        letterSpacing: '1px',
        borderBottom: '1px solid #0f3460',
        WebkitAppRegion: 'drag',
        userSelect: 'none'
      } as React.CSSProperties}>
        IDEA TERMINAL
      </div>

      <div style={{ padding: '8px' }}>
        <button
          onClick={handleNewTerminal}
          disabled={isCreating}
          style={{
            width: '100%',
            padding: '6px',
            backgroundColor: '#0f3460',
            color: '#a8b2d8',
            border: 'none',
            borderRadius: '4px',
            cursor: isCreating ? 'wait' : 'pointer',
            fontSize: '12px'
          }}
        >
          {isCreating ? '创建中...' : '＋ 新建终端'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
        <div style={{ color: '#8892a4', fontSize: '10px', letterSpacing: '1px', marginBottom: '4px' }}>
          会话
        </div>
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => setActive(session.id)}
            style={{
              padding: '5px 8px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px',
              color: session.id === activeSessionId ? '#ccd6f6' : '#8892a4',
              backgroundColor: session.id === activeSessionId ? '#0f3460' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '2px'
            }}
          >
            <span style={{ color: session.status === 'disconnected' ? '#f85149' : '#64ffda' }}>
              {session.status === 'disconnected' ? '○' : '●'}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {session.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
