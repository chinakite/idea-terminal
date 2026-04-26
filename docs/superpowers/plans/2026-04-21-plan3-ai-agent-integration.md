# Plan 3: AI Agent Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Idea Terminal 添加完整的 AI Agent 集成：支持 Claude / OpenAI / 自定义 API，每个终端会话独立维护对话历史，AI 返回的代码块可手动确认后发送到终端，API Key 通过 Electron safeStorage 加密存储。

**Architecture:** Main Process 通过 `AiKeyStore`（safeStorage）加密 API Key，`AiManager` 负责向 Claude/OpenAI API 发起流式请求；流式 chunk 通过 `win.webContents.send` 推送给 Renderer；Renderer 的 `useAiStore` 管理每个会话的对话历史，`useTerminalOutputStore` 维护终端输出缓冲，`AiPanel` 作为可折叠面板显示在所有分屏下方（宽度 100%，高度 240px）。

**Tech Stack:** `@anthropic-ai/sdk`, `openai`, Electron `safeStorage`, Zustand, Vitest (`vi.mock`)

---

## 文件结构

```
src/main/
├── ai/
│   ├── AiKeyStore.ts              (新建) — safeStorage 加密/解密 API Key
│   └── AiManager.ts               (新建) — Claude/OpenAI/Custom 流式 API 调用
├── ipc/
│   └── handlers.ts                (修改) — 添加 ai:* IPC handlers
└── index.ts                       (修改) — 实例化 AiKeyStore + AiManager

src/renderer/src/
├── store/
│   ├── useAiStore.ts              (新建) — 每会话对话历史 + 当前 Agent 选择
│   └── useTerminalOutputStore.ts  (新建) — 每会话终端输出缓冲（最近 5000 字节）
├── components/
│   ├── Terminal/
│   │   └── TerminalPane.tsx       (修改) — onData 时同步写入 useTerminalOutputStore
│   └── AiPanel/
│       ├── AiPanel.tsx            (新建) — 主面板：消息历史、输入区、折叠控制
│       └── AiAgentForm.tsx        (新建) — 添加/编辑 Agent 表单
└── App.tsx                        (修改) — 将 AiPanel 添加到布局底部

src/preload/index.ts               (修改) — 添加 AI IPC channel 绑定
src/renderer/src/types/api.ts      (修改) — 添加 AI API 类型声明
src/shared/types.ts                (修改) — 添加 AiMessage 类型

tests/
├── main/ai/
│   ├── AiKeyStore.test.ts         (新建)
│   └── AiManager.test.ts          (新建)
└── renderer/store/
    ├── useAiStore.test.ts          (新建)
    └── useTerminalOutputStore.test.ts (新建)
```

---

## Task 1: 安装依赖 + AiMessage 类型

**Files:**
- Run: `npm install @anthropic-ai/sdk openai`
- Modify: `src/shared/types.ts`

- [ ] **Step 1: 安装 AI SDK 依赖**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal
npm install @anthropic-ai/sdk openai
```

预期：安装成功，`package.json` 中出现 `@anthropic-ai/sdk` 和 `openai`。

- [ ] **Step 2: 在 shared/types.ts 末尾添加 AiMessage**

在 `src/shared/types.ts` 末尾（`DEFAULT_CONFIG` 之前）添加：

```typescript
// src/shared/types.ts — 在 DEFAULT_CONFIG 之前添加
export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}
```

完整文件最终如下（只展示新增行位置，其余内容不变）：

```typescript
// ... 已有内容不变 ...

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export const DEFAULT_CONFIG: AppConfig = {
  groups: [],
  quickCommands: [],
  proxies: [],
  aiAgents: [],
  theme: 'dark'
}
```

- [ ] **Step 3: 运行测试确认无回归**

```bash
npm test
```

预期：26 个测试全部通过。

- [ ] **Step 4: Commit**

```bash
git add src/shared/types.ts package.json package-lock.json
git commit -m "feat: install AI SDKs and add AiMessage type"
```

---

## Task 2: AiKeyStore（TDD）

**Files:**
- Create: `src/main/ai/AiKeyStore.ts`
- Create: `tests/main/ai/AiKeyStore.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/main/ai/AiKeyStore.test.ts`：

```typescript
// tests/main/ai/AiKeyStore.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  safeStorage: {
    encryptString: vi.fn((s: string) => Buffer.from(`enc:${s}`)),
    decryptString: vi.fn((b: Buffer) => b.toString().replace('enc:', '')),
    isEncryptionAvailable: vi.fn(() => true)
  }
}))

const { AiKeyStore } = await import('../../../src/main/ai/AiKeyStore')

describe('AiKeyStore', () => {
  let store: InstanceType<typeof AiKeyStore>

  beforeEach(() => {
    store = new AiKeyStore()
    vi.clearAllMocks()
  })

  it('encrypt returns base64 string different from input', () => {
    const encrypted = store.encrypt('sk-secret')
    expect(typeof encrypted).toBe('string')
    expect(encrypted).not.toBe('sk-secret')
  })

  it('decrypt reverses encrypt', () => {
    const encrypted = store.encrypt('sk-my-api-key')
    expect(store.decrypt(encrypted)).toBe('sk-my-api-key')
  })

  it('isAvailable returns safeStorage availability', () => {
    expect(store.isAvailable()).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npm test
```

预期：FAIL — `Cannot find module '../../../src/main/ai/AiKeyStore'`

- [ ] **Step 3: 实现 AiKeyStore**

创建 `src/main/ai/AiKeyStore.ts`：

```typescript
// src/main/ai/AiKeyStore.ts
import { safeStorage } from 'electron'

export class AiKeyStore {
  encrypt(plaintext: string): string {
    return safeStorage.encryptString(plaintext).toString('base64')
  }

  decrypt(encrypted: string): string {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  }

  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npm test
```

预期：29 个测试（26 旧 + 3 新）全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/main/ai/AiKeyStore.ts tests/main/ai/AiKeyStore.test.ts
git commit -m "feat: add AiKeyStore for safeStorage API key encryption"
```

---

## Task 3: AiManager（TDD）

**Files:**
- Create: `src/main/ai/AiManager.ts`
- Create: `tests/main/ai/AiManager.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/main/ai/AiManager.test.ts`：

```typescript
// tests/main/ai/AiManager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAnthropicStream = {
  [Symbol.asyncIterator]: async function* () {
    yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } }
    yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } }
    yield { type: 'message_stop' }
  },
  abort: vi.fn()
}

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      stream: vi.fn().mockReturnValue(mockAnthropicStream)
    }
  }
}))

const mockOpenAiStream = {
  [Symbol.asyncIterator]: async function* () {
    yield { choices: [{ delta: { content: 'Hi' } }] }
    yield { choices: [{ delta: { content: ' there' } }] }
  }
}

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue(mockOpenAiStream)
      }
    }
  }
}))

const { AiManager } = await import('../../../src/main/ai/AiManager')

describe('AiManager', () => {
  let manager: InstanceType<typeof AiManager>

  beforeEach(() => {
    manager = new AiManager()
    vi.clearAllMocks()
    mockAnthropicStream.abort.mockReset()
  })

  it('streams Claude response chunk by chunk', async () => {
    const chunks: string[] = []
    const controller = new AbortController()
    await manager.stream(
      { provider: 'claude', apiKey: 'sk-test', model: 'claude-sonnet-4-6' },
      [{ role: 'user', content: 'hello' }],
      (delta) => chunks.push(delta),
      controller.signal
    )
    expect(chunks).toEqual(['Hello', ' world'])
  })

  it('streams OpenAI response chunk by chunk', async () => {
    const chunks: string[] = []
    const controller = new AbortController()
    await manager.stream(
      { provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o' },
      [{ role: 'user', content: 'hello' }],
      (delta) => chunks.push(delta),
      controller.signal
    )
    expect(chunks).toEqual(['Hi', ' there'])
  })

  it('streams custom provider using OpenAI-compatible path', async () => {
    const chunks: string[] = []
    const controller = new AbortController()
    await manager.stream(
      { provider: 'custom', apiKey: 'key', model: 'llama3', baseUrl: 'http://localhost:11434/v1' },
      [{ role: 'user', content: 'hi' }],
      (delta) => chunks.push(delta),
      controller.signal
    )
    expect(chunks).toEqual(['Hi', ' there'])
  })

  it('aborts Claude stream when signal fires', async () => {
    const controller = new AbortController()
    controller.abort()
    await manager.stream(
      { provider: 'claude', apiKey: 'sk-test', model: 'claude-sonnet-4-6' },
      [{ role: 'user', content: 'hello' }],
      vi.fn(),
      controller.signal
    )
    expect(mockAnthropicStream.abort).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npm test
```

预期：FAIL — `Cannot find module '../../../src/main/ai/AiManager'`

- [ ] **Step 3: 实现 AiManager**

创建 `src/main/ai/AiManager.ts`：

```typescript
// src/main/ai/AiManager.ts
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AgentParams {
  provider: 'claude' | 'openai' | 'custom'
  apiKey: string
  model: string
  baseUrl?: string
  systemPrompt?: string
}

export class AiManager {
  async stream(
    agent: AgentParams,
    messages: ChatMessage[],
    onChunk: (delta: string) => void,
    signal: AbortSignal
  ): Promise<void> {
    if (agent.provider === 'claude') {
      await this.streamClaude(agent, messages, onChunk, signal)
    } else {
      await this.streamOpenAi(agent, messages, onChunk, signal)
    }
  }

  private async streamClaude(
    agent: AgentParams,
    messages: ChatMessage[],
    onChunk: (delta: string) => void,
    signal: AbortSignal
  ): Promise<void> {
    const client = new Anthropic({ apiKey: agent.apiKey })
    const stream = client.messages.stream({
      model: agent.model,
      max_tokens: 4096,
      system: agent.systemPrompt,
      messages
    })
    const abortHandler = (): void => stream.abort()
    signal.addEventListener('abort', abortHandler)
    try {
      for await (const event of stream) {
        if (signal.aborted) break
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          onChunk(event.delta.text)
        }
      }
    } finally {
      signal.removeEventListener('abort', abortHandler)
    }
  }

  private async streamOpenAi(
    agent: AgentParams,
    messages: ChatMessage[],
    onChunk: (delta: string) => void,
    signal: AbortSignal
  ): Promise<void> {
    const client = new OpenAI({ apiKey: agent.apiKey, baseURL: agent.baseUrl })
    const systemMsgs: OpenAI.Chat.ChatCompletionMessageParam[] = agent.systemPrompt
      ? [{ role: 'system', content: agent.systemPrompt }]
      : []
    const chatMsgs: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content
    }))
    const completion = await client.chat.completions.create(
      { model: agent.model, messages: [...systemMsgs, ...chatMsgs], stream: true },
      { signal }
    )
    for await (const chunk of completion) {
      if (signal.aborted) break
      const delta = chunk.choices[0]?.delta?.content ?? ''
      if (delta) onChunk(delta)
    }
  }
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npm test
```

预期：33 个测试（29 旧 + 4 新）全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/main/ai/AiManager.ts tests/main/ai/AiManager.test.ts
git commit -m "feat: add AiManager for Claude/OpenAI/Custom streaming API calls"
```

---

## Task 4: AI IPC Handlers + Preload + api.ts + index.ts

**Files:**
- Modify: `src/main/ipc/handlers.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/types/api.ts`

- [ ] **Step 1: 更新 handlers.ts**

完整替换 `src/main/ipc/handlers.ts`：

```typescript
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
```

- [ ] **Step 2: 更新 src/main/index.ts**

完整替换 `src/main/index.ts`：

```typescript
// src/main/index.ts
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { PtyManager } from './pty/PtyManager'
import { ConfigManager } from './config/ConfigManager'
import { AiKeyStore } from './ai/AiKeyStore'
import { AiManager } from './ai/AiManager'
import { registerHandlers } from './ipc/handlers'

const ptyManager = new PtyManager()
const configManager = new ConfigManager(app.getPath('userData'))

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
  registerHandlers(ptyManager, configManager, aiKeyStore, aiManager)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  ptyManager.destroyAll()
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 3: 更新 src/renderer/src/types/api.ts**

完整替换 `src/renderer/src/types/api.ts`：

```typescript
// src/renderer/src/types/api.ts
import type { AppConfig, AiAgentConfig } from '../../../shared/types'

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
  loadConfig: () => Promise<AppConfig>
  saveConfig: (config: AppConfig) => Promise<void>

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
}
```

- [ ] **Step 4: 更新 src/preload/index.ts**

完整替换 `src/preload/index.ts`：

```typescript
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
```

- [ ] **Step 5: 运行测试确认无回归，再构建验证**

```bash
npm test
```

预期：33 个测试全部通过（无新增测试，只改了 IPC 层）。

```bash
npm run build
```

预期：main / preload / renderer 三端全部构建成功，无 TypeScript 错误。

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/handlers.ts src/main/index.ts src/preload/index.ts src/renderer/src/types/api.ts
git commit -m "feat: add AI IPC handlers, preload channels and API type declarations"
```

---

## Task 5: useAiStore（TDD）

**Files:**
- Create: `src/renderer/src/store/useAiStore.ts`
- Create: `tests/renderer/store/useAiStore.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/renderer/store/useAiStore.test.ts`：

```typescript
// tests/renderer/store/useAiStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useAiStore } from '../../../src/renderer/src/store/useAiStore'
import type { AiMessage } from '../../../src/shared/types'

const msg = (role: AiMessage['role'], content: string): AiMessage => ({
  role,
  content,
  timestamp: 1000
})

describe('useAiStore', () => {
  beforeEach(() => {
    useAiStore.setState({ histories: {}, agentIds: {} })
  })

  it('initial state has empty histories and agentIds', () => {
    const { histories, agentIds } = useAiStore.getState()
    expect(histories).toEqual({})
    expect(agentIds).toEqual({})
  })

  it('addMessage adds to session history', () => {
    useAiStore.getState().addMessage('s1', msg('user', 'hello'))
    expect(useAiStore.getState().histories['s1']).toHaveLength(1)
    expect(useAiStore.getState().histories['s1'][0].content).toBe('hello')
  })

  it('appendToLast appends delta to last message content', () => {
    useAiStore.getState().addMessage('s1', msg('assistant', ''))
    useAiStore.getState().appendToLast('s1', 'Hello')
    useAiStore.getState().appendToLast('s1', ' world')
    expect(useAiStore.getState().histories['s1'][0].content).toBe('Hello world')
  })

  it('appendToLast does nothing when session has no messages', () => {
    useAiStore.getState().appendToLast('empty', 'data')
    expect(useAiStore.getState().histories['empty']).toBeUndefined()
  })

  it('clearHistory removes all messages for session', () => {
    useAiStore.getState().addMessage('s1', msg('user', 'hello'))
    useAiStore.getState().clearHistory('s1')
    expect(useAiStore.getState().histories['s1']).toHaveLength(0)
  })

  it('setAgentId sets selected agent for session', () => {
    useAiStore.getState().setAgentId('s1', 'agent-abc')
    expect(useAiStore.getState().agentIds['s1']).toBe('agent-abc')
  })

  it('multiple sessions maintain independent histories', () => {
    useAiStore.getState().addMessage('s1', msg('user', 'session-one'))
    useAiStore.getState().addMessage('s2', msg('user', 'session-two'))
    expect(useAiStore.getState().histories['s1'][0].content).toBe('session-one')
    expect(useAiStore.getState().histories['s2'][0].content).toBe('session-two')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npm test
```

预期：FAIL — `Cannot find module '../../../src/renderer/src/store/useAiStore'`

- [ ] **Step 3: 实现 useAiStore**

创建 `src/renderer/src/store/useAiStore.ts`：

```typescript
// src/renderer/src/store/useAiStore.ts
import { create } from 'zustand'
import type { AiMessage } from '../../../shared/types'

interface AiStore {
  histories: Record<string, AiMessage[]>
  agentIds: Record<string, string | null>
  addMessage: (sessionId: string, message: AiMessage) => void
  appendToLast: (sessionId: string, delta: string) => void
  clearHistory: (sessionId: string) => void
  setAgentId: (sessionId: string, agentId: string | null) => void
}

export const useAiStore = create<AiStore>((set, get) => ({
  histories: {},
  agentIds: {},

  addMessage: (sessionId, message) => {
    set((state) => ({
      histories: {
        ...state.histories,
        [sessionId]: [...(state.histories[sessionId] ?? []), message]
      }
    }))
  },

  appendToLast: (sessionId, delta) => {
    const messages = get().histories[sessionId]
    if (!messages || messages.length === 0) return
    set((state) => {
      const msgs = state.histories[sessionId]
      const updated = [...msgs.slice(0, -1), { ...msgs[msgs.length - 1], content: msgs[msgs.length - 1].content + delta }]
      return { histories: { ...state.histories, [sessionId]: updated } }
    })
  },

  clearHistory: (sessionId) => {
    set((state) => ({
      histories: { ...state.histories, [sessionId]: [] }
    }))
  },

  setAgentId: (sessionId, agentId) => {
    set((state) => ({
      agentIds: { ...state.agentIds, [sessionId]: agentId }
    }))
  }
}))
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npm test
```

预期：40 个测试（33 旧 + 7 新）全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/store/useAiStore.ts tests/renderer/store/useAiStore.test.ts
git commit -m "feat: add useAiStore for per-session AI conversation history"
```

---

## Task 6: useTerminalOutputStore（TDD）+ TerminalPane 接入

**Files:**
- Create: `src/renderer/src/store/useTerminalOutputStore.ts`
- Create: `tests/renderer/store/useTerminalOutputStore.test.ts`
- Modify: `src/renderer/src/components/Terminal/TerminalPane.tsx`

- [ ] **Step 1: 写失败测试**

创建 `tests/renderer/store/useTerminalOutputStore.test.ts`：

```typescript
// tests/renderer/store/useTerminalOutputStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useTerminalOutputStore } from '../../../src/renderer/src/store/useTerminalOutputStore'

describe('useTerminalOutputStore', () => {
  beforeEach(() => {
    useTerminalOutputStore.setState({ buffers: {} })
  })

  it('appendData accumulates data for session', () => {
    useTerminalOutputStore.getState().appendData('s1', 'hello\n')
    useTerminalOutputStore.getState().appendData('s1', 'world\n')
    const output = useTerminalOutputStore.getState().getOutput('s1')
    expect(output).toContain('hello')
    expect(output).toContain('world')
  })

  it('getOutput strips ANSI escape codes', () => {
    useTerminalOutputStore.getState().appendData('s1', '\x1b[32mGreen\x1b[0m text')
    expect(useTerminalOutputStore.getState().getOutput('s1')).toBe('Green text')
  })

  it('trims buffer to 5000 chars when it exceeds limit', () => {
    useTerminalOutputStore.getState().appendData('s1', 'x'.repeat(6000))
    expect(useTerminalOutputStore.getState().buffers['s1'].length).toBe(5000)
  })

  it('returns empty string for unknown session', () => {
    expect(useTerminalOutputStore.getState().getOutput('unknown')).toBe('')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npm test
```

预期：FAIL — `Cannot find module '../../../src/renderer/src/store/useTerminalOutputStore'`

- [ ] **Step 3: 实现 useTerminalOutputStore**

创建 `src/renderer/src/store/useTerminalOutputStore.ts`：

```typescript
// src/renderer/src/store/useTerminalOutputStore.ts
import { create } from 'zustand'

const ANSI_REGEX = /\x1b\[[0-9;]*[mGKHFABCDJsu]/g
const MAX_BUFFER = 5000

interface TerminalOutputStore {
  buffers: Record<string, string>
  appendData: (sessionId: string, data: string) => void
  getOutput: (sessionId: string) => string
}

export const useTerminalOutputStore = create<TerminalOutputStore>((set, get) => ({
  buffers: {},

  appendData: (sessionId, data) => {
    set((state) => {
      const current = state.buffers[sessionId] ?? ''
      const combined = current + data
      const trimmed = combined.length > MAX_BUFFER ? combined.slice(combined.length - MAX_BUFFER) : combined
      return { buffers: { ...state.buffers, [sessionId]: trimmed } }
    })
  },

  getOutput: (sessionId) => {
    const raw = get().buffers[sessionId] ?? ''
    return raw.replace(ANSI_REGEX, '')
  }
}))
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npm test
```

预期：44 个测试（40 旧 + 4 新）全部通过。

- [ ] **Step 5: 修改 TerminalPane.tsx，接入 useTerminalOutputStore**

修改 `src/renderer/src/components/Terminal/TerminalPane.tsx`，在 `onData` 回调中同步写入输出 store：

```typescript
// src/renderer/src/components/Terminal/TerminalPane.tsx
import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { useSessionStore } from '../../store/useSessionStore'
import { useTerminalOutputStore } from '../../store/useTerminalOutputStore'
import 'xterm/css/xterm.css'

interface TerminalPaneProps {
  sessionId: string
  isActive: boolean
}

export function TerminalPane({ sessionId, isActive }: TerminalPaneProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const cleanupRef = useRef<(() => void)[]>([])
  const markDisconnected = useSessionStore((s) => s.markDisconnected)

  const fit = useCallback(() => {
    if (!fitAddonRef.current || !termRef.current) return
    fitAddonRef.current.fit()
    const { cols, rows } = termRef.current
    window.api.resize(sessionId, cols, rows)
  }, [sessionId])

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0d1117',
        foreground: '#cdd9e5',
        cursor: '#cdd9e5',
        selectionBackground: '#264f78'
      }
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitAddonRef.current = fitAddon

    const disposeInput = term.onData((data) => window.api.write(sessionId, data))
    const removeData = window.api.onData(sessionId, (data) => {
      term.write(data)
      useTerminalOutputStore.getState().appendData(sessionId, data)
    })
    const removeExit = window.api.onExit(sessionId, () => {
      term.write('\r\n\x1b[33m[进程已退出]\x1b[0m\r\n')
      markDisconnected(sessionId)
    })

    cleanupRef.current = [
      () => disposeInput.dispose(),
      removeData,
      removeExit,
      () => term.dispose()
    ]

    const resizeObserver = new ResizeObserver(() => fitAddon.fit())
    resizeObserver.observe(containerRef.current)
    cleanupRef.current.push(() => resizeObserver.disconnect())

    return () => {
      cleanupRef.current.forEach((fn) => fn())
      cleanupRef.current = []
    }
  }, [sessionId])

  useEffect(() => {
    if (isActive) {
      fit()
      termRef.current?.focus()
    }
  }, [isActive, fit])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        padding: '4px',
        backgroundColor: '#0d1117'
      }}
    />
  )
}
```

- [ ] **Step 6: 运行测试，确认无回归**

```bash
npm test
```

预期：44 个测试全部通过。

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/store/useTerminalOutputStore.ts tests/renderer/store/useTerminalOutputStore.test.ts src/renderer/src/components/Terminal/TerminalPane.tsx
git commit -m "feat: add useTerminalOutputStore and feed terminal output from TerminalPane"
```

---

## Task 7: AiAgentForm + AiPanel 组件

**Files:**
- Create: `src/renderer/src/components/AiPanel/AiAgentForm.tsx`
- Create: `src/renderer/src/components/AiPanel/AiPanel.tsx`

- [ ] **Step 1: 实现 AiAgentForm**

创建 `src/renderer/src/components/AiPanel/AiAgentForm.tsx`：

```tsx
// src/renderer/src/components/AiPanel/AiAgentForm.tsx
import { useState } from 'react'
import { useConfigStore } from '../../store/useConfigStore'

interface AiAgentFormProps {
  onSaved: () => void
  onCancel?: () => void
}

const INPUT_STYLE: React.CSSProperties = {
  backgroundColor: '#0d1117',
  border: '1px solid #30363d',
  borderRadius: '3px',
  color: '#cdd9e5',
  fontSize: '11px',
  padding: '4px 8px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box'
}

const LABEL_STYLE: React.CSSProperties = {
  color: '#8892a4',
  fontSize: '10px',
  marginBottom: '2px',
  display: 'block'
}

export function AiAgentForm({ onSaved, onCancel }: AiAgentFormProps): JSX.Element {
  const [name, setName] = useState('')
  const [provider, setProvider] = useState<'claude' | 'openai' | 'custom'>('claude')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [baseUrl, setBaseUrl] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const defaultModel = {
    claude: 'claude-sonnet-4-6',
    openai: 'gpt-4o',
    custom: ''
  }

  const handleProviderChange = (p: typeof provider): void => {
    setProvider(p)
    setModel(defaultModel[p])
  }

  const handleSave = async (): Promise<void> => {
    if (!name.trim() || !apiKey.trim() || !model.trim()) {
      setError('名称、API Key 和模型均为必填项')
      return
    }
    setSaving(true)
    setError('')
    try {
      await window.api.saveAiAgent({
        name: name.trim(),
        provider,
        apiKey: apiKey.trim(),
        model: model.trim(),
        baseUrl: baseUrl.trim() || undefined,
        systemPrompt: systemPrompt.trim() || undefined
      })
      await useConfigStore.getState().load()
      onSaved()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px' }}>
      <div style={{ color: '#cdd9e5', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
        添加 AI Agent
      </div>

      <div>
        <label style={LABEL_STYLE}>名称</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="如：My Claude"
          style={INPUT_STYLE}
        />
      </div>

      <div>
        <label style={LABEL_STYLE}>提供商</label>
        <select
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value as typeof provider)}
          style={{ ...INPUT_STYLE }}
        >
          <option value="claude">Claude (Anthropic)</option>
          <option value="openai">OpenAI</option>
          <option value="custom">自定义（OpenAI 兼容）</option>
        </select>
      </div>

      <div>
        <label style={LABEL_STYLE}>API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          style={INPUT_STYLE}
        />
      </div>

      <div>
        <label style={LABEL_STYLE}>模型</label>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="claude-sonnet-4-6"
          style={INPUT_STYLE}
        />
      </div>

      {provider === 'custom' && (
        <div>
          <label style={LABEL_STYLE}>API 端点（Base URL）</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:11434/v1"
            style={INPUT_STYLE}
          />
        </div>
      )}

      <div>
        <label style={LABEL_STYLE}>系统提示（可选）</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="你是一个终端助手..."
          rows={2}
          style={{ ...INPUT_STYLE, resize: 'none' }}
        />
      </div>

      {error && (
        <div style={{ color: '#f85149', fontSize: '11px' }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 1,
            backgroundColor: '#0f3460',
            border: 'none',
            borderRadius: '3px',
            color: '#64ffda',
            fontSize: '11px',
            padding: '5px',
            cursor: saving ? 'wait' : 'pointer'
          }}
        >
          {saving ? '保存中...' : '保存'}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #30363d',
              borderRadius: '3px',
              color: '#8892a4',
              fontSize: '11px',
              padding: '5px 10px',
              cursor: 'pointer'
            }}
          >
            取消
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 实现 AiPanel**

创建 `src/renderer/src/components/AiPanel/AiPanel.tsx`：

```tsx
// src/renderer/src/components/AiPanel/AiPanel.tsx
import { useState, useRef, useEffect } from 'react'
import { useConfigStore } from '../../store/useConfigStore'
import { useAiStore } from '../../store/useAiStore'
import { useTerminalOutputStore } from '../../store/useTerminalOutputStore'
import { useSplitStore } from '../../store/useSplitStore'
import { AiAgentForm } from './AiAgentForm'
import type { AiMessage } from '../../../../shared/types'

interface ContentPart {
  type: 'text' | 'code'
  value: string
  lang?: string
}

function parseContent(content: string): ContentPart[] {
  const parts: ContentPart[] = []
  const regex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'code', value: match[2].trim(), lang: match[1] || undefined })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) })
  }
  return parts
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function AiPanel(): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [input, setInput] = useState('')
  const [includeContext, setIncludeContext] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const requestIdRef = useRef<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const agents = useConfigStore((s) => s.config.aiAgents)
  const { histories, agentIds, addMessage, appendToLast, setAgentId } = useAiStore()
  const getOutput = useTerminalOutputStore((s) => s.getOutput)
  const getActivePaneSessionId = useSplitStore((s) => s.getActivePaneSessionId)

  const sessionId = getActivePaneSessionId()
  const messages: AiMessage[] = sessionId ? (histories[sessionId] ?? []) : []
  const agentId: string | null = sessionId ? (agentIds[sessionId] ?? null) : null
  const selectedAgent = agents.find((a) => a.id === agentId) ?? null

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (): Promise<void> => {
    if (!agentId || !input.trim() || isStreaming || !sessionId) return

    const userMsg: AiMessage = { role: 'user', content: input.trim(), timestamp: Date.now() }
    const assistantMsg: AiMessage = { role: 'assistant', content: '', timestamp: Date.now() }
    addMessage(sessionId, userMsg)
    addMessage(sessionId, assistantMsg)
    setInput('')
    setIsStreaming(true)

    const requestId = genId()
    requestIdRef.current = requestId

    const chatMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content
    }))

    const termCtx = includeContext ? getOutput(sessionId) : undefined

    const removeChunk = window.api.onAiChunk(requestId, (delta) => {
      appendToLast(sessionId, delta)
    })
    const removeEnd = window.api.onAiEnd(requestId, () => {
      setIsStreaming(false)
      requestIdRef.current = null
      removeChunk()
      removeEnd()
      removeError()
    })
    const removeError = window.api.onAiError(requestId, (error) => {
      appendToLast(sessionId, `\n\n[错误: ${error}]`)
      setIsStreaming(false)
      requestIdRef.current = null
      removeChunk()
      removeEnd()
      removeError()
    })

    window.api.sendAiMessage(requestId, agentId, chatMessages, termCtx)
  }

  const handleStop = (): void => {
    if (requestIdRef.current) {
      window.api.abortAiMessage(requestIdRef.current)
      setIsStreaming(false)
      requestIdRef.current = null
    }
  }

  const handleSendCode = (code: string): void => {
    if (sessionId) window.api.write(sessionId, code + '\r')
  }

  const headerLabel = selectedAgent
    ? `AI · ${selectedAgent.name} [${selectedAgent.model}]`
    : 'AI 面板'

  return (
    <div style={{
      flexShrink: 0,
      borderTop: '1px solid #21262d',
      backgroundColor: '#0d1117',
      display: 'flex',
      flexDirection: 'column',
      height: expanded ? '240px' : '28px',
      overflow: 'hidden',
      transition: 'height 0.15s ease'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: '28px',
        padding: '0 8px',
        backgroundColor: '#161b22',
        borderBottom: expanded ? '1px solid #21262d' : 'none',
        flexShrink: 0,
        gap: '8px',
        userSelect: 'none'
      }}>
        <span
          onClick={() => setExpanded(!expanded)}
          style={{ fontSize: '11px', color: '#768390', cursor: 'pointer', flex: 1 }}
        >
          {expanded ? '▼' : '▶'} {headerLabel}
        </span>

        {expanded && agents.length > 0 && (
          <select
            value={agentId ?? ''}
            onChange={(e) => sessionId && setAgentId(sessionId, e.target.value || null)}
            style={{
              backgroundColor: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: '3px',
              color: '#cdd9e5',
              fontSize: '10px',
              padding: '1px 4px',
              cursor: 'pointer'
            }}
          >
            <option value="">选择 Agent</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}

        {expanded && (
          <button
            onClick={() => setShowForm(!showForm)}
            title="添加 Agent"
            style={{
              background: 'none', border: 'none', color: '#768390',
              cursor: 'pointer', fontSize: '13px', lineHeight: 1
            }}
          >
            {showForm ? '×' : '+'}
          </button>
        )}
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {showForm ? (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <AiAgentForm
                onSaved={() => setShowForm(false)}
                onCancel={() => setShowForm(false)}
              />
            </div>
          ) : (
            <>
              {/* Message history */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {messages.length === 0 && !agentId && agents.length === 0 && (
                  <div style={{ color: '#484f58', fontSize: '12px', textAlign: 'center', paddingTop: '16px' }}>
                    点击右上角 + 添加 AI Agent
                  </div>
                )}
                {messages.length === 0 && agents.length > 0 && !agentId && (
                  <div style={{ color: '#484f58', fontSize: '12px', textAlign: 'center', paddingTop: '16px' }}>
                    从上方选择 Agent 后开始对话
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} style={{ marginBottom: '8px' }}>
                    <div style={{
                      fontSize: '10px',
                      color: msg.role === 'user' ? '#64ffda' : '#e94560',
                      marginBottom: '2px',
                      fontWeight: 'bold'
                    }}>
                      {msg.role === 'user' ? 'You' : (selectedAgent?.name ?? 'AI')}
                    </div>
                    {msg.role === 'user' ? (
                      <div style={{ fontSize: '12px', color: '#cdd9e5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {msg.content}
                      </div>
                    ) : (
                      <div>
                        {parseContent(msg.content).map((part, j) =>
                          part.type === 'text' ? (
                            <span key={j} style={{ fontSize: '12px', color: '#cdd9e5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {part.value}
                            </span>
                          ) : (
                            <div key={j} style={{ margin: '4px 0', backgroundColor: '#161b22', borderRadius: '4px', border: '1px solid #30363d', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 8px', backgroundColor: '#21262d' }}>
                                <span style={{ fontSize: '10px', color: '#768390' }}>{part.lang || 'code'}</span>
                                <button
                                  onClick={() => handleSendCode(part.value)}
                                  style={{
                                    background: 'none', border: 'none', color: '#64ffda',
                                    fontSize: '10px', cursor: 'pointer', padding: '1px 4px'
                                  }}
                                  title="发送到终端"
                                >
                                  ▶ 发送到终端
                                </button>
                              </div>
                              <pre style={{ margin: 0, padding: '6px 8px', fontSize: '11px', color: '#cdd9e5', overflowX: 'auto', fontFamily: 'Menlo, Monaco, monospace' }}>
                                {part.value}
                              </pre>
                            </div>
                          )
                        )}
                        {i === messages.length - 1 && isStreaming && (
                          <span style={{ color: '#64ffda', fontSize: '12px' }}>▍</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div style={{
                padding: '6px 8px',
                borderTop: '1px solid #21262d',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#768390', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeContext}
                      onChange={(e) => setIncludeContext(e.target.checked)}
                      style={{ accentColor: '#64ffda' }}
                    />
                    引用终端输出
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder={agentId ? '输入消息，Enter 发送...' : '请先选择 Agent'}
                    disabled={!agentId || isStreaming}
                    style={{
                      flex: 1,
                      backgroundColor: '#0d1117',
                      border: '1px solid #30363d',
                      borderRadius: '3px',
                      color: '#cdd9e5',
                      fontSize: '12px',
                      padding: '4px 8px',
                      outline: 'none'
                    }}
                  />
                  {isStreaming ? (
                    <button
                      onClick={handleStop}
                      style={{
                        backgroundColor: '#3d1f1f',
                        border: 'none',
                        borderRadius: '3px',
                        color: '#f85149',
                        fontSize: '11px',
                        padding: '4px 10px',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      停止
                    </button>
                  ) : (
                    <button
                      onClick={handleSend}
                      disabled={!agentId || !input.trim()}
                      style={{
                        backgroundColor: agentId && input.trim() ? '#0f3460' : '#21262d',
                        border: 'none',
                        borderRadius: '3px',
                        color: agentId && input.trim() ? '#64ffda' : '#484f58',
                        fontSize: '11px',
                        padding: '4px 10px',
                        cursor: agentId && input.trim() ? 'pointer' : 'default',
                        flexShrink: 0
                      }}
                    >
                      发送
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 运行测试确认无回归**

```bash
npm test
```

预期：44 个测试全部通过。

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/AiPanel/AiAgentForm.tsx src/renderer/src/components/AiPanel/AiPanel.tsx
git commit -m "feat: add AiPanel and AiAgentForm components"
```

---

## Task 8: App.tsx 集成

**Files:**
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: 更新 App.tsx，添加 AiPanel**

完整替换 `src/renderer/src/App.tsx`：

```tsx
// src/renderer/src/App.tsx
import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar/Sidebar'
import { SplitPane } from './components/Terminal/SplitPane'
import { CommandPalette } from './components/CommandPalette/CommandPalette'
import { AiPanel } from './components/AiPanel/AiPanel'
import { useConfigStore } from './store/useConfigStore'
import { useSplitStore } from './store/useSplitStore'

export default function App(): JSX.Element {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const loadConfig = useConfigStore((s) => s.load)
  const panes = useSplitStore((s) => s.panes)

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const showEmptyState = panes.every((p) => !p.sessionId) && panes.length === 1

  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      backgroundColor: '#0d1117',
      overflow: 'hidden'
    }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {showEmptyState ? (
          <div style={{
            flex: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#768390', fontSize: '14px',
            flexDirection: 'column', gap: '8px'
          }}>
            <span>点击"＋ 新建终端"开始</span>
            <span style={{ fontSize: '12px', color: '#484f58' }}>Cmd+K 打开命令面板</span>
          </div>
        ) : (
          <SplitPane />
        )}
        <AiPanel />
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
```

- [ ] **Step 2: 运行测试**

```bash
npm test
```

预期：44 个测试全部通过。

- [ ] **Step 3: 构建验证**

```bash
npm run build
```

预期：三端构建成功，无 TypeScript 错误。

- [ ] **Step 4: 手动验证（npm run dev）**

验证清单：
- [ ] 点击 AI 面板标题栏 "▶ AI 面板" → 面板展开（240px 高）
- [ ] 展开后点击 "+" → 出现 Agent 添加表单
- [ ] 填写名称、选择 Claude、填 API Key、填模型 → 点击保存 → 表单关闭，下拉框出现该 Agent
- [ ] 从下拉框选择 Agent → 输入框激活
- [ ] 输入消息 → Enter 发送 → 出现 You 消息 + AI 流式回复
- [ ] AI 回复包含代码块时显示 "▶ 发送到终端" 按钮，点击后命令出现在终端
- [ ] 勾选 "引用终端输出" → 发送时包含终端上下文
- [ ] 流式输出时点击 "停止" → 停止流式输出
- [ ] Cmd+K 命令面板仍然正常工作
- [ ] 多终端分屏时，切换激活窗格后 AI 面板消息历史随之切换

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat: integrate AiPanel into App layout"
```

---

## 完成检查

Plan 3 交付后，应用具备：

- [x] AI Agent 配置：支持 Claude / OpenAI / 自定义 API，API Key 通过 safeStorage 加密存储
- [x] AI 面板：可折叠，显示在分屏区域下方，宽度占满
- [x] 流式对话：逐字渲染，支持中途停止
- [x] 代码块识别：AI 返回的代码块显示"发送到终端"按钮，需手动确认
- [x] 独立对话历史：每个终端会话各自的历史，切换分屏时自动切换
- [x] 引用终端输出：可选将最近终端输出附加到 AI 请求
- [x] 44 个单元测试全部通过

**下一步：** Plan 4 — 网络代理管理（Per-session proxy injection via pty env vars）
