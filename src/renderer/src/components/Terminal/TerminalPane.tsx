// src/renderer/src/components/Terminal/TerminalPane.tsx
import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { useSessionStore } from '../../store/useSessionStore'
import { useTerminalOutputStore } from '../../store/useTerminalOutputStore'
import { useCommandHistoryStore } from '../../store/useCommandHistoryStore'
import { useActivityStore } from '../../store/useActivityStore'
import { useSplitStore } from '../../store/useSplitStore'
import { scheduleSave } from '../../store/persistSessions'
import 'xterm/css/xterm.css'

/** Prevents re-notifying the same session within 30 seconds. */
const notificationCooldowns = new Map<string, number>()
const COOLDOWN_MS = 30_000
const QUIET_PERIOD_MS = 2_000

interface TerminalPaneProps {
  sessionId: string
  isActive: boolean
  /** Called when the user presses ⌘D (horizontal split) inside this terminal */
  onSplitH?: () => void
  /** Called when the user presses ⌘⇧D (vertical split) inside this terminal */
  onSplitV?: () => void
  /** Called when the user presses ⌘W (close pane) inside this terminal */
  onClose?: () => void
}

export function TerminalPane({
  sessionId,
  isActive,
  onSplitH,
  onSplitV,
  onClose
}: TerminalPaneProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const cleanupRef = useRef<(() => void)[]>([])
  const markDisconnected = useSessionStore((s) => s.markDisconnected)

  /** Keeps isActive current inside the onData closure (avoids stale closure). */
  const isActiveRef = useRef(isActive)
  /** Timer ID for the 2-second quiet period before firing a notification. */
  const quietTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fit = useCallback(() => {
    if (!fitAddonRef.current || !termRef.current) return
    fitAddonRef.current.fit()
    const { cols, rows } = termRef.current
    window.api.resize(sessionId, cols, rows)
  }, [sessionId])

  // Mount xterm once per sessionId
  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0d1117',
        foreground: '#cdd9e5',
        cursor: '#cdd9e5',
        selectionBackground: '#264f78'
      }
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Command tracking: intercept keystrokes to record commands in history
    let lineBuffer = ''
    const addCommand = useCommandHistoryStore.getState().addCommand
    const disposeInput = term.onData((data) => {
      window.api.write(sessionId, data)
      if (data === '\r') {
        const cmd = lineBuffer.trim()
        if (cmd) {
          addCommand(sessionId, cmd)
          scheduleSave()
        }
        lineBuffer = ''
      } else if (data === '\x7f') {
        // Backspace
        lineBuffer = lineBuffer.slice(0, -1)
      } else if (!data.startsWith('\x1b') && data.length === 1) {
        // Printable character (ignore ANSI escape sequences like arrow keys)
        lineBuffer += data
      }
    })
    const removeData = window.api.onData(sessionId, (data) => {
      term.write(data)
      useTerminalOutputStore.getState().appendData(sessionId, data)

      // Activity detection: only for non-active panes
      if (!isActiveRef.current) {
        useActivityStore.getState().markActivity(sessionId)

        // Reset the quiet-period timer on every new chunk of output
        if (quietTimerRef.current !== null) clearTimeout(quietTimerRef.current)
        quietTimerRef.current = setTimeout(() => {
          quietTimerRef.current = null

          // Skip if the app window is focused
          if (document.hasFocus()) return

          // Skip if the session no longer exists
          const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId)
          if (!session) return

          // Skip if within the 30-second cooldown
          const now = Date.now()
          const lastNotified = notificationCooldowns.get(sessionId) ?? 0
          if (now - lastNotified < COOLDOWN_MS) return

          // Send system notification (only if permission is granted)
          if (Notification.permission !== 'granted') return
          const notification = new Notification('IDEA Terminal', {
            body: `终端「${session.title}」需要您的操作`
          })
          notificationCooldowns.set(sessionId, Date.now())
          notification.onclick = () => {
            window.focus()
            const leaves = useSplitStore.getState().collectLeaves()
            const existingPane = leaves.find((l) => l.sessionId === sessionId)
            if (existingPane) {
              useSplitStore.getState().setActivePane(existingPane.id)
            } else {
              const { activePaneId, assignSession } = useSplitStore.getState()
              if (activePaneId) assignSession(activePaneId, sessionId)
            }
          }
        }, QUIET_PERIOD_MS)
      }
    })
    const removeExit = window.api.onExit(sessionId, () => {
      term.write('\r\n\x1b[33m[进程已退出]\x1b[0m\r\n')
      markDisconnected(sessionId)
    })

    cleanupRef.current = [
      () => disposeInput.dispose(),
      removeData,
      removeExit,
      () => term.dispose()
    ]

    cleanupRef.current.push(() => {
      if (quietTimerRef.current !== null) {
        clearTimeout(quietTimerRef.current)
        quietTimerRef.current = null
      }
    })
    cleanupRef.current.push(() => {
      useActivityStore.getState().clearActivity(sessionId)
    })
    cleanupRef.current.push(() => {
      notificationCooldowns.delete(sessionId)
    })

    // Guard: only fit when the container has non-zero dimensions
    // Use the `fit` callback (not fitAddon.fit directly) so PTY receives updated dimensions
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          fit()
        }
      }
    })
    resizeObserver.observe(containerRef.current)
    cleanupRef.current.push(() => resizeObserver.disconnect())

    return () => {
      cleanupRef.current.forEach((fn) => fn())
      cleanupRef.current = []
    }
  }, [sessionId])

  // Sync ref so the onData closure always sees the current value
  // Focus and fit when this pane becomes active; clear the activity dot
  useEffect(() => {
    isActiveRef.current = isActive
    if (isActive) {
      fit()
      termRef.current?.focus()
      useActivityStore.getState().clearActivity(sessionId)
    }
  }, [isActive, fit, sessionId])

  // Wire keyboard shortcuts via xterm's customKeyEventHandler
  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true
      if (e.metaKey && !e.shiftKey && e.key === 'd') {
        onSplitH?.()
        return false
      }
      if (e.metaKey && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        onSplitV?.()
        return false
      }
      if (e.metaKey && e.key === 'w') {
        onClose?.()
        return false
      }
      return true
    })
  }, [onSplitH, onSplitV, onClose])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', padding: '4px', backgroundColor: '#0d1117' }}
    />
  )
}
