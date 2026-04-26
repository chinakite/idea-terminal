// src/main/index.ts
import { app, BrowserWindow, shell } from 'electron'
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

  const sessions = sessionManager.load()
  if (sessions.length === 0) {
    isQuitting = true
    app.quit()
    return
  }

  // Update lastCwd for all sessions from live PTY processes, then quit
  Promise.all(
    sessions.map(async (s) => ({ ...s, lastCwd: await ptyManager.getCwd(s.id) }))
  )
    .then((updated) => sessionManager.save(updated))
    .catch(() => {})
    .finally(() => {
      isQuitting = true
      app.quit()
    })
})

app.on('window-all-closed', () => {
  // On macOS, keep PTY processes alive after window closes (app stays in dock).
  // Destroy PTYs on will-quit instead, after before-quit has saved CWDs.
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  ptyManager.destroyAll()
})
