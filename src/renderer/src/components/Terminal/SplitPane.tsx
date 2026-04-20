// src/renderer/src/components/Terminal/SplitPane.tsx
import { useSessionStore } from '../../store/useSessionStore'
import { useSplitStore } from '../../store/useSplitStore'
import { TerminalPane } from './TerminalPane'

export function SplitPane(): JSX.Element {
  const { panes, activePaneId, addPane, removePane, setActivePane } = useSplitStore()
  const sessions = useSessionStore((s) => s.sessions)

  const getSessionTitle = (sessionId: string | null): string => {
    if (!sessionId) return '空白'
    return sessions.find((s) => s.id === sessionId)?.title ?? '空白'
  }

  const handleAddPane = (): void => {
    addPane()
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {panes.map((pane, index) => {
        const isActive = pane.id === activePaneId
        return (
          <div
            key={pane.id}
            onClick={() => setActivePane(pane.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              borderLeft: index > 0 ? '2px solid #21262d' : 'none',
              outline: isActive && panes.length > 1 ? '1px solid #0f3460' : 'none',
              outlineOffset: '-1px',
              overflow: 'hidden'
            }}
          >
            {/* Pane header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              height: '28px',
              backgroundColor: isActive ? '#161b22' : '#0d1117',
              borderBottom: '1px solid #21262d',
              padding: '0 8px',
              gap: '6px',
              flexShrink: 0,
              userSelect: 'none'
            }}>
              <span style={{ flex: 1, fontSize: '11px', color: '#768390', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getSessionTitle(pane.sessionId)}
              </span>

              {panes.length < 4 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleAddPane() }}
                  title="新增分屏"
                  style={{
                    background: 'none', border: 'none', color: '#768390',
                    cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px'
                  }}
                >
                  ⊕
                </button>
              )}

              {panes.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); removePane(pane.id) }}
                  title="关闭窗格"
                  style={{
                    background: 'none', border: 'none', color: '#768390',
                    cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '0 2px'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#f85149')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#768390')}
                >
                  ×
                </button>
              )}
            </div>

            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              {pane.sessionId ? (
                <TerminalPane sessionId={pane.sessionId} isActive={isActive} />
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: '100%', color: '#768390', fontSize: '13px',
                  flexDirection: 'column', gap: '8px'
                }}>
                  <span>空白窗格</span>
                  <span style={{ fontSize: '11px', color: '#484f58' }}>从左侧列表点击会话即可显示</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
