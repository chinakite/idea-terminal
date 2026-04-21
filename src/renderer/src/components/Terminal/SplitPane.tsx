// src/renderer/src/components/Terminal/SplitPane.tsx
import { useRef, useState, useLayoutEffect, useCallback } from 'react'
import { useSessionStore } from '../../store/useSessionStore'
import { useSplitStore, findLeafBySession, countLeaves, collectLeaves } from '../../store/useSplitStore'
import { computeLayout, DIVIDER_SIZE, HEADER_HEIGHT } from '../../utils/splitLayout'
import type { DividerLayout, LeafLayout } from '../../utils/splitLayout'
import { TerminalPane } from './TerminalPane'

// ── Divider (draggable resize handle) ────────────────────────────────────────

interface DividerProps {
  layout: DividerLayout  // includes ratio from the tree node
  onRatioChange: (splitId: string, newRatio: number) => void
  containerW: number
  containerH: number
}

function Divider({ layout, onRatioChange, containerW, containerH }: DividerProps): JSX.Element {
  const startRef = useRef<{ x: number; y: number; ratio: number } | null>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      startRef.current = { x: e.clientX, y: e.clientY, ratio: layout.ratio }

      const onMove = (ev: MouseEvent): void => {
        if (!startRef.current) return
        const dx = ev.clientX - startRef.current.x
        const dy = ev.clientY - startRef.current.y
        const delta =
          layout.direction === 'h'
            ? dx / (containerW - DIVIDER_SIZE)
            : dy / (containerH - DIVIDER_SIZE)
        const newRatio = Math.min(0.9, Math.max(0.1, startRef.current.ratio + delta))
        onRatioChange(layout.splitId, newRatio)
      }

      const onUp = (): void => {
        startRef.current = null
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [layout, containerW, containerH, onRatioChange]
  )

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        top: layout.top,
        left: layout.left,
        width: layout.width,
        height: layout.height,
        backgroundColor: '#21262d',
        cursor: layout.direction === 'h' ? 'col-resize' : 'row-resize',
        zIndex: 10,
        flexShrink: 0
      }}
    />
  )
}

// ── PaneHeader ────────────────────────────────────────────────────────────────

interface PaneHeaderProps {
  leafLayout: LeafLayout
  sessionTitle: string
  isActive: boolean
  canSplit: boolean
  onSplitH: () => void
  onSplitV: () => void
  onClose: () => void
  onClick: () => void
}

function PaneHeader({
  leafLayout,
  sessionTitle,
  isActive,
  canSplit,
  onSplitH,
  onSplitV,
  onClose,
  onClick
}: PaneHeaderProps): JSX.Element {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        top: leafLayout.top,
        left: leafLayout.left,
        width: leafLayout.width,
        height: HEADER_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        backgroundColor: isActive ? '#161b22' : '#0d1117',
        borderBottom: '1px solid #21262d',
        borderLeft: leafLayout.left > 0 ? '1px solid #21262d' : 'none',
        padding: '0 8px',
        gap: '6px',
        userSelect: 'none',
        zIndex: 20,
        boxSizing: 'border-box',
        outline: isActive ? '1px solid #0f3460' : 'none',
        outlineOffset: '-1px'
      }}
    >
      <span
        style={{
          flex: 1,
          fontSize: '11px',
          color: '#768390',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {sessionTitle}
      </span>

      {canSplit && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onSplitH() }}
            title="水平分割 (⌘D)"
            style={{ background: 'none', border: 'none', color: '#768390', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '0 2px' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#cdd9e5')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#768390')}
          >
            ⊟
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSplitV() }}
            title="垂直分割 (⌘⇧D)"
            style={{ background: 'none', border: 'none', color: '#768390', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '0 2px' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#cdd9e5')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#768390')}
          >
            ⊞
          </button>
        </>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onClose() }}
        title="关闭窗格 (⌘W)"
        style={{ background: 'none', border: 'none', color: '#768390', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#f85149')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#768390')}
      >
        ×
      </button>
    </div>
  )
}

// ── SplitPane (main) ──────────────────────────────────────────────────────────

export function SplitPane(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  const { root, activePaneId, splitPane, closePane, setRatio, setActivePane } = useSplitStore()
  const sessions = useSessionStore((s) => s.sessions)

  // Track container dimensions for layout computation
  useLayoutEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setContainerSize({ w: width, h: height })
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const { w, h } = containerSize
  const layout = w > 0 && h > 0 ? computeLayout(root, w, h) : { leaves: new Map(), dividers: [] }
  const leafCount = countLeaves(root)
  const canSplit = leafCount < 9

  // Reactive map of leafId → sessionId, derived from the subscribed root
  const leafSessionMap = new Map(collectLeaves(root).map((l) => [l.id, l.sessionId]))

  const getSessionTitle = (sessionId: string | null): string => {
    if (!sessionId) return '空白'
    return sessions.find((s) => s.id === sessionId)?.title ?? '空白'
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>

      {/* ── Terminal pool: one TerminalPane per session, always mounted ── */}
      {sessions.map((session) => {
        const assignedLeaf = findLeafBySession(root, session.id)
        const leafLayout = assignedLeaf ? layout.leaves.get(assignedLeaf.id) : undefined
        const isActive = assignedLeaf?.id === activePaneId

        const contentBounds = leafLayout
          ? {
              top: leafLayout.top + HEADER_HEIGHT,
              left: leafLayout.left,
              width: leafLayout.width,
              height: leafLayout.height - HEADER_HEIGHT
            }
          : null

        return (
          <div
            key={session.id}
            style={{
              position: 'absolute',
              display: contentBounds ? 'block' : 'none',
              top: contentBounds?.top ?? 0,
              left: contentBounds?.left ?? 0,
              width: contentBounds?.width ?? 0,
              height: contentBounds?.height ?? 0,
              zIndex: 1
            }}
          >
            <TerminalPane
              sessionId={session.id}
              isActive={isActive}
              onSplitH={assignedLeaf ? () => splitPane(assignedLeaf.id, 'h') : undefined}
              onSplitV={assignedLeaf ? () => splitPane(assignedLeaf.id, 'v') : undefined}
              onClose={assignedLeaf ? () => closePane(assignedLeaf.id) : undefined}
            />
          </div>
        )
      })}

      {/* ── Chrome layer: headers + blank-pane placeholders ── */}
      {Array.from(layout.leaves.entries()).map(([leafId, leafLayout]) => {
        const sessionId = leafSessionMap.get(leafId) ?? null
        const isActive = leafId === activePaneId

        return (
          <div key={`chrome-${leafId}`}>
            <PaneHeader
              leafLayout={leafLayout}
              sessionTitle={getSessionTitle(sessionId)}
              isActive={isActive}
              canSplit={canSplit}
              onSplitH={() => splitPane(leafId, 'h')}
              onSplitV={() => splitPane(leafId, 'v')}
              onClose={() => closePane(leafId)}
              onClick={() => setActivePane(leafId)}
            />
            {/* Blank placeholder shown when no session is assigned */}
            {!sessionId && (
              <div
                onClick={() => setActivePane(leafId)}
                style={{
                  position: 'absolute',
                  top: leafLayout.top + HEADER_HEIGHT,
                  left: leafLayout.left,
                  width: leafLayout.width,
                  height: leafLayout.height - HEADER_HEIGHT,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: '8px',
                  color: '#768390',
                  fontSize: '13px',
                  zIndex: 1,
                  backgroundColor: '#0d1117',
                  cursor: 'default'
                }}
              >
                <span>空白窗格</span>
                <span style={{ fontSize: '11px', color: '#484f58' }}>从左侧列表点击会话即可显示</span>
              </div>
            )}
          </div>
        )
      })}

      {/* ── Dividers ── */}
      {layout.dividers.map((d) => (
        <Divider
          key={d.splitId}
          layout={d}
          containerW={w}
          containerH={h}
          onRatioChange={setRatio}
        />
      ))}
    </div>
  )
}
