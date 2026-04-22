// src/preload/index.ts
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type { TerminalAPI } from '../renderer/src/types/api'

const api: TerminalAPI = {
  create: (options) => ipcRenderer.invoke('terminal:create', options),
  destroy: (id) => ipcRenderer.invoke('terminal:destroy', id),
  write: (id, data) => ipcRenderer.send('terminal:write', id, data),
  resize: (id, cols, rows) => ipcRenderer.send('terminal:resize', id, cols, rows),

  onData: (id, callback) => {
    const channel = `terminal:data:${id}`
    const handler = (_: IpcRendererEvent, data: string): void => callback(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  onExit: (id, callback) => {
    const channel = `terminal:exit:${id}`
    const handler = (_: IpcRendererEvent, code: number): void => callback(code)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  getHomedir: () => ipcRenderer.invoke('system:homedir'),
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),

  // Session persistence
  saveSessionSnapshot: (snapshots) => ipcRenderer.invoke('session:save', snapshots),
  loadSessionSnapshots: () => ipcRenderer.invoke('session:load'),

  onWillQuit: (callback) => {
    const handler = (): void => callback()
    ipcRenderer.once('app:will-quit', handler)
    return () => ipcRenderer.removeListener('app:will-quit', handler)
  },

  notifyQuitReady: () => ipcRenderer.send('session:quit-ready'),

  saveAiAgent: (agent) => ipcRenderer.invoke('ai:save-agent', agent),
  deleteAiAgent: (id) => ipcRenderer.invoke('ai:delete-agent', id),

  sendAiMessage: (requestId, agentId, messages, terminalContext) => {
    ipcRenderer.send('ai:send-message', { requestId, agentId, messages, terminalContext })
  },

  onAiChunk: (requestId, callback) => {
    const channel = `ai:chunk:${requestId}`
    const handler = (_: IpcRendererEvent, delta: string): void => callback(delta)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  onAiEnd: (requestId, callback) => {
    const channel = `ai:end:${requestId}`
    const handler = (): void => callback()
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  onAiError: (requestId, callback) => {
    const channel = `ai:error:${requestId}`
    const handler = (_: IpcRendererEvent, error: string): void => callback(error)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  abortAiMessage: (requestId) => ipcRenderer.send('ai:abort', requestId)
}

contextBridge.exposeInMainWorld('api', api)
