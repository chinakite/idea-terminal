// src/renderer/src/components/Terminal/TerminalContextMenu.tsx
import { useEffect, useRef } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'

export interface TerminalContextMenuProps {
  position: { x: number; y: number }
  hasSelection: boolean
  onCopy: () => void
  onPaste: () => void
  onClose: () => void
}

export function TerminalContextMenu({
  position,
  hasSelection,
  onCopy,
  onPaste,
  onClose
}: TerminalContextMenuProps): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [onClose])

  // Compute position, flipping toward the viewport edge if the menu would overflow
  const menuWidth = 160
  const menuHeight = 88 // 2 items × 32px + 2 × 4px vertical padding + border

  const overflowRight = position.x + menuWidth > window.innerWidth
  const overflowBottom = position.y + menuHeight > window.innerHeight

  const menuStyle: CSSProperties = {
    position: 'fixed',
    zIndex: 1000,
    left: overflowRight ? undefined : position.x,
    right: overflowRight ? window.innerWidth - position.x : undefined,
    top: overflowBottom ? undefined : position.y,
    bottom: overflowBottom ? window.innerHeight - position.y : undefined,
    backgroundColor: '#1c2333',
    border: '1px solid #30363d',
    borderRadius: '6px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    padding: '4px 0',
    minWidth: `${menuWidth}px`,
    userSelect: 'none'
  }

  const enabledItem: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    height: '32px',
    padding: '0 16px',
    cursor: 'pointer',
    color: '#cdd9e5',
    fontSize: '13px'
  }

  const disabledItem: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    height: '32px',
    padding: '0 16px',
    cursor: 'default',
    color: '#484f58',
    fontSize: '13px'
  }

  const handleMouseEnter = (e: ReactMouseEvent<HTMLDivElement>): void => {
    e.currentTarget.style.backgroundColor = '#264f78'
  }
  const handleMouseLeave = (e: ReactMouseEvent<HTMLDivElement>): void => {
    e.currentTarget.style.backgroundColor = ''
  }

  return (
    <div ref={menuRef} style={menuStyle}>
      <div
        style={hasSelection ? enabledItem : disabledItem}
        onClick={hasSelection ? onCopy : undefined}
        onMouseEnter={hasSelection ? handleMouseEnter : undefined}
        onMouseLeave={hasSelection ? handleMouseLeave : undefined}
      >
        复制
      </div>
      <div
        style={enabledItem}
        onClick={onPaste}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        粘贴
      </div>
    </div>
  )
}
