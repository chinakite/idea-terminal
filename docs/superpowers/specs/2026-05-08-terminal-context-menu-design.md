# Terminal Right-Click Context Menu Design

## Goal

Add a right-click context menu to the terminal pane with Copy and Paste actions. The menu is designed to be extensible — future items can be added with minimal changes.

## Architecture

Two files involved:

**New:** `src/renderer/src/components/Terminal/TerminalContextMenu.tsx`
Pure presentational component. Receives all state and callbacks via props; renders the floating menu and handles click-outside dismissal. Adding future menu items requires changes only to this file.

**Modified:** `src/renderer/src/components/Terminal/TerminalPane.tsx`
Owns `contextMenu` state (`{ x: number; y: number } | null`), attaches `onContextMenu` to the container div, reads xterm selection state, and implements the copy/paste action functions. Renders `<TerminalContextMenu>` when `contextMenu` is non-null.

This mirrors the existing `ThemePopup` + `SidebarBottomBar` pattern: parent holds state and business logic, child handles rendering.

## Component Interface

```tsx
interface TerminalContextMenuProps {
  position: { x: number; y: number }
  hasSelection: boolean
  onCopy: () => void
  onPaste: () => void
  onClose: () => void
}
```

Future items (e.g. "Clear", "Select All") are added as additional optional callbacks on this interface.

## Data Flow

### Triggering
1. User right-clicks inside the terminal container div
2. `onContextMenu` handler fires: `e.preventDefault()` suppresses the browser default menu
3. `term.getSelection() !== ''` is evaluated → sets `hasSelection`
4. Mouse coordinates relative to the page are stored in `contextMenu` state
5. `<TerminalContextMenu>` renders at the recorded position

### Copy
1. User clicks 「复制」(only enabled when `hasSelection` is true)
2. `navigator.clipboard.writeText(term.getSelection())`
3. Menu closes (`setContextMenu(null)`)

### Paste
1. User clicks 「粘贴」
2. `await navigator.clipboard.readText()` wrapped in `try/catch` (silent on failure)
3. `window.api.write(sessionId, text)` sends clipboard content to the PTY
4. Menu closes

### Closing
- Click outside the menu: `mousedown` listener on `document` (same pattern as `ThemePopup`)
- After any menu item action: `onClose` is called by the action handler

## Positioning

The menu is positioned using `position: fixed` with `left: position.x` and `top: position.y`. On render, the component checks if the menu would overflow the right or bottom edge of the viewport and flips direction accordingly:

- Right overflow: `right: viewport.width - position.x`, `left: unset`
- Bottom overflow: `bottom: viewport.height - position.y`, `top: unset`

## UI Style

Consistent with `ThemePopup` visual language:
- Background: `#1c2333`, border: `1px solid #30363d`, border-radius: `6px`
- Box shadow: `0 4px 16px rgba(0,0,0,0.4)`
- Menu item height: `32px`, padding: `0 16px`
- Hover state: background `#264f78`
- Disabled (「复制」when no selection): color `#484f58`, `cursor: default`, hover has no effect

## Copy State

`hasSelection` is computed at the moment the context menu opens (not reactively updated while open). This is correct behavior — if the user right-clicks, the selection is fixed at that point.

## Testing

New file: `tests/renderer/components/Terminal/TerminalContextMenu.test.tsx`

Test cases:
1. Menu renders at the correct position (`style.left` / `style.top` match `position` prop)
2. `hasSelection=false` → 「复制」has disabled styles and click does not invoke `onCopy`
3. `hasSelection=true` → clicking 「复制」invokes `onCopy`
4. Clicking 「粘贴」invokes `onPaste`
5. `mousedown` outside the menu invokes `onClose`

`TerminalPane` has no existing unit tests (xterm requires real DOM); no new TerminalPane tests are added.

## Files Summary

| Action | File |
|--------|------|
| Create | `src/renderer/src/components/Terminal/TerminalContextMenu.tsx` |
| Modify | `src/renderer/src/components/Terminal/TerminalPane.tsx` |
| Create | `tests/renderer/components/Terminal/TerminalContextMenu.test.tsx` |
