# Plan 2: Split Pane, Groups, Quick Commands & Command Palette

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Plan 1 基础上增加分屏终端布局（最多 4 个横向窗格）、侧边栏分组管理、快捷命令面板，以及全局命令面板（Cmd+K）。

**Architecture:** `useSplitStore` 管理窗格布局和会话分配（最多 4 个横向窗格）；`useConfigStore` 通过现有 IPC 层持久化分组和快捷命令；`CommandPalette` 是全局 React 覆盖层，内置命令注册表。`App.tsx` 用 `SplitPane` 替换原有单一终端区域，移除 `TerminalTabs`。

**Tech Stack:** React 18, Zustand, xterm.js，已有 IPC 层（window.api），Vitest

---

## 文件结构

```
src/renderer/src/
├── store/
│   ├── useSessionStore.ts        (已有，不修改)
│   ├── useSplitStore.ts          (新建) — 窗格布局 & 会话分配
│   └── useConfigStore.ts         (新建) — 分组/快捷命令持久化，通过 IPC
├── components/
│   ├── Terminal/
│   │   ├── TerminalPane.tsx      (已有，不修改)
│   │   ├── TerminalTabs.tsx      (已有，App.tsx 中不再使用)
│   │   └── SplitPane.tsx         (新建) — 多窗格容器
│   ├── Sidebar/
│   │   ├── Sidebar.tsx           (修改) — 集成分组 + 快捷命令
│   │   ├── GroupItem.tsx         (新建) — 可折叠分组行
│   │   └── QuickCommands.tsx     (新建) — 底部快捷命令面板
│   └── CommandPalette/
│       └── CommandPalette.tsx    (新建) — 全局搜索覆盖层
└── App.tsx                       (修改) — 集成 SplitPane + CommandPalette + 启动加载
tests/
├── renderer/
│   └── store/
│       ├── useSplitStore.test.ts (新建)
│       └── useConfigStore.test.ts(新建)
└── vitest.config.ts              (修改) — 覆盖率加入 renderer/store
```

---

## Task 1: useSplitStore（TDD）

**Files:**
- Create: `src/renderer/src/store/useSplitStore.ts`
- Create: `tests/renderer/store/useSplitStore.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// tests/renderer/store/useSplitStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useSplitStore } from '../../../src/renderer/src/store/useSplitStore'

describe('useSplitStore', () => {
  beforeEach(() => {
    useSplitStore.setState({
      panes: [{ id: 'p1', sessionId: null }],
      activePaneId: 'p1'
    })
  })

  it('starts with one empty pane', () => {
    const { panes, activePaneId } = useSplitStore.getState()
    expect(panes).toHaveLength(1)
    expect(panes[0].sessionId).toBeNull()
    expect(activePaneId).toBe('p1')
  })

  it('addPane adds a pane and makes it active', () => {
    const id = useSplitStore.getState().addPane('s1')
    const { panes, activePaneId } = useSplitStore.getState()
    expect(panes).toHaveLength(2)
    expect(panes[1].sessionId).toBe('s1')
    expect(activePaneId).toBe(id)
  })

  it('addPane returns null when 4 panes exist', () => {
    useSplitStore.setState({
      panes: [
        { id: 'p1', sessionId: null },
        { id: 'p2', sessionId: null },
        { id: 'p3', sessionId: null },
        { id: 'p4', sessionId: null }
      ],
      activePaneId: 'p1'
    })
    const result = useSplitStore.getState().addPane()
    expect(result).toBeNull()
  })

  it('removePane removes pane and updates active', () => {
    useSplitStore.setState({
      panes: [{ id: 'p1', sessionId: 's1' }, { id: 'p2', sessionId: 's2' }],
      activePaneId: 'p1'
    })
    useSplitStore.getState().removePane('p1')
    const { panes, activePaneId } = useSplitStore.getState()
    expect(panes).toHaveLength(1)
    expect(activePaneId).toBe('p2')
  })

  it('removePane keeps at least one pane', () => {
    useSplitStore.getState().removePane('p1')
    expect(useSplitStore.getState().panes).toHaveLength(1)
  })

  it('assignSession updates pane sessionId', () => {
    useSplitStore.getState().assignSession('p1', 's99')
    expect(useSplitStore.getState().panes[0].sessionId).toBe('s99')
  })

  it('clearSession nullifies matching pane', () => {
    useSplitStore.setState({
      panes: [{ id: 'p1', sessionId: 's1' }, { id: 'p2', sessionId: 's2' }],
      activePaneId: 'p1'
    })
    useSplitStore.getState().clearSession('s1')
    const { panes } = useSplitStore.getState()
    expect(panes[0].sessionId).toBeNull()
    expect(panes[1].sessionId).toBe('s2')
  })

  it('getActivePaneSessionId returns active pane session', () => {
    useSplitStore.setState({
      panes: [{ id: 'p1', sessionId: 'sess-abc' }],
      activePaneId: 'p1'
    })
    expect(useSplitStore.getState().getActivePaneSessionId()).toBe('sess-abc')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
npm test
```

预期：FAIL — `Cannot find module '../../../src/renderer/src/store/useSplitStore'`

- [ ] **Step 3: 实现 useSplitStore**

```typescript
// src/renderer/src/store/useSplitStore.ts
import { create } from 'zustand'

export interface Pane {
  id: string
  sessionId: string | null
}

interface SplitStore {
  panes: Pane[]
  activePaneId: string | null
  addPane: (sessionId?: string) => string | null
  removePane: (paneId: string) => void
  setActivePane: (paneId: string) => void
  assignSession: (paneId: string, sessionId: string) => void
  clearSession: (sessionId: string) => void
  getActivePaneSessionId: () => string | null
}

const genId = (): string => Math.random().toString(36).slice(2, 10)

const initialPaneId = genId()

export const useSplitStore = create<SplitStore>((set, get) => ({
  panes: [{ id: initialPaneId, sessionId: null }],
  activePaneId: initialPaneId,

  addPane: (sessionId) => {
    if (get().panes.length >= 4) return null
    const id = genId()
    set((state) => ({
      panes: [...state.panes, { id, sessionId: sessionId ?? null }],
      activePaneId: id
    }))
    return id
  },

  removePane: (paneId) => {
    set((state) => {
      if (state.panes.length <= 1) return state
      const remaining = state.panes.filter((p) => p.id !== paneId)
      const newActive =
        state.activePaneId === paneId
          ? remaining[remaining.length - 1].id
          : state.activePaneId
      return { panes: remaining, activePaneId: newActive }
    })
  },

  setActivePane: (paneId) => set({ activePaneId: paneId }),

  assignSession: (paneId, sessionId) => {
    set((state) => ({
      panes: state.panes.map((p) => (p.id === paneId ? { ...p, sessionId } : p))
    }))
  },

  clearSession: (sessionId) => {
    set((state) => ({
      panes: state.panes.map((p) =>
        p.sessionId === sessionId ? { ...p, sessionId: null } : p
      )
    }))
  },

  getActivePaneSessionId: () => {
    const { panes, activePaneId } = get()
    return panes.find((p) => p.id === activePaneId)?.sessionId ?? null
  }
}))
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
npm test
```

预期：PASS — 新增 8 个测试，总计 20 个。

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/store/useSplitStore.ts tests/renderer/store/useSplitStore.test.ts
git commit -m "feat: add useSplitStore for split pane layout management"
```

---

## Task 2: useConfigStore（TDD）

**Files:**
- Modify: `tests/vitest.config.ts`
- Create: `src/renderer/src/store/useConfigStore.ts`
- Create: `tests/renderer/store/useConfigStore.test.ts`

- [ ] **Step 1: 更新 vitest.config.ts 覆盖率范围**

```typescript
// tests/vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/main/**/*.ts', 'src/renderer/src/store/**/*.ts']
    }
  }
})
```

- [ ] **Step 2: 写失败测试**

```typescript
// tests/renderer/store/useConfigStore.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DEFAULT_CONFIG } from '../../../src/shared/types'

const mockApi = {
  loadConfig: vi.fn().mockResolvedValue(structuredClone(DEFAULT_CONFIG)),
  saveConfig: vi.fn().mockResolvedValue(undefined)
}

vi.stubGlobal('window', { api: mockApi })

// Import AFTER stubbing global so the store sees window.api
const { useConfigStore } = await import('../../../src/renderer/src/store/useConfigStore')

describe('useConfigStore', () => {
  beforeEach(() => {
    useConfigStore.setState({ config: structuredClone(DEFAULT_CONFIG), isLoaded: false })
    vi.clearAllMocks()
  })

  it('load calls window.api.loadConfig and sets isLoaded', async () => {
    await useConfigStore.getState().load()
    expect(mockApi.loadConfig).toHaveBeenCalledOnce()
    expect(useConfigStore.getState().isLoaded).toBe(true)
  })

  it('addGroup adds a group and saves', () => {
    const group = useConfigStore.getState().addGroup('Project A')
    const { config } = useConfigStore.getState()
    expect(config.groups).toHaveLength(1)
    expect(config.groups[0].name).toBe('Project A')
    expect(group.id).toBeTruthy()
    expect(mockApi.saveConfig).toHaveBeenCalledOnce()
  })

  it('renameGroup updates name and saves', () => {
    const group = useConfigStore.getState().addGroup('Old Name')
    vi.clearAllMocks()
    useConfigStore.getState().renameGroup(group.id, 'New Name')
    expect(useConfigStore.getState().config.groups[0].name).toBe('New Name')
    expect(mockApi.saveConfig).toHaveBeenCalledOnce()
  })

  it('removeGroup removes by id and saves', () => {
    const group = useConfigStore.getState().addGroup('Temp')
    vi.clearAllMocks()
    useConfigStore.getState().removeGroup(group.id)
    expect(useConfigStore.getState().config.groups).toHaveLength(0)
    expect(mockApi.saveConfig).toHaveBeenCalledOnce()
  })

  it('addQuickCommand adds and saves', () => {
    const qc = useConfigStore.getState().addQuickCommand('List files', 'ls -la')
    expect(useConfigStore.getState().config.quickCommands).toHaveLength(1)
    expect(qc.command).toBe('ls -la')
    expect(mockApi.saveConfig).toHaveBeenCalledOnce()
  })

  it('removeQuickCommand removes by id and saves', () => {
    const qc = useConfigStore.getState().addQuickCommand('List files', 'ls -la')
    vi.clearAllMocks()
    useConfigStore.getState().removeQuickCommand(qc.id)
    expect(useConfigStore.getState().config.quickCommands).toHaveLength(0)
    expect(mockApi.saveConfig).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 3: 运行测试，确认失败**

```bash
npm test
```

预期：FAIL — `Cannot find module '../../../src/renderer/src/store/useConfigStore'`

- [ ] **Step 4: 实现 useConfigStore**

```typescript
// src/renderer/src/store/useConfigStore.ts
import { create } from 'zustand'
import { AppConfig, DEFAULT_CONFIG, TerminalGroup, QuickCommand } from '../../../shared/types'

const genId = (): string => Math.random().toString(36).slice(2, 10)

interface ConfigStore {
  config: AppConfig
  isLoaded: boolean
  load: () => Promise<void>
  save: () => Promise<void>
  addGroup: (name: string) => TerminalGroup
  renameGroup: (id: string, name: string) => void
  removeGroup: (id: string) => void
  addQuickCommand: (label: string, command: string) => QuickCommand
  removeQuickCommand: (id: string) => void
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: structuredClone(DEFAULT_CONFIG),
  isLoaded: false,

  load: async () => {
    const config = await window.api.loadConfig()
    set({ config, isLoaded: true })
  },

  save: async () => {
    await window.api.saveConfig(get().config)
  },

  addGroup: (name) => {
    const now = Date.now()
    const group: TerminalGroup = {
      id: genId(),
      name,
      createdAt: now,
      updatedAt: now,
      sessions: []
    }
    set((state) => ({
      config: { ...state.config, groups: [...state.config.groups, group] }
    }))
    get().save()
    return group
  },

  renameGroup: (id, name) => {
    set((state) => ({
      config: {
        ...state.config,
        groups: state.config.groups.map((g) =>
          g.id === id ? { ...g, name, updatedAt: Date.now() } : g
        )
      }
    }))
    get().save()
  },

  removeGroup: (id) => {
    set((state) => ({
      config: {
        ...state.config,
        groups: state.config.groups.filter((g) => g.id !== id)
      }
    }))
    get().save()
  },

  addQuickCommand: (label, command) => {
    const now = Date.now()
    const qc: QuickCommand = { id: genId(), label, command, createdAt: now, updatedAt: now }
    set((state) => ({
      config: { ...state.config, quickCommands: [...state.config.quickCommands, qc] }
    }))
    get().save()
    return qc
  },

  removeQuickCommand: (id) => {
    set((state) => ({
      config: {
        ...state.config,
        quickCommands: state.config.quickCommands.filter((q) => q.id !== id)
      }
    }))
    get().save()
  }
}))
```

- [ ] **Step 5: 运行测试，确认通过**

```bash
npm test
```

预期：PASS — 总计 26 个测试全部通过。

- [ ] **Step 6: Commit**

```bash
git add tests/vitest.config.ts src/renderer/src/store/useConfigStore.ts tests/renderer/store/useConfigStore.test.ts
git commit -m "feat: add useConfigStore for persistent groups and quick commands"
```

---

## Task 3: SplitPane 组件

**Files:**
- Create: `src/renderer/src/components/Terminal/SplitPane.tsx`

- [ ] **Step 1: 实现 SplitPane**

```tsx
// src/renderer/src/components/Terminal/SplitPane.tsx
import { useSessionStore } from '../../store/useSessionStore'
import { useSplitStore } from '../../store/useSplitStore'
import { TerminalPane } from './TerminalPane'

export function SplitPane(): JSX.Element {
  const { panes, activePaneId, addPane, removePane, setActivePane } = useSplitStore()
  const sessions = useSessionStore((s) => s.sessions)

  const getSessionTitle = (sessionId: string | null): string => {
    if (!sessionId) return '空白'
    return sessions.find((s) => s.id === sessionId)?.title ?? '空白'
  }

  const handleAddPane = (): void => {
    addPane()
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {panes.map((pane, index) => {
        const isActive = pane.id === activePaneId
        return (
          <div
            key={pane.id}
            onClick={() => setActivePane(pane.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              borderLeft: index > 0 ? '2px solid #21262d' : 'none',
              outline: isActive && panes.length > 1 ? '1px solid #0f3460' : 'none',
              outlineOffset: '-1px',
              overflow: 'hidden'
            }}
          >
            {/* Pane header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              height: '28px',
              backgroundColor: isActive ? '#161b22' : '#0d1117',
              borderBottom: '1px solid #21262d',
              padding: '0 8px',
              gap: '6px',
              flexShrink: 0,
              userSelect: 'none'
            }}>
              <span style={{ flex: 1, fontSize: '11px', color: '#768390', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getSessionTitle(pane.sessionId)}
              </span>

              {/* 添加窗格按钮（最多 4 个） */}
              {panes.length < 4 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleAddPane() }}
                  title="新增分屏"
                  style={{
                    background: 'none', border: 'none', color: '#768390',
                    cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px'
                  }}
                >
                  ⊕
                </button>
              )}

              {/* 关闭窗格按钮（至少保留 1 个） */}
              {panes.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); removePane(pane.id) }}
                  title="关闭窗格"
                  style={{
                    background: 'none', border: 'none', color: '#768390',
                    cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '0 2px'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#f85149')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#768390')}
                >
                  ×
                </button>
              )}
            </div>

            {/* Terminal content */}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              {pane.sessionId ? (
                <TerminalPane sessionId={pane.sessionId} isActive={isActive} />
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: '100%', color: '#768390', fontSize: '13px',
                  flexDirection: 'column', gap: '8px'
                }}>
                  <span>空白窗格</span>
                  <span style={{ fontSize: '11px', color: '#484f58' }}>从左侧列表点击会话即可显示</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: 运行测试确认未破坏已有测试**

```bash
npm test
```

预期：PASS — 仍为 26 个测试通过。

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/Terminal/SplitPane.tsx
git commit -m "feat: add SplitPane component for multi-pane terminal layout"
```

---

## Task 4: GroupItem 组件

**Files:**
- Create: `src/renderer/src/components/Sidebar/GroupItem.tsx`

- [ ] **Step 1: 实现 GroupItem**

```tsx
// src/renderer/src/components/Sidebar/GroupItem.tsx
import { useState } from 'react'
import { RuntimeSession } from '../../store/useSessionStore'
import { useSplitStore } from '../../store/useSplitStore'

interface GroupItemProps {
  groupId: string
  groupName: string
  sessions: RuntimeSession[]
  activePaneId: string | null
}

export function GroupItem({ groupId, groupName, sessions, activePaneId }: GroupItemProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const { panes, assignSession, setActivePane, getActivePaneSessionId } = useSplitStore()

  const handleSessionClick = (sessionId: string): void => {
    // 已在某个窗格中 → 激活那个窗格
    const existingPane = panes.find((p) => p.sessionId === sessionId)
    if (existingPane) {
      setActivePane(existingPane.id)
      return
    }
    // 否则分配到当前激活窗格
    if (activePaneId) {
      assignSession(activePaneId, sessionId)
    }
  }

  const isSessionActive = (sessionId: string): boolean =>
    getActivePaneSessionId() === sessionId

  return (
    <div style={{ marginBottom: '4px' }}>
      {/* 分组标题行 */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '3px 6px', cursor: 'pointer', userSelect: 'none',
          color: '#8892a4', fontSize: '10px', letterSpacing: '0.5px',
          borderRadius: '3px'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0f3460')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span style={{ fontSize: '9px' }}>{collapsed ? '▶' : '▼'}</span>
        <span style={{ textTransform: 'uppercase' }}>{groupName}</span>
        <span style={{ marginLeft: 'auto', color: '#484f58' }}>{sessions.length}</span>
      </div>

      {/* 会话列表 */}
      {!collapsed && sessions.map((session) => (
        <div
          key={session.id}
          onClick={() => handleSessionClick(session.id)}
          style={{
            padding: '4px 8px 4px 16px',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px',
            color: isSessionActive(session.id) ? '#ccd6f6' : '#8892a4',
            backgroundColor: isSessionActive(session.id) ? '#0f3460' : 'transparent',
            display: 'flex', alignItems: 'center', gap: '6px',
            marginBottom: '1px'
          }}
          onMouseEnter={(e) => {
            if (!isSessionActive(session.id))
              e.currentTarget.style.backgroundColor = '#1c2128'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isSessionActive(session.id)
              ? '#0f3460' : 'transparent'
          }}
        >
          <span style={{ color: session.status === 'disconnected' ? '#f85149' : '#64ffda', fontSize: '8px' }}>
            ●
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.title}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 运行测试**

```bash
npm test
```

预期：PASS — 26 个测试。

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/Sidebar/GroupItem.tsx
git commit -m "feat: add GroupItem collapsible sidebar group component"
```

---

## Task 5: QuickCommands 组件

**Files:**
- Create: `src/renderer/src/components/Sidebar/QuickCommands.tsx`

- [ ] **Step 1: 实现 QuickCommands**

```tsx
// src/renderer/src/components/Sidebar/QuickCommands.tsx
import { useState } from 'react'
import { useConfigStore } from '../../store/useConfigStore'
import { useSplitStore } from '../../store/useSplitStore'

export function QuickCommands(): JSX.Element {
  const { config, addQuickCommand, removeQuickCommand } = useConfigStore()
  const getActivePaneSessionId = useSplitStore((s) => s.getActivePaneSessionId)
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [command, setCommand] = useState('')

  const handleRun = (cmd: string): void => {
    const sessionId = getActivePaneSessionId()
    if (sessionId) window.api.write(sessionId, cmd + '\r')
  }

  const handleAdd = (): void => {
    if (label.trim() && command.trim()) {
      addQuickCommand(label.trim(), command.trim())
      setLabel('')
      setCommand('')
      setAdding(false)
    }
  }

  return (
    <div style={{
      borderTop: '1px solid #0f3460',
      padding: '8px',
      flexShrink: 0
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '6px'
      }}>
        <span style={{ color: '#8892a4', fontSize: '10px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          快捷命令
        </span>
        <button
          onClick={() => setAdding(!adding)}
          style={{
            background: 'none', border: 'none', color: '#8892a4',
            cursor: 'pointer', fontSize: '14px', lineHeight: 1
          }}
          title="添加快捷命令"
        >
          {adding ? '×' : '+'}
        </button>
      </div>

      {/* 添加表单 */}
      {adding && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '6px' }}>
          <input
            placeholder="标签（如：Git 状态）"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{
              backgroundColor: '#0d1117', border: '1px solid #30363d',
              borderRadius: '3px', color: '#cdd9e5', fontSize: '11px',
              padding: '3px 6px', outline: 'none'
            }}
          />
          <input
            placeholder="命令（如：git status）"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            style={{
              backgroundColor: '#0d1117', border: '1px solid #30363d',
              borderRadius: '3px', color: '#cdd9e5', fontSize: '11px',
              padding: '3px 6px', outline: 'none'
            }}
          />
          <button
            onClick={handleAdd}
            style={{
              backgroundColor: '#0f3460', border: 'none', borderRadius: '3px',
              color: '#a8b2d8', fontSize: '11px', padding: '3px', cursor: 'pointer'
            }}
          >
            保存
          </button>
        </div>
      )}

      {/* 命令按钮列表 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {config.quickCommands.map((qc) => (
          <div key={qc.id} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => handleRun(qc.command)}
              title={qc.command}
              style={{
                backgroundColor: '#0f3460', border: 'none', borderRadius: '3px 0 0 3px',
                color: '#64ffda', fontSize: '10px', padding: '3px 6px',
                cursor: 'pointer', maxWidth: '80px', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}
            >
              {qc.label}
            </button>
            <button
              onClick={() => removeQuickCommand(qc.id)}
              style={{
                backgroundColor: '#0f3460', border: 'none', borderRadius: '0 3px 3px 0',
                color: '#484f58', fontSize: '10px', padding: '3px 4px',
                cursor: 'pointer', borderLeft: '1px solid #1c2128'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#f85149')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#484f58')}
            >
              ×
            </button>
          </div>
        ))}
        {config.quickCommands.length === 0 && !adding && (
          <span style={{ color: '#484f58', fontSize: '10px' }}>点击 + 添加</span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 运行测试**

```bash
npm test
```

预期：PASS — 26 个测试。

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/Sidebar/QuickCommands.tsx
git commit -m "feat: add QuickCommands sidebar panel"
```

---

## Task 6: CommandPalette 组件

**Files:**
- Create: `src/renderer/src/components/CommandPalette/CommandPalette.tsx`

- [ ] **Step 1: 实现 CommandPalette**

```tsx
// src/renderer/src/components/CommandPalette/CommandPalette.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSessionStore } from '../../store/useSessionStore'
import { useConfigStore } from '../../store/useConfigStore'
import { useSplitStore } from '../../store/useSplitStore'

interface Command {
  id: string
  label: string
  description?: string
  action: () => void
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps): JSX.Element | null {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const sessions = useSessionStore((s) => s.sessions)
  const addSession = useSessionStore((s) => s.addSession)
  const { config } = useConfigStore()
  const { panes, activePaneId, addPane, removePane, assignSession, getActivePaneSessionId } =
    useSplitStore()

  const buildCommands = useCallback((): Command[] => {
    const cmds: Command[] = []

    // 新建终端
    cmds.push({
      id: 'new-terminal',
      label: '新建终端',
      description: '在当前窗格或新窗格中创建终端',
      action: async () => {
        const id = generateId()
        const homedir = await window.api.getHomedir()
        const { pid } = await window.api.create({ id, cwd: homedir })
        const sessionNum = sessions.length + 1
        addSession({ id, title: `终端 ${sessionNum}`, groupId: 'default', pid, status: 'running' })
        // 分配到空白窗格，或激活窗格
        const emptyPane = panes.find((p) => !p.sessionId)
        if (emptyPane) {
          assignSession(emptyPane.id, id)
        } else if (activePaneId) {
          assignSession(activePaneId, id)
        }
        onClose()
      }
    })

    // 分割窗格
    if (panes.length < 4) {
      cmds.push({
        id: 'split-pane',
        label: '新增分屏窗格',
        description: `当前 ${panes.length} 个窗格，最多 4 个`,
        action: () => { addPane(); onClose() }
      })
    }

    // 关闭当前窗格
    if (panes.length > 1 && activePaneId) {
      cmds.push({
        id: 'close-pane',
        label: '关闭当前窗格',
        action: () => { removePane(activePaneId); onClose() }
      })
    }

    // 切换到会话
    sessions.forEach((session) => {
      cmds.push({
        id: `switch-${session.id}`,
        label: `切换到：${session.title}`,
        description: session.status === 'disconnected' ? '已断开' : '运行中',
        action: () => {
          const pane = panes.find((p) => p.sessionId === session.id)
          if (pane) {
            useSplitStore.getState().setActivePane(pane.id)
          } else if (activePaneId) {
            assignSession(activePaneId, session.id)
          }
          onClose()
        }
      })
    })

    // 运行快捷命令
    config.quickCommands.forEach((qc) => {
      cmds.push({
        id: `qc-${qc.id}`,
        label: `运行：${qc.label}`,
        description: qc.command,
        action: () => {
          const sessionId = getActivePaneSessionId()
          if (sessionId) window.api.write(sessionId, qc.command + '\r')
          onClose()
        }
      })
    })

    return cmds
  }, [sessions, config.quickCommands, panes, activePaneId])

  const filtered = buildCommands().filter(
    (c) =>
      !query ||
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.description?.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      filtered[selectedIndex]?.action()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!open) return null

  return (
    <>
      {/* 背景遮罩 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100
        }}
      />
      {/* 面板 */}
      <div style={{
        position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: '500px', maxWidth: '90vw', backgroundColor: '#161b22',
        border: '1px solid #30363d', borderRadius: '8px', zIndex: 101,
        overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
      }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入命令或搜索..."
          style={{
            width: '100%', padding: '12px 16px', backgroundColor: 'transparent',
            border: 'none', borderBottom: '1px solid #30363d', color: '#cdd9e5',
            fontSize: '14px', outline: 'none', boxSizing: 'border-box'
          }}
        />
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ padding: '12px 16px', color: '#768390', fontSize: '13px' }}>
              无匹配命令
            </div>
          )}
          {filtered.map((cmd, i) => (
            <div
              key={cmd.id}
              onClick={cmd.action}
              style={{
                padding: '8px 16px', cursor: 'pointer',
                backgroundColor: i === selectedIndex ? '#0f3460' : 'transparent',
                borderBottom: '1px solid #21262d'
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <div style={{ fontSize: '13px', color: '#cdd9e5' }}>{cmd.label}</div>
              {cmd.description && (
                <div style={{ fontSize: '11px', color: '#768390', marginTop: '2px' }}>
                  {cmd.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: 运行测试**

```bash
npm test
```

预期：PASS — 26 个测试。

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/CommandPalette/CommandPalette.tsx
git commit -m "feat: add CommandPalette with fuzzy search and keyboard navigation"
```

---

## Task 7: 更新 Sidebar

**Files:**
- Modify: `src/renderer/src/components/Sidebar/Sidebar.tsx`

- [ ] **Step 1: 替换 Sidebar 内容**

```tsx
// src/renderer/src/components/Sidebar/Sidebar.tsx
import { useState } from 'react'
import { useSessionStore } from '../../store/useSessionStore'
import { useSplitStore } from '../../store/useSplitStore'
import { GroupItem } from './GroupItem'
import { QuickCommands } from './QuickCommands'

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function Sidebar(): JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const addSession = useSessionStore((s) => s.addSession)
  const { panes, activePaneId, assignSession, addPane } = useSplitStore()
  const [isCreating, setIsCreating] = useState(false)

  const handleNewTerminal = async (): Promise<void> => {
    if (isCreating) return
    setIsCreating(true)
    try {
      const id = generateId()
      const homedir = await window.api.getHomedir()
      const { pid } = await window.api.create({ id, cwd: homedir })
      const sessionNum = sessions.length + 1
      addSession({ id, title: `终端 ${sessionNum}`, groupId: 'default', pid, status: 'running' })

      // 优先放入空白窗格，否则分配到激活窗格，否则新建窗格
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

  // 按 groupId 分组（默认分组收纳无分组会话）
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

      {/* 会话列表（分组） */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 4px' }}>
        <GroupItem
          groupId="default"
          groupName="会话"
          sessions={defaultSessions}
          activePaneId={activePaneId}
        />
      </div>

      {/* 快捷命令 */}
      <QuickCommands />
    </div>
  )
}
```

- [ ] **Step 2: 运行测试**

```bash
npm test
```

预期：PASS — 26 个测试。

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/Sidebar/Sidebar.tsx
git commit -m "feat: update Sidebar with GroupItem and QuickCommands"
```

---

## Task 8: App.tsx 集成

**Files:**
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: 替换 App.tsx**

```tsx
// src/renderer/src/App.tsx
import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar/Sidebar'
import { SplitPane } from './components/Terminal/SplitPane'
import { CommandPalette } from './components/CommandPalette/CommandPalette'
import { useConfigStore } from './store/useConfigStore'
import { useSplitStore } from './store/useSplitStore'

export default function App(): JSX.Element {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const loadConfig = useConfigStore((s) => s.load)
  const panes = useSplitStore((s) => s.panes)

  // 启动时加载持久化配置
  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  // 全局快捷键：Cmd+K / Ctrl+K 打开命令面板
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
        {panes.every((p) => !p.sessionId) && panes.length === 1 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: '#768390', fontSize: '14px',
            flexDirection: 'column', gap: '8px'
          }}>
            <span>点击"＋ 新建终端"开始</span>
            <span style={{ fontSize: '12px', color: '#484f58' }}>Cmd+K 打开命令面板</span>
          </div>
        ) : (
          <SplitPane />
        )}
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

预期：PASS — 26 个测试全部通过。

- [ ] **Step 3: 构建验证**

```bash
npm run build
```

预期：三端（main/preload/renderer）全部构建成功，无 TypeScript 错误。

- [ ] **Step 4: 手动验证（npm run dev）**

验证清单：
- [ ] 点击"＋ 新建终端" → 终端出现在左侧窗格，左侧列表也显示该会话
- [ ] 点击窗格头部的 ⊕ 按钮 → 新增空白窗格（最多 4 个）
- [ ] 再次点击"＋ 新建终端" → 新终端自动填入空白窗格
- [ ] 点击窗格头部 × → 关闭该窗格
- [ ] 在快捷命令区点击 + → 填写标签和命令 → 保存 → 出现按钮
- [ ] 点击快捷命令按钮 → 命令发送到当前激活终端
- [ ] `Cmd+K` → 打开命令面板 → 搜索"分屏" → 按回车执行
- [ ] `Esc` → 关闭命令面板

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat: integrate SplitPane and CommandPalette into App, load config on startup"
```

---

## 完成检查

Plan 2 交付后，应用具备：

- [x] 横向分屏，最多 4 个窗格
- [x] 每个窗格独立显示一个终端会话
- [x] 从侧边栏会话列表点击 → 分配到激活窗格
- [x] 快捷命令面板：添加/删除/点击发送到终端
- [x] 全局命令面板（Cmd+K）：新建终端、分屏、切换会话、运行快捷命令
- [x] 配置持久化（快捷命令跨重启保留）
- [x] 26 个单元测试全部通过

**下一步：** Plan 3 — AI Agent 集成（AI 交互面板 + 命令发送）
