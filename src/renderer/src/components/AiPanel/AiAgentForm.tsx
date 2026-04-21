// src/renderer/src/components/AiPanel/AiAgentForm.tsx
import { useState } from 'react'
import { useConfigStore } from '../../store/useConfigStore'

interface AiAgentFormProps {
  onSaved: () => void
  onCancel?: () => void
}

const INPUT_STYLE: React.CSSProperties = {
  backgroundColor: '#0d1117',
  border: '1px solid #30363d',
  borderRadius: '3px',
  color: '#cdd9e5',
  fontSize: '11px',
  padding: '4px 8px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box'
}

const LABEL_STYLE: React.CSSProperties = {
  color: '#8892a4',
  fontSize: '10px',
  marginBottom: '2px',
  display: 'block'
}

export function AiAgentForm({ onSaved, onCancel }: AiAgentFormProps): JSX.Element {
  const [name, setName] = useState('')
  const [provider, setProvider] = useState<'claude' | 'openai' | 'custom'>('claude')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [baseUrl, setBaseUrl] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const defaultModel = {
    claude: 'claude-sonnet-4-6',
    openai: 'gpt-4o',
    custom: ''
  }

  const handleProviderChange = (p: typeof provider): void => {
    setProvider(p)
    setModel(defaultModel[p])
  }

  const handleSave = async (): Promise<void> => {
    if (!name.trim() || !apiKey.trim() || !model.trim()) {
      setError('名称、API Key 和模型均为必填项')
      return
    }
    setSaving(true)
    setError('')
    try {
      await window.api.saveAiAgent({
        name: name.trim(),
        provider,
        apiKey: apiKey.trim(),
        model: model.trim(),
        baseUrl: baseUrl.trim() || undefined,
        systemPrompt: systemPrompt.trim() || undefined
      })
      await useConfigStore.getState().load()
      onSaved()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px' }}>
      <div style={{ color: '#cdd9e5', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
        添加 AI Agent
      </div>

      <div>
        <label style={LABEL_STYLE}>名称</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="如：My Claude"
          style={INPUT_STYLE}
        />
      </div>

      <div>
        <label style={LABEL_STYLE}>提供商</label>
        <select
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value as typeof provider)}
          style={{ ...INPUT_STYLE }}
        >
          <option value="claude">Claude (Anthropic)</option>
          <option value="openai">OpenAI</option>
          <option value="custom">自定义（OpenAI 兼容）</option>
        </select>
      </div>

      <div>
        <label style={LABEL_STYLE}>API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          style={INPUT_STYLE}
        />
      </div>

      <div>
        <label style={LABEL_STYLE}>模型</label>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="claude-sonnet-4-6"
          style={INPUT_STYLE}
        />
      </div>

      {provider === 'custom' && (
        <div>
          <label style={LABEL_STYLE}>API 端点（Base URL）</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:11434/v1"
            style={INPUT_STYLE}
          />
        </div>
      )}

      <div>
        <label style={LABEL_STYLE}>系统提示（可选）</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="你是一个终端助手..."
          rows={2}
          style={{ ...INPUT_STYLE, resize: 'none' }}
        />
      </div>

      {error && (
        <div style={{ color: '#f85149', fontSize: '11px' }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 1,
            backgroundColor: '#0f3460',
            border: 'none',
            borderRadius: '3px',
            color: '#64ffda',
            fontSize: '11px',
            padding: '5px',
            cursor: saving ? 'wait' : 'pointer'
          }}
        >
          {saving ? '保存中...' : '保存'}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #30363d',
              borderRadius: '3px',
              color: '#8892a4',
              fontSize: '11px',
              padding: '5px 10px',
              cursor: 'pointer'
            }}
          >
            取消
          </button>
        )}
      </div>
    </div>
  )
}
