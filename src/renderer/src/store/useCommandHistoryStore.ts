import { create } from 'zustand'

const MAX_COMMANDS = 10

interface CommandHistoryStore {
  history: Record<string, string[]>
  addCommand: (sessionId: string, cmd: string) => void
  clearSession: (sessionId: string) => void
}

export const useCommandHistoryStore = create<CommandHistoryStore>((set) => ({
  history: {},

  addCommand: (sessionId, cmd) =>
    set((state) => {
      const existing = state.history[sessionId] ?? []
      const updated = [...existing, cmd].slice(-MAX_COMMANDS)
      return { history: { ...state.history, [sessionId]: updated } }
    }),

  clearSession: (sessionId) =>
    set((state) => {
      const next = { ...state.history }
      delete next[sessionId]
      return { history: next }
    })
}))
