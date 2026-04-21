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
    const { activePaneId } = useSplitStore.getState()
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
