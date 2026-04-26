# IDEA Terminal

A terminal manager for developers who work with AI CLI tools — built with Electron, React, and xterm.js.

> Designed for workflows where you run multiple AI agents (Claude Code, OpenCode, Aider, etc.) in parallel and need to stay on top of which one is waiting for your input.

---

## Features

### Terminal Management
- **Multiple sessions** — Create and manage as many terminal sessions as you need
- **Session groups** — Organize terminals into named groups; new terminals inherit the active group
- **Split panes** — Split the workspace horizontally or vertically, drag dividers to resize
- **Drag & drop** — Reorder sessions within or across groups by dragging
- **Rename & close** — Rename sessions and groups inline; close sessions with ×

### Session Persistence
- Sessions are automatically saved and restored on restart
- Each session restores to its last working directory
- Last 10 commands are restored per session (fully isolated — no shared `~/.zsh_history`)

### Activity Notifications
- **Sidebar badge** — An orange pulsing dot appears on sessions that produced output while you were away
- **System notification** — After 2 seconds of silence, a macOS notification fires if the app is in the background
- Clicking the notification focuses the app and jumps to the relevant terminal
- Only triggers after you've visited a session at least once (no false positives on startup)

### Proxy Support
- Configure HTTP/SOCKS proxies and assign them per terminal session
- Proxy settings are persisted and restored with each session

### Built-in AI Panel
- Connect any OpenAI-compatible or Anthropic model as an AI agent
- Send messages with terminal output as context ("引用终端输出")
- AI code blocks can be sent directly to the active terminal with one click
- Per-session conversation history; multiple agents supported

### Command Palette
- `Cmd+K` — Quick access to all commands: new terminal, split, switch session, etc.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+K` | Open command palette |
| `Cmd+D` | Split pane horizontally |
| `Cmd+Shift+D` | Split pane vertically |
| `Cmd+W` | Close current pane |

---

## Getting Started

### Prerequisites

- Node.js 18+
- macOS (primary platform; Linux untested)

### Install & Run

```bash
git clone https://github.com/chinakite/idea-terminal.git
cd idea-terminal
npm install
npm run dev
```

### Build

```bash
npm run package
```

The packaged app is output to `dist/`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Shell | Electron 28 |
| UI | React 18 + TypeScript |
| Terminal | xterm.js + node-pty |
| State | Zustand |
| Build | electron-vite + electron-builder |
| Tests | Vitest |
| AI | Anthropic SDK + OpenAI SDK |

---

## Project Structure

```
src/
  main/           # Electron main process
    pty/          # PTY process management (node-pty)
    ai/           # AI streaming (Anthropic / OpenAI)
    session/      # Session persistence
    proxy/        # Proxy environment injection
  renderer/
    src/
      components/
        Terminal/ # Split pane layout + xterm rendering
        Sidebar/  # Session list, groups, drag & drop
        AiPanel/  # AI chat panel
        CommandPalette/
      store/      # Zustand stores
tests/            # Vitest unit tests
```

---

## License

MIT
