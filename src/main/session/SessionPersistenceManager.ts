// src/main/session/SessionPersistenceManager.ts
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'fs'
import { join } from 'path'

export interface PersistedSessionData {
  id: string
  title: string
  groupId: string
  proxyId?: string
  lastCwd: string
  lastCommands: string[]
}

interface SessionSnapshot {
  version: number
  sessions: PersistedSessionData[]
}

export class SessionPersistenceManager {
  private readonly filePath: string

  constructor(userDataPath: string) {
    this.filePath = join(userDataPath, 'sessions.json')
  }

  load(): PersistedSessionData[] {
    if (!existsSync(this.filePath)) return []
    try {
      const raw = readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as SessionSnapshot
      return Array.isArray(parsed.sessions) ? parsed.sessions : []
    } catch {
      const backupPath = this.filePath + '.bak'
      copyFileSync(this.filePath, backupPath)
      return []
    }
  }

  save(sessions: PersistedSessionData[]): void {
    const snapshot: SessionSnapshot = { version: 1, sessions }
    writeFileSync(this.filePath, JSON.stringify(snapshot, null, 2), 'utf-8')
  }
}
