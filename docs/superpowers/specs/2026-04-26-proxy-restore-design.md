# Proxy Restore on Session Restart — Design Spec

## Goal

When sessions are restored on app startup, pass the persisted `proxyId` to the PTY creation call so the proxy environment variables are applied, restoring the proxy capability.

## Root Cause

`App.tsx` restore loop calls `window.api.create(...)` without `proxyId`. The field is stored in the snapshot and the IPC handler already supports it — it just wasn't being forwarded.

## Fix

One-line change in `src/renderer/src/App.tsx`:

```typescript
const { pid } = await window.api.create({
  id: snap.id,
  cwd: snap.lastCwd,
  histCommands: snap.lastCommands,
  proxyId: snap.proxyId          // add this
})
```

## Files

- Modify: `src/renderer/src/App.tsx` (restore loop, ~line 40)
