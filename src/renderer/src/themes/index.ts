// src/renderer/src/themes/index.ts
import type { ITheme } from 'xterm'

export type ThemeId =
  | 'github-dark'
  | 'dracula'
  | 'tokyo-night'
  | 'nord'
  | 'catppuccin'
  | 'solarized-light'

export interface ThemeEntry {
  name: string
  /** Hex color for the color dot in the popup UI */
  dot: string
  /** Full xterm.js ITheme color set */
  xterm: ITheme
}

export const DEFAULT_THEME_ID: ThemeId = 'github-dark'

export const THEMES: Record<ThemeId, ThemeEntry> = {
  'github-dark': {
    name: 'GitHub Dark',
    dot: '#0d1117',
    xterm: {
      background: '#0d1117',
      foreground: '#cdd9e5',
      cursor: '#cdd9e5',
      selectionBackground: '#264f78',
      black: '#484f58',   red: '#ff7b72',   green: '#3fb950',   yellow: '#d29922',
      blue: '#388bfd',   magenta: '#bc8cff', cyan: '#39c5cf',   white: '#b1bac4',
      brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364', brightYellow: '#e3b341',
      brightBlue: '#79c0ff', brightMagenta: '#d2a8ff', brightCyan: '#56d8dd', brightWhite: '#cdd9e5'
    }
  },
  'dracula': {
    name: 'Dracula',
    dot: '#282a36',
    xterm: {
      background: '#282a36',
      foreground: '#f8f8f2',
      cursor: '#f8f8f2',
      selectionBackground: '#44475a',
      black: '#21222c',   red: '#ff5555',   green: '#50fa7b',   yellow: '#f1fa8c',
      blue: '#bd93f9',   magenta: '#ff79c6', cyan: '#8be9fd',   white: '#f8f8f2',
      brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94', brightYellow: '#ffffa5',
      brightBlue: '#d6acff', brightMagenta: '#ff92df', brightCyan: '#a4ffff', brightWhite: '#ffffff'
    }
  },
  'tokyo-night': {
    name: 'Tokyo Night',
    dot: '#1a1b26',
    xterm: {
      background: '#1a1b26',
      foreground: '#a9b1d6',
      cursor: '#a9b1d6',
      selectionBackground: '#283457',
      black: '#32344a',   red: '#f7768e',   green: '#9ece6a',   yellow: '#e0af68',
      blue: '#7aa2f7',   magenta: '#ad8ee6', cyan: '#449dab',   white: '#787c99',
      brightBlack: '#444b6a', brightRed: '#ff7a93', brightGreen: '#b9f27c', brightYellow: '#ff9e64',
      brightBlue: '#7da6ff', brightMagenta: '#bb9af7', brightCyan: '#0db9d7', brightWhite: '#acb0d0'
    }
  },
  'nord': {
    name: 'Nord',
    dot: '#2e3440',
    xterm: {
      background: '#2e3440',
      foreground: '#d8dee9',
      cursor: '#d8dee9',
      selectionBackground: '#434c5e',
      black: '#3b4252',   red: '#bf616a',   green: '#a3be8c',   yellow: '#ebcb8b',
      blue: '#81a1c1',   magenta: '#b48ead', cyan: '#88c0d0',   white: '#e5e9f0',
      brightBlack: '#4c566a', brightRed: '#bf616a', brightGreen: '#a3be8c', brightYellow: '#ebcb8b',
      brightBlue: '#81a1c1', brightMagenta: '#b48ead', brightCyan: '#8fbcbb', brightWhite: '#eceff4'
    }
  },
  'catppuccin': {
    name: 'Catppuccin Mocha',
    dot: '#1e1e2e',
    xterm: {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      cursor: '#f5e0dc',
      selectionBackground: '#313244',
      black: '#45475a',   red: '#f38ba8',   green: '#a6e3a1',   yellow: '#f9e2af',
      blue: '#89b4fa',   magenta: '#f5c2e7', cyan: '#94e2d5',   white: '#bac2de',
      brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1', brightYellow: '#f9e2af',
      brightBlue: '#89b4fa', brightMagenta: '#f5c2e7', brightCyan: '#94e2d5', brightWhite: '#a6adc8'
    }
  },
  'solarized-light': {
    name: 'Solarized Light',
    dot: '#fdf6e3',
    xterm: {
      background: '#fdf6e3',
      foreground: '#657b83',
      cursor: '#586e75',
      selectionBackground: '#eee8d5',
      black: '#073642',   red: '#dc322f',   green: '#859900',   yellow: '#b58900',
      blue: '#268bd2',   magenta: '#d33682', cyan: '#2aa198',   white: '#eee8d5',
      brightBlack: '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75', brightYellow: '#657b83',
      brightBlue: '#839496', brightMagenta: '#6c71c4', brightCyan: '#93a1a1', brightWhite: '#fdf6e3'
    }
  }
}
