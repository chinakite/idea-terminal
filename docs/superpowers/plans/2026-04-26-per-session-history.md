# Per-Session Shell History — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each terminal session restore its own command history (via ↑ key) in isolation after app restart, by using a per-session ZDOTDIR wrapper that overrides zsh history settings after `~/.zshrc` runs.

**Architecture:** Only `PtyManager.ts` changes. When creating a zsh session with `histCommands`, write three wrapper zsh rc files into a per-session temp directory and set `ZDOTDIR` to that directory. Each wrapper sources the user's real config file first, then `.zshrc` overrides `HISTFILE`, disables history sharing, and loads the injected commands via `fc -R`. On `destroy()`, the temp directory is removed alongside the existing hist file cleanup.

**Tech Stack:** Node.js `fs` (mkdirSync, rmSync, writeFileSync, unlinkSync), node-pty, TypeScript

---

### Task 1: Add ZDOTDIR wrapper to PtyManager

**Files:**
- Modify: `src/main/pty/PtyManager.ts`
- Test: `tests/main/pty/PtyManager.test.ts`

**Context:**

`PtyManager.ts` currently injects history via a temp `HISTFILE`. The problem: `~/.zshrc` overrides `HISTFILE` during shell startup, so the injected history is lost and all sessions share `~/.zsh_history`. The fix uses `ZDOTDIR` so zsh loads our wrapper `.zshrc` instead of `~/.zshrc`. Our wrapper sources `~/.zshrc` first, then re-applies history settings at the end.

The existing `histFiles` map (`private histFiles = new Map<string, string>()`) tracks temp hist files for cleanup. We add a parallel `zdotDirs` map for the temp directories.

Current imports from `'fs'`: `realpathSync, writeFileSync, unlinkSync`  
Need to add: `mkdirSync, rmSync`

Current `create()` extraEnv block (lines 36–41):
```typescript
if (options.histCommands && options.histCommands.length > 0) {
  const histFile = join(tmpdir(), `idea-terminal-hist-${options.id}`)
  writeFileSync(histFile, options.histCommands.join('\n') + '\n', 'utf-8')
  extraEnv = { HISTFILE: histFile, HISTSIZE: '1000', HISTFILESIZE: '1000', SAVEHIST: '1000' }
  this.histFiles.set(options.id, histFile)
}
```

Current `destroy()` cleanup (lines 78–82):
```typescript
const histFile = this.histFiles.get(id)
if (histFile) {
  try { unlinkSync(histFile) } catch { /* already gone */ }
  this.histFiles.delete(id)
}
```

---

- [ ] **Step 1: Write failing tests**

Add to `tests/main/pty/PtyManager.test.ts` after the existing hist file tests (after line 89):

```typescript
// ── ZDOTDIR isolation (zsh only) ─────────────────────────────────────────────
const isZsh = (process.env.SHELL ?? '').endsWith('zsh') && process.platform !== 'win32'

it.skipIf(!isZsh)('create with histCommands creates ZDOTDIR with wrapper files', () => {
  const zdotDir = join(tmpdir(), 'idea-terminal-zdot-s-zdot')
  manager.create({ id: 's-zdot', cwd: process.cwd(), histCommands: ['ls', 'pwd'] })
  expect(existsSync(zdotDir)).toBe(true)
  expect(existsSync(join(zdotDir, '.zshenv'))).toBe(true)
  expect(existsSync(join(zdotDir, '.zprofile'))).toBe(true)
  expect(existsSync(join(zdotDir, '.zshrc'))).toBe(true)
})

it.skipIf(!isZsh)('destroy cleans up the ZDOTDIR', () => {
  const zdotDir = join(tmpdir(), 'idea-terminal-zdot-s-zdot2')
  manager.create({ id: 's-zdot2', cwd: process.cwd(), histCommands: ['ls'] })
  manager.destroy('s-zdot2')
  expect(existsSync(zdotDir)).toBe(false)
})

it.skipIf(!isZsh)('.zshrc wrapper contains HISTFILE override and fc -R', () => {
  const zdotDir = join(tmpdir(), 'idea-terminal-zdot-s-zdot3')
  manager.create({ id: 's-zdot3', cwd: process.cwd(), histCommands: ['echo hello'] })
  const { readFileSync } = require('fs')
  const zshrc = readFileSync(join(zdotDir, '.zshrc'), 'utf-8')
  expect(zshrc).toContain('source "$HOME/.zshrc"')
  expect(zshrc).toContain('HISTFILE="$_IDEA_HISTFILE"')
  expect(zshrc).toContain('unsetopt SHARE_HISTORY')
  expect(zshrc).toContain('fc -R "$HISTFILE"')
})
```

---

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/zhangzhonghua1/Work/Code/Tool/idea-terminal && npm test -- --reporter=verbose 2>&1 | grep -A 3 "zdot\|ZDOTDIR\|wrapper"
```

Expected: the three new tests FAIL (ZDOTDIR does not exist yet).

---

- [ ] **Step 3: Update imports in PtyManager.ts**

Change line 5 from:
```typescript
import { realpathSync, writeFileSync, unlinkSync } from 'fs'
```
To:
```typescript
import { realpathSync, writeFileSync, unlinkSync, mkdirSync, rmSync } from 'fs'
```

---

- [ ] **Step 4: Add `zdotDirs` field and `isZsh` helper**

After line 30 (`private histFiles = new Map<string, string>()`), add:

```typescript
/** Tracks per-session ZDOTDIR temp directories for cleanup */
private zdotDirs = new Map<string, string>()
```

---

- [ ] **Step 5: Replace the `create()` extraEnv block**

Replace lines 35–41 (the entire `let extraEnv` + `if (options.histCommands ...)` block) with:

```typescript
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
```

Note: `shell` is declared on the line just above this block (`const shell = ...`), so `isZsh` can reference it.

---

- [ ] **Step 6: Add ZDOTDIR cleanup to `destroy()`**

After the existing histFile cleanup block in `destroy()`, add:

```typescript
const zdotDir = this.zdotDirs.get(id)
if (zdotDir) {
  try { rmSync(zdotDir, { recursive: true, force: true }) } catch { /* already gone */ }
  this.zdotDirs.delete(id)
}
```

The complete `destroy()` method becomes:

```typescript
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
```

---

- [ ] **Step 7: Run tests — all should pass**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: All tests pass including the three new ZDOTDIR tests.

---

- [ ] **Step 8: Verify TypeScript build**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds, no TypeScript errors.

---

- [ ] **Step 9: Commit**

```bash
git add src/main/pty/PtyManager.ts tests/main/pty/PtyManager.test.ts
git commit -m "feat: use ZDOTDIR wrapper to isolate per-session zsh history"
```
