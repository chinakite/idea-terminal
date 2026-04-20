// src/main/ipc/handlers.ts
import { ipcMain, BrowserWindow } from 'electron'
import { homedir } from 'os'
import type { IDisposable } from 'node-pty'
import { PtyManager } from '../pty/PtyManager'
import { ConfigManager } from '../config/ConfigManager'
import { AiKeyStore } from '../ai/AiKeyStore'
import { AiManager, ChatMessage } from '../ai/AiManager'
import type { AiAgentConfig } from '../../shared/types'

export function registerHandlers(
  ptyManager: PtyManager,
  configManager: ConfigManager,
  aiKeyStore: AiKeyStore,
  aiManager: AiManager
): void {
  const disposables = new Map<string, IDisposable[]>()
  const activeStreams = new Map<string, AbortController>()

  // ── Terminal ──────────────────────────────────────────────────────────────

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

  // ── AI Agents ─────────────────────────────────────────────────────────────

  ipcMain.handle(
    'ai:save-agent',
    (
      _event,
      agentData: Omit<AiAgentConfig, 'apiKey' | 'createdAt' | 'updatedAt'> & {
        apiKey: string
        id?: string
      }
    ) => {
      const config = configManager.load()
      const now = Date.now()

      if (agentData.id) {
        config.aiAgents = config.aiAgents.map((a) => {
          if (a.id !== agentData.id) return a
          const encryptedKey = agentData.apiKey
            ? aiKeyStore.encrypt(agentData.apiKey)
            : a.apiKey
          return { ...a, ...agentData, apiKey: encryptedKey, updatedAt: now }
        })
      } else {
        const id = Math.random().toString(36).slice(2, 10)
        const newAgent: AiAgentConfig = {
          id,
          name: agentData.name,
          provider: agentData.provider,
          apiKey: aiKeyStore.encrypt(agentData.apiKey),
          model: agentData.model,
          baseUrl: agentData.baseUrl,
          systemPrompt: agentData.systemPrompt,
          createdAt: now,
          updatedAt: now
        }
        config.aiAgents.push(newAgent)
      }

      configManager.save(config)
      return { success: true }
    }
  )

  ipcMain.handle('ai:delete-agent', (_event, id: string) => {
    const config = configManager.load()
    config.aiAgents = config.aiAgents.filter((a) => a.id !== id)
    configManager.save(config)
    return { success: true }
  })

  // ── AI Streaming ──────────────────────────────────────────────────────────

  ipcMain.on(
    'ai:send-message',
    async (
      _event,
      payload: {
        requestId: string
        agentId: string
        messages: ChatMessage[]
        terminalContext?: string
      }
    ) => {
      const { requestId, agentId, messages, terminalContext } = payload
      const win = BrowserWindow.fromWebContents(_event.sender)
      if (!win) return

      const config = configManager.load()
      const agentConfig = config.aiAgents.find((a) => a.id === agentId)
      if (!agentConfig) {
        if (!win.isDestroyed()) win.webContents.send(`ai:error:${requestId}`, 'Agent not found')
        return
      }

      let apiKey: string
      try {
        apiKey = aiKeyStore.decrypt(agentConfig.apiKey)
      } catch {
        if (!win.isDestroyed())
          win.webContents.send(`ai:error:${requestId}`, 'Failed to decrypt API key')
        return
      }

      const allMessages: ChatMessage[] = terminalContext
        ? [
            ...messages.slice(0, -1),
            {
              role: messages[messages.length - 1].role,
              content: `终端输出:\n${terminalContext}\n\n${messages[messages.length - 1].content}`
            }
          ]
        : messages

      const controller = new AbortController()
      activeStreams.set(requestId, controller)

      try {
        await aiManager.stream(
          {
            provider: agentConfig.provider,
            apiKey,
            model: agentConfig.model,
            baseUrl: agentConfig.baseUrl,
            systemPrompt: agentConfig.systemPrompt
          },
          allMessages,
          (delta) => {
            if (!win.isDestroyed()) win.webContents.send(`ai:chunk:${requestId}`, delta)
          },
          controller.signal
        )
        if (!win.isDestroyed()) win.webContents.send(`ai:end:${requestId}`)
      } catch (err) {
        if (!controller.signal.aborted && !win.isDestroyed()) {
          win.webContents.send(`ai:error:${requestId}`, String(err))
        }
      } finally {
        activeStreams.delete(requestId)
      }
    }
  )

  ipcMain.on('ai:abort', (_event, requestId: string) => {
    activeStreams.get(requestId)?.abort()
    activeStreams.delete(requestId)
  })
}
