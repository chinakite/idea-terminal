// tests/renderer/store/useAiStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useAiStore } from '../../../src/renderer/src/store/useAiStore'
import type { AiMessage } from '../../../src/shared/types'

const msg = (role: AiMessage['role'], content: string): AiMessage => ({
  role,
  content,
  timestamp: 1000
})

describe('useAiStore', () => {
  beforeEach(() => {
    useAiStore.setState({ histories: {}, agentIds: {} })
  })

  it('initial state has empty histories and agentIds', () => {
    const { histories, agentIds } = useAiStore.getState()
    expect(histories).toEqual({})
    expect(agentIds).toEqual({})
  })

  it('addMessage adds to session history', () => {
    useAiStore.getState().addMessage('s1', msg('user', 'hello'))
    expect(useAiStore.getState().histories['s1']).toHaveLength(1)
    expect(useAiStore.getState().histories['s1'][0].content).toBe('hello')
  })

  it('appendToLast appends delta to last message content', () => {
    useAiStore.getState().addMessage('s1', msg('assistant', ''))
    useAiStore.getState().appendToLast('s1', 'Hello')
    useAiStore.getState().appendToLast('s1', ' world')
    expect(useAiStore.getState().histories['s1'][0].content).toBe('Hello world')
  })

  it('appendToLast does nothing when session has no messages', () => {
    useAiStore.getState().appendToLast('empty', 'data')
    expect(useAiStore.getState().histories['empty']).toBeUndefined()
  })

  it('clearHistory removes all messages for session', () => {
    useAiStore.getState().addMessage('s1', msg('user', 'hello'))
    useAiStore.getState().clearHistory('s1')
    expect(useAiStore.getState().histories['s1']).toHaveLength(0)
  })

  it('setAgentId sets selected agent for session', () => {
    useAiStore.getState().setAgentId('s1', 'agent-abc')
    expect(useAiStore.getState().agentIds['s1']).toBe('agent-abc')
  })

  it('multiple sessions maintain independent histories', () => {
    useAiStore.getState().addMessage('s1', msg('user', 'session-one'))
    useAiStore.getState().addMessage('s2', msg('user', 'session-two'))
    expect(useAiStore.getState().histories['s1'][0].content).toBe('session-one')
    expect(useAiStore.getState().histories['s2'][0].content).toBe('session-two')
  })
})
