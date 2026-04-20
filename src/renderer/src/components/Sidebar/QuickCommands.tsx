// src/renderer/src/components/Sidebar/QuickCommands.tsx
import { useState } from 'react'
import { useConfigStore } from '../../store/useConfigStore'
import { useSplitStore } from '../../store/useSplitStore'

export function QuickCommands(): JSX.Element {
  const { config, addQuickCommand, removeQuickCommand } = useConfigStore()
  const getActivePaneSessionId = useSplitStore((s) => s.getActivePaneSessionId)
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [command, setCommand] = useState('')

  const handleRun = (cmd: string): void => {
    const sessionId = getActivePaneSessionId()
    if (sessionId) window.api.write(sessionId, cmd + '\r')
  }

  const handleAdd = (): void => {
    if (label.trim() && command.trim()) {
      addQuickCommand(label.trim(), command.trim())
      setLabel('')
      setCommand('')
      setAdding(false)
    }
  }

  return (
    <div style={{
      borderTop: '1px solid #0f3460',
      padding: '8px',
      flexShrink: 0
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '6px'
      }}>
        <span style={{ color: '#8892a4', fontSize: '10px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          快捷命令
        </span>
        <button
          onClick={() => setAdding(!adding)}
          style={{
            background: 'none', border: 'none', color: '#8892a4',
            cursor: 'pointer', fontSize: '14px', lineHeight: 1
          }}
          title="添加快捷命令"
        >
          {adding ? '×' : '+'}
        </button>
      </div>

      {adding && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '6px' }}>
          <input
            placeholder="标签（如：Git 状态）"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{
              backgroundColor: '#0d1117', border: '1px solid #30363d',
              borderRadius: '3px', color: '#cdd9e5', fontSize: '11px',
              padding: '3px 6px', outline: 'none'
            }}
          />
          <input
            placeholder="命令（如：git status）"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            style={{
              backgroundColor: '#0d1117', border: '1px solid #30363d',
              borderRadius: '3px', color: '#cdd9e5', fontSize: '11px',
              padding: '3px 6px', outline: 'none'
            }}
          />
          <button
            onClick={handleAdd}
            style={{
              backgroundColor: '#0f3460', border: 'none', borderRadius: '3px',
              color: '#a8b2d8', fontSize: '11px', padding: '3px', cursor: 'pointer'
            }}
          >
            保存
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {config.quickCommands.map((qc) => (
          <div key={qc.id} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => handleRun(qc.command)}
              title={qc.command}
              style={{
                backgroundColor: '#0f3460', border: 'none', borderRadius: '3px 0 0 3px',
                color: '#64ffda', fontSize: '10px', padding: '3px 6px',
                cursor: 'pointer', maxWidth: '80px', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}
            >
              {qc.label}
            </button>
            <button
              onClick={() => removeQuickCommand(qc.id)}
              style={{
                backgroundColor: '#0f3460', border: 'none', borderRadius: '0 3px 3px 0',
                color: '#484f58', fontSize: '10px', padding: '3px 4px',
                cursor: 'pointer', borderLeft: '1px solid #1c2128'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#f85149')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#484f58')}
            >
              ×
            </button>
          </div>
        ))}
        {config.quickCommands.length === 0 && !adding && (
          <span style={{ color: '#484f58', fontSize: '10px' }}>点击 + 添加</span>
        )}
      </div>
    </div>
  )
}
