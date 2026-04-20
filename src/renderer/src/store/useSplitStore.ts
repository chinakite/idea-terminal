// src/renderer/src/store/useSplitStore.ts
import { create } from 'zustand'

export interface Pane {
  id: string
  sessionId: string | null
}

interface SplitStore {
  panes: Pane[]
  activePaneId: string | null
  addPane: (sessionId?: string) => string | null
  removePane: (paneId: string) => void
  setActivePane: (paneId: string) => void
  assignSession: (paneId: string, sessionId: string) => void
  clearSession: (sessionId: string) => void
  getActivePaneSessionId: () => string | null
}

const genId = (): string => Math.random().toString(36).slice(2, 10)

const initialPaneId = genId()

export const useSplitStore = create<SplitStore>((set, get) => ({
  panes: [{ id: initialPaneId, sessionId: null }],
  activePaneId: initialPaneId,

  addPane: (sessionId) => {
    if (get().panes.length >= 4) return null
    const id = genId()
    set((state) => ({
      panes: [...state.panes, { id, sessionId: sessionId ?? null }],
      activePaneId: id
    }))
    return id
  },

  removePane: (paneId) => {
    set((state) => {
      if (state.panes.length <= 1) return state
      const remaining = state.panes.filter((p) => p.id !== paneId)
      const newActive =
        state.activePaneId === paneId
          ? remaining[remaining.length - 1].id
          : state.activePaneId
      return { panes: remaining, activePaneId: newActive }
    })
  },

  setActivePane: (paneId) => set({ activePaneId: paneId }),

  assignSession: (paneId, sessionId) => {
    set((state) => ({
      panes: state.panes.map((p) => (p.id === paneId ? { ...p, sessionId } : p))
    }))
  },

  clearSession: (sessionId) => {
    set((state) => ({
      panes: state.panes.map((p) =>
        p.sessionId === sessionId ? { ...p, sessionId: null } : p
      )
    }))
  },

  getActivePaneSessionId: () => {
    const { panes, activePaneId } = get()
    return panes.find((p) => p.id === activePaneId)?.sessionId ?? null
  }
}))
