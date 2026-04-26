# Proxy Restore on Session Restart — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pass the persisted `proxyId` to `window.api.create` during session restore so proxy environment variables are applied when the app restarts.

**Architecture:** One-line fix in `App.tsx`. The `proxyId` is already stored in session snapshots and the `terminal:create` IPC handler already accepts and applies it — it just wasn't being forwarded during restore.

**Tech Stack:** React 18, TypeScript, Electron IPC

---

### Task 1: Forward proxyId during session restore

**Files:**
- Modify: `src/renderer/src/App.tsx` (~line 40)

**Context:**

The restore loop in `App.tsx` calls `window.api.create(...)` to respawn PTY processes. The `proxyId` field is available on each snapshot (`snap.proxyId`) and is already passed to `addSession` right after, but it was never forwarded to `window.api.create`. The IPC handler in `src/main/ipc/handlers.ts` (line 25–36) already reads `options.proxyId`, looks up the proxy config, and builds the env vars — so no main-process changes are needed.

- [ ] **Step 1: Add `proxyId` to the `window.api.create` call**

In `src/renderer/src/App.tsx`, find the restore loop's `window.api.create` call (around line 40). The current code:

```typescript
const { pid } = await window.api.create({
  id: snap.id,
  cwd: snap.lastCwd,
  histCommands: snap.lastCommands
})
```

Change it to:

```typescript
const { pid } = await window.api.create({
  id: snap.id,
  cwd: snap.lastCwd,
  histCommands: snap.lastCommands,
  proxyId: snap.proxyId
})
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal && npm run build
```

Expected: Build succeeds with no TypeScript errors (all 3 bundles: main, preload, renderer).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "fix: forward proxyId to PTY create during session restore"
```
