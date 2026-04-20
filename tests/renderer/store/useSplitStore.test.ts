// tests/renderer/store/useSplitStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useSplitStore } from '../../../src/renderer/src/store/useSplitStore'

describe('useSplitStore', () => {
  beforeEach(() => {
    useSplitStore.setState({
      panes: [{ id: 'p1', sessionId: null }],
      activePaneId: 'p1'
    })
  })

  it('starts with one empty pane', () => {
    const { panes, activePaneId } = useSplitStore.getState()
    expect(panes).toHaveLength(1)
    expect(panes[0].sessionId).toBeNull()
    expect(activePaneId).toBe('p1')
  })

  it('addPane adds a pane and makes it active', () => {
    const id = useSplitStore.getState().addPane('s1')
    const { panes, activePaneId } = useSplitStore.getState()
    expect(panes).toHaveLength(2)
    expect(panes[1].sessionId).toBe('s1')
    expect(activePaneId).toBe(id)
  })

  it('addPane returns null when 4 panes exist', () => {
    useSplitStore.setState({
      panes: [
        { id: 'p1', sessionId: null },
        { id: 'p2', sessionId: null },
        { id: 'p3', sessionId: null },
        { id: 'p4', sessionId: null }
      ],
      activePaneId: 'p1'
    })
    const result = useSplitStore.getState().addPane()
    expect(result).toBeNull()
  })

  it('removePane removes pane and updates active', () => {
    useSplitStore.setState({
      panes: [{ id: 'p1', sessionId: 's1' }, { id: 'p2', sessionId: 's2' }],
      activePaneId: 'p1'
    })
    useSplitStore.getState().removePane('p1')
    const { panes, activePaneId } = useSplitStore.getState()
    expect(panes).toHaveLength(1)
    expect(activePaneId).toBe('p2')
  })

  it('removePane keeps at least one pane', () => {
    useSplitStore.getState().removePane('p1')
    expect(useSplitStore.getState().panes).toHaveLength(1)
  })

  it('assignSession updates pane sessionId', () => {
    useSplitStore.getState().assignSession('p1', 's99')
    expect(useSplitStore.getState().panes[0].sessionId).toBe('s99')
  })

  it('clearSession nullifies matching pane', () => {
    useSplitStore.setState({
      panes: [{ id: 'p1', sessionId: 's1' }, { id: 'p2', sessionId: 's2' }],
      activePaneId: 'p1'
    })
    useSplitStore.getState().clearSession('s1')
    const { panes } = useSplitStore.getState()
    expect(panes[0].sessionId).toBeNull()
    expect(panes[1].sessionId).toBe('s2')
  })

  it('getActivePaneSessionId returns active pane session', () => {
    useSplitStore.setState({
      panes: [{ id: 'p1', sessionId: 'sess-abc' }],
      activePaneId: 'p1'
    })
    expect(useSplitStore.getState().getActivePaneSessionId()).toBe('sess-abc')
  })
})
