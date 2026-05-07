// src/renderer/src/components/Sidebar/SidebarBottomBar.tsx
import { useState, useRef, useEffect } from 'react'
import { ThemePopup } from './ThemePopup'

export function SidebarBottomBar(): JSX.Element {
  const [popupOpen, setPopupOpen] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  // Close popup when clicking outside the bottom bar (including the popup itself)
  useEffect(() => {
    if (!popupOpen) return
    const handleMouseDown = (e: MouseEvent): void => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setPopupOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [popupOpen])

  return (
    <div
      ref={barRef}
      style={{
        position: 'relative',
        borderTop: '1px solid #0f3460',
        flexShrink: 0,
        backgroundColor: '#111827'
      }}
    >
      {/* Popup renders above the bar; position: absolute bottom: 100% */}
      {popupOpen && <ThemePopup onClose={() => setPopupOpen(false)} />}

      <div style={{
        padding: '5px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <button
          onClick={() => setPopupOpen((o) => !o)}
          title="切换主题"
          style={{
            background: popupOpen ? '#1c2744' : 'none',
            border: 'none',
            color: popupOpen ? '#a8b2d8' : '#484f58',
            cursor: 'pointer',
            padding: '3px 5px',
            borderRadius: '4px',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center'
          }}
          onMouseEnter={(e) => {
            if (!popupOpen) {
              e.currentTarget.style.color = '#a8b2d8'
              e.currentTarget.style.background = '#1c2744'
            }
          }}
          onMouseLeave={(e) => {
            if (!popupOpen) {
              e.currentTarget.style.color = '#484f58'
              e.currentTarget.style.background = 'none'
            }
          }}
        >
          {/* Swatches SVG: three outlined squares + one filled square */}
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="10" y="10" width="6" height="6" rx="1.5" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
