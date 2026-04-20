// src/renderer/src/App.tsx
import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar/Sidebar'
import { SplitPane } from './components/Terminal/SplitPane'
import { CommandPalette } from './components/CommandPalette/CommandPalette'
import { useConfigStore } from './store/useConfigStore'
import { useSplitStore } from './store/useSplitStore'

export default function App(): JSX.Element {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const loadConfig = useConfigStore((s) => s.load)
  const panes = useSplitStore((s) => s.panes)

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

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
        {panes.every((p) => !p.sessionId) && panes.length === 1 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: '#768390', fontSize: '14px',
            flexDirection: 'column', gap: '8px'
          }}>
            <span>点击"＋ 新建终端"开始</span>
            <span style={{ fontSize: '12px', color: '#484f58' }}>Cmd+K 打开命令面板</span>
          </div>
        ) : (
          <SplitPane />
        )}
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
