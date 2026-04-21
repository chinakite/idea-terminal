// src/renderer/src/store/useConfigStore.ts
import { create } from 'zustand'
import { AppConfig, DEFAULT_CONFIG, TerminalGroup, QuickCommand, ProxyConfig } from '../../../shared/types'

const genId = (): string => Math.random().toString(36).slice(2, 10)

interface ConfigStore {
  config: AppConfig
  isLoaded: boolean
  load: () => Promise<void>
  save: () => Promise<void>
  addGroup: (name: string) => TerminalGroup
  renameGroup: (id: string, name: string) => void
  removeGroup: (id: string) => void
  addQuickCommand: (label: string, command: string) => QuickCommand
  removeQuickCommand: (id: string) => void
  addProxy: (data: Omit<ProxyConfig, 'id' | 'createdAt' | 'updatedAt'>) => ProxyConfig
  removeProxy: (id: string) => void
  updateProxy: (id: string, updates: Partial<Omit<ProxyConfig, 'id' | 'createdAt'>>) => void
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: structuredClone(DEFAULT_CONFIG),
  isLoaded: false,

  load: async () => {
    const config = await window.api.loadConfig()
    set({ config, isLoaded: true })
  },

  save: async () => {
    await window.api.saveConfig(get().config)
  },

  addGroup: (name) => {
    const now = Date.now()
    const group: TerminalGroup = {
      id: genId(),
      name,
      createdAt: now,
      updatedAt: now,
      sessions: []
    }
    set((state) => ({
      config: { ...state.config, groups: [...state.config.groups, group] }
    }))
    get().save().catch(console.error)
    return group
  },

  renameGroup: (id, name) => {
    set((state) => ({
      config: {
        ...state.config,
        groups: state.config.groups.map((g) =>
          g.id === id ? { ...g, name, updatedAt: Date.now() } : g
        )
      }
    }))
    get().save().catch(console.error)
  },

  removeGroup: (id) => {
    set((state) => ({
      config: {
        ...state.config,
        groups: state.config.groups.filter((g) => g.id !== id)
      }
    }))
    get().save().catch(console.error)
  },

  addQuickCommand: (label, command) => {
    const now = Date.now()
    const qc: QuickCommand = { id: genId(), label, command, createdAt: now, updatedAt: now }
    set((state) => ({
      config: { ...state.config, quickCommands: [...state.config.quickCommands, qc] }
    }))
    get().save().catch(console.error)
    return qc
  },

  removeQuickCommand: (id) => {
    set((state) => ({
      config: {
        ...state.config,
        quickCommands: state.config.quickCommands.filter((q) => q.id !== id)
      }
    }))
    get().save().catch(console.error)
  },

  addProxy: (data) => {
    const now = Date.now()
    const proxy: ProxyConfig = { id: genId(), ...data, createdAt: now, updatedAt: now }
    set((state) => ({
      config: { ...state.config, proxies: [...state.config.proxies, proxy] }
    }))
    get().save().catch(console.error)
    return proxy
  },

  removeProxy: (id) => {
    set((state) => ({
      config: { ...state.config, proxies: state.config.proxies.filter((p) => p.id !== id) }
    }))
    get().save().catch(console.error)
  },

  updateProxy: (id, updates) => {
    set((state) => ({
      config: {
        ...state.config,
        proxies: state.config.proxies.map((p) =>
          p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
        )
      }
    }))
    get().save().catch(console.error)
  }
}))
