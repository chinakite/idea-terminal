// src/main/ipc/handlers.ts
import { ipcMain, BrowserWindow } from 'electron'
import { homedir } from 'os'
import type { IDisposable } from 'node-pty'
import { PtyManager } from '../pty/PtyManager'
import { ConfigManager } from '../config/ConfigManager'

export function registerHandlers(ptyManager: PtyManager, configManager: ConfigManager): void {
  const disposables = new Map<string, IDisposable[]>()

  ipcMain.handle('terminal:create', (_event, options: { id: string; cwd: string }) => {
    const win = BrowserWindow.fromWebContents(_event.sender)
    if (!win) return { pid: -1 }

    const result = ptyManager.create(options)

    const dataDisposable = ptyManager.onData(options.id, (data) => {
      if (!win.isDestroyed()) win.webContents.send(`terminal:data:${options.id}`, data)
    })

    const exitDisposable = ptyManager.onExit(options.id, (code) => {
      if (!win.isDestroyed()) win.webContents.send(`terminal:exit:${options.id}`, code)
      ptyManager.destroy(options.id)
      disposables.delete(options.id)
    })

    const sessionDisposables: IDisposable[] = []
    if (dataDisposable) sessionDisposables.push(dataDisposable)
    if (exitDisposable) sessionDisposables.push(exitDisposable)
    disposables.set(options.id, sessionDisposables)

    return result
  })

  ipcMain.handle('terminal:destroy', (_event, id: string) => {
    const sessionDisposables = disposables.get(id)
    if (sessionDisposables) {
      sessionDisposables.forEach((d) => d.dispose())
      disposables.delete(id)
    }
    ptyManager.destroy(id)
  })

  ipcMain.on('terminal:write', (_event, id: string, data: string) => {
    ptyManager.write(id, data)
  })

  ipcMain.on('terminal:resize', (_event, id: string, cols: number, rows: number) => {
    if (typeof id === 'string' && cols > 0 && rows > 0) {
      ptyManager.resize(id, cols, rows)
    }
  })

  ipcMain.handle('system:homedir', () => homedir())

  ipcMain.handle('config:load', () => configManager.load())

  ipcMain.handle('config:save', (_event, config) => configManager.save(config))
}
