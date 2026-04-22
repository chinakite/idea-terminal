import { describe, it, expect, beforeEach } from 'vitest'
import { useCommandHistoryStore } from '../../../src/renderer/src/store/useCommandHistoryStore'

describe('useCommandHistoryStore', () => {
  beforeEach(() => {
    useCommandHistoryStore.setState({ history: {} })
  })

  it('starts with empty history', () => {
    expect(useCommandHistoryStore.getState().history).toEqual({})
  })

  it('adds a command for a session', () => {
    useCommandHistoryStore.getState().addCommand('s1', 'ls')
    expect(useCommandHistoryStore.getState().history['s1']).toEqual(['ls'])
  })

  it('appends subsequent commands in order', () => {
    useCommandHistoryStore.getState().addCommand('s1', 'ls')
    useCommandHistoryStore.getState().addCommand('s1', 'pwd')
    expect(useCommandHistoryStore.getState().history['s1']).toEqual(['ls', 'pwd'])
  })

  it('caps at 10 commands, dropping the oldest', () => {
    const { addCommand } = useCommandHistoryStore.getState()
    for (let i = 1; i <= 12; i++) addCommand('s1', `cmd${i}`)
    const history = useCommandHistoryStore.getState().history['s1']
    expect(history).toHaveLength(10)
    expect(history[0]).toBe('cmd3')
    expect(history[9]).toBe('cmd12')
  })

  it('keeps separate history per session', () => {
    useCommandHistoryStore.getState().addCommand('s1', 'ls')
    useCommandHistoryStore.getState().addCommand('s2', 'pwd')
    expect(useCommandHistoryStore.getState().history['s1']).toEqual(['ls'])
    expect(useCommandHistoryStore.getState().history['s2']).toEqual(['pwd'])
  })

  it('clearSession removes the session history', () => {
    useCommandHistoryStore.getState().addCommand('s1', 'ls')
    useCommandHistoryStore.getState().clearSession('s1')
    expect(useCommandHistoryStore.getState().history['s1']).toBeUndefined()
  })

  it('clearSession does not affect other sessions', () => {
    useCommandHistoryStore.getState().addCommand('s1', 'ls')
    useCommandHistoryStore.getState().addCommand('s2', 'pwd')
    useCommandHistoryStore.getState().clearSession('s1')
    expect(useCommandHistoryStore.getState().history['s2']).toEqual(['pwd'])
  })
})
