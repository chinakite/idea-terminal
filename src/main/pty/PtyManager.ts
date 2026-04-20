// src/main/pty/PtyManager.ts
import * as pty from 'node-pty'
import { platform } from 'os'

export interface PtySession {
  id: string
  pid: number
  process: pty.IPty
}

interface CreateOptions {
  id: string
  cwd: string
  env?: Record<string, string>
  cols?: number
  rows?: number
}

export class PtyManager {
  private sessions = new Map<string, PtySession>()

  create(options: CreateOptions): { pid: number } {
    const shell = platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL ?? '/bin/zsh')
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: options.cols ?? 80,
      rows: options.rows ?? 24,
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) } as Record<string, string>
    })
    this.sessions.set(options.id, { id: options.id, pid: ptyProcess.pid, process: ptyProcess })
    return { pid: ptyProcess.pid }
  }

  get(id: string): PtySession | undefined {
    return this.sessions.get(id)
  }

  list(): PtySession[] {
    return Array.from(this.sessions.values())
  }

  write(id: string, data: string): void {
    this.sessions.get(id)?.process.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    this.sessions.get(id)?.process.resize(cols, rows)
  }

  destroy(id: string): void {
    const session = this.sessions.get(id)
    if (session) {
      session.process.kill()
      this.sessions.delete(id)
    }
  }

  destroyAll(): void {
    for (const id of [...this.sessions.keys()]) {
      this.destroy(id)
    }
  }

  onData(id: string, callback: (data: string) => void): pty.IDisposable | undefined {
    return this.sessions.get(id)?.process.onData(callback)
  }

  onExit(id: string, callback: (code: number) => void): pty.IDisposable | undefined {
    return this.sessions.get(id)?.process.onExit(({ exitCode }) => callback(exitCode))
  }
}
