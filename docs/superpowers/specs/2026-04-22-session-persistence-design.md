# Session Persistence Design Spec

**Date:** 2026-04-22
**Status:** Approved

---

## Overview

Persist terminal sessions across app restarts. When the app closes, each session's name, last working directory, and last 10 commands are saved to disk. On the next launch, all sessions are automatically restored: each PTY restarts in its last directory, and pressing ↑ in the shell immediately cycles through the saved commands.

---

## Data Model & Storage

A dedicated `sessions.json` file sits alongside `config.json` in Electron's `userData` directory:

- **macOS:** `~/Library/Application Support/idea-terminal/sessions.json`
- **Linux:** `~/.config/idea-terminal/sessions.json`

A new `SessionPersistenceManager` class in `src/main/session/` handles file I/O — the same pattern as the existing `ConfigManager`. If the file is missing (first run), an empty array is returned. If the file is corrupt, it is backed up and an empty array is returned.

**File format:**

```json
{
  "version": 1,
  "sessions": [
    {
      "id": "abc123",
      "title": "My Server",
      "groupId": "default",
      "proxyId": "proxy-1",
      "lastCwd": "/home/user/projects/idea-terminal",
      "lastCommands": ["git status", "npm run dev", "ls -la"]
    }
  ]
}
```

Each entry maps 1:1 to a `RuntimeSession` plus `lastCwd` and `lastCommands`. If a session's `groupId` no longer exists at restore time, the session is placed in the `default` group.

**TypeScript type** (added to `src/renderer/src/types/api.ts`):

```typescript
export interface PersistedSession {
  id: string
  title: string
  groupId: string
  proxyId?: string
  lastCwd: string
  lastCommands: string[]
}
```

---

## Command Tracking

Commands are captured in `TerminalPane.tsx` by hooking into the existing `term.onData` callback. A per-terminal `lineBuffer` string accumulates characters:

| Input | Action |
|---|---|
| `\r` (Enter) | Flush `lineBuffer` as a command if non-empty; clear buffer |
| `\x7f` (Backspace) | Trim last character from buffer |
| `\x1b...` (ANSI escape) | Ignore entirely (arrow keys, function keys, etc.) |
| Any other single printable character | Append to buffer |

Captured commands are stored in a new Zustand store `useCommandHistoryStore`, keyed by session ID:

```typescript
interface CommandHistoryStore {
  history: Record<string, string[]>   // sessionId → last 10 commands
  addCommand: (sessionId: string, cmd: string) => void
  clearSession: (sessionId: string) => void
}
```

The cap is 10 entries per session (oldest dropped when exceeded). The store is in-memory only; it is flushed to `sessions.json` on quit.

**Limitation:** Paste operations and multi-line inputs are captured as a single string. This is acceptable for "recent commands" context.

---

## CWD Tracking

node-pty does not expose the current working directory of a running process. The main process reads it at quit time using the PTY's `pid` via OS-level tools:

- **macOS:** `lsof -p <pid> -a -d cwd -Fn | grep '^n' | sed 's/^n//'`
- **Linux:** `readlink /proc/<pid>/cwd`
- **Windows:** Not supported — falls back to the session's initial `cwd`

A new `getCwd(sessionId: string): Promise<string>` method is added to `PtyManager`. Failures (process already dead, permission error, unsupported platform) silently fall back to the user's home directory. This method is called only from the quit handler in `src/main/index.ts` — it is not exposed as an IPC endpoint.

---

## History Injection on Restore

When a session is restored, the saved commands are written to a temporary file and injected via the shell's `HISTFILE` environment variable so ↑ works immediately:

1. `PtyManager.create()` receives an optional `histCommands?: string[]` parameter.
2. If `histCommands` is non-empty, the main process writes a temp file at `/tmp/idea-terminal-hist-<id>` with one command per line (plain text; both bash and zsh accept this format).
3. The PTY is spawned with extra env vars:
   ```
   HISTFILE=/tmp/idea-terminal-hist-<id>
   HISTSIZE=1000
   HISTFILESIZE=1000
   ```
4. The shell reads `HISTFILE` on startup — ↑ immediately cycles through saved commands.
5. The temp file is deleted in `PtyManager.destroy(id)`.

---

## Save Flow (on quit)

1. `app.on('before-quit')` fires in `src/main/index.ts`. The event is **`preventDefault()`'d** so the app waits for the async save to complete.
2. Main sends `app:will-quit` IPC event to the renderer window.
3. Renderer responds by collecting all sessions from `useSessionStore` and all commands from `useCommandHistoryStore`, then calls `window.api.saveSessionSnapshot(snapshots: PersistedSession[])` (without `lastCwd` — CWD is read by main).
4. Main's `session:save` handler:
   - Calls `PtyManager.getCwd(id)` for each snapshot to read the live CWD
   - Merges CWD into each snapshot
   - Writes the result to `sessions.json` via `SessionPersistenceManager`
5. Main calls `app.quit()` — the app exits normally.

A 2-second timeout guards the quit: if the renderer does not respond within 2 seconds (e.g. the window crashed), `app.quit()` is called unconditionally.

---

## Restore Flow (on startup)

1. `SessionPersistenceManager.load()` runs in `src/main/index.ts` synchronously before the main window is created. Snapshots are stored in a module-level variable.
2. A new IPC handler `session:load` returns the snapshots to the renderer on demand.
3. In `src/renderer/src/App.tsx`, after `useConfigStore.load()` completes, the renderer calls `window.api.loadSessionSnapshots()`.
4. If snapshots are returned:
   - For each snapshot, the renderer calls `window.api.create({ id, cwd: lastCwd, histCommands: lastCommands })`.
   - On success, calls `addSession({ id, title, groupId, pid, status: 'running', proxyId })`.
   - The first restored session is assigned to the active pane; subsequent sessions are available in the sidebar.
5. If no snapshots exist (first run or cleared), the existing default behaviour applies (no sessions created automatically).

---

## Files Affected

| File | Change |
|---|---|
| `src/main/session/SessionPersistenceManager.ts` | **New** — read/write `sessions.json`; backup on corruption |
| `src/main/pty/PtyManager.ts` | Add `getCwd(id)` method; accept `histCommands` in `create()`; delete temp hist file in `destroy()` |
| `src/main/ipc/handlers.ts` | Add `session:save` and `session:load` IPC handlers |
| `src/main/index.ts` | `before-quit` save flow with 2s timeout guard; startup `session:load` data |
| `src/preload/index.ts` | Expose `saveSessionSnapshot` and `loadSessionSnapshots` |
| `src/renderer/src/types/api.ts` | Add `PersistedSession` type; add new method signatures to `TerminalAPI` |
| `src/renderer/src/store/useCommandHistoryStore.ts` | **New** — Zustand store tracking last 10 commands per session |
| `src/renderer/src/components/Terminal/TerminalPane.tsx` | Hook command tracking into `term.onData` |
| `src/renderer/src/App.tsx` | Call `loadSessionSnapshots()` on startup and restore sessions |

---

## Out of Scope

- Restoring the split-pane layout (number and arrangement of panes)
- Persisting terminal scrollback buffer content
- Windows CWD tracking
- Per-session shell detection (plain-text history format is used universally)
