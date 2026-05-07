// src/renderer/src/components/Sidebar/Sidebar.tsx
import { useState } from 'react'
import { useSessionStore } from '../../store/useSessionStore'
import { useSplitStore } from '../../store/useSplitStore'
import { useConfigStore } from '../../store/useConfigStore'
import { GroupItem } from './GroupItem'
import { QuickCommands } from './QuickCommands'
import { SidebarBottomBar } from './SidebarBottomBar'
import { ProxyForm } from '../Proxy/ProxyForm'

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function Sidebar(): JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const addSession = useSessionStore((s) => s.addSession)

  const collectLeaves = useSplitStore((s) => s.collectLeaves)
  const activePaneId = useSplitStore((s) => s.activePaneId)
  const assignSession = useSplitStore((s) => s.assignSession)

  const proxies = useConfigStore((s) => s.config.proxies)
  const groups = useConfigStore((s) => s.config.groups)
  const removeProxy = useConfigStore((s) => s.removeProxy)
  const addGroup = useConfigStore((s) => s.addGroup)

  const [isCreating, setIsCreating] = useState(false)
  const [selectedProxyId, setSelectedProxyId] = useState<string>('')
  const [showProxyForm, setShowProxyForm] = useState(false)
  const [showNewGroupInput, setShowNewGroupInput] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')

  const handleNewTerminal = async (): Promise<void> => {
    if (isCreating) return
    setIsCreating(true)
    try {
      const id = generateId()
      const homedir = await window.api.getHomedir()
      const proxyId = selectedProxyId || undefined
      const { pid } = await window.api.create({ id, cwd: homedir, proxyId })
      const sessionNum = sessions.length + 1

      // Create in the active session's group; fall back to 'default' if none or invalid
      const activeSessionId = collectLeaves().find((l) => l.id === activePaneId)?.sessionId
      const activeSession = activeSessionId ? sessions.find((s) => s.id === activeSessionId) : undefined
      const validGroupIds = new Set(['default', ...groups.map((g) => g.id)])
      const groupId = activeSession && validGroupIds.has(activeSession.groupId)
        ? activeSession.groupId
        : 'default'

      addSession({ id, title: `终端 ${sessionNum}`, groupId, pid, status: 'running', proxyId })

      const leaves = collectLeaves()
      const emptyPane = leaves.find((l) => !l.sessionId)
      if (emptyPane) {
        assignSession(emptyPane.id, id)
      } else if (activePaneId) {
        assignSession(activePaneId, id)
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleCreateGroup = (): void => {
    const name = newGroupName.trim()
    if (!name) return
    addGroup(name)
    setNewGroupName('')
    setShowNewGroupInput(false)
  }

  const handleGroupInputKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleCreateGroup()
    if (e.key === 'Escape') { setShowNewGroupInput(false); setNewGroupName('') }
  }

  const selectedProxy = proxies.find((p) => p.id === selectedProxyId)

  // Sessions in the default group (groupId === 'default')
  const defaultSessions = sessions.filter((s) => s.groupId === 'default')

  return (
    <div style={{
      width: '200px', height: '100%', backgroundColor: '#16213e',
      borderRight: '1px solid #0f3460', display: 'flex', flexDirection: 'column', flexShrink: 0
    }}>
      {/* ── Logo header ── */}
      <div style={{
        padding: '10px 12px', borderBottom: '1px solid #0f3460',
        display: 'flex', alignItems: 'center', gap: '8px'
      }}>
        {/* Terminal-window SVG icon — 22×22, inline, no external file */}
        <svg width="22" height="22" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="1" y="1" width="18" height="18" rx="3" stroke="#e94560" strokeWidth="1.5"/>
          <polyline points="5,7 9,10 5,13" stroke="#e94560" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <line x1="11" y1="13" x2="15" y2="13" stroke="#e94560" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        {/* Stacked two-line name */}
        <div style={{ flex: 1 }}>
          <div style={{ color: '#e94560', fontWeight: 700, fontSize: '11px', letterSpacing: '1.5px', lineHeight: 1.3 }}>
            IDEA
          </div>
          <div style={{ color: '#a8b2d8', fontSize: '9px', letterSpacing: '2px', opacity: 0.7 }}>
            TERMINAL
          </div>
        </div>
        {/* Version — bottom-right corner of the header block */}
        <div style={{ fontFamily: 'monospace', fontSize: '8px', color: '#484f58', alignSelf: 'flex-end', paddingBottom: '1px' }}>
          v{__APP_VERSION__}
        </div>
      </div>

      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* Proxy selector */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <select
            value={selectedProxyId}
            onChange={(e) => setSelectedProxyId(e.target.value)}
            style={{
              flex: 1, backgroundColor: '#0d1117', border: '1px solid #0f3460',
              borderRadius: '3px', color: selectedProxyId ? '#64ffda' : '#484f58',
              fontSize: '10px', padding: '3px 4px', cursor: 'pointer', outline: 'none'
            }}
          >
            <option value="">无代理</option>
            {proxies.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
          <button
            onClick={() => setShowProxyForm(!showProxyForm)}
            title={showProxyForm ? '取消' : '添加代理'}
            style={{ background: 'none', border: 'none', color: '#484f58', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '2px 4px' }}
          >
            {showProxyForm ? '×' : '+'}
          </button>
        </div>

        {!showProxyForm && selectedProxy && (
          <button
            onClick={() => { removeProxy(selectedProxyId); setSelectedProxyId('') }}
            style={{ background: 'none', border: '1px solid #3d1f1f', borderRadius: '3px', color: '#f85149', fontSize: '10px', padding: '2px 6px', cursor: 'pointer', textAlign: 'left' }}
          >
            删除「{selectedProxy.name}」
          </button>
        )}

        {showProxyForm && (
          <div style={{ backgroundColor: '#0d1117', borderRadius: '4px', border: '1px solid #21262d' }}>
            <ProxyForm onSaved={() => setShowProxyForm(false)} onCancel={() => setShowProxyForm(false)} />
          </div>
        )}

        <button
          onClick={handleNewTerminal}
          disabled={isCreating}
          style={{
            width: '100%', padding: '6px', backgroundColor: '#0f3460',
            color: '#a8b2d8', border: 'none', borderRadius: '4px',
            cursor: isCreating ? 'wait' : 'pointer', fontSize: '12px'
          }}
        >
          {isCreating ? '创建中...' : '＋ 新建终端'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
        {/* Section header: 终端分组 + add group button */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '4px 6px 2px',
          color: '#484f58', fontSize: '9px', letterSpacing: '0.5px'
        }}>
          <span style={{ flex: 1, textTransform: 'uppercase' }}>终端分组</span>
          <button
            onClick={() => { setShowNewGroupInput(!showNewGroupInput); setNewGroupName('') }}
            title={showNewGroupInput ? '取消' : '新建分组'}
            style={{ background: 'none', border: 'none', color: '#484f58', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#64ffda')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#484f58')}
          >
            {showNewGroupInput ? '×' : '+'}
          </button>
        </div>

        {/* Inline new-group input */}
        {showNewGroupInput && (
          <div style={{ padding: '2px 6px 4px', display: 'flex', gap: '4px' }}>
            <input
              autoFocus
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={handleGroupInputKeyDown}
              placeholder="分组名称"
              style={{
                flex: 1, background: '#0d1117', border: '1px solid #30363d',
                borderRadius: '3px', color: '#cdd9e5', fontSize: '10px',
                padding: '3px 6px', outline: 'none'
              }}
            />
            <button
              onClick={handleCreateGroup}
              disabled={!newGroupName.trim()}
              style={{
                background: newGroupName.trim() ? '#0f3460' : '#21262d',
                border: 'none', borderRadius: '3px',
                color: newGroupName.trim() ? '#64ffda' : '#484f58',
                fontSize: '10px', padding: '2px 6px', cursor: newGroupName.trim() ? 'pointer' : 'default'
              }}
            >
              ✓
            </button>
          </div>
        )}

        {/* Default group (always shown, cannot be deleted or renamed) */}
        <GroupItem
          groupId="default"
          groupName="默认"
          sessions={defaultSessions}
          activePaneId={activePaneId}
          isDefault={true}
        />

        {/* User-created groups */}
        {groups.map((group) => {
          const groupSessions = sessions.filter((s) => s.groupId === group.id)
          return (
            <GroupItem
              key={group.id}
              groupId={group.id}
              groupName={group.name}
              sessions={groupSessions}
              activePaneId={activePaneId}
            />
          )
        })}
      </div>

      <QuickCommands />
      <SidebarBottomBar />
    </div>
  )
}
