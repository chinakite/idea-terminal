// src/renderer/src/utils/splitLayout.ts
import type { SplitNode } from '../store/useSplitStore'

export const DIVIDER_SIZE = 4   // px — width/height of the draggable divider bar
export const HEADER_HEIGHT = 28 // px — height of each pane's title bar

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
  leaves: Map<string, LeafLayout>  // leafId → bounds of the full leaf area (including header)
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
    dividers.push({
      splitId: node.id,
      direction: 'h',
      ratio: node.ratio,
      top: y,
      left: x + firstW,
      width: DIVIDER_SIZE,
      height: h
    })
    recurse(node.first, x, y, firstW, h, leaves, dividers)
    recurse(node.second, secondX, y, secondW, h, leaves, dividers)
  } else {
    const firstH = Math.round((h - DIVIDER_SIZE) * node.ratio)
    const secondY = y + firstH + DIVIDER_SIZE
    const secondH = h - firstH - DIVIDER_SIZE
    dividers.push({
      splitId: node.id,
      direction: 'v',
      ratio: node.ratio,
      top: y + firstH,
      left: x,
      width: w,
      height: DIVIDER_SIZE
    })
    recurse(node.first, x, y, w, firstH, leaves, dividers)
    recurse(node.second, x, secondY, w, secondH, leaves, dividers)
  }
}

/**
 * Computes absolute pixel positions for all leaves and dividers in the tree.
 *
 * Leaf bounds include the full area (header + terminal content).
 * To get the terminal content area, subtract HEADER_HEIGHT from the top and height.
 *
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
