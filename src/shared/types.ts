// src/shared/types.ts

export interface TerminalGroup {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  defaultProxyId?: string
  defaultAiAgentId?: string
  sessions: TerminalSessionConfig[]
}

export interface TerminalSessionConfig {
  id: string
  title: string
  groupId: string
  cwd: string
  createdAt: number
  updatedAt: number
  proxyId?: string
  aiAgentId?: string
}

export interface AppConfig {
  groups: TerminalGroup[]
  quickCommands: QuickCommand[]
  proxies: ProxyConfig[]
  aiAgents: AiAgentConfig[]
  theme: 'dark' | 'light' | 'high-contrast'
}

export interface QuickCommand {
  id: string
  label: string
  command: string
  createdAt: number
  updatedAt: number
}

export interface ProxyConfig {
  id: string
  name: string
  type: 'http' | 'socks5'
  host: string
  port: number
  username?: string
  password?: string
  createdAt: number
  updatedAt: number
}

export interface AiAgentConfig {
  id: string
  name: string
  provider: 'claude' | 'openai' | 'custom'  // custom 遵循 OpenAI 兼容 API 格式
  apiKey: string
  model: string
  baseUrl?: string      // custom provider 的 API 端点
  systemPrompt?: string
  createdAt: number
  updatedAt: number
}

export const DEFAULT_CONFIG: AppConfig = {
  groups: [],
  quickCommands: [],
  proxies: [],
  aiAgents: [],
  theme: 'dark'
}
