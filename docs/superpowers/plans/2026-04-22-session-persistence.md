# Session Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist each terminal session's name, last working directory, and last 10 commands across app restarts, with automatic PTY restore and shell history injection on startup.

**Architecture:** A new `SessionPersistenceManager` in the main process writes/reads `sessions.json`. On quit, the renderer collects session names and commands, the main process reads live CWDs via OS tools, and saves everything. On startup, the renderer fetches the snapshots and recreates PTYs with history injected via `HISTFILE`. Command tracking happens in `TerminalPane` by intercepting `term.onData`.

**Tech Stack:** Electron IPC, node-pty, Zustand 4, TypeScript, Vitest

---

## File Map

| File | Role |
|---|---|
| `src/main/session/SessionPersistenceManager.ts` | **New** — read/write `sessions.json`; backup on corruption |
| `src/renderer/src/store/useCommandHistoryStore.ts` | **New** — Zustand store: last 10 commands per session |
| `src/main/pty/PtyManager.ts` | Add `getCwd()`, `histCommands` in `create()`, temp-file cleanup in `destroy()` |
| `src/main/ipc/handlers.ts` | Add `session:save` and `session:load` handlers; accept `sessionManager` param |
| `src/main/index.ts` | Wire `SessionPersistenceManager`; add `before-quit` save flow with 2s timeout |
| `src/preload/index.ts` | Expose `saveSessionSnapshot`, `loadSessionSnapshots`, `onWillQuit`, `notifyQuitReady` |
| `src/renderer/src/types/api.ts` | Add `PersistedSession` type; add 4 new methods + update `create` signature |
| `src/renderer/src/store/useSessionStore.ts` | Add `useCommandHistoryStore.clearSession` call inside `closeSession` |
| `src/renderer/src/components/Terminal/TerminalPane.tsx` | Hook command tracking into `term.onData` |
| `src/renderer/src/App.tsx` | Await `loadConfig`, restore sessions, register `onWillQuit` listener |
| `tests/main/session/SessionPersistenceManager.test.ts` | **New** — unit tests |
| `tests/renderer/store/useCommandHistoryStore.test.ts` | **New** — unit tests |
| `tests/main/pty/PtyManager.test.ts` | Add tests for `getCwd` and `histCommands` |

---

### Task 1: SessionPersistenceManager

**Files:**
- Create: `src/main/session/SessionPersistenceManager.ts`
- Create: `tests/main/session/SessionPersistenceManager.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/main/session/SessionPersistenceManager.test.ts`:

```typescript
// tests/main/session/SessionPersistenceManager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { SessionPersistenceManager } from '../../../src/main/session/SessionPersistenceManager'
import type { PersistedSessionData } from '../../../src/main/session/SessionPersistenceManager'

const sample: PersistedSessionData = {
  id: 'abc123',
  title: 'My Terminal',
  groupId: 'default',
  lastCwd: '/home/user',
  lastCommands: ['ls', 'pwd']
}

describe('SessionPersistenceManager', () => {
  let tmpDir: string
  let manager: SessionPersistenceManager

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'idea-terminal-session-test-'))
    manager = new SessionPersistenceManager(tmpDir)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true })
  })

  it('returns empty array when file does not exist', () => {
    expect(manager.load()).toEqual([])
  })

  it('saves and loads sessions correctly', () => {
    manager.save([sample])
    expect(manager.load()).toEqual([sample])
  })

  it('preserves all fields including optional proxyId', () => {
    const withProxy: PersistedSessionData = { ...sample, proxyId: 'p1' }
    manager.save([withProxy])
    expect(manager.load()[0].proxyId).toBe('p1')
  })

  it('saves empty array and loads it back', () => {
    manager.save([sample])
    manager.save([])
    expect(manager.load()).toEqual([])
  })

  it('returns empty array and creates backup when file is corrupt', () => {
    writeFileSync(join(tmpDir, 'sessions.json'), 'not valid json')
    expect(manager.load()).toEqual([])
    expect(existsSync(join(tmpDir, 'sessions.json.bak'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal
npx vitest run tests/main/session/SessionPersistenceManager.test.ts
```

Expected: FAIL — `Cannot find module '.../SessionPersistenceManager'`

- [ ] **Step 3: Implement `SessionPersistenceManager`**

Create `src/main/session/SessionPersistenceManager.ts`:

```typescript
// src/main/session/SessionPersistenceManager.ts
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'fs'
import { join } from 'path'

export interface PersistedSessionData {
  id: string
  title: string
  groupId: string
  proxyId?: string
  lastCwd: string
  lastCommands: string[]
}

interface SessionSnapshot {
  version: number
  sessions: PersistedSessionData[]
}

export class SessionPersistenceManager {
  private readonly filePath: string

  constructor(userDataPath: string) {
    this.filePath = join(userDataPath, 'sessions.json')
  }

  load(): PersistedSessionData[] {
    if (!existsSync(this.filePath)) return []
    try {
      const raw = readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as SessionSnapshot
      return Array.isArray(parsed.sessions) ? parsed.sessions : []
    } catch {
      const backupPath = this.filePath + '.bak'
      copyFileSync(this.filePath, backupPath)
      return []
    }
  }

  save(sessions: PersistedSessionData[]): void {
    const snapshot: SessionSnapshot = { version: 1, sessions }
    writeFileSync(this.filePath, JSON.stringify(snapshot, null, 2), 'utf-8')
  }
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npx vitest run tests/main/session/SessionPersistenceManager.test.ts
```

Expected: 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/main/session/SessionPersistenceManager.ts tests/main/session/SessionPersistenceManager.test.ts
git commit -m "feat: add SessionPersistenceManager for sessions.json"
```

---

### Task 2: useCommandHistoryStore

**Files:**
- Create: `src/renderer/src/store/useCommandHistoryStore.ts`
- Create: `tests/renderer/store/useCommandHistoryStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/renderer/store/useCommandHistoryStore.test.ts`:

```typescript
// tests/renderer/store/useCommandHistoryStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useCommandHistoryStore } from '../../../src/renderer/src/store/useCommandHistoryStore'

describe('useCommandHistoryStore', () => {
  beforeEach(() => {
    useCommandHistoryStore.setState({ history: {} })
  })

  it('starts with empty history', () => {
    expect(useCommandHistoryStore.getState().history).toEqual({})
  })

  it('adds a command for a session', () => {
    useCommandHistoryStore.getState().addCommand('s1', 'ls')
    expect(useCommandHistoryStore.getState().history['s1']).toEqual(['ls'])
  })

  it('appends subsequent commands in order', () => {
    useCommandHistoryStore.getState().addCommand('s1', 'ls')
    useCommandHistoryStore.getState().addCommand('s1', 'pwd')
    expect(useCommandHistoryStore.getState().history['s1']).toEqual(['ls', 'pwd'])
  })

  it('caps at 10 commands, dropping the oldest', () => {
    const { addCommand } = useCommandHistoryStore.getState()
    for (let i = 1; i <= 12; i++) addCommand('s1', `cmd${i}`)
    const history = useCommandHistoryStore.getState().history['s1']
    expect(history).toHaveLength(10)
    expect(history[0]).toBe('cmd3')
    expect(history[9]).toBe('cmd12')
  })

  it('keeps separate history per session', () => {
    useCommandHistoryStore.getState().addCommand('s1', 'ls')
    useCommandHistoryStore.getState().addCommand('s2', 'pwd')
    expect(useCommandHistoryStore.getState().history['s1']).toEqual(['ls'])
    expect(useCommandHistoryStore.getState().history['s2']).toEqual(['pwd'])
  })

  it('clearSession removes the session history', () => {
    useCommandHistoryStore.getState().addCommand('s1', 'ls')
    useCommandHistoryStore.getState().clearSession('s1')
    expect(useCommandHistoryStore.getState().history['s1']).toBeUndefined()
  })

  it('clearSession does not affect other sessions', () => {
    useCommandHistoryStore.getState().addCommand('s1', 'ls')
    useCommandHistoryStore.getState().addCommand('s2', 'pwd')
    useCommandHistoryStore.getState().clearSession('s1')
    expect(useCommandHistoryStore.getState().history['s2']).toEqual(['pwd'])
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run tests/renderer/store/useCommandHistoryStore.test.ts
```

Expected: FAIL — `Cannot find module '.../useCommandHistoryStore'`

- [ ] **Step 3: Implement `useCommandHistoryStore`**

Create `src/renderer/src/store/useCommandHistoryStore.ts`:

```typescript
// src/renderer/src/store/useCommandHistoryStore.ts
import { create } from 'zustand'

const MAX_COMMANDS = 10

interface CommandHistoryStore {
  history: Record<string, string[]>
  addCommand: (sessionId: string, cmd: string) => void
  clearSession: (sessionId: string) => void
}

export const useCommandHistoryStore = create<CommandHistoryStore>((set) => ({
  history: {},

  addCommand: (sessionId, cmd) =>
    set((state) => {
      const existing = state.history[sessionId] ?? []
      const updated = [...existing, cmd].slice(-MAX_COMMANDS)
      return { history: { ...state.history, [sessionId]: updated } }
    }),

  clearSession: (sessionId) =>
    set((state) => {
      const next = { ...state.history }
      delete next[sessionId]
      return { history: next }
    })
}))
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npx vitest run tests/renderer/store/useCommandHistoryStore.test.ts
```

Expected: 7 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/store/useCommandHistoryStore.ts tests/renderer/store/useCommandHistoryStore.test.ts
git commit -m "feat: add useCommandHistoryStore (last 10 commands per session)"
```

---

### Task 3: Extend PtyManager

**Files:**
- Modify: `src/main/pty/PtyManager.ts`
- Modify: `tests/main/pty/PtyManager.test.ts`

- [ ] **Step 1: Write the new failing tests**

Add these tests to `tests/main/pty/PtyManager.test.ts` (append before the closing `}`):

```typescript
  it('getCwd returns homedir for unknown session id', async () => {
    const { homedir } = await import('os')
    const cwd = await manager.getCwd('nonexistent')
    expect(cwd).toBe(homedir())
  })

  it('getCwd returns a non-empty string for a live session', async () => {
    manager.create({ id: 's-cwd', cwd: process.cwd() })
    const cwd = await manager.getCwd('s-cwd')
    expect(typeof cwd).toBe('string')
    expect(cwd.length).toBeGreaterThan(0)
  })

  it('create with histCommands writes a temp HISTFILE', () => {
    const { existsSync } = require('fs')
    const { join } = require('path')
    const { tmpdir } = require('os')
    manager.create({ id: 's-hist', cwd: process.cwd(), histCommands: ['ls', 'pwd'] })
    expect(existsSync(join(tmpdir(), 'idea-terminal-hist-s-hist'))).toBe(true)
  })

  it('destroy cleans up the temp HISTFILE', () => {
    const { existsSync } = require('fs')
    const { join } = require('path')
    const { tmpdir } = require('os')
    manager.create({ id: 's-hist2', cwd: process.cwd(), histCommands: ['ls'] })
    manager.destroy('s-hist2')
    expect(existsSync(join(tmpdir(), 'idea-terminal-hist-s-hist2'))).toBe(false)
  })
```

- [ ] **Step 2: Run new tests — expect failure**

```bash
npx vitest run tests/main/pty/PtyManager.test.ts
```

Expected: the 4 new tests FAIL — `manager.getCwd is not a function` and `histCommands` path doesn't exist

- [ ] **Step 3: Implement the changes in `PtyManager.ts`**

Replace the entire file content with:

```typescript
// src/main/pty/PtyManager.ts
import * as pty from 'node-pty'
import { execSync } from 'child_process'
import { existsSync, realpathSync, writeFileSync, unlinkSync } from 'fs'
import { homedir, platform, tmpdir } from 'os'
import { join } from 'path'

export interface PtySession {
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
  /** Commands to inject into the shell's history via HISTFILE on startup */
  histCommands?: string[]
}

export class PtyManager {
  private sessions = new Map<string, PtySession>()
  /** Tracks temp history files so they can be cleaned up on destroy */
  private histFiles = new Map<string, string>()

  create(options: CreateOptions): { pid: number } {
    const shell = platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL ?? '/bin/zsh')

    let extraEnv: Record<string, string> = {}
    if (options.histCommands && options.histCommands.length > 0) {
      const histFile = join(tmpdir(), `idea-terminal-hist-${options.id}`)
      writeFileSync(histFile, options.histCommands.join('\n'), 'utf-8')
      extraEnv = { HISTFILE: histFile, HISTSIZE: '1000', HISTFILESIZE: '1000' }
      this.histFiles.set(options.id, histFile)
    }

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: options.cols ?? 80,
      rows: options.rows ?? 24,
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}), ...extraEnv } as Record<string, string>
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
    const histFile = this.histFiles.get(id)
    if (histFile) {
      try { unlinkSync(histFile) } catch { /* already gone */ }
      this.histFiles.delete(id)
    }
  }

  destroyAll(): void {
    for (const id of [...this.sessions.keys()]) {
      this.destroy(id)
    }
  }

  /** Reads the current working directory of the PTY process via OS-level tools.
   *  Falls back to homedir() on failure or unsupported platform. */
  async getCwd(id: string): Promise<string> {
    const session = this.sessions.get(id)
    if (!session) return homedir()
    const { pid } = session
    try {
      if (platform() === 'darwin') {
        const result = execSync(
          `lsof -p ${pid} -a -d cwd -Fn 2>/dev/null | grep '^n' | sed 's/^n//'`,
          { encoding: 'utf-8' }
        ).trim()
        return result || homedir()
      } else if (platform() === 'linux') {
        return realpathSync(`/proc/${pid}/cwd`)
      }
    } catch {
      // fallthrough to homedir
    }
    return homedir()
  }

  onData(id: string, callback: (data: string) => void): pty.IDisposable | undefined {
    return this.sessions.get(id)?.process.onData(callback)
  }

  onExit(id: string, callback: (code: number) => void): pty.IDisposable | undefined {
    return this.sessions.get(id)?.process.onExit(({ exitCode }) => callback(exitCode))
  }
}
```

- [ ] **Step 4: Run all PtyManager tests — expect all pass**

```bash
npx vitest run tests/main/pty/PtyManager.test.ts
```

Expected: all tests (original + 4 new) pass

- [ ] **Step 5: Commit**

```bash
git add src/main/pty/PtyManager.ts tests/main/pty/PtyManager.test.ts
git commit -m "feat: add getCwd and histCommands support to PtyManager"
```

---

### Task 4: IPC layer — types, handlers, preload

**Files:**
- Modify: `src/renderer/src/types/api.ts`
- Modify: `src/main/ipc/handlers.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add `PersistedSession` type and new methods to `src/renderer/src/types/api.ts`**

Add the `PersistedSession` interface just before the `TerminalAPI` interface, and add 4 new methods to `TerminalAPI`. Also update `create` to accept `histCommands`.

Replace the current `TerminalAPI` interface with:

```typescript
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
  /** Listen for the main process about-to-quit signal. Returns unsubscribe fn. */
  onWillQuit: (callback: () => void) => () => void
  /** Notify the main process that the renderer has finished saving and it is safe to quit. */
  notifyQuitReady: () => void

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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors

- [ ] **Step 3: Add `session:save` and `session:load` handlers to `src/main/ipc/handlers.ts`**

Replace the entire file with:

```typescript
// src/main/ipc/handlers.ts
import { ipcMain, BrowserWindow } from 'electron'
import { homedir } from 'os'
import type { IDisposable } from 'node-pty'
import { PtyManager } from '../pty/PtyManager'
import { ConfigManager } from '../config/ConfigManager'
import { SessionPersistenceManager } from '../session/SessionPersistenceManager'
import { AiKeyStore } from '../ai/AiKeyStore'
import { AiManager, ChatMessage } from '../ai/AiManager'
import type { AiAgentConfig } from '../../shared/types'
import { buildProxyEnv } from '../proxy/buildProxyEnv'

export function registerHandlers(
  ptyManager: PtyManager,
  configManager: ConfigManager,
  sessionManager: SessionPersistenceManager,
  aiKeyStore: AiKeyStore,
  aiManager: AiManager
): void {
  const disposables = new Map<string, IDisposable[]>()
  const activeStreams = new Map<string, AbortController>()

  // ── Terminal ──────────────────────────────────────────────────────────────

  ipcMain.handle('terminal:create', (_event, options: { id: string; cwd: string; proxyId?: string; histCommands?: string[] }) => {
    const win = BrowserWindow.fromWebContents(_event.sender)
    if (!win) return { pid: -1 }

    let proxyEnv: Record<string, string> = {}
    if (options.proxyId) {
      const config = configManager.load()
      const proxy = config.proxies.find((p) => p.id === options.proxyId)
      proxyEnv = buildProxyEnv(proxy)
    }

    const result = ptyManager.create({ ...options, env: proxyEnv })

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

  // ── Session Persistence ────────────────────────────────────────────────────

  ipcMain.handle('session:load', () => sessionManager.load())

  ipcMain.handle(
    'session:save',
    async (
      _event,
      snapshots: Array<{ id: string; title: string; groupId: string; proxyId?: string; lastCommands: string[] }>
    ) => {
      const withCwd = await Promise.all(
        snapshots.map(async (s) => ({
          ...s,
          lastCwd: await ptyManager.getCwd(s.id)
        }))
      )
      sessionManager.save(withCwd)
    }
  )

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
```

- [ ] **Step 4: Expose new methods in `src/preload/index.ts`**

Replace the entire file content with:

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

  // Session persistence
  saveSessionSnapshot: (snapshots) => ipcRenderer.invoke('session:save', snapshots),
  loadSessionSnapshots: () => ipcRenderer.invoke('session:load'),

  onWillQuit: (callback) => {
    const handler = (): void => callback()
    ipcRenderer.on('app:will-quit', handler)
    return () => ipcRenderer.removeListener('app:will-quit', handler)
  },

  notifyQuitReady: () => ipcRenderer.send('session:quit-ready'),

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

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/types/api.ts src/main/ipc/handlers.ts src/preload/index.ts
git commit -m "feat: add session:save and session:load IPC handlers"
```

---

### Task 5: Before-quit save flow in `src/main/index.ts`

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: Replace `src/main/index.ts` with the updated version**

```typescript
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
  // Second call: isQuitting is true, let Electron proceed normally
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: add before-quit session save flow with 2s timeout guard"
```

---

### Task 6: Command tracking in `TerminalPane.tsx` and cleanup in `useSessionStore.ts`

**Files:**
- Modify: `src/renderer/src/components/Terminal/TerminalPane.tsx`
- Modify: `src/renderer/src/store/useSessionStore.ts`

- [ ] **Step 1: Add command tracking to `src/renderer/src/components/Terminal/TerminalPane.tsx`**

Add the import at the top of the file (after existing imports):

```typescript
import { useCommandHistoryStore } from '../../store/useCommandHistoryStore'
```

Inside the mount `useEffect` (the one with `[sessionId]` dependency), find the line:

```typescript
    const disposeInput = term.onData((data) => window.api.write(sessionId, data))
```

Replace it with:

```typescript
    // Command tracking: intercept keystrokes to record commands in history
    let lineBuffer = ''
    const addCommand = useCommandHistoryStore.getState().addCommand
    const disposeInput = term.onData((data) => {
      window.api.write(sessionId, data)
      if (data === '\r') {
        const cmd = lineBuffer.trim()
        if (cmd) addCommand(sessionId, cmd)
        lineBuffer = ''
      } else if (data === '\x7f') {
        // Backspace
        lineBuffer = lineBuffer.slice(0, -1)
      } else if (!data.startsWith('\x1b') && data.length === 1) {
        // Printable character (ignore ANSI escape sequences like arrow keys)
        lineBuffer += data
      }
    })
```

- [ ] **Step 2: Add history cleanup to `src/renderer/src/store/useSessionStore.ts`**

Add the import at the top of the file (after existing imports):

```typescript
import { useCommandHistoryStore } from './useCommandHistoryStore'
```

Find the `closeSession` action:

```typescript
  closeSession: (id) => {
    window.api.destroy(id)
    useSessionStore.getState().removeSession(id)
    useSplitStore.getState().clearSession(id)
  },
```

Replace it with:

```typescript
  closeSession: (id) => {
    window.api.destroy(id)
    useSessionStore.getState().removeSession(id)
    useSplitStore.getState().clearSession(id)
    useCommandHistoryStore.getState().clearSession(id)
  },
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors

- [ ] **Step 4: Run all tests to verify nothing is broken**

```bash
npx vitest run
```

Expected: all existing tests still pass

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/Terminal/TerminalPane.tsx src/renderer/src/store/useSessionStore.ts
git commit -m "feat: track commands in TerminalPane and clear on session close"
```

---

### Task 7: Session restore in `App.tsx`

**Files:**
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Replace `src/renderer/src/App.tsx` with the updated version**

```typescript
// src/renderer/src/App.tsx
import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar/Sidebar'
import { SplitPane } from './components/Terminal/SplitPane'
import { CommandPalette } from './components/CommandPalette/CommandPalette'
import { AiPanel } from './components/AiPanel/AiPanel'
import { useConfigStore } from './store/useConfigStore'
import { useSplitStore } from './store/useSplitStore'
import { useSessionStore } from './store/useSessionStore'
import { useCommandHistoryStore } from './store/useCommandHistoryStore'

export default function App(): JSX.Element {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const loadConfig = useConfigStore((s) => s.load)
  const leaves = useSplitStore((s) => s.collectLeaves())

  // ── Init: load config then restore persisted sessions ─────────────────────
  useEffect(() => {
    const init = async (): Promise<void> => {
      await loadConfig()

      const snapshots = await window.api.loadSessionSnapshots()
      if (snapshots.length === 0) return

      const { addSession } = useSessionStore.getState()
      const { activePaneId, assignSession } = useSplitStore.getState()
      const validGroupIds = new Set(
        useConfigStore.getState().config.groups.map((g) => g.id)
      )
      validGroupIds.add('default')

      let firstSessionId: string | null = null
      for (const snap of snapshots) {
        try {
          const groupId = validGroupIds.has(snap.groupId) ? snap.groupId : 'default'
          const { pid } = await window.api.create({
            id: snap.id,
            cwd: snap.lastCwd,
            histCommands: snap.lastCommands
          })
          addSession({
            id: snap.id,
            title: snap.title,
            groupId,
            pid,
            status: 'running',
            proxyId: snap.proxyId
          })
          if (!firstSessionId) firstSessionId = snap.id
        } catch {
          // Skip sessions that fail to restore (e.g. lastCwd no longer exists)
        }
      }

      if (firstSessionId && activePaneId) {
        assignSession(activePaneId, firstSessionId)
      }
    }

    init().catch(console.error)
  }, [loadConfig])

  // ── Will-quit: save sessions before the app closes ────────────────────────
  useEffect(() => {
    const unsubscribe = window.api.onWillQuit(async () => {
      const sessions = useSessionStore.getState().sessions
      const history = useCommandHistoryStore.getState().history
      const snapshots = sessions.map((s) => ({
        id: s.id,
        title: s.title,
        groupId: s.groupId,
        proxyId: s.proxyId,
        lastCommands: history[s.id] ?? []
      }))
      try {
        await window.api.saveSessionSnapshot(snapshots)
      } finally {
        window.api.notifyQuitReady()
      }
    })
    return unsubscribe
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
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

  const showEmptyState = leaves.length === 1 && !leaves[0]?.sessionId

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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors

- [ ] **Step 3: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

1. Create 2–3 terminals in the app, run a few commands in each (e.g. `ls`, `pwd`, `echo hello`)
2. Rename one terminal via the ✏ icon in the sidebar
3. Quit the app (Cmd+Q on macOS)
4. Verify `~/Library/Application\ Support/idea-terminal/sessions.json` was written:
   ```bash
   cat ~/Library/Application\ Support/idea-terminal/sessions.json
   ```
   Expected: JSON with sessions array containing names, `lastCwd`, and `lastCommands`
5. Relaunch the app — sessions should appear in the sidebar with their saved names
6. In a restored terminal, press ↑ — it should cycle through your previously typed commands

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat: restore persisted sessions on startup and save on quit"
```
