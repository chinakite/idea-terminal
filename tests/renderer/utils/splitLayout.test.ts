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

  it('content area height fits within leaf bounds', () => {
    const { leaves } = computeLayout(leaf('a'), 800, 600)
    const bounds = leaves.get('a')!
    expect(bounds.height - HEADER_HEIGHT).toBeGreaterThan(0)
  })

  it('divider carries the ratio of its split node', () => {
    const tree = split('s1', 'h', leaf('a'), leaf('b'), 0.3)
    const { dividers } = computeLayout(tree, 800, 600)
    expect(dividers[0].ratio).toBe(0.3)
  })

  it('divider has correct position for horizontal split', () => {
    const tree = split('s1', 'h', leaf('a'), leaf('b'), 0.5)
    const { dividers } = computeLayout(tree, 800, 600)
    const firstW = Math.round((800 - DIVIDER_SIZE) * 0.5)
    expect(dividers[0].left).toBe(firstW)
    expect(dividers[0].top).toBe(0)
    expect(dividers[0].width).toBe(DIVIDER_SIZE)
    expect(dividers[0].height).toBe(600)
  })

  it('divider has correct position for vertical split', () => {
    const tree = split('s1', 'v', leaf('a'), leaf('b'), 0.4)
    const { dividers } = computeLayout(tree, 800, 600)
    const firstH = Math.round((600 - DIVIDER_SIZE) * 0.4)
    expect(dividers[0].top).toBe(firstH)
    expect(dividers[0].left).toBe(0)
    expect(dividers[0].width).toBe(800)
    expect(dividers[0].height).toBe(DIVIDER_SIZE)
  })

  it('all leaves together cover the full container width (horizontal split)', () => {
    const tree = split('s1', 'h', leaf('a'), leaf('b'), 0.5)
    const { leaves, dividers } = computeLayout(tree, 800, 600)
    const totalW = Array.from(leaves.values()).reduce((sum, l) => sum + l.width, 0)
    expect(totalW + dividers.length * DIVIDER_SIZE).toBe(800)
  })
})
