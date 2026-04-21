// src/renderer/src/components/AiPanel/AiPanel.tsx
import { useState, useRef, useEffect } from 'react'
import { useConfigStore } from '../../store/useConfigStore'
import { useAiStore } from '../../store/useAiStore'
import { useTerminalOutputStore } from '../../store/useTerminalOutputStore'
import { useSplitStore } from '../../store/useSplitStore'
import { AiAgentForm } from './AiAgentForm'
import type { AiMessage } from '../../../../shared/types'

interface ContentPart {
  type: 'text' | 'code'
  value: string
  lang?: string
}

function parseContent(content: string): ContentPart[] {
  const parts: ContentPart[] = []
  const regex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'code', value: match[2].trim(), lang: match[1] || undefined })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) })
  }
  return parts
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function AiPanel(): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [input, setInput] = useState('')
  const [includeContext, setIncludeContext] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const requestIdRef = useRef<string | null>(null)
  const streamCleanupRef = useRef<(() => void) | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const agents = useConfigStore((s) => s.config.aiAgents)
  const { histories, agentIds, addMessage, appendToLast, setAgentId } = useAiStore()
  const getOutput = useTerminalOutputStore((s) => s.getOutput)
  const getActivePaneSessionId = useSplitStore((s) => s.getActivePaneSessionId)

  const sessionId = getActivePaneSessionId()
  const messages: AiMessage[] = sessionId ? (histories[sessionId] ?? []) : []
  const agentId: string | null = sessionId ? (agentIds[sessionId] ?? null) : null
  const selectedAgent = agents.find((a) => a.id === agentId) ?? null

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => {
      streamCleanupRef.current?.()
      if (requestIdRef.current) {
        window.api.abortAiMessage(requestIdRef.current)
      }
    }
  }, [])

  const handleSend = async (): Promise<void> => {
    if (!agentId || !input.trim() || isStreaming || !sessionId) return

    const userMsg: AiMessage = { role: 'user', content: input.trim(), timestamp: Date.now() }
    const assistantMsg: AiMessage = { role: 'assistant', content: '', timestamp: Date.now() }
    addMessage(sessionId, userMsg)
    addMessage(sessionId, assistantMsg)
    setInput('')
    setIsStreaming(true)

    const requestId = genId()
    requestIdRef.current = requestId

    const chatMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content
    }))

    const termCtx = includeContext ? getOutput(sessionId) : undefined

    const cleanupRef = { current: () => {} }

    const removeChunk = window.api.onAiChunk(requestId, (delta) => {
      appendToLast(sessionId, delta)
    })
    const removeEnd = window.api.onAiEnd(requestId, () => {
      setIsStreaming(false)
      requestIdRef.current = null
      cleanupRef.current()
    })
    const removeError = window.api.onAiError(requestId, (error) => {
      appendToLast(sessionId, `\n\n[错误: ${error}]`)
      setIsStreaming(false)
      requestIdRef.current = null
      cleanupRef.current()
    })

    cleanupRef.current = () => {
      removeChunk()
      removeEnd()
      removeError()
      streamCleanupRef.current = null
    }
    streamCleanupRef.current = cleanupRef.current

    window.api.sendAiMessage(requestId, agentId, chatMessages, termCtx)
  }

  const handleStop = (): void => {
    if (requestIdRef.current) {
      window.api.abortAiMessage(requestIdRef.current)
      setIsStreaming(false)
      requestIdRef.current = null
    }
  }

  const handleSendCode = (code: string): void => {
    if (sessionId) window.api.write(sessionId, code + '\r')
  }

  const headerLabel = selectedAgent
    ? `AI · ${selectedAgent.name} [${selectedAgent.model}]`
    : 'AI 面板'

  return (
    <div style={{
      flexShrink: 0,
      borderTop: '1px solid #21262d',
      backgroundColor: '#0d1117',
      display: 'flex',
      flexDirection: 'column',
      height: expanded ? '240px' : '28px',
      overflow: 'hidden',
      transition: 'height 0.15s ease'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: '28px',
        padding: '0 8px',
        backgroundColor: '#161b22',
        borderBottom: expanded ? '1px solid #21262d' : 'none',
        flexShrink: 0,
        gap: '8px',
        userSelect: 'none'
      }}>
        <span
          onClick={() => setExpanded(!expanded)}
          style={{ fontSize: '11px', color: '#768390', cursor: 'pointer', flex: 1 }}
        >
          {expanded ? '▼' : '▶'} {headerLabel}
        </span>

        {expanded && agents.length > 0 && (
          <select
            value={agentId ?? ''}
            onChange={(e) => sessionId && setAgentId(sessionId, e.target.value || null)}
            style={{
              backgroundColor: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: '3px',
              color: '#cdd9e5',
              fontSize: '10px',
              padding: '1px 4px',
              cursor: 'pointer'
            }}
          >
            <option value="">选择 Agent</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}

        {expanded && (
          <button
            onClick={() => setShowForm(!showForm)}
            title="添加 Agent"
            style={{
              background: 'none', border: 'none', color: '#768390',
              cursor: 'pointer', fontSize: '13px', lineHeight: 1
            }}
          >
            {showForm ? '×' : '+'}
          </button>
        )}
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {showForm ? (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <AiAgentForm
                onSaved={() => setShowForm(false)}
                onCancel={() => setShowForm(false)}
              />
            </div>
          ) : (
            <>
              {/* Message history */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {messages.length === 0 && !agentId && agents.length === 0 && (
                  <div style={{ color: '#484f58', fontSize: '12px', textAlign: 'center', paddingTop: '16px' }}>
                    点击右上角 + 添加 AI Agent
                  </div>
                )}
                {messages.length === 0 && agents.length > 0 && !agentId && (
                  <div style={{ color: '#484f58', fontSize: '12px', textAlign: 'center', paddingTop: '16px' }}>
                    从上方选择 Agent 后开始对话
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} style={{ marginBottom: '8px' }}>
                    <div style={{
                      fontSize: '10px',
                      color: msg.role === 'user' ? '#64ffda' : '#e94560',
                      marginBottom: '2px',
                      fontWeight: 'bold'
                    }}>
                      {msg.role === 'user' ? 'You' : (selectedAgent?.name ?? 'AI')}
                    </div>
                    {msg.role === 'user' ? (
                      <div style={{ fontSize: '12px', color: '#cdd9e5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {msg.content}
                      </div>
                    ) : (
                      <div>
                        {parseContent(msg.content).map((part, j) =>
                          part.type === 'text' ? (
                            <span key={j} style={{ fontSize: '12px', color: '#cdd9e5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {part.value}
                            </span>
                          ) : (
                            <div key={j} style={{ margin: '4px 0', backgroundColor: '#161b22', borderRadius: '4px', border: '1px solid #30363d', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 8px', backgroundColor: '#21262d' }}>
                                <span style={{ fontSize: '10px', color: '#768390' }}>{part.lang || 'code'}</span>
                                <button
                                  onClick={() => handleSendCode(part.value)}
                                  style={{
                                    background: 'none', border: 'none', color: '#64ffda',
                                    fontSize: '10px', cursor: 'pointer', padding: '1px 4px'
                                  }}
                                  title="发送到终端"
                                >
                                  ▶ 发送到终端
                                </button>
                              </div>
                              <pre style={{ margin: 0, padding: '6px 8px', fontSize: '11px', color: '#cdd9e5', overflowX: 'auto', fontFamily: 'Menlo, Monaco, monospace' }}>
                                {part.value}
                              </pre>
                            </div>
                          )
                        )}
                        {i === messages.length - 1 && isStreaming && (
                          <span style={{ color: '#64ffda', fontSize: '12px' }}>▍</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div style={{
                padding: '6px 8px',
                borderTop: '1px solid #21262d',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#768390', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeContext}
                      onChange={(e) => setIncludeContext(e.target.checked)}
                      style={{ accentColor: '#64ffda' }}
                    />
                    引用终端输出
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder={agentId ? '输入消息，Enter 发送...' : '请先选择 Agent'}
                    disabled={!agentId || isStreaming}
                    style={{
                      flex: 1,
                      backgroundColor: '#0d1117',
                      border: '1px solid #30363d',
                      borderRadius: '3px',
                      color: '#cdd9e5',
                      fontSize: '12px',
                      padding: '4px 8px',
                      outline: 'none'
                    }}
                  />
                  {isStreaming ? (
                    <button
                      onClick={handleStop}
                      style={{
                        backgroundColor: '#3d1f1f',
                        border: 'none',
                        borderRadius: '3px',
                        color: '#f85149',
                        fontSize: '11px',
                        padding: '4px 10px',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      停止
                    </button>
                  ) : (
                    <button
                      onClick={handleSend}
                      disabled={!agentId || !input.trim()}
                      style={{
                        backgroundColor: agentId && input.trim() ? '#0f3460' : '#21262d',
                        border: 'none',
                        borderRadius: '3px',
                        color: agentId && input.trim() ? '#64ffda' : '#484f58',
                        fontSize: '11px',
                        padding: '4px 10px',
                        cursor: agentId && input.trim() ? 'pointer' : 'default',
                        flexShrink: 0
                      }}
                    >
                      发送
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
