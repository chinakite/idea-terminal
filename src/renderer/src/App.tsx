// src/renderer/src/App.tsx
import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar/Sidebar'
import { SplitPane } from './components/Terminal/SplitPane'
import { CommandPalette } from './components/CommandPalette/CommandPalette'
import { AiPanel } from './components/AiPanel/AiPanel'
import { useConfigStore } from './store/useConfigStore'
import { useSplitStore } from './store/useSplitStore'

export default function App(): JSX.Element {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const loadConfig = useConfigStore((s) => s.load)
  const leaves = useSplitStore((s) => s.collectLeaves())

  // ── Init: load config then restore persisted sessions ─────────────────────
  useEffect(() => {
    const init = async (): Promise<void> => {
      await loadConfig()

      const snapshots = await window.api.loadSessionSnapshots()
      if (snapshots.length === 0) return

      const { addSession } = useSessionStore.getState()
      const { activePaneId, assignSession } = useSplitStore.getState()
      const validGroupIds = new Set(
        useConfigStore.getState().config.groups.map((g) => g.id)
      )
      validGroupIds.add('default')

      let firstSessionId: string | null = null
      for (const snap of snapshots) {
        try {
          const groupId = validGroupIds.has(snap.groupId) ? snap.groupId : 'default'
          const { pid } = await window.api.create({
            id: snap.id,
            cwd: snap.lastCwd,
            histCommands: snap.lastCommands
          })
          addSession({
            id: snap.id,
            title: snap.title,
            groupId,
            pid,
            status: 'running',
            proxyId: snap.proxyId
          })
          if (!firstSessionId) firstSessionId = snap.id
        } catch {
          // Skip sessions that fail to restore (e.g. lastCwd no longer exists)
        }
      }

      if (firstSessionId && activePaneId) {
        assignSession(activePaneId, firstSessionId)
      }
    }

    init().catch(console.error)
  }, [loadConfig])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
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

  const showEmptyState = leaves.length === 1 && !leaves[0]?.sessionId

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
        {showEmptyState ? (
          <div style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#768390', fontSize: '14px',
            flexDirection: 'column', gap: '8px'
          }}>
            <span>点击"＋ 新建终端"开始</span>
            <span style={{ fontSize: '12px', color: '#484f58' }}>Cmd+K 打开命令面板</span>
          </div>
        ) : (
          <SplitPane />
        )}
        <AiPanel />
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
