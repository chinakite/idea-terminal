// src/renderer/src/store/useSessionStore.ts
import { create } from 'zustand'
import { useSplitStore } from './useSplitStore'

export interface RuntimeSession {
  id: string
  title: string
  groupId: string
  pid: number
  status: 'running' | 'disconnected'
  proxyId?: string
}

interface SessionStore {
  sessions: RuntimeSession[]
  activeSessionId: string | null
  addSession: (session: RuntimeSession) => void
  removeSession: (id: string) => void
  /** Atomically removes the session and nullifies any pane that was showing it. */
  closeSession: (id: string) => void
  setActive: (id: string) => void
  markDisconnected: (id: string) => void
  /** Updates the display title of an existing session. */
  renameSession: (id: string, title: string) => void
  /**
   * Moves a session to a different group and repositions it in the flat sessions array.
   * @param id             Session to move
   * @param targetGroupId  Destination group id
   * @param insertAfterId  Insert after this session id, or null to insert before the
   *                       first session already in targetGroupId (appends if group is empty)
   */
  moveSession: (id: string, targetGroupId: string, insertAfterId: string | null) => void
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

  closeSession: (id) => {
    window.api.destroy(id)
    useSessionStore.getState().removeSession(id)
    useSplitStore.getState().clearSession(id)
  },

  setActive: (id) => set({ activeSessionId: id }),

  markDisconnected: (id) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, status: 'disconnected' } : s))
    })),

  renameSession: (id, title) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, title } : s))
    })),

  moveSession: (id, targetGroupId, insertAfterId) =>
    set((state) => {
      const session = state.sessions.find((s) => s.id === id)
      if (!session) return state
      const updated = { ...session, groupId: targetGroupId }
      // Remove from current position
      const remaining = state.sessions.filter((s) => s.id !== id)

      if (insertAfterId === null) {
        // Insert before the first existing session of targetGroupId
        const firstIdx = remaining.findIndex((s) => s.groupId === targetGroupId)
        if (firstIdx === -1) {
          // Target group has no sessions — append to end
          return { sessions: [...remaining, updated] }
        }
        const next = [...remaining]
        next.splice(firstIdx, 0, updated)
        return { sessions: next }
      }

      // Insert after insertAfterId
      const afterIdx = remaining.findIndex((s) => s.id === insertAfterId)
      if (afterIdx === -1) {
        // insertAfterId not found (should not happen in normal use) — append
        return { sessions: [...remaining, updated] }
      }
      const next = [...remaining]
      next.splice(afterIdx + 1, 0, updated)
      return { sessions: next }
    })
}))
