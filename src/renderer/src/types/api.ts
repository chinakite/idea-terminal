// src/renderer/src/types/api.ts
export interface TerminalAPI {
  // 终端生命周期
  create: (options: { id: string; cwd: string }) => Promise<{ pid: number }>
  destroy: (id: string) => Promise<void>
  write: (id: string, data: string) => void
  resize: (id: string, cols: number, rows: number) => void

  // 数据事件（Main → Renderer）
  onData: (id: string, callback: (data: string) => void) => () => void
  onExit: (id: string, callback: (code: number) => void) => () => void

  // 系统
  getHomedir: () => Promise<string>

  // 配置
  loadConfig: () => Promise<import('../../../shared/types').AppConfig>
  saveConfig: (config: import('../../../shared/types').AppConfig) => Promise<void>
}

declare global {
  interface Window {
    api: TerminalAPI
  }
}
