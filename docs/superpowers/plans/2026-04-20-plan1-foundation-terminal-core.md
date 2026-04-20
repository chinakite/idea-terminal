# Plan 1: Foundation & Terminal Core

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 Electron + React 项目基础，实现可打开多个终端会话、输入命令、查看输出的基础应用。

**Architecture:** Electron Main Process 通过 node-pty 管理终端进程，Renderer Process 使用 React + xterm.js 渲染终端 UI，两侧通过 contextBridge 暴露的 IPC API 通信。配置持久化到用户 userData 目录下的 JSON 文件。

**Tech Stack:** Electron 28+, React 18, TypeScript 5, xterm.js 5, node-pty, Zustand, Vite (electron-vite), Vitest

---

## 文件结构

```
idea-terminal/
├── package.json
├── electron.vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── src/
│   ├── main/
│   │   ├── index.ts                    # Main Process 入口，创建 BrowserWindow
│   │   ├── pty/
│   │   │   └── PtyManager.ts           # node-pty 封装，管理所有 pty 进程
│   │   ├── config/
│   │   │   └── ConfigManager.ts        # JSON 配置读写，持久化到 userData
│   │   └── ipc/
│   │       └── handlers.ts             # 注册所有 IPC handler
│   ├── preload/
│   │   └── index.ts                    # contextBridge：暴露安全的 window.api
│   ├── renderer/
│   │   ├── index.html
│   │   ├── src/
│   │   │   ├── main.tsx                # React 入口
│   │   │   ├── App.tsx                 # 根组件，左右布局
│   │   │   ├── components/
│   │   │   │   ├── Sidebar/
│   │   │   │   │   └── Sidebar.tsx     # 左侧面板：操作区 + 会话列表
│   │   │   │   └── Terminal/
│   │   │   │       ├── TerminalPane.tsx  # 单个 xterm.js 终端实例
│   │   │   │       └── TerminalTabs.tsx  # 顶部标签栏
│   │   │   ├── store/
│   │   │   │   └── useSessionStore.ts  # Zustand store：运行时会话状态
│   │   │   └── types/
│   │   │       └── api.ts              # window.api 类型声明
│   └── shared/
│       └── types.ts                    # Main/Renderer 共享的 TypeScript 类型
├── tests/
│   ├── main/
│   │   ├── pty/
│   │   │   └── PtyManager.test.ts
│   │   └── config/
│   │       └── ConfigManager.test.ts
│   └── vitest.config.ts
```

---

## Task 1: 项目初始化

**Files:**
- Create: `package.json`
- Create: `electron.vite.config.ts`
- Create: `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`

- [ ] **Step 1: 初始化项目**

```bash
mkdir idea-terminal && cd idea-terminal
npm create @quick-start/electron@latest . -- --template react-ts
```

若 `@quick-start/electron` 不可用，手动初始化：

```bash
npm init -y
npm install --save-dev electron@28 electron-vite vite @vitejs/plugin-react
npm install --save-dev typescript @types/node @types/react @types/react-dom
npm install react react-dom
```

- [ ] **Step 2: 安装核心依赖**

```bash
npm install xterm@5 xterm-addon-fit xterm-addon-web-links
npm install node-pty
npm install zustand
npm install --save-dev vitest @vitest/coverage-v8
```

- [ ] **Step 3: 配置 electron.vite.config.ts**

```typescript
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
```

- [ ] **Step 4: 配置 package.json scripts**

在 `package.json` 中确保以下 scripts 存在：

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test": "vitest run --config tests/vitest.config.ts",
    "test:watch": "vitest --config tests/vitest.config.ts"
  },
  "main": "out/main/index.js"
}
```

- [ ] **Step 5: 配置 tests/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/main/**/*.ts']
    }
  }
})
```

- [ ] **Step 6: 验证项目能启动**

```bash
npm run dev
```

预期：Electron 窗口打开，显示默认的 React 页面。

- [ ] **Step 7: Commit**

```bash
git init
echo "node_modules\nout\ndist\n.superpowers" > .gitignore
git add .
git commit -m "chore: initialize electron-vite react-ts project"
```

---

## Task 2: 共享类型定义

**Files:**
- Create: `src/shared/types.ts`

- [ ] **Step 1: 创建共享类型文件**

```typescript
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
  provider: 'claude' | 'openai' | 'custom'
  apiKey: string
  model: string
  baseUrl?: string
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
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: ConfigManager（TDD）

**Files:**
- Create: `src/main/config/ConfigManager.ts`
- Create: `tests/main/config/ConfigManager.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/main/config/ConfigManager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { ConfigManager } from '../../../src/main/config/ConfigManager'
import { DEFAULT_CONFIG } from '../../../src/shared/types'

describe('ConfigManager', () => {
  let tmpDir: string
  let manager: ConfigManager

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'idea-terminal-test-'))
    manager = new ConfigManager(tmpDir)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true })
  })

  it('returns default config when no file exists', () => {
    const config = manager.load()
    expect(config).toEqual(DEFAULT_CONFIG)
  })

  it('saves and loads config', () => {
    const config = manager.load()
    config.theme = 'light'
    manager.save(config)

    const loaded = manager.load()
    expect(loaded.theme).toBe('light')
  })

  it('adds a group and persists it', () => {
    const config = manager.load()
    const now = Date.now()
    config.groups.push({
      id: 'g1',
      name: 'Project A',
      createdAt: now,
      updatedAt: now,
      sessions: []
    })
    manager.save(config)

    const loaded = manager.load()
    expect(loaded.groups).toHaveLength(1)
    expect(loaded.groups[0].name).toBe('Project A')
  })

  it('returns default config on corrupted file', () => {
    const { writeFileSync } = require('fs')
    writeFileSync(join(tmpDir, 'config.json'), 'not valid json')

    const config = manager.load()
    expect(config).toEqual(DEFAULT_CONFIG)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npm test
```

预期：FAIL — `Cannot find module '../../../src/main/config/ConfigManager'`

- [ ] **Step 3: 实现 ConfigManager**

```typescript
// src/main/config/ConfigManager.ts
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'fs'
import { join } from 'path'
import { AppConfig, DEFAULT_CONFIG } from '../../shared/types'

export class ConfigManager {
  private readonly configPath: string

  constructor(userDataPath: string) {
    this.configPath = join(userDataPath, 'config.json')
  }

  load(): AppConfig {
    if (!existsSync(this.configPath)) {
      return structuredClone(DEFAULT_CONFIG)
    }
    try {
      const raw = readFileSync(this.configPath, 'utf-8')
      return { ...structuredClone(DEFAULT_CONFIG), ...JSON.parse(raw) }
    } catch {
      const backupPath = this.configPath + '.bak'
      copyFileSync(this.configPath, backupPath)
      return structuredClone(DEFAULT_CONFIG)
    }
  }

  save(config: AppConfig): void {
    writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
  }
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npm test
```

预期：PASS，4 个测试全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/main/config/ConfigManager.ts tests/main/config/ConfigManager.test.ts
git commit -m "feat: add ConfigManager with JSON persistence"
```

---

## Task 4: PtyManager（TDD）

**Files:**
- Create: `src/main/pty/PtyManager.ts`
- Create: `tests/main/pty/PtyManager.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/main/pty/PtyManager.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { PtyManager } from '../../../src/main/pty/PtyManager'

describe('PtyManager', () => {
  const manager = new PtyManager()

  afterEach(() => {
    manager.destroyAll()
  })

  it('creates a session and returns pid', () => {
    const session = manager.create({ id: 's1', cwd: process.cwd() })
    expect(session.pid).toBeGreaterThan(0)
  })

  it('lists active sessions', () => {
    manager.create({ id: 's1', cwd: process.cwd() })
    manager.create({ id: 's2', cwd: process.cwd() })
    expect(manager.list()).toHaveLength(2)
  })

  it('destroys a session by id', () => {
    manager.create({ id: 's1', cwd: process.cwd() })
    manager.destroy('s1')
    expect(manager.list()).toHaveLength(0)
  })

  it('get returns undefined for unknown id', () => {
    expect(manager.get('unknown')).toBeUndefined()
  })

  it('write does not throw for valid session', () => {
    manager.create({ id: 's1', cwd: process.cwd() })
    expect(() => manager.write('s1', 'echo hello\r')).not.toThrow()
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npm test
```

预期：FAIL — `Cannot find module '../../../src/main/pty/PtyManager'`

- [ ] **Step 3: 实现 PtyManager**

```typescript
// src/main/pty/PtyManager.ts
import * as pty from 'node-pty'
import { platform } from 'os'

interface PtySession {
  id: string
  pid: number
  process: pty.IPty
}

interface CreateOptions {
  id: string
  cwd: string
  env?: Record<string, string>
  cols?: number
  rows?: number
}

export class PtyManager {
  private sessions = new Map<string, PtySession>()

  create(options: CreateOptions): { pid: number } {
    const shell = platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL ?? '/bin/zsh')
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: options.cols ?? 80,
      rows: options.rows ?? 24,
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) } as Record<string, string>
    })
    this.sessions.set(options.id, { id: options.id, pid: ptyProcess.pid, process: ptyProcess })
    return { pid: ptyProcess.pid }
  }

  get(id: string): PtySession | undefined {
    return this.sessions.get(id)
  }

  list(): PtySession[] {
    return Array.from(this.sessions.values())
  }

  write(id: string, data: string): void {
    this.sessions.get(id)?.process.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    this.sessions.get(id)?.process.resize(cols, rows)
  }

  destroy(id: string): void {
    const session = this.sessions.get(id)
    if (session) {
      session.process.kill()
      this.sessions.delete(id)
    }
  }

  destroyAll(): void {
    for (const id of this.sessions.keys()) {
      this.destroy(id)
    }
  }

  onData(id: string, callback: (data: string) => void): void {
    this.sessions.get(id)?.process.onData(callback)
  }

  onExit(id: string, callback: (code: number) => void): void {
    this.sessions.get(id)?.process.onExit(({ exitCode }) => callback(exitCode))
  }
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npm test
```

预期：PASS，5 个测试全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/main/pty/PtyManager.ts tests/main/pty/PtyManager.test.ts
git commit -m "feat: add PtyManager for terminal process lifecycle"
```

---

## Task 5: IPC Layer（Preload + Handlers）

**Files:**
- Create: `src/preload/index.ts`
- Create: `src/main/ipc/handlers.ts`
- Create: `src/renderer/src/types/api.ts`

- [ ] **Step 1: 定义 Renderer 端 API 类型**

```typescript
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
```

- [ ] **Step 2: 实现 Preload contextBridge**

```typescript
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
```

- [ ] **Step 3: 实现 IPC Handlers**

```typescript
// src/main/ipc/handlers.ts
import { ipcMain, BrowserWindow } from 'electron'
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

  ipcMain.handle('system:homedir', () => require('os').homedir())

  ipcMain.handle('config:load', () => configManager.load())

  ipcMain.handle('config:save', (_event, config) => configManager.save(config))
}
```

- [ ] **Step 4: Commit**

```bash
git add src/preload/index.ts src/main/ipc/handlers.ts src/renderer/src/types/api.ts
git commit -m "feat: add IPC layer with contextBridge"
```

---

## Task 6: Main Process 入口

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: 实现 Main Process 入口**

```typescript
// src/main/index.ts
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { PtyManager } from './pty/PtyManager'
import { ConfigManager } from './config/ConfigManager'
import { registerHandlers } from './ipc/handlers'

const ptyManager = new PtyManager()
const configManager = new ConfigManager(app.getPath('userData'))

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
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

  registerHandlers(ptyManager, configManager)
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

- [ ] **Step 2: 安装缺失依赖**

```bash
npm install @electron-toolkit/utils
```

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: implement main process entry with pty and config setup"
```

---

## Task 7: Zustand Session Store

**Files:**
- Create: `src/renderer/src/store/useSessionStore.ts`

- [ ] **Step 1: 实现 session store**

```typescript
// src/renderer/src/store/useSessionStore.ts
import { create } from 'zustand'

export interface RuntimeSession {
  id: string
  title: string
  groupId: string
  pid: number
  status: 'running' | 'disconnected'
}

interface SessionStore {
  sessions: RuntimeSession[]
  activeSessionId: string | null
  addSession: (session: RuntimeSession) => void
  removeSession: (id: string) => void
  setActive: (id: string) => void
  markDisconnected: (id: string) => void
}

export const useSessionStore = create<SessionStore>((set) => ({
  sessions: [],
  activeSessionId: null,

  addSession: (session) =>
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: state.activeSessionId ?? session.id
    })),

  removeSession: (id) =>
    set((state) => {
      const remaining = state.sessions.filter((s) => s.id !== id)
      return {
        sessions: remaining,
        activeSessionId:
          state.activeSessionId === id ? (remaining[0]?.id ?? null) : state.activeSessionId
      }
    }),

  setActive: (id) => set({ activeSessionId: id }),

  markDisconnected: (id) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, status: 'disconnected' } : s))
    }))
}))
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/store/useSessionStore.ts
git commit -m "feat: add Zustand session store"
```

---

## Task 8: TerminalPane 组件（xterm.js）

**Files:**
- Create: `src/renderer/src/components/Terminal/TerminalPane.tsx`

- [ ] **Step 1: 实现 TerminalPane**

```tsx
// src/renderer/src/components/Terminal/TerminalPane.tsx
import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { useSessionStore } from '../../store/useSessionStore'
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

    // 用户输入 → Main Process
    const disposeInput = term.onData((data) => window.api.write(sessionId, data))

    // Main Process 输出 → 终端渲染
    const removeData = window.api.onData(sessionId, (data) => term.write(data))

    // 进程退出
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

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/components/Terminal/TerminalPane.tsx
git commit -m "feat: add TerminalPane with xterm.js integration"
```

---

## Task 9: TerminalTabs 组件

**Files:**
- Create: `src/renderer/src/components/Terminal/TerminalTabs.tsx`

- [ ] **Step 1: 实现 TerminalTabs**

```tsx
// src/renderer/src/components/Terminal/TerminalTabs.tsx
import { useSessionStore } from '../../store/useSessionStore'

export function TerminalTabs(): JSX.Element {
  const { sessions, activeSessionId, setActive, removeSession } = useSessionStore()

  const handleClose = (e: React.MouseEvent, id: string): void => {
    e.stopPropagation()
    window.api.destroy(id)
    removeSession(id)
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      height: '36px',
      backgroundColor: '#0d1117',
      borderBottom: '1px solid #21262d',
      overflowX: 'auto',
      flexShrink: 0
    }}>
      {sessions.map((session) => (
        <div
          key={session.id}
          onClick={() => setActive(session.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0 12px',
            height: '100%',
            cursor: 'pointer',
            borderRight: '1px solid #21262d',
            backgroundColor: session.id === activeSessionId ? '#161b22' : 'transparent',
            color: session.status === 'disconnected' ? '#768390' : '#cdd9e5',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            userSelect: 'none'
          }}
        >
          <span>{session.title}</span>
          {session.status === 'disconnected' && <span style={{ color: '#f85149' }}>●</span>}
          <span
            onClick={(e) => handleClose(e, session.id)}
            style={{
              color: '#768390',
              fontSize: '12px',
              lineHeight: 1,
              padding: '2px 4px',
              borderRadius: '3px'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f85149')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#768390')}
          >
            ×
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/components/Terminal/TerminalTabs.tsx
git commit -m "feat: add TerminalTabs component"
```

---

## Task 10: Sidebar 组件

**Files:**
- Create: `src/renderer/src/components/Sidebar/Sidebar.tsx`

- [ ] **Step 1: 实现 Sidebar**

```tsx
// src/renderer/src/components/Sidebar/Sidebar.tsx
import { useState } from 'react'
import { useSessionStore } from '../../store/useSessionStore'

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function Sidebar(): JSX.Element {
  const { sessions, activeSessionId, setActive } = useSessionStore()
  const addSession = useSessionStore((s) => s.addSession)
  const [isCreating, setIsCreating] = useState(false)

  const handleNewTerminal = async (): Promise<void> => {
    if (isCreating) return
    setIsCreating(true)
    try {
      const id = generateId()
      const homedir = await window.api.getHomedir()
      const { pid } = await window.api.create({ id, cwd: homedir })
      addSession({
        id,
        title: `终端 ${sessions.length + 1}`,
        groupId: 'default',
        pid,
        status: 'running'
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div style={{
      width: '200px',
      height: '100%',
      backgroundColor: '#16213e',
      borderRight: '1px solid #0f3460',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0
    }}>
      {/* 标题 */}
      <div style={{
        padding: '12px',
        color: '#e94560',
        fontWeight: 'bold',
        fontSize: '12px',
        letterSpacing: '1px',
        borderBottom: '1px solid #0f3460'
      }}>
        IDEA TERMINAL
      </div>

      {/* 操作区 */}
      <div style={{ padding: '8px' }}>
        <button
          onClick={handleNewTerminal}
          disabled={isCreating}
          style={{
            width: '100%',
            padding: '6px',
            backgroundColor: '#0f3460',
            color: '#a8b2d8',
            border: 'none',
            borderRadius: '4px',
            cursor: isCreating ? 'wait' : 'pointer',
            fontSize: '12px'
          }}
        >
          {isCreating ? '创建中...' : '＋ 新建终端'}
        </button>
      </div>

      {/* 会话列表 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
        <div style={{ color: '#8892a4', fontSize: '10px', letterSpacing: '1px', marginBottom: '4px' }}>
          会话
        </div>
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => setActive(session.id)}
            style={{
              padding: '5px 8px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px',
              color: session.id === activeSessionId ? '#ccd6f6' : '#8892a4',
              backgroundColor: session.id === activeSessionId ? '#0f3460' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '2px'
            }}
          >
            <span style={{ color: session.status === 'disconnected' ? '#f85149' : '#64ffda' }}>
              {session.status === 'disconnected' ? '○' : '●'}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {session.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/components/Sidebar/Sidebar.tsx
git commit -m "feat: add Sidebar with session list and new terminal button"
```

---

## Task 11: App 根组件 & 完整集成

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/main.tsx`

- [ ] **Step 1: 实现 App 根组件**

```tsx
// src/renderer/src/App.tsx
import { useSessionStore } from './store/useSessionStore'
import { Sidebar } from './components/Sidebar/Sidebar'
import { TerminalTabs } from './components/Terminal/TerminalTabs'
import { TerminalPane } from './components/Terminal/TerminalPane'

export default function App(): JSX.Element {
  const { sessions, activeSessionId } = useSessionStore()

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
        <TerminalTabs />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {sessions.length === 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#768390',
              fontSize: '14px'
            }}>
              点击"＋ 新建终端"开始
            </div>
          )}
          {sessions.map((session) => (
            <div
              key={session.id}
              style={{
                position: 'absolute',
                inset: 0,
                display: session.id === activeSessionId ? 'flex' : 'none'
              }}
            >
              <TerminalPane sessionId={session.id} isActive={session.id === activeSessionId} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 更新 main.tsx**

```tsx
// src/renderer/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 3: 创建全局样式**

```css
/* src/renderer/src/styles/global.css */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1117; color: #cdd9e5; }
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
```

- [ ] **Step 4: 启动并手动验证**

```bash
npm run dev
```

验证清单：
- [ ] 应用窗口正常打开
- [ ] 点击"＋ 新建终端"，终端出现在标签栏和会话列表
- [ ] 终端可以接收输入并显示输出（输入 `echo hello`，回车，看到 `hello`）
- [ ] 可以创建多个终端，点击标签或会话列表可切换
- [ ] 关闭标签时终端从列表消失

- [ ] **Step 5: 运行所有测试**

```bash
npm test
```

预期：所有测试 PASS。

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/App.tsx src/renderer/src/main.tsx src/renderer/src/styles/
git commit -m "feat: wire up App shell with Sidebar, Tabs, and TerminalPane"
```

---

## 完成检查

Plan 1 交付后，应用具备：

- [x] 跨平台 Electron 项目，`npm run dev` 可启动
- [x] ConfigManager：JSON 配置持久化，有测试覆盖
- [x] PtyManager：终端进程生命周期管理，有测试覆盖
- [x] IPC Layer：安全的 contextBridge，Main ↔ Renderer 通信
- [x] 基础 UI：左侧会话列表 + 右侧 xterm.js 终端 + 标签栏
- [x] 新建 / 切换 / 关闭终端会话

**下一步：** Plan 2 — 分屏布局、分组管理、快捷命令、命令面板
