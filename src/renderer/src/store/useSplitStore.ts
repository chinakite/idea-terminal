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
