// src/main/ipc/handlers.ts
import { ipcMain, BrowserWindow } from 'electron'
import { homedir } from 'os'
import { PtyManager } from '../pty/PtyManager'
import { ConfigManager } from '../config/ConfigManager'

export function registerHandlers(ptyManager: PtyManager, configManager: ConfigManager): void {
  ipcMain.handle('terminal:create', (_event, options: { id: string; cwd: string }) => {
    const win = BrowserWindow.fromWebContents(_event.sender)!
    const result = ptyManager.create(options)

    ptyManager.onData(options.id, (data) => {
      win.webContents.send(`terminal:data:${options.id}`, data)
    })

    ptyManager.onExit(options.id, (code) => {
      win.webContents.send(`terminal:exit:${options.id}`, code)
      ptyManager.destroy(options.id)
    })

    return result
  })

  ipcMain.handle('terminal:destroy', (_event, id: string) => {
    ptyManager.destroy(id)
  })

  ipcMain.on('terminal:write', (_event, id: string, data: string) => {
    ptyManager.write(id, data)
  })

  ipcMain.on('terminal:resize', (_event, id: string, cols: number, rows: number) => {
    ptyManager.resize(id, cols, rows)
  })

  ipcMain.handle('system:homedir', () => homedir())

  ipcMain.handle('config:load', () => configManager.load())

  ipcMain.handle('config:save', (_event, config) => configManager.save(config))
}
