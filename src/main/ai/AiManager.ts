// src/main/ai/AiManager.ts
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AgentParams {
  provider: 'claude' | 'openai' | 'custom'
  apiKey: string
  model: string
  baseUrl?: string
  systemPrompt?: string
}

export class AiManager {
  async stream(
    agent: AgentParams,
    messages: ChatMessage[],
    onChunk: (delta: string) => void,
    signal: AbortSignal
  ): Promise<void> {
    if (agent.provider === 'claude') {
      await this.streamClaude(agent, messages, onChunk, signal)
    } else {
      await this.streamOpenAi(agent, messages, onChunk, signal)
    }
  }

  private async streamClaude(
    agent: AgentParams,
    messages: ChatMessage[],
    onChunk: (delta: string) => void,
    signal: AbortSignal
  ): Promise<void> {
    const client = new Anthropic({ apiKey: agent.apiKey })
    const stream = client.messages.stream({
      model: agent.model,
      max_tokens: 4096,
      system: agent.systemPrompt,
      messages
    })
    const abortHandler = (): void => stream.abort()
    signal.addEventListener('abort', abortHandler)
    if (signal.aborted) stream.abort()
    try {
      for await (const event of stream) {
        if (signal.aborted) break
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          onChunk(event.delta.text)
        }
      }
    } finally {
      signal.removeEventListener('abort', abortHandler)
    }
  }

  private async streamOpenAi(
    agent: AgentParams,
    messages: ChatMessage[],
    onChunk: (delta: string) => void,
    signal: AbortSignal
  ): Promise<void> {
    const client = new OpenAI({ apiKey: agent.apiKey, baseURL: agent.baseUrl })
    const systemMsgs: OpenAI.Chat.ChatCompletionMessageParam[] = agent.systemPrompt
      ? [{ role: 'system', content: agent.systemPrompt }]
      : []
    const chatMsgs: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content
    }))
    const completion = await client.chat.completions.create(
      { model: agent.model, messages: [...systemMsgs, ...chatMsgs], stream: true },
      { signal }
    )
    for await (const chunk of completion) {
      if (signal.aborted) break
      const delta = chunk.choices[0]?.delta?.content ?? ''
      if (delta) onChunk(delta)
    }
  }
}
