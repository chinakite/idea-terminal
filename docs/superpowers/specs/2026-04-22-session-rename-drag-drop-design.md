# Session Rename & Drag-and-Drop Design

**Date:** 2026-04-22  
**Status:** Approved

---

## Overview

Two sidebar improvements:

1. **Rename terminal** — users can rename a session inline from the sidebar
2. **Drag-and-drop reorder / move** — users can drag a session row to a different position within the same group or to a different group entirely

---

## Issue 1: Rename Terminal

### Design

**Trigger:** A pencil icon (✏) appears on the right side of each session row when hovered — identical to the group rename pattern already in `GroupItem.tsx`.

**Edit mode:** Clicking ✏ replaces the session title `<span>` with an `<input>` pre-filled with the current title. The same keyboard/blur contract applies:
- `Enter` or `onBlur` → confirm (if non-empty, call `renameSession`; if empty, revert silently)
- `Escape` → cancel, revert to original title

**Store change:** Add `renameSession(id: string, title: string)` to `useSessionStore`. It updates `session.title` in the flat `sessions` array.

---

## Issue 2: Drag-and-Drop Between Groups

### Design

**Drag source:** Each session row is `draggable`. On `dragstart`, the session id is written to `dataTransfer` and the row opacity is reduced to indicate it is being dragged.

**Drop target — insert-line indicator:** While dragging over a session row, the cursor position within the row determines intent:
- **Top half of the row** → insert before that session
- **Bottom half of the row** → insert after that session

A blue horizontal line (2 px, with a small circle dot on the left) renders between the relevant rows to show the exact insertion point. This state is tracked as: `{ targetSessionId: string; position: 'before' | 'after' } | null`.

**Drop target — group header fallback:** Each group header also listens for `dragover` / `drop`. Dropping onto the header appends the session to the end of that group. This handles collapsed groups and empty groups.

**Result of drop:** Calls `moveSession(id, targetGroupId, insertAfterId)`:
1. Removes the dragged session from its current position in the `sessions` array
2. Updates its `groupId` to `targetGroupId`
3. Splices it back into the array:
   - If `insertAfterId` is a session id → insert immediately after that session
   - If `insertAfterId` is `null` → insert at the start of the target group's sessions (before the first)

**Cleanup:** `dragend` (fires on the drag source regardless of whether the drop succeeded) clears the insert-indicator state and restores the row opacity.

---

## Files Affected

| File | Change |
|---|---|
| `src/renderer/src/store/useSessionStore.ts` | Add `renameSession(id, title)` and `moveSession(id, targetGroupId, insertAfterId)` |
| `src/renderer/src/components/Sidebar/GroupItem.tsx` | Add ✏ rename icon + drag-and-drop handlers and insert-line indicator |
| `tests/renderer/store/useSessionStore.test.ts` | Add tests for `renameSession` and `moveSession` |

---

## Out of Scope

- Persisting session order across app restarts
- Dragging sessions into panes (only group reassignment)
- Reordering groups themselves
