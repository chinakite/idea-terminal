// src/main/pty/PtyManager.ts
import * as pty from 'node-pty'
import { execSync } from 'child_process'
import { realpathSync, writeFileSync, unlinkSync } from 'fs'
import { homedir, platform, tmpdir } from 'os'
import { join } from 'path'

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
  /** Commands to inject into the shell's history via HISTFILE on startup */
  histCommands?: string[]
}

export class PtyManager {
  private sessions = new Map<string, PtySession>()
  /** Tracks temp history files so they can be cleaned up on destroy */
  private histFiles = new Map<string, string>()

  create(options: CreateOptions): { pid: number } {
    const shell = platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL ?? '/bin/zsh')

    let extraEnv: Record<string, string> = {}
    if (options.histCommands && options.histCommands.length > 0) {
      const histFile = join(tmpdir(), `idea-terminal-hist-${options.id}`)
      writeFileSync(histFile, options.histCommands.join('\n'), 'utf-8')
      extraEnv = { HISTFILE: histFile, HISTSIZE: '1000', HISTFILESIZE: '1000' }
      this.histFiles.set(options.id, histFile)
    }

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: options.cols ?? 80,
      rows: options.rows ?? 24,
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}), ...extraEnv } as Record<string, string>
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
    const histFile = this.histFiles.get(id)
    if (histFile) {
      try { unlinkSync(histFile) } catch { /* already gone */ }
      this.histFiles.delete(id)
    }
  }

  destroyAll(): void {
    for (const id of [...this.sessions.keys()]) {
      this.destroy(id)
    }
  }

  /** Reads the current working directory of the PTY process via OS-level tools.
   *  Falls back to homedir() on failure or unsupported platform. */
  async getCwd(id: string): Promise<string> {
    const session = this.sessions.get(id)
    if (!session) return homedir()
    const { pid } = session
    try {
      if (platform() === 'darwin') {
        const result = execSync(
          `lsof -p ${pid} -a -d cwd -Fn 2>/dev/null | grep '^n' | sed 's/^n//'`,
          { encoding: 'utf-8' }
        ).trim()
        return result || homedir()
      } else if (platform() === 'linux') {
        return realpathSync(`/proc/${pid}/cwd`)
      }
    } catch {
      // fallthrough to homedir
    }
    return homedir()
  }

  onData(id: string, callback: (data: string) => void): pty.IDisposable | undefined {
    return this.sessions.get(id)?.process.onData(callback)
  }

  onExit(id: string, callback: (code: number) => void): pty.IDisposable | undefined {
    return this.sessions.get(id)?.process.onExit(({ exitCode }) => callback(exitCode))
  }
}
