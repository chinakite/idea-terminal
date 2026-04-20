// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'
import type { TerminalAPI } from '../renderer/src/types/api'

const api: TerminalAPI = {
  create: (options) => ipcRenderer.invoke('terminal:create', options),
  destroy: (id) => ipcRenderer.invoke('terminal:destroy', id),
  write: (id, data) => ipcRenderer.send('terminal:write', id, data),
  resize: (id, cols, rows) => ipcRenderer.send('terminal:resize', id, cols, rows),

  onData: (id, callback) => {
    const channel = `terminal:data:${id}`
    const handler = (_: Electron.IpcRendererEvent, data: string) => callback(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  onExit: (id, callback) => {
    const channel = `terminal:exit:${id}`
    const handler = (_: Electron.IpcRendererEvent, code: number) => callback(code)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  getHomedir: () => ipcRenderer.invoke('system:homedir'),
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config)
}

contextBridge.exposeInMainWorld('api', api)
