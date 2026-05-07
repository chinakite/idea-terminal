// src/renderer/src/components/Sidebar/ThemePopup.tsx
import { useThemeStore } from '../../store/useThemeStore'
import { THEMES, type ThemeId } from '../../themes'

interface ThemePopupProps {
  onClose: () => void
}

export function ThemePopup({ onClose }: ThemePopupProps): JSX.Element {
  const themeId = useThemeStore((s) => s.themeId)
  const setTheme = useThemeStore((s) => s.setTheme)

  const themeIds = Object.keys(THEMES) as ThemeId[]

  const handleSelect = (id: ThemeId): void => {
    setTheme(id)
    onClose()
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: '100%',
      left: 0,
      right: 0,
      backgroundColor: '#161b22',
      border: '1px solid #30363d',
      borderRadius: '6px 6px 0 0',
      overflow: 'hidden',
      boxShadow: '0 -4px 16px rgba(0,0,0,0.4)',
      zIndex: 10
    }}>
      <div style={{
        padding: '6px 10px',
        fontSize: '9px',
        color: '#484f58',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        borderBottom: '1px solid #21262d'
      }}>
        选择主题
      </div>
      {themeIds.map((id) => {
        const entry = THEMES[id]
        const isSelected = id === themeId
        const needsBorder = id === 'github-dark' || id === 'solarized-light'
        return (
          <div
            key={id}
            onClick={() => handleSelect(id)}
            style={{
              padding: '6px 10px',
              fontSize: '11px',
              color: isSelected ? '#64ffda' : '#8892a4',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.background = '#0f3460'
                e.currentTarget.style.color = '#cdd9e5'
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = '#8892a4'
              }
            }}
          >
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              flexShrink: 0,
              background: entry.dot,
              border: needsBorder ? '1px solid #30363d' : 'none'
            }} />
            {entry.name}
            {isSelected && ' ✓'}
          </div>
        )
      })}
    </div>
  )
}
