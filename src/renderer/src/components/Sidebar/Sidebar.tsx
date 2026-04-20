// src/renderer/src/components/Sidebar/Sidebar.tsx
import { useState } from 'react'
import { useSessionStore } from '../../store/useSessionStore'
import { useSplitStore } from '../../store/useSplitStore'
import { GroupItem } from './GroupItem'
import { QuickCommands } from './QuickCommands'

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function Sidebar(): JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const addSession = useSessionStore((s) => s.addSession)
  const { panes, activePaneId, assignSession, addPane } = useSplitStore()
  const [isCreating, setIsCreating] = useState(false)

  const handleNewTerminal = async (): Promise<void> => {
    if (isCreating) return
    setIsCreating(true)
    try {
      const id = generateId()
      const homedir = await window.api.getHomedir()
      const { pid } = await window.api.create({ id, cwd: homedir })
      const sessionNum = sessions.length + 1
      addSession({ id, title: `终端 ${sessionNum}`, groupId: 'default', pid, status: 'running' })

      const emptyPane = panes.find((p) => !p.sessionId)
      if (emptyPane) {
        assignSession(emptyPane.id, id)
      } else if (activePaneId) {
        assignSession(activePaneId, id)
      } else {
        addPane(id)
      }
    } finally {
      setIsCreating(false)
    }
  }

  const defaultSessions = sessions.filter((s) => s.groupId === 'default')

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
        borderBottom: '1px solid #0f3460'
      }}>
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

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 4px' }}>
        <GroupItem
          groupId="default"
          groupName="会话"
          sessions={defaultSessions}
          activePaneId={activePaneId}
        />
      </div>

      <QuickCommands />
    </div>
  )
}
