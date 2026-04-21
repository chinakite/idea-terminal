# UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix terminal content being cleared on session switch, add group management UI, and replace horizontal-only split pane with a bidirectional binary-tree split.

**Architecture:** The split pane store is rewritten from a flat `Pane[]` to a binary tree (`SplitNode`). `SplitPane.tsx` renders a pool of always-mounted `TerminalPane` components (one per known session, positioned absolutely) plus a chrome overlay (headers, dividers) computed from the tree. Group management adds inline create/rename/delete controls to the sidebar without changing the existing `useConfigStore` logic.

**Tech Stack:** React 18, Zustand 4, xterm.js 5, TypeScript, Vitest, Electron/IPC

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/renderer/src/store/useSplitStore.ts` | **Rewrite** | Binary-tree state + pure helpers exported for testing |
| `src/renderer/src/utils/splitLayout.ts` | **Create** | `computeLayout()` pure function: leaf bounds + divider positions |
| `src/renderer/src/components/Terminal/SplitPane.tsx` | **Rewrite** | Pool renderer + chrome overlay; consumes new store + layout util |
| `src/renderer/src/components/Terminal/TerminalPane.tsx` | **Modify** | Add `onSplitH/V/Close` props; wire `customKeyEventHandler` |
| `src/renderer/src/components/Sidebar/Sidebar.tsx` | **Modify** | Show all groups; inline new-group input; remove `addPane` usage |
| `src/renderer/src/components/Sidebar/GroupItem.tsx` | **Modify** | Hover controls: rename (inline edit) + delete (confirm dialog) |
| `tests/renderer/store/useSplitStore.test.ts` | **Rewrite** | Tests for new tree API |
| `tests/renderer/utils/splitLayout.test.ts` | **Create** | Tests for `computeLayout` |

---

## Task 1: Rewrite `useSplitStore` with binary-tree structure

**Files:**
- Modify: `src/renderer/src/store/useSplitStore.ts`
- Modify: `tests/renderer/store/useSplitStore.test.ts`

---

- [ ] **Step 1: Write failing tests for the new store API**

Replace the entire contents of `tests/renderer/store/useSplitStore.test.ts`:

```typescript
// tests/renderer/store/useSplitStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  countLeaves,
  collectLeaves,
  splitAt,
  removeLeaf,
  updateRatioInTree,
  clearSessionInTree,
  assignSessionInTree,
  findLeafBySession,
  useSplitStore
} from '../../../src/renderer/src/store/useSplitStore'
import type { SplitNode } from '../../../src/renderer/src/store/useSplitStore'

// ── pure helper tests ─────────────────────────────────────────────────────────

const leaf = (id: string, sessionId: string | null = null): SplitNode =>
  ({ type: 'leaf', id, sessionId })

const split = (
  id: string,
  direction: 'h' | 'v',
  first: SplitNode,
  second: SplitNode,
  ratio = 0.5
): SplitNode => ({ type: 'split', id, direction, ratio, first, second })

describe('countLeaves', () => {
  it('counts a single leaf as 1', () => {
    expect(countLeaves(leaf('a'))).toBe(1)
  })

  it('counts a tree with two leaves as 2', () => {
    expect(countLeaves(split('s1', 'h', leaf('a'), leaf('b')))).toBe(2)
  })

  it('counts a 3-leaf tree correctly', () => {
    const tree = split('s1', 'h', leaf('a'), split('s2', 'v', leaf('b'), leaf('c')))
    expect(countLeaves(tree)).toBe(3)
  })
})

describe('collectLeaves', () => {
  it('returns single leaf', () => {
    expect(collectLeaves(leaf('a', 's1'))).toEqual([{ id: 'a', sessionId: 's1' }])
  })

  it('returns all leaves left-to-right', () => {
    const tree = split('s1', 'h', leaf('a', 'sa'), leaf('b', 'sb'))
    expect(collectLeaves(tree)).toEqual([
      { id: 'a', sessionId: 'sa' },
      { id: 'b', sessionId: 'sb' }
    ])
  })
})

describe('splitAt', () => {
  it('replaces target leaf with a split node', () => {
    const result = splitAt(leaf('a'), 'a', 'h', 'new-leaf', 'new-split')
    expect(result.type).toBe('split')
    if (result.type !== 'split') return
    expect(result.direction).toBe('h')
    expect(result.ratio).toBe(0.5)
    expect(result.first).toEqual(leaf('a'))
    expect(result.second).toEqual(leaf('new-leaf', null))
  })

  it('leaves non-target nodes unchanged', () => {
    const original = leaf('b')
    const result = splitAt(original, 'other-id', 'v', 'x', 'y')
    expect(result).toBe(original)
  })

  it('splits a nested leaf', () => {
    const tree = split('s1', 'h', leaf('a'), leaf('b'))
    const result = splitAt(tree, 'b', 'v', 'c', 's2')
    if (result.type !== 'split') throw new Error()
    expect(result.second.type).toBe('split')
    if (result.second.type !== 'split') return
    expect(result.second.direction).toBe('v')
    expect(countLeaves(result)).toBe(3)
  })
})

describe('removeLeaf', () => {
  it('returns null when removing the only leaf', () => {
    expect(removeLeaf(leaf('a'), 'a')).toBeNull()
  })

  it('returns the sibling when one leaf is removed from a 2-leaf tree', () => {
    const tree = split('s1', 'h', leaf('a'), leaf('b'))
    expect(removeLeaf(tree, 'a')).toEqual(leaf('b'))
    expect(removeLeaf(tree, 'b')).toEqual(leaf('a'))
  })

  it('promotes sibling correctly in a 3-leaf tree', () => {
    const tree = split('s1', 'h', leaf('a'), split('s2', 'v', leaf('b'), leaf('c')))
    const result = removeLeaf(tree, 'b')
    if (!result || result.type !== 'split') throw new Error()
    expect(countLeaves(result)).toBe(2)
    expect(result.second).toEqual(leaf('c'))
  })
})

describe('updateRatioInTree', () => {
  it('updates ratio of matching split node', () => {
    const tree = split('s1', 'h', leaf('a'), leaf('b'))
    const result = updateRatioInTree(tree, 's1', 0.3)
    if (result.type !== 'split') throw new Error()
    expect(result.ratio).toBe(0.3)
  })

  it('leaves non-matching nodes unchanged', () => {
    const tree = split('s1', 'h', leaf('a'), leaf('b'))
    const result = updateRatioInTree(tree, 'other', 0.3)
    if (result.type !== 'split') throw new Error()
    expect(result.ratio).toBe(0.5)
  })
})

describe('clearSessionInTree', () => {
  it('nullifies sessionId for matching session', () => {
    const tree = split('s1', 'h', leaf('a', 'sess1'), leaf('b', 'sess2'))
    const result = clearSessionInTree(tree, 'sess1')
    expect(collectLeaves(result)[0].sessionId).toBeNull()
    expect(collectLeaves(result)[1].sessionId).toBe('sess2')
  })
})

describe('assignSessionInTree', () => {
  it('sets sessionId on the matching leaf', () => {
    const tree = leaf('p1', null)
    const result = assignSessionInTree(tree, 'p1', 'sess-x')
    if (result.type !== 'leaf') throw new Error()
    expect(result.sessionId).toBe('sess-x')
  })
})

describe('findLeafBySession', () => {
  it('finds the leaf with the given sessionId', () => {
    const tree = split('s1', 'h', leaf('a', 'sess-a'), leaf('b', 'sess-b'))
    const found = findLeafBySession(tree, 'sess-a')
    expect(found?.id).toBe('a')
  })

  it('returns null if sessionId not in tree', () => {
    expect(findLeafBySession(leaf('a', 'sess-a'), 'other')).toBeNull()
  })
})

// ── store action tests ────────────────────────────────────────────────────────

describe('useSplitStore', () => {
  beforeEach(() => {
    const rootLeaf: SplitNode = { type: 'leaf', id: 'p1', sessionId: null }
    useSplitStore.setState({ root: rootLeaf, activePaneId: 'p1' })
  })

  it('starts with one empty leaf as root', () => {
    const { root, activePaneId } = useSplitStore.getState()
    expect(root.type).toBe('leaf')
    expect(activePaneId).toBe('p1')
    expect(countLeaves(root)).toBe(1)
  })

  it('splitPane adds a new leaf and makes it active', () => {
    useSplitStore.getState().splitPane('p1', 'h')
    const { root, activePaneId } = useSplitStore.getState()
    expect(countLeaves(root)).toBe(2)
    expect(activePaneId).not.toBe('p1')
  })

  it('splitPane respects 9-pane maximum', () => {
    for (let i = 0; i < 8; i++) {
      const leaves = collectLeaves(useSplitStore.getState().root)
      useSplitStore.getState().splitPane(leaves[0].id, 'h')
    }
    expect(countLeaves(useSplitStore.getState().root)).toBe(9)
    // 10th split should be ignored
    const leaves = collectLeaves(useSplitStore.getState().root)
    useSplitStore.getState().splitPane(leaves[0].id, 'h')
    expect(countLeaves(useSplitStore.getState().root)).toBe(9)
  })

  it('closePane removes a leaf, keeps at least one', () => {
    useSplitStore.getState().splitPane('p1', 'h')
    const { root } = useSplitStore.getState()
    const leaves = collectLeaves(root)
    useSplitStore.getState().closePane(leaves[1].id)
    expect(countLeaves(useSplitStore.getState().root)).toBe(1)
  })

  it('closePane does nothing when only one pane exists', () => {
    useSplitStore.getState().closePane('p1')
    expect(countLeaves(useSplitStore.getState().root)).toBe(1)
  })

  it('closePane updates activePaneId when active pane is closed', () => {
    useSplitStore.getState().splitPane('p1', 'h')
    const { activePaneId, root } = useSplitStore.getState()
    useSplitStore.getState().closePane(activePaneId)
    expect(useSplitStore.getState().activePaneId).not.toBe(activePaneId)
    expect(countLeaves(useSplitStore.getState().root)).toBe(1)
  })

  it('assignSession sets sessionId on the target leaf', () => {
    useSplitStore.getState().assignSession('p1', 'sess-99')
    expect(useSplitStore.getState().getActivePaneSessionId()).toBe('sess-99')
  })

  it('clearSession nullifies matching leaf', () => {
    useSplitStore.getState().assignSession('p1', 'sess-1')
    useSplitStore.getState().clearSession('sess-1')
    expect(useSplitStore.getState().getActivePaneSessionId()).toBeNull()
  })

  it('getActivePaneSessionId returns the active leaf sessionId', () => {
    useSplitStore.getState().assignSession('p1', 'sess-abc')
    expect(useSplitStore.getState().getActivePaneSessionId()).toBe('sess-abc')
  })

  it('collectLeaves returns all leaves', () => {
    useSplitStore.getState().splitPane('p1', 'v')
    const leaves = useSplitStore.getState().collectLeaves()
    expect(leaves).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal
npm test 2>&1 | grep -E "(FAIL|PASS|useSplitStore)" | head -30
```

Expected: FAIL — imports from the new API don't exist yet.

- [ ] **Step 3: Rewrite `useSplitStore.ts`**

Replace the entire file with:

```typescript
// src/renderer/src/store/useSplitStore.ts
import { create } from 'zustand'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SplitLeaf = { type: 'leaf'; id: string; sessionId: string | null }
export type SplitSplit = {
  type: 'split'
  id: string
  direction: 'h' | 'v'
  ratio: number // fraction [0,1] of space given to `first`
  first: SplitNode
  second: SplitNode
}
export type SplitNode = SplitLeaf | SplitSplit

// ── Pure helpers (exported for testing) ──────────────────────────────────────

export function countLeaves(node: SplitNode): number {
  if (node.type === 'leaf') return 1
  return countLeaves(node.first) + countLeaves(node.second)
}

export function collectLeaves(node: SplitNode): Array<{ id: string; sessionId: string | null }> {
  if (node.type === 'leaf') return [{ id: node.id, sessionId: node.sessionId }]
  return [...collectLeaves(node.first), ...collectLeaves(node.second)]
}

export function findLeafBySession(node: SplitNode, sessionId: string): SplitLeaf | null {
  if (node.type === 'leaf') return node.sessionId === sessionId ? node : null
  return findLeafBySession(node.first, sessionId) ?? findLeafBySession(node.second, sessionId)
}

export function splitAt(
  node: SplitNode,
  targetId: string,
  direction: 'h' | 'v',
  newLeafId: string,
  newSplitId: string
): SplitNode {
  if (node.type === 'leaf') {
    if (node.id !== targetId) return node
    return {
      type: 'split',
      id: newSplitId,
      direction,
      ratio: 0.5,
      first: node,
      second: { type: 'leaf', id: newLeafId, sessionId: null }
    }
  }
  return {
    ...node,
    first: splitAt(node.first, targetId, direction, newLeafId, newSplitId),
    second: splitAt(node.second, targetId, direction, newLeafId, newSplitId)
  }
}

export function removeLeaf(node: SplitNode, targetId: string): SplitNode | null {
  if (node.type === 'leaf') return node.id === targetId ? null : node
  const newFirst = removeLeaf(node.first, targetId)
  const newSecond = removeLeaf(node.second, targetId)
  if (newFirst === null) return newSecond
  if (newSecond === null) return newFirst
  return { ...node, first: newFirst, second: newSecond }
}

export function updateRatioInTree(node: SplitNode, splitId: string, ratio: number): SplitNode {
  if (node.type === 'leaf') return node
  if (node.id === splitId) return { ...node, ratio }
  return {
    ...node,
    first: updateRatioInTree(node.first, splitId, ratio),
    second: updateRatioInTree(node.second, splitId, ratio)
  }
}

export function clearSessionInTree(node: SplitNode, sessionId: string): SplitNode {
  if (node.type === 'leaf') {
    return node.sessionId === sessionId ? { ...node, sessionId: null } : node
  }
  return {
    ...node,
    first: clearSessionInTree(node.first, sessionId),
    second: clearSessionInTree(node.second, sessionId)
  }
}

export function assignSessionInTree(node: SplitNode, paneId: string, sessionId: string): SplitNode {
  if (node.type === 'leaf') {
    return node.id === paneId ? { ...node, sessionId } : node
  }
  return {
    ...node,
    first: assignSessionInTree(node.first, paneId, sessionId),
    second: assignSessionInTree(node.second, paneId, sessionId)
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

const MAX_PANES = 9

interface SplitStore {
  root: SplitNode
  activePaneId: string
  splitPane: (paneId: string, direction: 'h' | 'v') => void
  closePane: (paneId: string) => void
  setRatio: (splitId: string, ratio: number) => void
  assignSession: (paneId: string, sessionId: string) => void
  clearSession: (sessionId: string) => void
  setActivePane: (paneId: string) => void
  getActivePaneSessionId: () => string | null
  collectLeaves: () => Array<{ id: string; sessionId: string | null }>
}

const genId = (): string => Math.random().toString(36).slice(2, 10)
const initialLeafId = genId()

export const useSplitStore = create<SplitStore>((set, get) => ({
  root: { type: 'leaf', id: initialLeafId, sessionId: null },
  activePaneId: initialLeafId,

  splitPane: (paneId, direction) => {
    if (countLeaves(get().root) >= MAX_PANES) return
    const newLeafId = genId()
    const newSplitId = genId()
    set((state) => ({
      root: splitAt(state.root, paneId, direction, newLeafId, newSplitId),
      activePaneId: newLeafId
    }))
  },

  closePane: (paneId) => {
    const { root, activePaneId } = get()
    if (countLeaves(root) <= 1) return
    const newRoot = removeLeaf(root, paneId)
    if (!newRoot) return
    const leaves = collectLeaves(newRoot)
    const newActive =
      activePaneId === paneId ? leaves[leaves.length - 1].id : activePaneId
    set({ root: newRoot, activePaneId: newActive })
  },

  setRatio: (splitId, ratio) =>
    set((state) => ({ root: updateRatioInTree(state.root, splitId, ratio) })),

  assignSession: (paneId, sessionId) =>
    set((state) => ({ root: assignSessionInTree(state.root, paneId, sessionId) })),

  clearSession: (sessionId) =>
    set((state) => ({ root: clearSessionInTree(state.root, sessionId) })),

  setActivePane: (paneId) => set({ activePaneId: paneId }),

  getActivePaneSessionId: () => {
    const { root, activePaneId } = get()
    const leaves = collectLeaves(root)
    return leaves.find((l) => l.id === activePaneId)?.sessionId ?? null
  },

  collectLeaves: () => collectLeaves(get().root)
}))
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
npm test 2>&1 | grep -E "(FAIL|PASS|✓|✗)" | head -40
```

Expected: all useSplitStore tests PASS.

- [ ] **Step 5: Fix TypeScript compilation errors in callers**

`GroupItem.tsx` uses `panes` from `useSplitStore`. Update the import and usage temporarily to use `collectLeaves()`. Open `src/renderer/src/components/Sidebar/GroupItem.tsx` and replace the two `useSplitStore` lines:

Old:
```typescript
const { panes, setActivePane, assignSession } = useSplitStore()
```
New:
```typescript
const collectLeaves = useSplitStore((s) => s.collectLeaves)
const setActivePane = useSplitStore((s) => s.setActivePane)
const assignSession = useSplitStore((s) => s.assignSession)
const activePaneId = useSplitStore((s) => s.activePaneId)
```

Old (in `handleSessionClick`):
```typescript
const existingPane = panes.find((p) => p.sessionId === sessionId)
if (existingPane) {
  setActivePane(existingPane.id)
} else if (activePaneId) {
  assignSession(activePaneId, sessionId)
}
```
New:
```typescript
const leaves = collectLeaves()
const existingPane = leaves.find((l) => l.sessionId === sessionId)
if (existingPane) {
  setActivePane(existingPane.id)
} else if (activePaneId) {
  assignSession(activePaneId, sessionId)
}
```

Old:
```typescript
const activePaneSessionId = panes.find((p) => p.id === activePaneId)?.sessionId
```
New:
```typescript
const activePaneSessionId = collectLeaves().find((l) => l.id === activePaneId)?.sessionId
```

Also update `Sidebar.tsx` — replace usage of `addPane`:

Old:
```typescript
const { panes, activePaneId, assignSession, addPane } = useSplitStore()
```
New:
```typescript
const collectLeaves = useSplitStore((s) => s.collectLeaves)
const activePaneId = useSplitStore((s) => s.activePaneId)
const assignSession = useSplitStore((s) => s.assignSession)
```

Replace the `addPane` call in `handleNewTerminal`:

Old:
```typescript
const emptyPane = panes.find((p) => !p.sessionId)
if (emptyPane) {
  assignSession(emptyPane.id, id)
} else if (activePaneId) {
  assignSession(activePaneId, id)
} else {
  addPane(id)
}
```
New:
```typescript
const leaves = collectLeaves()
const emptyPane = leaves.find((l) => !l.sessionId)
if (emptyPane) {
  assignSession(emptyPane.id, id)
} else if (activePaneId) {
  assignSession(activePaneId, id)
}
```

- [ ] **Step 6: Verify TypeScript compiles cleanly**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing errors unrelated to this change).

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/store/useSplitStore.ts \
        src/renderer/src/components/Sidebar/GroupItem.tsx \
        src/renderer/src/components/Sidebar/Sidebar.tsx \
        tests/renderer/store/useSplitStore.test.ts
git commit -m "refactor: replace useSplitStore flat array with binary tree"
```

---

## Task 2: Create `splitLayout` utility and tests

**Files:**
- Create: `src/renderer/src/utils/splitLayout.ts`
- Create: `tests/renderer/utils/splitLayout.test.ts`

---

- [ ] **Step 1: Write failing tests**

Create `tests/renderer/utils/splitLayout.test.ts`:

```typescript
// tests/renderer/utils/splitLayout.test.ts
import { describe, it, expect } from 'vitest'
import { computeLayout, DIVIDER_SIZE, HEADER_HEIGHT } from '../../../src/renderer/src/utils/splitLayout'
import type { SplitNode } from '../../../src/renderer/src/store/useSplitStore'

const leaf = (id: string): SplitNode => ({ type: 'leaf', id, sessionId: null })
const split = (id: string, dir: 'h' | 'v', first: SplitNode, second: SplitNode, ratio = 0.5): SplitNode =>
  ({ type: 'split', id, direction: dir, ratio, first, second })

describe('computeLayout', () => {
  it('single leaf fills entire container', () => {
    const { leaves, dividers } = computeLayout(leaf('a'), 800, 600)
    expect(leaves.get('a')).toEqual({ top: 0, left: 0, width: 800, height: 600 })
    expect(dividers).toHaveLength(0)
  })

  it('horizontal split divides width by ratio', () => {
    const tree = split('s1', 'h', leaf('a'), leaf('b'), 0.5)
    const { leaves, dividers } = computeLayout(tree, 800, 600)
    const firstW = Math.round((800 - DIVIDER_SIZE) * 0.5)
    const secondW = 800 - firstW - DIVIDER_SIZE
    expect(leaves.get('a')?.width).toBe(firstW)
    expect(leaves.get('b')?.width).toBe(secondW)
    expect(leaves.get('a')?.left).toBe(0)
    expect(leaves.get('b')?.left).toBe(firstW + DIVIDER_SIZE)
    expect(dividers).toHaveLength(1)
    expect(dividers[0].direction).toBe('h')
  })

  it('vertical split divides height by ratio', () => {
    const tree = split('s1', 'v', leaf('a'), leaf('b'), 0.6)
    const { leaves, dividers } = computeLayout(tree, 800, 600)
    const firstH = Math.round((600 - DIVIDER_SIZE) * 0.6)
    expect(leaves.get('a')?.height).toBe(firstH)
    expect(leaves.get('b')?.top).toBe(firstH + DIVIDER_SIZE)
    expect(dividers[0].direction).toBe('v')
  })

  it('3-pane tree produces 3 leaf layouts and 2 dividers', () => {
    const tree = split('s1', 'h', leaf('a'), split('s2', 'v', leaf('b'), leaf('c')))
    const { leaves, dividers } = computeLayout(tree, 800, 600)
    expect(leaves.size).toBe(3)
    expect(dividers).toHaveLength(2)
  })

  it('HEADER_HEIGHT is 28', () => {
    expect(HEADER_HEIGHT).toBe(28)
  })

  it('content bounds (top + HEADER_HEIGHT) fit within leaf bounds', () => {
    const { leaves } = computeLayout(leaf('a'), 800, 600)
    const bounds = leaves.get('a')!
    expect(bounds.height - HEADER_HEIGHT).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test 2>&1 | grep -E "(FAIL|splitLayout)" | head -10
```

Expected: FAIL — `splitLayout.ts` does not exist.

- [ ] **Step 3: Create `src/renderer/src/utils/splitLayout.ts`**

```typescript
// src/renderer/src/utils/splitLayout.ts
import type { SplitNode } from '../store/useSplitStore'

export const DIVIDER_SIZE = 4   // px
export const HEADER_HEIGHT = 28 // px

export interface LeafLayout {
  top: number
  left: number
  width: number
  height: number
}

export interface DividerLayout {
  splitId: string
  direction: 'h' | 'v'
  ratio: number   // current ratio of the split node (needed for drag calculations)
  top: number
  left: number
  width: number
  height: number
}

export interface Layout {
  leaves: Map<string, LeafLayout>  // leafId → bounds
  dividers: DividerLayout[]
}

function recurse(
  node: SplitNode,
  x: number,
  y: number,
  w: number,
  h: number,
  leaves: Map<string, LeafLayout>,
  dividers: DividerLayout[]
): void {
  if (node.type === 'leaf') {
    leaves.set(node.id, { top: y, left: x, width: w, height: h })
    return
  }
  if (node.direction === 'h') {
    const firstW = Math.round((w - DIVIDER_SIZE) * node.ratio)
    const secondX = x + firstW + DIVIDER_SIZE
    const secondW = w - firstW - DIVIDER_SIZE
    dividers.push({ splitId: node.id, direction: 'h', ratio: node.ratio, top: y, left: x + firstW, width: DIVIDER_SIZE, height: h })
    recurse(node.first, x, y, firstW, h, leaves, dividers)
    recurse(node.second, secondX, y, secondW, h, leaves, dividers)
  } else {
    const firstH = Math.round((h - DIVIDER_SIZE) * node.ratio)
    const secondY = y + firstH + DIVIDER_SIZE
    const secondH = h - firstH - DIVIDER_SIZE
    dividers.push({ splitId: node.id, direction: 'v', ratio: node.ratio, top: y + firstH, left: x, width: w, height: DIVIDER_SIZE })
    recurse(node.first, x, y, w, firstH, leaves, dividers)
    recurse(node.second, x, secondY, w, secondH, leaves, dividers)
  }
}

/**
 * Computes absolute pixel positions for all leaves and dividers in the tree.
 * @param root   The SplitNode tree
 * @param width  Total container width in px
 * @param height Total container height in px
 */
export function computeLayout(root: SplitNode, width: number, height: number): Layout {
  const leaves = new Map<string, LeafLayout>()
  const dividers: DividerLayout[] = []
  recurse(root, 0, 0, width, height, leaves, dividers)
  return { leaves, dividers }
}
```

- [ ] **Step 4: Run tests — expect them to pass**

```bash
npm test 2>&1 | grep -E "(FAIL|PASS|splitLayout)" | head -10
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/utils/splitLayout.ts tests/renderer/utils/splitLayout.test.ts
git commit -m "feat: add splitLayout utility for computing leaf and divider positions"
```

---

## Task 3: Rewrite `SplitPane.tsx` with pool renderer + chrome overlay

This task fixes the terminal content-cleared bug (pool keeps all TerminalPanes mounted) and adds bidirectional tree-based split with draggable dividers.

**Files:**
- Modify: `src/renderer/src/components/Terminal/SplitPane.tsx`
- Modify: `src/renderer/src/components/Terminal/TerminalPane.tsx`

---

- [ ] **Step 1: Update `TerminalPane.tsx` to add keyboard-callback props and guard zero-size resize**

Replace the file:

```typescript
// src/renderer/src/components/Terminal/TerminalPane.tsx
import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { useSessionStore } from '../../store/useSessionStore'
import { useTerminalOutputStore } from '../../store/useTerminalOutputStore'
import 'xterm/css/xterm.css'

interface TerminalPaneProps {
  sessionId: string
  isActive: boolean
  /** Called when the user presses ⌘D (horizontal split) inside this terminal */
  onSplitH?: () => void
  /** Called when the user presses ⌘⇧D (vertical split) inside this terminal */
  onSplitV?: () => void
  /** Called when the user presses ⌘W (close pane) inside this terminal */
  onClose?: () => void
}

export function TerminalPane({
  sessionId,
  isActive,
  onSplitH,
  onSplitV,
  onClose
}: TerminalPaneProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const cleanupRef = useRef<(() => void)[]>([])
  const markDisconnected = useSessionStore((s) => s.markDisconnected)

  const fit = useCallback(() => {
    if (!fitAddonRef.current || !termRef.current) return
    fitAddonRef.current.fit()
    const { cols, rows } = termRef.current
    window.api.resize(sessionId, cols, rows)
  }, [sessionId])

  // Mount xterm once per sessionId
  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0d1117',
        foreground: '#cdd9e5',
        cursor: '#cdd9e5',
        selectionBackground: '#264f78'
      }
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitAddonRef.current = fitAddon

    const disposeInput = term.onData((data) => window.api.write(sessionId, data))
    const removeData = window.api.onData(sessionId, (data) => {
      term.write(data)
      useTerminalOutputStore.getState().appendData(sessionId, data)
    })
    const removeExit = window.api.onExit(sessionId, () => {
      term.write('\r\n\x1b[33m[进程已退出]\x1b[0m\r\n')
      markDisconnected(sessionId)
    })

    cleanupRef.current = [
      () => disposeInput.dispose(),
      removeData,
      removeExit,
      () => term.dispose()
    ]

    // Guard: only call fit when the container has non-zero dimensions
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          fitAddon.fit()
        }
      }
    })
    resizeObserver.observe(containerRef.current)
    cleanupRef.current.push(() => resizeObserver.disconnect())

    return () => {
      cleanupRef.current.forEach((fn) => fn())
      cleanupRef.current = []
    }
  }, [sessionId])

  // Focus and fit when this pane becomes active
  useEffect(() => {
    if (isActive) {
      fit()
      termRef.current?.focus()
    }
  }, [isActive, fit])

  // Wire up keyboard shortcuts inside the terminal
  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true
      if (e.metaKey && !e.shiftKey && e.key === 'd') {
        onSplitH?.()
        return false
      }
      if (e.metaKey && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        onSplitV?.()
        return false
      }
      if (e.metaKey && e.key === 'w') {
        onClose?.()
        return false
      }
      return true
    })
  }, [onSplitH, onSplitV, onClose])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', padding: '4px', backgroundColor: '#0d1117' }}
    />
  )
}
```

- [ ] **Step 2: Rewrite `SplitPane.tsx`**

Replace the entire file:

```typescript
// src/renderer/src/components/Terminal/SplitPane.tsx
import { useRef, useState, useLayoutEffect, useCallback } from 'react'
import { useSessionStore } from '../../store/useSessionStore'
import { useSplitStore, findLeafBySession, countLeaves, collectLeaves } from '../../store/useSplitStore'
import { computeLayout, DIVIDER_SIZE, HEADER_HEIGHT } from '../../utils/splitLayout'
import type { DividerLayout, LeafLayout } from '../../utils/splitLayout'
import { TerminalPane } from './TerminalPane'

// ── Divider (draggable resize handle) ────────────────────────────────────────

interface DividerProps {
  layout: DividerLayout  // includes ratio from the tree node
  onRatioChange: (splitId: string, newRatio: number) => void
  containerW: number
  containerH: number
}

function Divider({ layout, onRatioChange, containerW, containerH }: DividerProps): JSX.Element {
  const startRef = useRef<{ x: number; y: number; ratio: number } | null>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      startRef.current = { x: e.clientX, y: e.clientY, ratio: layout.ratio }

      const onMove = (ev: MouseEvent): void => {
        if (!startRef.current) return
        const dx = ev.clientX - startRef.current.x
        const dy = ev.clientY - startRef.current.y
        const delta =
          layout.direction === 'h'
            ? dx / (containerW - DIVIDER_SIZE)
            : dy / (containerH - DIVIDER_SIZE)
        const newRatio = Math.min(0.9, Math.max(0.1, startRef.current.ratio + delta))
        onRatioChange(layout.splitId, newRatio)
      }

      const onUp = (): void => {
        startRef.current = null
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [layout, splitStoreRatio, containerW, containerH, onDragEnd]
  )

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        top: layout.top,
        left: layout.left,
        width: layout.width,
        height: layout.height,
        backgroundColor: '#21262d',
        cursor: layout.direction === 'h' ? 'col-resize' : 'row-resize',
        zIndex: 10,
        flexShrink: 0
      }}
    />
  )
}

// ── PaneHeader ────────────────────────────────────────────────────────────────

interface PaneHeaderProps {
  leafId: string
  leafLayout: LeafLayout
  sessionTitle: string
  isActive: boolean
  canSplit: boolean
  onSplitH: () => void
  onSplitV: () => void
  onClose: () => void
  onClick: () => void
}

function PaneHeader({
  leafLayout,
  sessionTitle,
  isActive,
  canSplit,
  onSplitH,
  onSplitV,
  onClose,
  onClick
}: PaneHeaderProps): JSX.Element {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        top: leafLayout.top,
        left: leafLayout.left,
        width: leafLayout.width,
        height: HEADER_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        backgroundColor: isActive ? '#161b22' : '#0d1117',
        borderBottom: '1px solid #21262d',
        padding: '0 8px',
        gap: '6px',
        userSelect: 'none',
        zIndex: 20,
        boxSizing: 'border-box',
        outline: isActive ? '1px solid #0f3460' : 'none',
        outlineOffset: '-1px'
      }}
    >
      <span
        style={{
          flex: 1,
          fontSize: '11px',
          color: '#768390',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {sessionTitle}
      </span>

      {canSplit && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onSplitH() }}
            title="水平分割 (⌘D)"
            style={{ background: 'none', border: 'none', color: '#768390', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '0 2px' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#cdd9e5')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#768390')}
          >
            ⊟
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSplitV() }}
            title="垂直分割 (⌘⇧D)"
            style={{ background: 'none', border: 'none', color: '#768390', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '0 2px' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#cdd9e5')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#768390')}
          >
            ⊞
          </button>
        </>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onClose() }}
        title="关闭窗格 (⌘W)"
        style={{ background: 'none', border: 'none', color: '#768390', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#f85149')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#768390')}
      >
        ×
      </button>
    </div>
  )
}

// ── SplitPane (main) ──────────────────────────────────────────────────────────

export function SplitPane(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  const { root, activePaneId, splitPane, closePane, setRatio, setActivePane } = useSplitStore()
  const sessions = useSessionStore((s) => s.sessions)

  // Track container dimensions for layout computation
  useLayoutEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setContainerSize({ w: width, h: height })
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const { w, h } = containerSize
  const layout = w > 0 && h > 0 ? computeLayout(root, w, h) : { leaves: new Map(), dividers: [] }
  const leafCount = countLeaves(root)
  const canSplit = leafCount < 9

  // Build a reactive map of leafId → sessionId using the pure collectLeaves helper
  // (root is subscribed from the store so this updates on every tree change)
  const leafSessionMap = new Map(collectLeaves(root).map((l) => [l.id, l.sessionId]))

  const getSessionTitle = (sessionId: string | null): string => {
    if (!sessionId) return '空白'
    return sessions.find((s) => s.id === sessionId)?.title ?? '空白'
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
      {/* ── Terminal pool: all sessions always mounted ── */}
      {sessions.map((session) => {
        const assignedLeaf = findLeafBySession(root, session.id)
        const leafLayout = assignedLeaf ? layout.leaves.get(assignedLeaf.id) : undefined
        const isActive = assignedLeaf?.id === activePaneId

        const contentBounds = leafLayout
          ? {
              top: leafLayout.top + HEADER_HEIGHT,
              left: leafLayout.left,
              width: leafLayout.width,
              height: leafLayout.height - HEADER_HEIGHT
            }
          : null

        return (
          <div
            key={session.id}
            style={{
              position: 'absolute',
              display: contentBounds ? 'block' : 'none',
              top: contentBounds?.top ?? 0,
              left: contentBounds?.left ?? 0,
              width: contentBounds?.width ?? 0,
              height: contentBounds?.height ?? 0,
              zIndex: 1
            }}
          >
            <TerminalPane
              sessionId={session.id}
              isActive={isActive}
              onSplitH={assignedLeaf ? () => splitPane(assignedLeaf.id, 'h') : undefined}
              onSplitV={assignedLeaf ? () => splitPane(assignedLeaf.id, 'v') : undefined}
              onClose={assignedLeaf ? () => closePane(assignedLeaf.id) : undefined}
            />
          </div>
        )
      })}

      {/* ── Chrome layer: headers and blank-pane placeholders ── */}
      {Array.from(layout.leaves.entries()).map(([leafId, leafLayout]) => {
        const sessionId = leafSessionMap.get(leafId) ?? null
        const isActive = leafId === activePaneId

        return (
          <div key={`chrome-${leafId}`}>
            <PaneHeader
              leafId={leafId}
              leafLayout={leafLayout}
              sessionTitle={getSessionTitle(sessionId)}
              isActive={isActive}
              canSplit={canSplit}
              onSplitH={() => splitPane(leafId, 'h')}
              onSplitV={() => splitPane(leafId, 'v')}
              onClose={() => closePane(leafId)}
              onClick={() => setActivePane(leafId)}
            />
            {/* Blank placeholder shown when no session is assigned */}
            {!sessionId && (
              <div
                style={{
                  position: 'absolute',
                  top: leafLayout.top + HEADER_HEIGHT,
                  left: leafLayout.left,
                  width: leafLayout.width,
                  height: leafLayout.height - HEADER_HEIGHT,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: '8px',
                  color: '#768390',
                  fontSize: '13px',
                  zIndex: 1,
                  backgroundColor: '#0d1117'
                }}
                onClick={() => setActivePane(leafId)}
              >
                <span>空白窗格</span>
                <span style={{ fontSize: '11px', color: '#484f58' }}>从左侧列表点击会话即可显示</span>
              </div>
            )}
          </div>
        )
      })}

      {/* ── Dividers ── */}
      {layout.dividers.map((d) => (
        <Divider
          key={d.splitId}
          layout={d}
          containerW={w}
          containerH={h}
          onRatioChange={setRatio}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify no unused imports remain**

Check that `useCallback` is still used (it is — in `Divider.handleMouseDown`). Verify the import line at the top of `SplitPane.tsx` matches exactly what the file uses:

```typescript
import { useRef, useState, useLayoutEffect, useCallback } from 'react'
import { useSessionStore } from '../../store/useSessionStore'
import { useSplitStore, findLeafBySession, countLeaves, collectLeaves } from '../../store/useSplitStore'
import { computeLayout, DIVIDER_SIZE, HEADER_HEIGHT } from '../../utils/splitLayout'
import type { DividerLayout, LeafLayout } from '../../utils/splitLayout'
import { TerminalPane } from './TerminalPane'
```

If the TypeScript compiler flags `LeafLayout` as unused, remove it from the import (it is used as the type for `leafLayout` in `PaneHeaderProps` and the chrome layer map).

- [ ] **Step 4: Verify the app builds without TypeScript errors**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds (or shows only pre-existing warnings).

- [ ] **Step 5: Manual smoke test**

Run the app and verify:
- Opening the app shows one blank pane
- Click `+` to create a new terminal — it appears in the blank pane
- Create a second terminal from the sidebar — content of the first terminal is NOT cleared
- Click `⊟` header button → pane splits horizontally, new empty pane appears on the right
- Click `⊞` header button → pane splits vertically
- Drag divider between panes to resize
- Click `×` to close a pane — sibling fills the space
- With a terminal focused, press `⌘D` → horizontal split; `⌘⇧D` → vertical split; `⌘W` → close

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/Terminal/SplitPane.tsx \
        src/renderer/src/components/Terminal/TerminalPane.tsx
git commit -m "feat: rewrite SplitPane with tree-based bidirectional splits and always-mounted terminal pool"
```

---

## Task 4: Group management UI — create, rename, delete groups

**Files:**
- Modify: `src/renderer/src/components/Sidebar/Sidebar.tsx`
- Modify: `src/renderer/src/components/Sidebar/GroupItem.tsx`

---

- [ ] **Step 1: Update `GroupItem.tsx` to add rename and delete controls**

Replace the entire file:

```typescript
// src/renderer/src/components/Sidebar/GroupItem.tsx
import { useState } from 'react'
import { useSplitStore } from '../../store/useSplitStore'
import { useConfigStore } from '../../store/useConfigStore'
import { useSessionStore } from '../../store/useSessionStore'
import type { RuntimeSession } from '../../store/useSessionStore'

interface GroupItemProps {
  groupId: string
  groupName: string
  sessions: RuntimeSession[]
  activePaneId: string | null
  isDefault?: boolean
}

export function GroupItem({
  groupId,
  groupName,
  sessions,
  activePaneId,
  isDefault = false
}: GroupItemProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(groupName)

  const collectLeaves = useSplitStore((s) => s.collectLeaves)
  const setActivePane = useSplitStore((s) => s.setActivePane)
  const assignSession = useSplitStore((s) => s.assignSession)
  const activePaneIdFromStore = useSplitStore((s) => s.activePaneId)
  const proxies = useConfigStore((s) => s.config.proxies)
  const renameGroup = useConfigStore((s) => s.renameGroup)
  const removeGroup = useConfigStore((s) => s.removeGroup)
  const closeSession = useSessionStore((s) => s.closeSession)

  const resolvedActivePaneId = activePaneId ?? activePaneIdFromStore

  const getProxyName = (proxyId?: string): string | undefined => {
    if (!proxyId) return undefined
    return proxies.find((p) => p.id === proxyId)?.name
  }

  const handleSessionClick = (sessionId: string): void => {
    const leaves = collectLeaves()
    const existingPane = leaves.find((l) => l.sessionId === sessionId)
    if (existingPane) {
      setActivePane(existingPane.id)
    } else if (resolvedActivePaneId) {
      assignSession(resolvedActivePaneId, sessionId)
    }
  }

  const handleRenameConfirm = (): void => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== groupName) renameGroup(groupId, trimmed)
    setRenaming(false)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleRenameConfirm()
    if (e.key === 'Escape') { setRenaming(false); setRenameValue(groupName) }
  }

  const handleDelete = (): void => {
    if (!window.confirm(`删除分组「${groupName}」及其下所有终端？此操作不可撤销。`)) return
    // Close all sessions in this group first
    sessions.forEach((s) => closeSession(s.id))
    removeGroup(groupId)
  }

  const activePaneSessionId = collectLeaves().find((l) => l.id === resolvedActivePaneId)?.sessionId

  return (
    <div style={{ marginBottom: '4px' }}>
      {/* Group header row */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '3px 6px', userSelect: 'none',
          color: '#8892a4', fontSize: '10px', letterSpacing: '0.5px',
          borderRadius: '3px', position: 'relative'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0f3460')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span
          onClick={() => setCollapsed(!collapsed)}
          style={{ fontSize: '9px', cursor: 'pointer' }}
        >
          {collapsed ? '▶' : '▼'}
        </span>

        {renaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameConfirm}
            onKeyDown={handleRenameKeyDown}
            style={{
              flex: 1, background: '#0d1117', border: '1px solid #30363d',
              borderRadius: '2px', color: '#cdd9e5', fontSize: '10px',
              padding: '1px 4px', outline: 'none'
            }}
          />
        ) : (
          <span
            onClick={() => setCollapsed(!collapsed)}
            style={{ textTransform: 'uppercase', flex: 1, cursor: 'pointer' }}
          >
            {groupName}
          </span>
        )}

        <span style={{ color: '#484f58' }}>{sessions.length}</span>

        {!isDefault && !renaming && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setRenaming(true); setRenameValue(groupName) }}
              title="重命名分组"
              style={{ background: 'none', border: 'none', color: '#484f58', cursor: 'pointer', fontSize: '11px', padding: '0 1px', lineHeight: 1 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#cdd9e5')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#484f58')}
            >
              ✏
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete() }}
              title="删除分组"
              style={{ background: 'none', border: 'none', color: '#484f58', cursor: 'pointer', fontSize: '11px', padding: '0 1px', lineHeight: 1 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#f85149')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#484f58')}
            >
              🗑
            </button>
          </>
        )}
      </div>

      {/* Session list */}
      {!collapsed && sessions.map((session) => {
        const isActive = session.id === activePaneSessionId
        const proxyName = getProxyName(session.proxyId)

        return (
          <div
            key={session.id}
            onClick={() => handleSessionClick(session.id)}
            style={{
              padding: '4px 8px 4px 16px', borderRadius: '3px', cursor: 'pointer',
              fontSize: '12px', color: isActive ? '#ccd6f6' : '#8892a4',
              backgroundColor: isActive ? '#0f3460' : 'transparent',
              display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1px'
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = '#1c2128' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isActive ? '#0f3460' : 'transparent' }}
          >
            <span style={{ color: session.status === 'disconnected' ? '#f85149' : '#64ffda', fontSize: '8px' }}>●</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{session.title}</span>
            {proxyName && (
              <span style={{ fontSize: '9px', color: '#64ffda', backgroundColor: '#0d2b2b', border: '1px solid #1a5050', borderRadius: '2px', padding: '0 3px', flexShrink: 0, maxWidth: '56px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

- [ ] **Step 2: Update `Sidebar.tsx` to render all groups and add group creation UI**

Replace the entire file:

```typescript
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

  const collectLeaves = useSplitStore((s) => s.collectLeaves)
  const activePaneId = useSplitStore((s) => s.activePaneId)
  const assignSession = useSplitStore((s) => s.assignSession)

  const proxies = useConfigStore((s) => s.config.proxies)
  const groups = useConfigStore((s) => s.config.groups)
  const removeProxy = useConfigStore((s) => s.removeProxy)
  const addGroup = useConfigStore((s) => s.addGroup)

  const [isCreating, setIsCreating] = useState(false)
  const [selectedProxyId, setSelectedProxyId] = useState<string>('')
  const [showProxyForm, setShowProxyForm] = useState(false)
  const [showNewGroupInput, setShowNewGroupInput] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')

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

      const leaves = collectLeaves()
      const emptyPane = leaves.find((l) => !l.sessionId)
      if (emptyPane) {
        assignSession(emptyPane.id, id)
      } else if (activePaneId) {
        assignSession(activePaneId, id)
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleCreateGroup = (): void => {
    const name = newGroupName.trim()
    if (!name) return
    addGroup(name)
    setNewGroupName('')
    setShowNewGroupInput(false)
  }

  const handleGroupInputKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleCreateGroup()
    if (e.key === 'Escape') { setShowNewGroupInput(false); setNewGroupName('') }
  }

  const selectedProxy = proxies.find((p) => p.id === selectedProxyId)

  // Sessions in the default group (groupId === 'default')
  const defaultSessions = sessions.filter((s) => s.groupId === 'default')

  return (
    <div style={{
      width: '200px', height: '100%', backgroundColor: '#16213e',
      borderRight: '1px solid #0f3460', display: 'flex', flexDirection: 'column', flexShrink: 0
    }}>
      <div style={{
        padding: '12px', color: '#e94560', fontWeight: 'bold',
        fontSize: '12px', letterSpacing: '1px', borderBottom: '1px solid #0f3460'
      }}>
        IDEA TERMINAL
      </div>

      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* Proxy selector */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <select
            value={selectedProxyId}
            onChange={(e) => setSelectedProxyId(e.target.value)}
            style={{
              flex: 1, backgroundColor: '#0d1117', border: '1px solid #0f3460',
              borderRadius: '3px', color: selectedProxyId ? '#64ffda' : '#484f58',
              fontSize: '10px', padding: '3px 4px', cursor: 'pointer', outline: 'none'
            }}
          >
            <option value="">无代理</option>
            {proxies.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
          <button
            onClick={() => setShowProxyForm(!showProxyForm)}
            title={showProxyForm ? '取消' : '添加代理'}
            style={{ background: 'none', border: 'none', color: '#484f58', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '2px 4px' }}
          >
            {showProxyForm ? '×' : '+'}
          </button>
        </div>

        {!showProxyForm && selectedProxy && (
          <button
            onClick={() => { removeProxy(selectedProxyId); setSelectedProxyId('') }}
            style={{ background: 'none', border: '1px solid #3d1f1f', borderRadius: '3px', color: '#f85149', fontSize: '10px', padding: '2px 6px', cursor: 'pointer', textAlign: 'left' }}
          >
            删除「{selectedProxy.name}」
          </button>
        )}

        {showProxyForm && (
          <div style={{ backgroundColor: '#0d1117', borderRadius: '4px', border: '1px solid #21262d' }}>
            <ProxyForm onSaved={() => setShowProxyForm(false)} onCancel={() => setShowProxyForm(false)} />
          </div>
        )}

        <button
          onClick={handleNewTerminal}
          disabled={isCreating}
          style={{
            width: '100%', padding: '6px', backgroundColor: '#0f3460',
            color: '#a8b2d8', border: 'none', borderRadius: '4px',
            cursor: isCreating ? 'wait' : 'pointer', fontSize: '12px'
          }}
        >
          {isCreating ? '创建中...' : '＋ 新建终端'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
        {/* Section header: 终端分组 + add group button */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '4px 6px 2px',
          color: '#484f58', fontSize: '9px', letterSpacing: '0.5px'
        }}>
          <span style={{ flex: 1, textTransform: 'uppercase' }}>终端分组</span>
          <button
            onClick={() => { setShowNewGroupInput(!showNewGroupInput); setNewGroupName('') }}
            title={showNewGroupInput ? '取消' : '新建分组'}
            style={{ background: 'none', border: 'none', color: '#484f58', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#64ffda')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#484f58')}
          >
            {showNewGroupInput ? '×' : '+'}
          </button>
        </div>

        {/* Inline new-group input */}
        {showNewGroupInput && (
          <div style={{ padding: '2px 6px 4px', display: 'flex', gap: '4px' }}>
            <input
              autoFocus
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={handleGroupInputKeyDown}
              placeholder="分组名称"
              style={{
                flex: 1, background: '#0d1117', border: '1px solid #30363d',
                borderRadius: '3px', color: '#cdd9e5', fontSize: '10px',
                padding: '3px 6px', outline: 'none'
              }}
            />
            <button
              onClick={handleCreateGroup}
              disabled={!newGroupName.trim()}
              style={{
                background: newGroupName.trim() ? '#0f3460' : '#21262d',
                border: 'none', borderRadius: '3px',
                color: newGroupName.trim() ? '#64ffda' : '#484f58',
                fontSize: '10px', padding: '2px 6px', cursor: newGroupName.trim() ? 'pointer' : 'default'
              }}
            >
              ✓
            </button>
          </div>
        )}

        {/* Default group (always shown, cannot be deleted) */}
        <GroupItem
          groupId="default"
          groupName="默认"
          sessions={defaultSessions}
          activePaneId={activePaneId}
          isDefault={true}
        />

        {/* User-created groups */}
        {groups.map((group) => {
          const groupSessions = sessions.filter((s) => s.groupId === group.id)
          return (
            <GroupItem
              key={group.id}
              groupId={group.id}
              groupName={group.name}
              sessions={groupSessions}
              activePaneId={activePaneId}
            />
          )
        })}
      </div>

      <QuickCommands />
    </div>
  )
}
```

- [ ] **Step 3: Verify build is clean**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 4: Run full test suite**

```bash
npm test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Manual smoke test for group management**

Run the app and verify:
- Sidebar shows "终端分组" header with a `+` button
- Clicking `+` shows inline input field; pressing Enter creates a new group in the list
- Pressing Escape or clicking `×` dismisses without creating
- Hovering a user group shows ✏ and 🗑 icons
- Clicking ✏ turns the group name into an editable field; Enter saves, Escape cancels
- Clicking 🗑 shows a browser confirm dialog; confirming deletes the group
- The "默认" group has NO ✏ or 🗑 icons

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/Sidebar/Sidebar.tsx \
        src/renderer/src/components/Sidebar/GroupItem.tsx
git commit -m "feat: add group management UI — create, rename, and delete groups"
```

---

## Task 5: Integration pass and `.gitignore` update

**Files:**
- Modify: `.gitignore`

---

- [ ] **Step 1: Add `.superpowers/` to `.gitignore`**

Check if `.superpowers/` is already in `.gitignore`:

```bash
grep -n superpowers /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal/.gitignore
```

If the line is absent, append it:

```bash
echo '.superpowers/' >> /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal/.gitignore
```

- [ ] **Step 2: Run the full test suite one final time**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal && npm test
```

Expected output contains:
```
Test Files  X passed
Tests       XX passed
```

with zero failures.

- [ ] **Step 3: Verify TypeScript is clean**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (or only pre-existing errors).

- [ ] **Step 4: Final commit**

```bash
git add .gitignore
git commit -m "chore: add .superpowers to .gitignore"
```

---

## Summary

| Task | Key deliverable |
|---|---|
| 1 | `useSplitStore` rewritten as binary tree; 20+ tests |
| 2 | `splitLayout.ts` utility; 7 tests |
| 3 | `SplitPane` pool renderer + chrome overlay; `TerminalPane` keyboard shortcuts |
| 4 | Group create/rename/delete UI in sidebar |
| 5 | `.gitignore`, final test pass |
