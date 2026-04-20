// src/renderer/src/components/CommandPalette/CommandPalette.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSessionStore } from '../../store/useSessionStore'
import { useConfigStore } from '../../store/useConfigStore'
import { useSplitStore } from '../../store/useSplitStore'

interface Command {
  id: string
  label: string
  description?: string
  action: () => void
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps): JSX.Element | null {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const sessions = useSessionStore((s) => s.sessions)
  const addSession = useSessionStore((s) => s.addSession)
  const { config } = useConfigStore()
  const { panes, activePaneId, addPane, removePane, assignSession, getActivePaneSessionId } =
    useSplitStore()

  const buildCommands = useCallback((): Command[] => {
    const cmds: Command[] = []

    cmds.push({
      id: 'new-terminal',
      label: '新建终端',
      description: '在当前窗格或新窗格中创建终端',
      action: async () => {
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
        }
        onClose()
      }
    })

    if (panes.length < 4) {
      cmds.push({
        id: 'split-pane',
        label: '新增分屏窗格',
        description: `当前 ${panes.length} 个窗格，最多 4 个`,
        action: () => { addPane(); onClose() }
      })
    }

    if (panes.length > 1 && activePaneId) {
      cmds.push({
        id: 'close-pane',
        label: '关闭当前窗格',
        action: () => { removePane(activePaneId); onClose() }
      })
    }

    sessions.forEach((session) => {
      cmds.push({
        id: `switch-${session.id}`,
        label: `切换到：${session.title}`,
        description: session.status === 'disconnected' ? '已断开' : '运行中',
        action: () => {
          const pane = panes.find((p) => p.sessionId === session.id)
          if (pane) {
            useSplitStore.getState().setActivePane(pane.id)
          } else if (activePaneId) {
            assignSession(activePaneId, session.id)
          }
          onClose()
        }
      })
    })

    config.quickCommands.forEach((qc) => {
      cmds.push({
        id: `qc-${qc.id}`,
        label: `运行：${qc.label}`,
        description: qc.command,
        action: () => {
          const sessionId = getActivePaneSessionId()
          if (sessionId) window.api.write(sessionId, qc.command + '\r')
          onClose()
        }
      })
    })

    return cmds
  }, [sessions, config.quickCommands, panes, activePaneId])

  const filtered = buildCommands().filter(
    (c) =>
      !query ||
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.description?.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      filtered[selectedIndex]?.action()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!open) return null

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100
        }}
      />
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: '500px', maxWidth: '90vw', backgroundColor: '#161b22',
        border: '1px solid #30363d', borderRadius: '8px', zIndex: 101,
        overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
      }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入命令或搜索..."
          style={{
            width: '100%', padding: '12px 16px', backgroundColor: 'transparent',
            border: 'none', borderBottom: '1px solid #30363d', color: '#cdd9e5',
            fontSize: '14px', outline: 'none', boxSizing: 'border-box'
          }}
        />
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '12px 16px', color: '#768390', fontSize: '13px' }}>
              无匹配命令
            </div>
          )}
          {filtered.map((cmd, i) => (
            <div
              key={cmd.id}
              onClick={cmd.action}
              style={{
                padding: '8px 16px', cursor: 'pointer',
                backgroundColor: i === selectedIndex ? '#0f3460' : 'transparent',
                borderBottom: '1px solid #21262d'
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <div style={{ fontSize: '13px', color: '#cdd9e5' }}>{cmd.label}</div>
              {cmd.description && (
                <div style={{ fontSize: '11px', color: '#768390', marginTop: '2px' }}>
                  {cmd.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
