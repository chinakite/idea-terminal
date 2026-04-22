// src/renderer/src/store/persistSessions.ts
import { useSessionStore } from './useSessionStore'
import { useCommandHistoryStore } from './useCommandHistoryStore'

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function buildSnapshots(): Array<{
  id: string
  title: string
  groupId: string
  proxyId?: string
  lastCommands: string[]
}> {
  const sessions = useSessionStore.getState().sessions
  const history = useCommandHistoryStore.getState().history
  return sessions.map((s) => ({
    id: s.id,
    title: s.title,
    groupId: s.groupId,
    proxyId: s.proxyId,
    lastCommands: history[s.id] ?? []
  }))
}

/** Save immediately — use for session add / remove / rename / move. */
export function saveNow(): void {
  if (typeof window === 'undefined') return
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  window.api.saveSessionSnapshot(buildSnapshots()).catch(() => {})
}

/** Debounced save — use after each typed command (avoids saving on every keystroke). */
export function scheduleSave(delayMs = 500): void {
  if (typeof window === 'undefined') return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    window.api.saveSessionSnapshot(buildSnapshots()).catch(() => {})
  }, delayMs)
}
