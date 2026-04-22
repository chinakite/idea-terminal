// src/main/index.ts
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { PtyManager } from './pty/PtyManager'
import { ConfigManager } from './config/ConfigManager'
import { SessionPersistenceManager } from './session/SessionPersistenceManager'
import { AiKeyStore } from './ai/AiKeyStore'
import { AiManager } from './ai/AiManager'
import { registerHandlers } from './ipc/handlers'

const ptyManager = new PtyManager()
const configManager = new ConfigManager(app.getPath('userData'))
const sessionManager = new SessionPersistenceManager(app.getPath('userData'))

/** Set to true once the quit sequence starts so the second before-quit fires pass through. */
let isQuitting = false

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  return win
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.idea-terminal')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  const aiKeyStore = new AiKeyStore()
  const aiManager = new AiManager()
  registerHandlers(ptyManager, configManager, sessionManager, aiKeyStore, aiManager)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', (event) => {
  // Second call after app.quit() — let Electron proceed normally
  if (isQuitting) return

  event.preventDefault()

  const windows = BrowserWindow.getAllWindows()
  if (windows.length === 0) {
    // No renderer window to ask — quit immediately
    isQuitting = true
    app.quit()
    return
  }

  // Timeout guard: if renderer doesn't respond within 2 seconds, quit anyway
  const timer = setTimeout(() => {
    isQuitting = true
    app.quit()
  }, 2000)

  ipcMain.once('session:quit-ready', () => {
    clearTimeout(timer)
    isQuitting = true
    app.quit()
  })

  windows[0].webContents.send('app:will-quit')
})

app.on('window-all-closed', () => {
  ptyManager.destroyAll()
  if (process.platform !== 'darwin') app.quit()
})
