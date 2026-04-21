// src/renderer/src/store/useTerminalOutputStore.ts
import { create } from 'zustand'

const ANSI_REGEX = /\x1b\[[0-9;]*[mGKHFABCDJsu]/g
const MAX_BUFFER = 5000

interface TerminalOutputStore {
  buffers: Record<string, string>
  appendData: (sessionId: string, data: string) => void
  getOutput: (sessionId: string) => string
}

export const useTerminalOutputStore = create<TerminalOutputStore>((set, get) => ({
  buffers: {},

  appendData: (sessionId, data) => {
    set((state) => {
      const current = state.buffers[sessionId] ?? ''
      const combined = current + data
      const trimmed = combined.length > MAX_BUFFER ? combined.slice(combined.length - MAX_BUFFER) : combined
      return { buffers: { ...state.buffers, [sessionId]: trimmed } }
    })
  },

  getOutput: (sessionId) => {
    const raw = get().buffers[sessionId] ?? ''
    return raw.replace(ANSI_REGEX, '')
  }
}))
