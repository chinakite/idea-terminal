# UX Improvements Design

**Date:** 2026-04-21  
**Status:** Approved

---

## Overview

Three improvements to the Idea Terminal app:

1. **Bug: Terminal content cleared on session switch** — xterm reinitialises when `TerminalPane` unmounts
2. **Feature: Group management UI** — no way to create/rename/delete groups in the sidebar
3. **Feature: Bidirectional split pane** — split pane only supports horizontal; needs both horizontal and vertical

---

## Issue 1: Terminal Content Preservation

### Root Cause

`SplitPane.tsx` conditionally renders `<TerminalPane>` only when `pane.sessionId` is set. When the user switches sessions in a pane (changing `sessionId`), the old `TerminalPane` unmounts and the xterm instance is destroyed, losing all scrollback and output.

### Design

Keep every active session's `TerminalPane` **always mounted**. Visibility is controlled purely with CSS (`display: block/none`), never by conditional rendering.

**Change to `SplitPane.tsx`:**
- Collect the full set of `sessionId` values from `useSessionStore` (all known sessions)
- Render one `<TerminalPane>` per `sessionId`, always in the DOM regardless of whether it is currently assigned to a pane
- Show only the `TerminalPane` whose `sessionId` matches the currently visible pane slot; all others get `display: none`

**Lifecycle rule:** The framework never destroys a terminal. Only an explicit user action (closing a session) removes it. This means scrollback, output history, and running processes survive any number of pane/session switches.

---

## Issue 2: Group Management UI

### Current State

`useConfigStore` already implements `addGroup`, `renameGroup`, and `removeGroup`. No UI exposes these actions.

### Design

**Create group:**
- A `+` button sits at the right of the "终端分组" section header in the sidebar
- Clicking it shows an inline input field in the sidebar (below the header)
- User types a name and presses Enter (or clicks ✓) to confirm; Escape cancels
- Empty name is rejected

**Rename group:**
- Each group row shows a pencil icon (✏) on hover
- Clicking ✏ turns the group name into an inline editable field
- Enter confirms, Escape cancels

**Delete group:**
- Each group row shows a trash icon (🗑) on hover
- Clicking 🗑 shows a confirmation dialog: "删除分组「{name}」及其下所有终端？此操作不可撤销。"
- Confirming deletes the group and all its sessions (both config entries and runtime sessions)
- Cancelling does nothing

**Constraints:**
- The default group cannot be deleted or renamed (it always exists as a fallback)
- A group with active running sessions shows the same confirmation — sessions are terminated on delete

---

## Issue 3: Bidirectional Split Pane

### Current State

`useSplitStore` stores panes as a flat array `Pane[]` with a maximum of 4. `SplitPane.tsx` renders them in a single `flex-row`, horizontal only.

### Data Structure

Replace the flat array with a **binary tree**:

```typescript
type SplitNode =
  | { type: 'leaf'; id: string; sessionId: string | null }
  | { type: 'split'; direction: 'h' | 'v'; ratio: number; first: SplitNode; second: SplitNode }
```

- `direction: 'h'` — children arranged left/right (`flex-row`)
- `direction: 'v'` — children arranged top/bottom (`flex-column`)
- `ratio` — fraction of space given to `first` child (0–1, default 0.5)
- The tree root starts as a single leaf

### Operations

**Split (horizontal or vertical):**
- Target a leaf node
- Replace that leaf with a `split` node whose `first` child is a copy of the target leaf and `second` is a new empty leaf
- Max pane count: **9** (3×3). When 9 leaves exist, all split buttons and shortcuts are disabled.

**Close pane:**
- Remove the target leaf from the tree
- Its sibling node replaces the parent `split` node in the tree
- If closing the last pane, do nothing (always keep at least one pane)

**Resize:**
- Drag the divider between two siblings to adjust `ratio`

### UI Controls

Each pane has a title bar (28px) showing:
- Left: session name / cwd (truncated)
- Right: `⊟` horizontal split · `⊞` vertical split · `×` close

Buttons are hidden when at the 9-pane limit (split buttons only; close always visible).

**Keyboard shortcuts** (active when a pane is focused):
- `⌘D` — horizontal split
- `⌘⇧D` — vertical split  
- `⌘W` — close current pane

### Rendering

`SplitPane.tsx` renders the tree recursively:

```
renderNode(node):
  if leaf  → <TerminalPane>
  if split → <div flex-row|flex-col>
               <renderNode(first)  style={{ flex: ratio }}>
               <Divider onDrag={...}>
               <renderNode(second) style={{ flex: 1 - ratio }}>
             </div>
```

---

## Files Affected

| File | Change |
|---|---|
| `src/renderer/src/store/useSplitStore.ts` | Replace flat `Pane[]` with `SplitNode` tree; add split/close/resize actions |
| `src/renderer/src/components/Terminal/SplitPane.tsx` | Recursive tree renderer; always-mounted TerminalPane pool |
| `src/renderer/src/components/Terminal/TerminalPane.tsx` | Accept `visible` prop; apply `display: none` when hidden |
| `src/renderer/src/components/Sidebar/Sidebar.tsx` | Add `+` group button and inline input |
| `src/renderer/src/components/Sidebar/GroupItem.tsx` | Add hover rename/delete controls |
| `src/renderer/src/components/Sidebar/GroupList.tsx` | New component (extracted from Sidebar) — renders group list with management controls |

---

## Out of Scope

- Drag-and-drop to reorder sessions between groups
- Persist split layout across app restarts
- Named pane layouts / saved workspaces
