// src/main/pty/PtyManager.ts
import * as pty from 'node-pty'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { realpathSync, writeFileSync, unlinkSync, mkdirSync, rmSync } from 'fs'
import { homedir, platform, tmpdir } from 'os'
import { join } from 'path'

const execFileAsync = promisify(execFile)

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
  /** Tracks per-session ZDOTDIR temp directories for cleanup */
  private zdotDirs = new Map<string, string>()

  create(options: CreateOptions): { pid: number } {
    const shell = platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL ?? '/bin/zsh')

    let extraEnv: Record<string, string> = {}
    if (options.histCommands && options.histCommands.length > 0) {
      const histFile = join(tmpdir(), `idea-terminal-hist-${options.id}`)
      writeFileSync(histFile, options.histCommands.join('\n') + '\n', 'utf-8')
      this.histFiles.set(options.id, histFile)

      const isZsh = platform() !== 'win32' && (shell.endsWith('/zsh') || shell === 'zsh')
      if (isZsh) {
        const zdotDir = join(tmpdir(), `idea-terminal-zdot-${options.id}`)
        mkdirSync(zdotDir, { recursive: true })
        writeFileSync(join(zdotDir, '.zshenv'), '[ -f "$HOME/.zshenv" ] && source "$HOME/.zshenv"\n', 'utf-8')
        writeFileSync(join(zdotDir, '.zprofile'), '[ -f "$HOME/.zprofile" ] && source "$HOME/.zprofile"\n', 'utf-8')
        writeFileSync(
          join(zdotDir, '.zshrc'),
          [
            '[ -f "$HOME/.zshrc" ] && source "$HOME/.zshrc"',
            'HISTFILE="$_IDEA_HISTFILE"',
            'unsetopt SHARE_HISTORY 2>/dev/null',
            'unsetopt INC_APPEND_HISTORY 2>/dev/null',
            'HISTSIZE=1000',
            'SAVEHIST=1000',
            '[ -s "$HISTFILE" ] && fc -R "$HISTFILE"',
            ''
          ].join('\n'),
          'utf-8'
        )
        this.zdotDirs.set(options.id, zdotDir)
        extraEnv = {
          HISTFILE: histFile,
          HISTSIZE: '1000',
          HISTFILESIZE: '1000',
          SAVEHIST: '1000',
          ZDOTDIR: zdotDir,
          _IDEA_HISTFILE: histFile
        }
      } else {
        extraEnv = { HISTFILE: histFile, HISTSIZE: '1000', HISTFILESIZE: '1000', SAVEHIST: '1000' }
      }
    }

    // Use login shell so it sources ~/.zshrc / ~/.zprofile and gets the full PATH
    const shellArgs = platform() === 'win32' ? [] : ['-l']
    const ptyProcess = pty.spawn(shell, shellArgs, {
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
    const zdotDir = this.zdotDirs.get(id)
    if (zdotDir) {
      try { rmSync(zdotDir, { recursive: true, force: true }) } catch { /* already gone */ }
      this.zdotDirs.delete(id)
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
        const { stdout } = await execFileAsync('lsof', ['-p', String(pid), '-a', '-d', 'cwd', '-Fn'])
        const line = stdout.split('\n').find((l) => l.startsWith('n'))
        return line ? line.slice(1).trim() : homedir()
      } else if (platform() === 'linux') {
        return realpathSync(`/proc/${pid}/cwd`)
      }
    } catch {
      // Process exited or platform unsupported — fall back
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
