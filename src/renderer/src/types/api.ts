// src/renderer/src/types/api.ts
import type { AppConfig, AiAgentConfig } from '../../../shared/types'

export interface PersistedSession {
  id: string
  title: string
  groupId: string
  proxyId?: string
  lastCwd: string
  lastCommands: string[]
}

export interface TerminalAPI {
  // 终端生命周期
  create: (options: { id: string; cwd: string; proxyId?: string; histCommands?: string[] }) => Promise<{ pid: number }>
  destroy: (id: string) => Promise<void>
  write: (id: string, data: string) => void
  resize: (id: string, cols: number, rows: number) => void

  // 数据事件（Main → Renderer）
  onData: (id: string, callback: (data: string) => void) => () => void
  onExit: (id: string, callback: (code: number) => void) => () => void

  // 系统
  getHomedir: () => Promise<string>

  // 配置
  loadConfig: () => Promise<AppConfig>
  saveConfig: (config: AppConfig) => Promise<void>

  // 会话持久化
  saveSessionSnapshot: (snapshots: Omit<PersistedSession, 'lastCwd'>[]) => Promise<void>
  loadSessionSnapshots: () => Promise<PersistedSession[]>

  // AI Agent 管理
  saveAiAgent: (
    agent: Omit<AiAgentConfig, 'apiKey' | 'createdAt' | 'updatedAt'> & {
      apiKey: string
      id?: string
    }
  ) => Promise<{ success: boolean }>
  deleteAiAgent: (id: string) => Promise<void>

  // AI 流式对话
  sendAiMessage: (
    requestId: string,
    agentId: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    terminalContext?: string
  ) => void
  onAiChunk: (requestId: string, callback: (delta: string) => void) => () => void
  onAiEnd: (requestId: string, callback: () => void) => () => void
  onAiError: (requestId: string, callback: (error: string) => void) => () => void
  abortAiMessage: (requestId: string) => void
}

declare global {
  interface Window {
    api: TerminalAPI
  }
  // Injected at build time via Vite define — always matches package.json version
  const __APP_VERSION__: string
}
