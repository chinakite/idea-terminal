// src/renderer/src/store/useAiStore.ts
import { create } from 'zustand'
import type { AiMessage } from '../../../shared/types'

interface AiStore {
  histories: Record<string, AiMessage[]>
  agentIds: Record<string, string | null>
  addMessage: (sessionId: string, message: AiMessage) => void
  appendToLast: (sessionId: string, delta: string) => void
  clearHistory: (sessionId: string) => void
  setAgentId: (sessionId: string, agentId: string | null) => void
}

export const useAiStore = create<AiStore>((set, get) => ({
  histories: {},
  agentIds: {},

  addMessage: (sessionId, message) => {
    set((state) => ({
      histories: {
        ...state.histories,
        [sessionId]: [...(state.histories[sessionId] ?? []), message]
      }
    }))
  },

  appendToLast: (sessionId, delta) => {
    const messages = get().histories[sessionId]
    if (!messages || messages.length === 0) return
    set((state) => {
      const msgs = state.histories[sessionId]
      const updated = [
        ...msgs.slice(0, -1),
        { ...msgs[msgs.length - 1], content: msgs[msgs.length - 1].content + delta }
      ]
      return { histories: { ...state.histories, [sessionId]: updated } }
    })
  },

  clearHistory: (sessionId) => {
    set((state) => ({
      histories: { ...state.histories, [sessionId]: [] }
    }))
  },

  setAgentId: (sessionId, agentId) => {
    set((state) => ({
      agentIds: { ...state.agentIds, [sessionId]: agentId }
    }))
  }
}))
