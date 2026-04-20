// tests/main/ai/AiManager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAnthropicStream = {
  [Symbol.asyncIterator]: async function* () {
    yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } }
    yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } }
    yield { type: 'message_stop' }
  },
  abort: vi.fn()
}

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      stream: vi.fn().mockReturnValue(mockAnthropicStream)
    }
  }
}))

const mockOpenAiStream = {
  [Symbol.asyncIterator]: async function* () {
    yield { choices: [{ delta: { content: 'Hi' } }] }
    yield { choices: [{ delta: { content: ' there' } }] }
  }
}

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue(mockOpenAiStream)
      }
    }
  }
}))

const { AiManager } = await import('../../../src/main/ai/AiManager')

describe('AiManager', () => {
  let manager: InstanceType<typeof AiManager>

  beforeEach(() => {
    manager = new AiManager()
    vi.clearAllMocks()
    mockAnthropicStream.abort.mockReset()
  })

  it('streams Claude response chunk by chunk', async () => {
    const chunks: string[] = []
    const controller = new AbortController()
    await manager.stream(
      { provider: 'claude', apiKey: 'sk-test', model: 'claude-sonnet-4-6' },
      [{ role: 'user', content: 'hello' }],
      (delta) => chunks.push(delta),
      controller.signal
    )
    expect(chunks).toEqual(['Hello', ' world'])
  })

  it('streams OpenAI response chunk by chunk', async () => {
    const chunks: string[] = []
    const controller = new AbortController()
    await manager.stream(
      { provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o' },
      [{ role: 'user', content: 'hello' }],
      (delta) => chunks.push(delta),
      controller.signal
    )
    expect(chunks).toEqual(['Hi', ' there'])
  })

  it('streams custom provider using OpenAI-compatible path', async () => {
    const chunks: string[] = []
    const controller = new AbortController()
    await manager.stream(
      { provider: 'custom', apiKey: 'key', model: 'llama3', baseUrl: 'http://localhost:11434/v1' },
      [{ role: 'user', content: 'hi' }],
      (delta) => chunks.push(delta),
      controller.signal
    )
    expect(chunks).toEqual(['Hi', ' there'])
  })

  it('aborts Claude stream when signal fires', async () => {
    const controller = new AbortController()
    controller.abort()
    await manager.stream(
      { provider: 'claude', apiKey: 'sk-test', model: 'claude-sonnet-4-6' },
      [{ role: 'user', content: 'hello' }],
      vi.fn(),
      controller.signal
    )
    expect(mockAnthropicStream.abort).toHaveBeenCalled()
  })
})
