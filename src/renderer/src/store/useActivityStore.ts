// src/renderer/src/store/useActivityStore.ts
import { create } from 'zustand'

interface ActivityStore {
  unread: Record<string, true>
  markActivity: (sessionId: string) => void
  clearActivity: (sessionId: string) => void
  hasActivity: (sessionId: string) => boolean
}

export const useActivityStore = create<ActivityStore>((set, get) => ({
  unread: {},

  markActivity: (sessionId) => {
    set((state) => ({ unread: { ...state.unread, [sessionId]: true } }))
  },

  clearActivity: (sessionId) => {
    set((state) => {
      const next = { ...state.unread }
      delete next[sessionId]
      return { unread: next }
    })
  },

  hasActivity: (sessionId) => {
    return !!get().unread[sessionId]
  }
}))
