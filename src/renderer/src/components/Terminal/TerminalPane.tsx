// src/renderer/src/components/Terminal/TerminalPane.tsx
import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { useSessionStore } from '../../store/useSessionStore'
import { useTerminalOutputStore } from '../../store/useTerminalOutputStore'
import 'xterm/css/xterm.css'

interface TerminalPaneProps {
  sessionId: string
  isActive: boolean
}

export function TerminalPane({ sessionId, isActive }: TerminalPaneProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const cleanupRef = useRef<(() => void)[]>([])
  const markDisconnected = useSessionStore((s) => s.markDisconnected)

  const fit = useCallback(() => {
    if (!fitAddonRef.current || !termRef.current) return
    fitAddonRef.current.fit()
    const { cols, rows } = termRef.current
    window.api.resize(sessionId, cols, rows)
  }, [sessionId])

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

    const disposeInput = term.onData((data) => window.api.write(sessionId, data))
    const removeData = window.api.onData(sessionId, (data) => {
      term.write(data)
      useTerminalOutputStore.getState().appendData(sessionId, data)
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

    const resizeObserver = new ResizeObserver(() => fitAddon.fit())
    resizeObserver.observe(containerRef.current)
    cleanupRef.current.push(() => resizeObserver.disconnect())

    return () => {
      cleanupRef.current.forEach((fn) => fn())
      cleanupRef.current = []
    }
  }, [sessionId])

  useEffect(() => {
    if (isActive) {
      fit()
      termRef.current?.focus()
    }
  }, [isActive, fit])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        padding: '4px',
        backgroundColor: '#0d1117'
      }}
    />
  )
}
