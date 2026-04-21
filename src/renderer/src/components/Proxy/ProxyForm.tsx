// src/renderer/src/components/Proxy/ProxyForm.tsx
import { useState } from 'react'
import { useConfigStore } from '../../store/useConfigStore'

interface ProxyFormProps {
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

export function ProxyForm({ onSaved, onCancel }: ProxyFormProps): JSX.Element {
  const [name, setName] = useState('')
  const [type, setType] = useState<'http' | 'socks5'>('http')
  const [host, setHost] = useState('127.0.0.1')
  const [port, setPort] = useState('7890')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const addProxy = useConfigStore((s) => s.addProxy)

  const handleSave = (): void => {
    if (!name.trim() || !host.trim() || !port.trim()) {
      setError('名称、地址和端口均为必填项')
      return
    }
    const portNum = parseInt(port, 10)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setError('端口号必须为 1-65535 之间的数字')
      return
    }
    setError('')
    addProxy({
      name: name.trim(),
      type,
      host: host.trim(),
      port: portNum,
      username: username.trim() || undefined,
      password: password.trim() || undefined
    })
    onSaved()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px' }}>
      <div style={{ color: '#cdd9e5', fontSize: '11px', fontWeight: 'bold', marginBottom: '2px' }}>
        添加代理
      </div>

      <div>
        <label style={LABEL_STYLE}>名称</label>
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="如：本地 Clash" style={INPUT_STYLE} />
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        <div style={{ flex: 1 }}>
          <label style={LABEL_STYLE}>类型</label>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)}
            style={INPUT_STYLE}>
            <option value="http">HTTP</option>
            <option value="socks5">SOCKS5</option>
          </select>
        </div>
        <div style={{ flex: 2 }}>
          <label style={LABEL_STYLE}>地址</label>
          <input value={host} onChange={(e) => setHost(e.target.value)}
            placeholder="127.0.0.1" style={INPUT_STYLE} />
        </div>
        <div style={{ width: '60px' }}>
          <label style={LABEL_STYLE}>端口</label>
          <input value={port} onChange={(e) => setPort(e.target.value)}
            placeholder="7890" style={INPUT_STYLE} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        <div style={{ flex: 1 }}>
          <label style={LABEL_STYLE}>用户名（可选）</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="user" style={INPUT_STYLE} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={LABEL_STYLE}>密码（可选）</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••" style={INPUT_STYLE} />
        </div>
      </div>

      {error && <div style={{ color: '#f85149', fontSize: '10px' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={handleSave} style={{
          flex: 1, backgroundColor: '#0f3460', border: 'none', borderRadius: '3px',
          color: '#64ffda', fontSize: '11px', padding: '5px', cursor: 'pointer'
        }}>保存</button>
        {onCancel && (
          <button onClick={onCancel} style={{
            backgroundColor: 'transparent', border: '1px solid #30363d', borderRadius: '3px',
            color: '#8892a4', fontSize: '11px', padding: '5px 10px', cursor: 'pointer'
          }}>取消</button>
        )}
      </div>
    </div>
  )
}
