# Plan 4: 网络代理管理

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为每个终端会话注入独立的网络代理（HTTP/SOCKS5），通过 pty 环境变量实现，支持添加/删除代理配置，Sidebar 提供代理选择器，会话列表显示代理标识。

**Architecture:** Main Process 的 `buildProxyEnv` 将 `ProxyConfig` 转换为环境变量 dict，`terminal:create` IPC 接收 `proxyId`，查找配置后注入到 pty 进程；Renderer 的 `useConfigStore` 新增 `addProxy`/`removeProxy` mutations，Sidebar 提供代理选择下拉框，`GroupItem` 在会话旁显示代理名称徽章。

**Tech Stack:** Electron node-pty（env 注入），Zustand，React，Vitest

---

## 文件结构

```
src/main/
└── proxy/
    └── buildProxyEnv.ts          (新建) — ProxyConfig → env vars dict

src/main/ipc/
└── handlers.ts                   (修改) — terminal:create 接收 proxyId，注入代理 env

src/renderer/src/
├── store/
│   └── useConfigStore.ts         (修改) — 添加 addProxy, removeProxy mutations
├── components/
│   ├── Proxy/
│   │   └── ProxyForm.tsx         (新建) — 添加代理表单（name, type, host, port, auth）
│   └── Sidebar/
│       ├── Sidebar.tsx           (修改) — 代理选择下拉框，创建终端时传 proxyId
│       └── GroupItem.tsx         (修改) — 会话旁显示代理徽章

src/renderer/src/types/api.ts     (修改) — terminal:create 加 proxyId 参数
src/preload/index.ts              (修改) — 无新 channel，只更新 create 调用签名
src/shared/types.ts               (无改动，ProxyConfig 已存在)

docs/superpowers/specs/
└── 2026-04-20-idea-terminal-design.md  (修改) — 更新代理管理实现状态

tests/
├── main/proxy/
│   └── buildProxyEnv.test.ts     (新建) — 5 tests
└── renderer/store/
    └── useConfigStore.test.ts    (修改) — 添加 3 tests for proxy mutations
```

**当前测试基准：** 44 tests（Plan 3 结束后）  
**Plan 4 完成后：** 52 tests（+8）

---

## Task 1: buildProxyEnv（TDD）

**Files:**
- Create: `src/main/proxy/buildProxyEnv.ts`
- Create: `tests/main/proxy/buildProxyEnv.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/main/proxy/buildProxyEnv.test.ts`（需先建目录 `tests/main/proxy/`）：

```typescript
// tests/main/proxy/buildProxyEnv.test.ts
import { describe, it, expect } from 'vitest'
import { buildProxyEnv } from '../../../src/main/proxy/buildProxyEnv'
import type { ProxyConfig } from '../../../src/shared/types'

const makeProxy = (overrides: Partial<ProxyConfig> = {}): ProxyConfig => ({
  id: 'p1',
  name: 'Test Proxy',
  type: 'http',
  host: '127.0.0.1',
  port: 7890,
  createdAt: 0,
  updatedAt: 0,
  ...overrides
})

describe('buildProxyEnv', () => {
  it('returns empty object when proxy is undefined', () => {
    expect(buildProxyEnv(undefined)).toEqual({})
  })

  it('builds http proxy URL without auth', () => {
    const env = buildProxyEnv(makeProxy())
    expect(env.HTTP_PROXY).toBe('http://127.0.0.1:7890')
    expect(env.HTTPS_PROXY).toBe('http://127.0.0.1:7890')
    expect(env.http_proxy).toBe('http://127.0.0.1:7890')
    expect(env.https_proxy).toBe('http://127.0.0.1:7890')
  })

  it('builds http proxy URL with username and password', () => {
    const env = buildProxyEnv(makeProxy({ username: 'user', password: 'pass' }))
    expect(env.HTTP_PROXY).toBe('http://user:pass@127.0.0.1:7890')
    expect(env.http_proxy).toBe('http://user:pass@127.0.0.1:7890')
  })

  it('builds socks5 proxy URL', () => {
    const env = buildProxyEnv(makeProxy({ type: 'socks5', port: 1080 }))
    expect(env.HTTP_PROXY).toBe('socks5://127.0.0.1:1080')
    expect(env.HTTPS_PROXY).toBe('socks5://127.0.0.1:1080')
  })

  it('sets NO_PROXY and no_proxy to localhost entries', () => {
    const env = buildProxyEnv(makeProxy())
    expect(env.NO_PROXY).toBe('localhost,127.0.0.1')
    expect(env.no_proxy).toBe('localhost,127.0.0.1')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal
npm test
```

预期：FAIL — `Cannot find module '../../../src/main/proxy/buildProxyEnv'`

- [ ] **Step 3: 实现 buildProxyEnv**

创建 `src/main/proxy/buildProxyEnv.ts`：

```typescript
// src/main/proxy/buildProxyEnv.ts
import type { ProxyConfig } from '../../shared/types'

export function buildProxyEnv(proxy: ProxyConfig | undefined): Record<string, string> {
  if (!proxy) return {}

  const auth = proxy.username
    ? `${proxy.username}:${proxy.password}@`
    : ''
  const url = `${proxy.type}://${auth}${proxy.host}:${proxy.port}`

  return {
    HTTP_PROXY: url,
    HTTPS_PROXY: url,
    http_proxy: url,
    https_proxy: url,
    NO_PROXY: 'localhost,127.0.0.1',
    no_proxy: 'localhost,127.0.0.1'
  }
}
```

- [ ] **Step 4: 运行测试，确认 49 个测试通过**

```bash
npm test
```

预期：49 个测试（44 旧 + 5 新）全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/main/proxy/buildProxyEnv.ts tests/main/proxy/buildProxyEnv.test.ts
git commit -m "feat: add buildProxyEnv for pty environment variable injection"
```

---

## Task 2: terminal:create 代理注入 + API 类型更新

**Files:**
- Modify: `src/main/ipc/handlers.ts`
- Modify: `src/renderer/src/types/api.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: 更新 handlers.ts**

在 `src/main/ipc/handlers.ts` 顶部添加 import：

```typescript
import { buildProxyEnv } from '../proxy/buildProxyEnv'
```

将 `terminal:create` handler 中的 `options` 类型从 `{ id: string; cwd: string }` 改为 `{ id: string; cwd: string; proxyId?: string }`，并在调用 `ptyManager.create()` 前注入代理 env：

找到这段代码（大约在第 22 行）：

```typescript
  ipcMain.handle('terminal:create', (_event, options: { id: string; cwd: string }) => {
    const win = BrowserWindow.fromWebContents(_event.sender)
    if (!win) return { pid: -1 }

    const result = ptyManager.create(options)
```

替换为：

```typescript
  ipcMain.handle('terminal:create', (_event, options: { id: string; cwd: string; proxyId?: string }) => {
    const win = BrowserWindow.fromWebContents(_event.sender)
    if (!win) return { pid: -1 }

    let proxyEnv: Record<string, string> = {}
    if (options.proxyId) {
      const config = configManager.load()
      const proxy = config.proxies.find((p) => p.id === options.proxyId)
      proxyEnv = buildProxyEnv(proxy)
    }

    const result = ptyManager.create({ ...options, env: proxyEnv })
```

- [ ] **Step 2: 更新 src/renderer/src/types/api.ts**

找到 `create` 方法的类型声明：

```typescript
  create: (options: { id: string; cwd: string }) => Promise<{ pid: number }>
```

替换为：

```typescript
  create: (options: { id: string; cwd: string; proxyId?: string }) => Promise<{ pid: number }>
```

- [ ] **Step 3: 运行测试并构建**

```bash
npm test
```

预期：49 个测试全部通过（handlers 无新单元测试）。

```bash
npm run build
```

预期：三端构建成功，无 TypeScript 错误。

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc/handlers.ts src/renderer/src/types/api.ts
git commit -m "feat: inject proxy env vars into pty on terminal:create"
```

---

## Task 3: useConfigStore proxy mutations（TDD）

**Files:**
- Modify: `src/renderer/src/store/useConfigStore.ts`
- Modify: `tests/renderer/store/useConfigStore.test.ts`

- [ ] **Step 1: 在 useConfigStore.test.ts 中添加 3 个失败测试**

先读当前 `tests/renderer/store/useConfigStore.test.ts`，在 `describe` 末尾（最后一个 `it` 之后，`})` 之前）添加：

```typescript
  it('addProxy adds a proxy to config', () => {
    useConfigStore.getState().addProxy({
      name: 'Local',
      type: 'http',
      host: '127.0.0.1',
      port: 7890
    })
    const proxies = useConfigStore.getState().config.proxies
    expect(proxies).toHaveLength(1)
    expect(proxies[0].name).toBe('Local')
    expect(proxies[0].type).toBe('http')
    expect(proxies[0].id).toBeTruthy()
  })

  it('removeProxy removes proxy by id', () => {
    useConfigStore.getState().addProxy({ name: 'P1', type: 'http', host: '127.0.0.1', port: 7890 })
    useConfigStore.getState().addProxy({ name: 'P2', type: 'socks5', host: '127.0.0.1', port: 1080 })
    const id = useConfigStore.getState().config.proxies[0].id
    useConfigStore.getState().removeProxy(id)
    const proxies = useConfigStore.getState().config.proxies
    expect(proxies).toHaveLength(1)
    expect(proxies[0].name).toBe('P2')
  })

  it('updateProxy updates existing proxy fields', () => {
    useConfigStore.getState().addProxy({ name: 'Old', type: 'http', host: '127.0.0.1', port: 7890 })
    const id = useConfigStore.getState().config.proxies[0].id
    useConfigStore.getState().updateProxy(id, { name: 'New', port: 8080 })
    const proxy = useConfigStore.getState().config.proxies[0]
    expect(proxy.name).toBe('New')
    expect(proxy.port).toBe(8080)
    expect(proxy.type).toBe('http') // unchanged
  })
```

- [ ] **Step 2: 运行测试，确认 3 个失败**

```bash
npm test
```

预期：FAIL — `useConfigStore.getState().addProxy is not a function`（3 个新测试失败，49 旧测试仍通过）

- [ ] **Step 3: 在 useConfigStore.ts 中添加 proxy mutations**

在 `src/renderer/src/store/useConfigStore.ts` 中：

在 `ConfigStore` interface 中添加（在 `removeQuickCommand` 之后）：

```typescript
  addProxy: (data: Omit<ProxyConfig, 'id' | 'createdAt' | 'updatedAt'>) => ProxyConfig
  removeProxy: (id: string) => void
  updateProxy: (id: string, updates: Partial<Omit<ProxyConfig, 'id' | 'createdAt'>>) => void
```

在 import 行添加 `ProxyConfig`（与已有的 `AppConfig, DEFAULT_CONFIG, TerminalGroup, QuickCommand` 一起）：

```typescript
import { AppConfig, DEFAULT_CONFIG, TerminalGroup, QuickCommand, ProxyConfig } from '../../../shared/types'
```

在 `create<ConfigStore>((set, get) => ({` 的实现中，在 `removeQuickCommand` 实现之后添加：

```typescript
  addProxy: (data) => {
    const now = Date.now()
    const proxy: ProxyConfig = { id: genId(), ...data, createdAt: now, updatedAt: now }
    set((state) => ({
      config: { ...state.config, proxies: [...state.config.proxies, proxy] }
    }))
    get().save().catch(console.error)
    return proxy
  },

  removeProxy: (id) => {
    set((state) => ({
      config: { ...state.config, proxies: state.config.proxies.filter((p) => p.id !== id) }
    }))
    get().save().catch(console.error)
  },

  updateProxy: (id, updates) => {
    set((state) => ({
      config: {
        ...state.config,
        proxies: state.config.proxies.map((p) =>
          p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
        )
      }
    }))
    get().save().catch(console.error)
  },
```

- [ ] **Step 4: 运行测试，确认 52 个测试通过**

```bash
npm test
```

预期：52 个测试（49 旧 + 3 新）全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/store/useConfigStore.ts tests/renderer/store/useConfigStore.test.ts
git commit -m "feat: add proxy mutations to useConfigStore"
```

---

## Task 4: ProxyForm 组件 + Sidebar 代理选择器

**Files:**
- Create: `src/renderer/src/components/Proxy/ProxyForm.tsx`
- Modify: `src/renderer/src/components/Sidebar/Sidebar.tsx`
- Modify: `src/renderer/src/store/useSessionStore.ts`

- [ ] **Step 1: 修改 useSessionStore，给 RuntimeSession 添加 proxyId**

读 `src/renderer/src/store/useSessionStore.ts`，在 `RuntimeSession` interface 中添加：

```typescript
export interface RuntimeSession {
  id: string
  title: string
  groupId: string
  pid: number
  status: 'running' | 'disconnected'
  proxyId?: string   // ← 新增
}
```

无需添加新 action，`addSession` 已接受整个 `RuntimeSession` 对象。

- [ ] **Step 2: 创建 ProxyForm.tsx**

创建 `src/renderer/src/components/Proxy/ProxyForm.tsx`：

```tsx
// src/renderer/src/components/Proxy/ProxyForm.tsx
import { useState } from 'react'
import { useConfigStore } from '../../store/useConfigStore'

interface ProxyFormProps {
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

export function ProxyForm({ onSaved, onCancel }: ProxyFormProps): JSX.Element {
  const [name, setName] = useState('')
  const [type, setType] = useState<'http' | 'socks5'>('http')
  const [host, setHost] = useState('127.0.0.1')
  const [port, setPort] = useState('7890')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const addProxy = useConfigStore((s) => s.addProxy)

  const handleSave = (): void => {
    if (!name.trim() || !host.trim() || !port.trim()) {
      setError('名称、地址和端口均为必填项')
      return
    }
    const portNum = parseInt(port, 10)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setError('端口号必须为 1-65535 之间的数字')
      return
    }
    setError('')
    addProxy({
      name: name.trim(),
      type,
      host: host.trim(),
      port: portNum,
      username: username.trim() || undefined,
      password: password.trim() || undefined
    })
    onSaved()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px' }}>
      <div style={{ color: '#cdd9e5', fontSize: '11px', fontWeight: 'bold', marginBottom: '2px' }}>
        添加代理
      </div>

      <div>
        <label style={LABEL_STYLE}>名称</label>
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="如：本地 Clash" style={INPUT_STYLE} />
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        <div style={{ flex: 1 }}>
          <label style={LABEL_STYLE}>类型</label>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)}
            style={INPUT_STYLE}>
            <option value="http">HTTP</option>
            <option value="socks5">SOCKS5</option>
          </select>
        </div>
        <div style={{ flex: 2 }}>
          <label style={LABEL_STYLE}>地址</label>
          <input value={host} onChange={(e) => setHost(e.target.value)}
            placeholder="127.0.0.1" style={INPUT_STYLE} />
        </div>
        <div style={{ width: '60px' }}>
          <label style={LABEL_STYLE}>端口</label>
          <input value={port} onChange={(e) => setPort(e.target.value)}
            placeholder="7890" style={INPUT_STYLE} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        <div style={{ flex: 1 }}>
          <label style={LABEL_STYLE}>用户名（可选）</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="user" style={INPUT_STYLE} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={LABEL_STYLE}>密码（可选）</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••" style={INPUT_STYLE} />
        </div>
      </div>

      {error && <div style={{ color: '#f85149', fontSize: '10px' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={handleSave} style={{
          flex: 1, backgroundColor: '#0f3460', border: 'none', borderRadius: '3px',
          color: '#64ffda', fontSize: '11px', padding: '5px', cursor: 'pointer'
        }}>保存</button>
        {onCancel && (
          <button onClick={onCancel} style={{
            backgroundColor: 'transparent', border: '1px solid #30363d', borderRadius: '3px',
            color: '#8892a4', fontSize: '11px', padding: '5px 10px', cursor: 'pointer'
          }}>取消</button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 修改 Sidebar.tsx，添加代理选择器**

读 `src/renderer/src/components/Sidebar/Sidebar.tsx`，完整替换为：

```tsx
// src/renderer/src/components/Sidebar/Sidebar.tsx
import { useState } from 'react'
import { useSessionStore } from '../../store/useSessionStore'
import { useSplitStore } from '../../store/useSplitStore'
import { useConfigStore } from '../../store/useConfigStore'
import { GroupItem } from './GroupItem'
import { QuickCommands } from './QuickCommands'
import { ProxyForm } from '../Proxy/ProxyForm'

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function Sidebar(): JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const addSession = useSessionStore((s) => s.addSession)
  const { panes, activePaneId, assignSession, addPane } = useSplitStore()
  const proxies = useConfigStore((s) => s.config.proxies)
  const removeProxy = useConfigStore((s) => s.removeProxy)
  const [isCreating, setIsCreating] = useState(false)
  const [selectedProxyId, setSelectedProxyId] = useState<string>('')
  const [showProxyForm, setShowProxyForm] = useState(false)

  const handleNewTerminal = async (): Promise<void> => {
    if (isCreating) return
    setIsCreating(true)
    try {
      const id = generateId()
      const homedir = await window.api.getHomedir()
      const proxyId = selectedProxyId || undefined
      const { pid } = await window.api.create({ id, cwd: homedir, proxyId })
      const sessionNum = sessions.length + 1
      addSession({ id, title: `终端 ${sessionNum}`, groupId: 'default', pid, status: 'running', proxyId })

      const emptyPane = panes.find((p) => !p.sessionId)
      if (emptyPane) {
        assignSession(emptyPane.id, id)
      } else if (activePaneId) {
        assignSession(activePaneId, id)
      } else {
        addPane(id)
      }
    } finally {
      setIsCreating(false)
    }
  }

  const defaultSessions = sessions.filter((s) => s.groupId === 'default')

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

      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* 代理选择器 */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <select
            value={selectedProxyId}
            onChange={(e) => setSelectedProxyId(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: '#0d1117',
              border: '1px solid #0f3460',
              borderRadius: '3px',
              color: selectedProxyId ? '#64ffda' : '#484f58',
              fontSize: '10px',
              padding: '3px 4px',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="">无代理</option>
            {proxies.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowProxyForm(!showProxyForm)}
            title={showProxyForm ? '取消' : '添加代理'}
            style={{
              background: 'none', border: 'none', color: '#484f58',
              cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '2px 4px'
            }}
          >
            {showProxyForm ? '×' : '+'}
          </button>
        </div>

        {/* 代理管理：删除现有代理 */}
        {!showProxyForm && selectedProxyId && (
          <button
            onClick={() => { removeProxy(selectedProxyId); setSelectedProxyId('') }}
            style={{
              background: 'none', border: '1px solid #3d1f1f', borderRadius: '3px',
              color: '#f85149', fontSize: '10px', padding: '2px 6px',
              cursor: 'pointer', textAlign: 'left'
            }}
          >
            删除「{proxies.find((p) => p.id === selectedProxyId)?.name}」
          </button>
        )}

        {/* 新建代理表单 */}
        {showProxyForm && (
          <div style={{ backgroundColor: '#0d1117', borderRadius: '4px', border: '1px solid #21262d' }}>
            <ProxyForm onSaved={() => setShowProxyForm(false)} onCancel={() => setShowProxyForm(false)} />
          </div>
        )}

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

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 4px' }}>
        <GroupItem
          groupId="default"
          groupName="会话"
          sessions={defaultSessions}
          activePaneId={activePaneId}
        />
      </div>

      <QuickCommands />
    </div>
  )
}
```

- [ ] **Step 4: 运行测试并构建**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal
npm test
```

预期：52 个测试全部通过。

```bash
npm run build
```

预期：三端构建成功，无 TypeScript 错误。

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/store/useSessionStore.ts src/renderer/src/components/Proxy/ProxyForm.tsx src/renderer/src/components/Sidebar/Sidebar.tsx
git commit -m "feat: add ProxyForm and proxy selector to Sidebar"
```

---

## Task 5: GroupItem 代理徽章 + 文档更新

**Files:**
- Modify: `src/renderer/src/components/Sidebar/GroupItem.tsx`
- Modify: `docs/superpowers/specs/2026-04-20-idea-terminal-design.md`

- [ ] **Step 1: 读 GroupItem.tsx 了解当前结构**

读 `src/renderer/src/components/Sidebar/GroupItem.tsx`。

- [ ] **Step 2: 修改 GroupItem.tsx，显示代理徽章**

`GroupItem` 接收 `sessions: RuntimeSession[]`，每条 session 已有 `proxyId?: string`。需要从 `useConfigStore` 读取 proxies 来查找名称。

在 `GroupItem.tsx` 中添加 `useConfigStore` import，并在每个会话 item 的标题旁显示代理徽章。

完整替换 `src/renderer/src/components/Sidebar/GroupItem.tsx`：

```tsx
// src/renderer/src/components/Sidebar/GroupItem.tsx
import { useState } from 'react'
import { useSplitStore } from '../../store/useSplitStore'
import { useConfigStore } from '../../store/useConfigStore'
import type { RuntimeSession } from '../../store/useSessionStore'

interface GroupItemProps {
  groupId: string
  groupName: string
  sessions: RuntimeSession[]
  activePaneId: string | null
}

export function GroupItem({ groupName, sessions, activePaneId }: GroupItemProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const { panes, setActivePane, assignSession } = useSplitStore()
  const proxies = useConfigStore((s) => s.config.proxies)

  const getProxyName = (proxyId?: string): string | undefined => {
    if (!proxyId) return undefined
    return proxies.find((p) => p.id === proxyId)?.name
  }

  const handleSessionClick = (sessionId: string): void => {
    const existingPane = panes.find((p) => p.sessionId === sessionId)
    if (existingPane) {
      setActivePane(existingPane.id)
    } else if (activePaneId) {
      assignSession(activePaneId, sessionId)
    }
  }

  const activePaneSessionId = panes.find((p) => p.id === activePaneId)?.sessionId

  return (
    <div>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 8px',
          color: '#768390',
          fontSize: '11px',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <span style={{ marginRight: '4px' }}>{collapsed ? '▶' : '▼'}</span>
        {groupName}
      </div>

      {!collapsed && sessions.map((session) => {
        const isActive = session.id === activePaneSessionId
        const proxyName = getProxyName(session.proxyId)

        return (
          <div
            key={session.id}
            onClick={() => handleSessionClick(session.id)}
            style={{
              padding: '4px 8px 4px 20px',
              backgroundColor: isActive ? '#0f3460' : 'transparent',
              color: isActive ? '#e2e8f0' : '#a8b2d8',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              borderRadius: '3px',
              margin: '1px 4px'
            }}
          >
            <span style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {session.status === 'disconnected' ? '⚠ ' : ''}{session.title}
            </span>
            {proxyName && (
              <span style={{
                fontSize: '9px',
                color: '#64ffda',
                backgroundColor: '#0d2b2b',
                border: '1px solid #1a5050',
                borderRadius: '2px',
                padding: '0 3px',
                flexShrink: 0,
                maxWidth: '60px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              title={proxyName}
              >
                {proxyName}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: 更新设计文档**

读 `docs/superpowers/specs/2026-04-20-idea-terminal-design.md` 开头，将状态行：

```markdown
**状态：** 草稿
```

替换为：

```markdown
**状态：** 实施中（Plan 1-4 已完成）

**实现进度：**
- ✅ Plan 1: 基础终端管理（PTY + xterm.js + 配置系统）
- ✅ Plan 2: 分屏 + 分组 + 快捷命令 + 命令面板
- ✅ Plan 3: AI Agent 集成（Claude / OpenAI / 自定义 API）
- ✅ Plan 4: 网络代理管理（per-session pty env 注入）
```

- [ ] **Step 4: 运行测试并构建**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal
npm test
```

预期：52 个测试全部通过。

```bash
npm run build
```

预期：三端构建成功，无 TypeScript 错误。

- [ ] **Step 5: 手动验证（npm run dev）**

```bash
npm run dev
```

验证清单：
- [ ] Sidebar 顶部出现代理选择下拉框（默认"无代理"）
- [ ] 点击 "+" 展开 ProxyForm，填写名称/类型/地址/端口 → 保存 → 代理出现在下拉框
- [ ] 选择代理后创建终端 → 在终端中执行 `echo $HTTP_PROXY` → 显示代理 URL
- [ ] 会话列表中该终端旁显示代理名称徽章（青色小标签）
- [ ] 不选代理创建终端 → `echo $HTTP_PROXY` 为空
- [ ] 选中已有代理时显示"删除"按钮，点击后代理从下拉框消失

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/Sidebar/GroupItem.tsx docs/superpowers/specs/2026-04-20-idea-terminal-design.md
git commit -m "feat: show proxy badge in session list and update design doc"
```

---

## 完成检查

Plan 4 交付后，应用具备：

- [x] `buildProxyEnv`：将 ProxyConfig 转换为 HTTP_PROXY / HTTPS_PROXY / NO_PROXY 等 env vars
- [x] 代理注入：创建终端时自动将代理 env 注入 pty 进程（覆盖 npm/git/curl/pip 等 CLI 工具）
- [x] 代理管理 UI：Sidebar 顶部可添加/删除/选择代理
- [x] 会话代理徽章：会话列表旁显示当前代理名称
- [x] 52 个单元测试全部通过
- [x] 设计文档状态更新

**下一步：** Plan 5 — 主题系统 / 会话持久化 / 其他 MVP 剩余功能
