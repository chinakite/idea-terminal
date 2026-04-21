// src/renderer/src/components/Sidebar/Sidebar.tsx
import { useState } from 'react'
import { useSessionStore } from '../../store/useSessionStore'
import { useSplitStore } from '../../store/useSplitStore'
import { useConfigStore } from '../../store/useConfigStore'
import { GroupItem } from './GroupItem'
import { QuickCommands } from './QuickCommands'
import { ProxyForm } from '../Proxy/ProxyForm'

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function Sidebar(): JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const addSession = useSessionStore((s) => s.addSession)
  const { panes, activePaneId, assignSession, addPane } = useSplitStore()
  const proxies = useConfigStore((s) => s.config.proxies)
  const removeProxy = useConfigStore((s) => s.removeProxy)
  const [isCreating, setIsCreating] = useState(false)
  const [selectedProxyId, setSelectedProxyId] = useState<string>('')
  const [showProxyForm, setShowProxyForm] = useState(false)

  const handleNewTerminal = async (): Promise<void> => {
    if (isCreating) return
    setIsCreating(true)
    try {
      const id = generateId()
      const homedir = await window.api.getHomedir()
      const proxyId = selectedProxyId || undefined
      const { pid } = await window.api.create({ id, cwd: homedir, proxyId })
      const sessionNum = sessions.length + 1
      addSession({ id, title: `终端 ${sessionNum}`, groupId: 'default', pid, status: 'running', proxyId })

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
  const selectedProxy = proxies.find((p) => p.id === selectedProxyId)

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

      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* 代理选择器 */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <select
            value={selectedProxyId}
            onChange={(e) => setSelectedProxyId(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: '#0d1117',
              border: '1px solid #0f3460',
              borderRadius: '3px',
              color: selectedProxyId ? '#64ffda' : '#484f58',
              fontSize: '10px',
              padding: '3px 4px',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="">无代理</option>
            {proxies.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowProxyForm(!showProxyForm)}
            title={showProxyForm ? '取消' : '添加代理'}
            style={{
              background: 'none', border: 'none', color: '#484f58',
              cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '2px 4px'
            }}
          >
            {showProxyForm ? '×' : '+'}
          </button>
        </div>

        {/* 删除已选代理按钮 */}
        {!showProxyForm && selectedProxy && (
          <button
            onClick={() => { removeProxy(selectedProxyId); setSelectedProxyId('') }}
            style={{
              background: 'none', border: '1px solid #3d1f1f', borderRadius: '3px',
              color: '#f85149', fontSize: '10px', padding: '2px 6px',
              cursor: 'pointer', textAlign: 'left'
            }}
          >
            删除「{selectedProxy.name}」
          </button>
        )}

        {/* 新建代理表单 */}
        {showProxyForm && (
          <div style={{ backgroundColor: '#0d1117', borderRadius: '4px', border: '1px solid #21262d' }}>
            <ProxyForm
              onSaved={() => setShowProxyForm(false)}
              onCancel={() => setShowProxyForm(false)}
            />
          </div>
        )}

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
