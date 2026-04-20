// src/renderer/src/App.tsx
import { useSessionStore } from './store/useSessionStore'
import { Sidebar } from './components/Sidebar/Sidebar'
import { TerminalTabs } from './components/Terminal/TerminalTabs'
import { TerminalPane } from './components/Terminal/TerminalPane'

export default function App(): JSX.Element {
  const { sessions, activeSessionId } = useSessionStore()

  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      backgroundColor: '#0d1117',
      overflow: 'hidden'
    }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TerminalTabs />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {sessions.length === 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#768390',
              fontSize: '14px'
            }}>
              点击"＋ 新建终端"开始
            </div>
          )}
          {sessions.map((session) => (
            <div
              key={session.id}
              style={{
                position: 'absolute',
                inset: 0,
                display: session.id === activeSessionId ? 'flex' : 'none'
              }}
            >
              <TerminalPane sessionId={session.id} isActive={session.id === activeSessionId} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
