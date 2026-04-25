# Close Session Button — Design Spec

## Goal

Add a close (×) button to each session row in the sidebar so users can close terminals without having to delete the entire group.

## Architecture

Single-file change: `GroupItem.tsx`. All required store methods (`clearSession`, `assignSession`, `closeSession`) and the IPC call (`window.api.destroy`) already exist. No new store methods or IPC handlers needed.

## UI

- The `×` button appears on hover, next to the existing `✏` rename button.
- Button order on hover: `✏ ×` (then proxy badge on the far right, unchanged).
- No confirmation dialog — close is immediate, like closing a browser tab.
- Hover color: `#484f58` at rest, `#f85149` on mouse-enter (same red as the group delete button).

## Close Logic

```
handleCloseSession(session):
  1. leaves = collectLeaves()
  2. pane = leaves.find(l => l.sessionId === session.id)   // pane currently showing this session, or null
  3. remaining = all sessions except this one (from useSessionStore.getState())

  4. if pane exists:
       if remaining.length > 0:
         // Pick adjacent session: next in same group, else previous, else first of remaining
         next = sessions[currentIdx + 1] ?? sessions[currentIdx - 1] ?? remaining[0]
         assignSession(pane.id, next.id)    // pane now shows next session
       else:
         clearSession(session.id)           // pane goes blank

  5. await window.api.destroy(session.id)  // kill PTY process
  6. closeSession(session.id)              // remove from store + saveNow()
```

## Edge Cases

- **Session not in any pane**: skip pane reassignment, still destroy PTY and remove from store.
- **Last session in app**: pane goes blank (step 4 else branch), app shows empty state.
- **Session being renamed**: clicking × while rename input is open still closes correctly (the close handler doesn't depend on rename state).

## Files

- Modify: `src/renderer/src/components/Sidebar/GroupItem.tsx`
  - Add `clearSession` to store subscriptions
  - Add `handleCloseSession` handler
  - Add `×` button in the session row hover area
