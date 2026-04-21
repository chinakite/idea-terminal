// tests/renderer/store/useSessionStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from '../../../src/renderer/src/store/useSessionStore'
import type { RuntimeSession } from '../../../src/renderer/src/store/useSessionStore'

const s = (id: string, groupId: string, title: string): RuntimeSession => ({
  id, title, groupId, pid: 1, status: 'running'
})

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({ sessions: [], activeSessionId: null })
  })

  // ── renameSession ──────────────────────────────────────────────────────────

  describe('renameSession', () => {
    it('updates the title of the matching session', () => {
      useSessionStore.setState({ sessions: [s('s1', 'default', '终端 1')] })
      useSessionStore.getState().renameSession('s1', 'My Server')
      expect(useSessionStore.getState().sessions[0].title).toBe('My Server')
    })

    it('does not affect other sessions', () => {
      useSessionStore.setState({ sessions: [s('s1', 'default', '终端 1'), s('s2', 'default', '终端 2')] })
      useSessionStore.getState().renameSession('s1', 'Renamed')
      expect(useSessionStore.getState().sessions[1].title).toBe('终端 2')
    })

    it('does nothing when session id does not exist', () => {
      useSessionStore.setState({ sessions: [s('s1', 'default', '终端 1')] })
      useSessionStore.getState().renameSession('nonexistent', 'Renamed')
      expect(useSessionStore.getState().sessions[0].title).toBe('终端 1')
    })
  })

  // ── moveSession ────────────────────────────────────────────────────────────

  describe('moveSession', () => {
    beforeEach(() => {
      useSessionStore.setState({
        sessions: [
          s('a1', 'grp-a', 'A1'),
          s('a2', 'grp-a', 'A2'),
          s('b1', 'grp-b', 'B1'),
          s('b2', 'grp-b', 'B2'),
        ]
      })
    })

    it('updates the groupId of the moved session', () => {
      useSessionStore.getState().moveSession('a1', 'grp-b', 'b2')
      const moved = useSessionStore.getState().sessions.find((s) => s.id === 'a1')
      expect(moved?.groupId).toBe('grp-b')
    })

    it('inserts immediately after insertAfterId', () => {
      useSessionStore.getState().moveSession('a1', 'grp-b', 'b1')
      const ids = useSessionStore.getState().sessions.map((s) => s.id)
      expect(ids.indexOf('a1')).toBe(ids.indexOf('b1') + 1)
    })

    it('inserts before the first session of target group when insertAfterId is null', () => {
      useSessionStore.getState().moveSession('a1', 'grp-b', null)
      const ids = useSessionStore.getState().sessions.map((s) => s.id)
      expect(ids.indexOf('a1')).toBeLessThan(ids.indexOf('b1'))
    })

    it('appends to end when insertAfterId is null and target group has no sessions', () => {
      useSessionStore.getState().moveSession('a1', 'grp-empty', null)
      const moved = useSessionStore.getState().sessions.find((s) => s.id === 'a1')
      expect(moved?.groupId).toBe('grp-empty')
    })

    it('handles same-group reorder: move a1 after a2 within grp-a', () => {
      useSessionStore.getState().moveSession('a1', 'grp-a', 'a2')
      const ids = useSessionStore.getState().sessions.map((s) => s.id)
      expect(ids.indexOf('a1')).toBe(ids.indexOf('a2') + 1)
    })

    it('does nothing when session id does not exist', () => {
      const before = useSessionStore.getState().sessions.map((s) => s.id)
      useSessionStore.getState().moveSession('nonexistent', 'grp-b', null)
      const after = useSessionStore.getState().sessions.map((s) => s.id)
      expect(after).toEqual(before)
    })
  })
})
