// tests/renderer/store/useConfigStore.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DEFAULT_CONFIG } from '../../../src/shared/types'

const mockApi = {
  loadConfig: vi.fn().mockResolvedValue(structuredClone(DEFAULT_CONFIG)),
  saveConfig: vi.fn().mockResolvedValue(undefined)
}

vi.stubGlobal('window', { api: mockApi })

// Import AFTER stubbing global so the store sees window.api
const { useConfigStore } = await import('../../../src/renderer/src/store/useConfigStore')

describe('useConfigStore', () => {
  beforeEach(() => {
    useConfigStore.setState({ config: structuredClone(DEFAULT_CONFIG), isLoaded: false })
    vi.clearAllMocks()
  })

  it('load calls window.api.loadConfig and sets isLoaded', async () => {
    await useConfigStore.getState().load()
    expect(mockApi.loadConfig).toHaveBeenCalledOnce()
    expect(useConfigStore.getState().isLoaded).toBe(true)
  })

  it('addGroup adds a group and saves', () => {
    const group = useConfigStore.getState().addGroup('Project A')
    const { config } = useConfigStore.getState()
    expect(config.groups).toHaveLength(1)
    expect(config.groups[0].name).toBe('Project A')
    expect(group.id).toBeTruthy()
    expect(mockApi.saveConfig).toHaveBeenCalledOnce()
  })

  it('renameGroup updates name and saves', () => {
    const group = useConfigStore.getState().addGroup('Old Name')
    vi.clearAllMocks()
    useConfigStore.getState().renameGroup(group.id, 'New Name')
    expect(useConfigStore.getState().config.groups[0].name).toBe('New Name')
    expect(mockApi.saveConfig).toHaveBeenCalledOnce()
  })

  it('removeGroup removes by id and saves', () => {
    const group = useConfigStore.getState().addGroup('Temp')
    vi.clearAllMocks()
    useConfigStore.getState().removeGroup(group.id)
    expect(useConfigStore.getState().config.groups).toHaveLength(0)
    expect(mockApi.saveConfig).toHaveBeenCalledOnce()
  })

  it('addQuickCommand adds and saves', () => {
    const qc = useConfigStore.getState().addQuickCommand('List files', 'ls -la')
    expect(useConfigStore.getState().config.quickCommands).toHaveLength(1)
    expect(qc.command).toBe('ls -la')
    expect(mockApi.saveConfig).toHaveBeenCalledOnce()
  })

  it('removeQuickCommand removes by id and saves', () => {
    const qc = useConfigStore.getState().addQuickCommand('List files', 'ls -la')
    vi.clearAllMocks()
    useConfigStore.getState().removeQuickCommand(qc.id)
    expect(useConfigStore.getState().config.quickCommands).toHaveLength(0)
    expect(mockApi.saveConfig).toHaveBeenCalledOnce()
  })
})
