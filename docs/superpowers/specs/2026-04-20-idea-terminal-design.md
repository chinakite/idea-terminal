# Idea Terminal — 设计文档

**日期：** 2026-04-20  
**状态：** 草稿

---

## 1. 项目背景与目标

随着 AI 工具 CLI 化趋势加剧（Claude Code、Codex、Gemini CLI 等），开发者需要频繁管理多个终端窗口。现有终端工具（系统终端、iTerm2、Windows Terminal）偏重命令行增强，缺乏统一的会话管理、AI 集成和代理管理能力。

**Idea Terminal** 是一款跨平台桌面终端管理应用，核心目标：

- 统一管理多个终端会话，支持分组和分屏
- 为每个终端绑定独立的网络代理配置
- 为每个终端绑定 AI Agent，支持中层 AI 辅助（UI 交互 + 命令发送）
- 提供快捷命令和命令面板，减少重复操作

**不在范围内（MVP）：**
- 终端录制/回放
- 远程 SSH 管理
- 终端内嵌 AI 深度感知（主动监控输出并自动操作）
- 社区主题市场

---

## 2. 技术选型

| 层级 | 技术 | 理由 |
|------|------|------|
| 桌面框架 | Electron | 跨平台（macOS/Windows/Linux），生态成熟 |
| 前端框架 | React + TypeScript | 组件化适合复杂 UI，生态资源丰富 |
| 终端渲染 | xterm.js | 业界标准，ANSI 兼容，支持插件 |
| 终端进程 | node-pty | 跨平台 PTY，与 xterm.js 黄金组合 |
| 状态管理 | Zustand | 轻量，适合中等复杂度状态 |
| 配置存储 | JSON 文件（userData 目录） | 简单够用，无需数据库 |
| 敏感数据 | Electron safeStorage API | API Key 加密存储 |
| 构建工具 | Vite + electron-vite | 快速热更新，开发体验好 |

---

## 3. 整体架构

```
┌─────────────────────────────────────────────────────┐
│  Electron Main Process (Node.js)                    │
│  ┌─────────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  node-pty   │  │ 配置管理  │  │  网络代理管理   │  │
│  │ (终端进程)   │  │ (JSON)   │  │ (env inject)   │  │
│  └─────────────┘  └──────────┘  └────────────────┘  │
│          │         IPC (contextBridge)               │
├──────────┼──────────────────────────────────────────┤
│  Renderer Process (React)                           │
│  ┌──────────────┐   ┌────────────────────────────┐  │
│  │  左侧面板     │   │  右侧主区域                  │  │
│  │  - 操作区    │   │  - 终端窗格（xterm.js）      │  │
│  │  - 分组列表  │   │  - 分屏管理                  │  │
│  │  - 快捷命令  │   │  - AI 交互面板               │  │
│  └──────────────┘   └────────────────────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │  命令面板（全局浮层，Cmd+K / Ctrl+K）            │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**原则：**
- Main Process 负责所有系统级操作：pty 进程管理、配置读写、代理注入、API 调用
- Renderer Process 纯 UI，通过 `contextBridge` 暴露的安全 API 与 Main 通信
- AI API 调用在 Main Process 执行，API Key 不暴露给 Renderer

---

## 4. UI 布局

采用**左右分栏 + 分屏**布局（方案 B）：

```
┌──────────────┬─────────────────────────────────────┐
│  左侧面板     │  终端窗格 1    │  终端窗格 2          │
│  (200px固定)  │                │                     │
│  ┌──────────┐ │  输出区域      │  输出区域            │
│  │ 操作区   │ │                │                     │
│  │新建/设置  │ ├────────────────┴─────────────────── │
│  └──────────┘ │  输入区                              │
│  ┌──────────┐ ├─────────────────────────────────────┤
│  │ 分组列表  │ │  AI 交互面板                        │
│  │ (树形)   │ │  模型选择 | 消息历史 | 输入框         │
│  └──────────┘ └─────────────────────────────────────┘
│  ┌──────────┐
│  │ 快捷命令  │
│  └──────────┘
└──────────────┘
```

- 左侧面板宽度固定 200px，可折叠
- 右侧终端区支持横向/纵向分屏，最多 4 个窗格（MVP）
- 单窗格时等同于方案 A（兼容单屏工作流）
- AI 面板高度可拖拽调整，可折叠隐藏

---

## 5. 核心数据模型

```typescript
// 分组配置（持久化）
interface TerminalGroup {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  defaultProxyId?: string
  defaultAiAgentId?: string
  sessions: TerminalSessionConfig[]
}

// 会话配置（持久化，启动参数）
interface TerminalSessionConfig {
  id: string
  title: string
  groupId: string
  cwd: string
  createdAt: number
  updatedAt: number
  proxyId?: string
  aiAgentId?: string
}

// 运行时会话（内存，不持久化）
interface TerminalSession {
  id: string
  pid: number
  ptyProcess: IPty
}

// 网络代理配置（持久化）
interface ProxyConfig {
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

// AI Agent 配置（持久化，API Key 加密）
interface AiAgentConfig {
  id: string
  name: string
  provider: 'claude' | 'openai' | 'custom'  // custom 遵循 OpenAI 兼容 API 格式
  apiKey: string        // 通过 safeStorage 加密存储
  model: string
  baseUrl?: string      // custom provider 的 API 端点
  systemPrompt?: string
  createdAt: number
  updatedAt: number
}

// 快捷命令（持久化）
interface QuickCommand {
  id: string
  label: string
  command: string
  createdAt: number
  updatedAt: number
}
```

---

## 6. AI Agent 集成

### 6.1 交互流程

```
用户输入
   │
   ▼
AI 面板（Renderer）
   │  IPC: ai:send-message { sessionId, message, includeTerminalContext }
   ▼
Main Process（调用 API，API Key 不暴露给 Renderer）
   │  HTTP Streaming → Claude / OpenAI / Custom API
   ▼
流式响应回传 IPC: ai:stream-chunk { delta }
   │
   ▼
AI 面板渲染消息，代码块显示"发送到终端"按钮
   │  用户点击确认
   ▼
IPC: terminal:send-input → pty.write()
```

### 6.2 设计原则

- **命令必须手动确认**：AI 返回的代码块识别为可执行命令，显示"发送到终端"按钮，不自动执行
- **流式输出**：AI 回复逐字渲染，体验流畅
- **独立对话历史**：每个终端会话维护独立的 AI 对话历史，切换终端时 AI 面板同步切换
- **终端上下文可选**：用户可通过"引用终端输出"开关，将当前终端最近 100 行输出附加到 AI 请求中

### 6.3 AI 面板 UI

```
┌─────────────────────────────────────┐
│ AI · Claude  [claude-sonnet-4-6 ▾]  │  ← 模型选择下拉
├─────────────────────────────────────┤
│ 消息历史区（可滚动）                  │
│  You: 帮我看看为什么 build 失败       │
│  AI: 根据终端输出，错误原因是...       │
│       [▶ 发送到终端: npm install]    │
├─────────────────────────────────────┤
│ [引用终端输出 ☑]  [输入框]  [发送]   │
└─────────────────────────────────────┘
```

---

## 7. 网络代理管理

通过给 pty 进程注入环境变量实现，不做全局流量劫持：

```typescript
function buildProxyEnv(proxy: ProxyConfig): Record<string, string> {
  const authUrl = proxy.username
    ? `${proxy.type}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
    : `${proxy.type}://${proxy.host}:${proxy.port}`
  return {
    HTTP_PROXY: authUrl,
    HTTPS_PROXY: authUrl,
    http_proxy: authUrl,
    https_proxy: authUrl,
    NO_PROXY: 'localhost,127.0.0.1',
  }
}
```

- 代理绑定粒度到**终端会话**，不同终端可走不同代理
- 分组可设默认代理，新建终端自动继承，可单独覆盖
- 左侧会话列表中用小图标标注代理状态
- 覆盖 99% CLI 工具（npm、git、curl、pip 等）

---

## 8. 命令面板 & 快捷命令

### 命令面板（全局浮层）

- 快捷键：`Cmd+K`（macOS）/ `Ctrl+K`（Windows/Linux）
- 功能：搜索并执行所有操作——切换终端、运行快捷命令、调整布局、打开设置
- 实现：模糊搜索，键盘导航，`Esc` 关闭

### 快捷命令（左侧面板底部）

- 用户自定义收藏的命令，以标签按钮形式展示
- 点击直接发送到当前激活终端
- 支持增删改，拖拽排序

---

## 9. 错误处理

| 场景 | 处理方式 |
|------|----------|
| pty 进程意外退出 | 会话标记为"已断开"，保留输出历史，提供"重新连接"按钮 |
| AI API 调用失败 | 面板内显示错误提示，不影响终端功能 |
| API Key 无效 | 提示用户前往设置页重新配置 |
| 代理连接失败 | 不阻断终端启动，在状态栏提示代理不可用 |
| 配置文件损坏 | 备份损坏文件，使用默认配置启动，提示用户 |

---

## 10. 测试策略

- **单元测试**：数据模型转换、代理环境变量构建、命令解析逻辑
- **集成测试**：IPC 通道（Main ↔ Renderer）、pty 进程启动/销毁、配置读写
- **手动测试**：三平台（macOS/Windows/Linux）终端渲染、分屏布局、AI 流式输出

---

## 11. 目录结构（规划）

```
idea-terminal/
├── src/
│   ├── main/                 # Electron Main Process
│   │   ├── pty/              # node-pty 封装
│   │   ├── config/           # 配置读写
│   │   ├── proxy/            # 代理管理
│   │   ├── ai/               # AI API 调用
│   │   └── ipc/              # IPC handlers
│   ├── renderer/             # React 前端
│   │   ├── components/
│   │   │   ├── Sidebar/      # 左侧面板
│   │   │   ├── Terminal/     # xterm.js 终端窗格
│   │   │   ├── SplitPane/    # 分屏管理
│   │   │   ├── AiPanel/      # AI 交互面板
│   │   │   └── CommandPalette/ # 命令面板
│   │   ├── store/            # Zustand 状态
│   │   └── types/            # TypeScript 类型
│   └── shared/               # Main/Renderer 共享类型
├── docs/
└── package.json
```
