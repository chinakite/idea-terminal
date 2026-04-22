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
      if (!Array.isArray(parsed.sessions)) return []
      return parsed.sessions.filter(
        (s) =>
          s &&
          typeof s.id === 'string' &&
          typeof s.title === 'string' &&
          typeof s.groupId === 'string' &&
          typeof s.lastCwd === 'string' &&
          Array.isArray(s.lastCommands)
      )
    } catch {
      try {
        copyFileSync(this.filePath, this.filePath + '.bak')
      } catch {
        // Backup failed (e.g. permission error) — proceed without backup
      }
      return []
    }
  }

  save(sessions: PersistedSessionData[]): void {
    const snapshot: SessionSnapshot = { version: 1, sessions }
    writeFileSync(this.filePath, JSON.stringify(snapshot, null, 2), 'utf-8')
  }
}
