// src/renderer/src/store/useSessionStore.ts
import { create } from 'zustand'

export interface RuntimeSession {
  id: string
  title: string
  groupId: string
  pid: number
  status: 'running' | 'disconnected'
}

interface SessionStore {
  sessions: RuntimeSession[]
  activeSessionId: string | null
  addSession: (session: RuntimeSession) => void
  removeSession: (id: string) => void
  setActive: (id: string) => void
  markDisconnected: (id: string) => void
}

export const useSessionStore = create<SessionStore>((set) => ({
  sessions: [],
  activeSessionId: null,

  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: state.activeSessionId ?? session.id
    })),

  removeSession: (id) =>
    set((state) => {
      const remaining = state.sessions.filter((s) => s.id !== id)
      return {
        sessions: remaining,
        activeSessionId:
          state.activeSessionId === id ? (remaining[0]?.id ?? null) : state.activeSessionId
      }
    }),

  setActive: (id) => set({ activeSessionId: id }),

  markDisconnected: (id) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, status: 'disconnected' } : s))
    }))
}))
