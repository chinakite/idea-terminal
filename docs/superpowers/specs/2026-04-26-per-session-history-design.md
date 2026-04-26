# Per-Session Shell History — Design Spec

## Goal

When the app restarts, each terminal session restores its own command history (accessible via ↑), fully isolated from other sessions.

## Root Cause

`PtyManager.create()` injects per-session history by setting `HISTFILE=/tmp/idea-terminal-hist-{id}` in the PTY environment. This works in theory, but in practice `~/.zshrc` (or frameworks like Oh My Zsh) overrides `HISTFILE` back to `~/.zsh_history` during shell startup. As a result all sessions share one history file.

Additionally, zsh's `SHARE_HISTORY` option (common default) causes running shells to share history in real-time, further mixing commands across sessions.

## Approach: ZDOTDIR Wrapper (zsh only)

For each session, create a temporary ZDOTDIR directory containing three wrapper files. When `ZDOTDIR` is set, zsh loads rc files from that directory instead of `~/`. Each wrapper sources the user's real config file first (preserving PATH, plugins, etc.), then overrides history settings at the end — after the user's config has run.

Non-zsh shells (bash, fish, etc.) keep the existing HISTFILE-only injection. macOS default shell has been zsh since Catalina.

## File Structure per Session

```
/tmp/idea-terminal-zdot-{id}/
  .zshenv    — sources ~/.zshenv
  .zprofile  — sources ~/.zprofile  (preserves PATH for login shells)
  .zshrc     — sources ~/.zshrc, then overrides HISTFILE + history options
```

### .zshenv
```zsh
[ -f "$HOME/.zshenv" ] && source "$HOME/.zshenv"
```

### .zprofile
```zsh
[ -f "$HOME/.zprofile" ] && source "$HOME/.zprofile"
```

### .zshrc
```zsh
[ -f "$HOME/.zshrc" ] && source "$HOME/.zshrc"
# Override history settings — applied after user's config so nothing overwrites us
HISTFILE="$_IDEA_HISTFILE"
unsetopt SHARE_HISTORY 2>/dev/null
unsetopt INC_APPEND_HISTORY 2>/dev/null
HISTSIZE=1000
SAVEHIST=1000
[ -s "$HISTFILE" ] && fc -R "$HISTFILE"
```

## Environment Variables

| Variable | Value | Purpose |
|---|---|---|
| `ZDOTDIR` | `/tmp/idea-terminal-zdot-{id}` | Makes zsh load our wrapper files |
| `_IDEA_HISTFILE` | `/tmp/idea-terminal-hist-{id}` | Passed to .zshrc; never overridden by user config |
| `HISTFILE` | `/tmp/idea-terminal-hist-{id}` | Pre-set for non-login shell edge cases |

`_IDEA_HISTFILE` is an app-internal env var. User's `.zshrc` does not know about it, so it can't be accidentally overridden.

## Cleanup

`PtyManager.destroy(id)` already removes the temp hist file. It must also remove the ZDOTDIR directory (`rmSync(zdotDir, { recursive: true })`). A new `zdotDirs = new Map<string, string>()` tracks this alongside the existing `histFiles` map.

## Files to Modify

- `src/main/pty/PtyManager.ts`
  - `create()`: for zsh, build wrapper files and set `ZDOTDIR` / `_IDEA_HISTFILE`
  - `destroy()`: remove zdot dir in addition to hist file
  - Add `private zdotDirs = new Map<string, string>()`
