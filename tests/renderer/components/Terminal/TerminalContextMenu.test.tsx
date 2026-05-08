// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { TerminalContextMenu } from '../../../../src/renderer/src/components/Terminal/TerminalContextMenu'

describe('TerminalContextMenu', () => {
  const position = { x: 100, y: 200 }

  it('renders at the correct position', () => {
    const { container } = render(
      <TerminalContextMenu
        position={position}
        hasSelection={false}
        onCopy={vi.fn()}
        onPaste={vi.fn()}
        onClose={vi.fn()}
      />
    )
    const menu = container.firstChild as HTMLElement
    expect(menu.style.left).toBe('100px')
    expect(menu.style.top).toBe('200px')
  })

  it('does not call onCopy when 复制 is clicked and hasSelection is false', () => {
    const onCopy = vi.fn()
    const { getByText } = render(
      <TerminalContextMenu
        position={position}
        hasSelection={false}
        onCopy={onCopy}
        onPaste={vi.fn()}
        onClose={vi.fn()}
      />
    )
    fireEvent.click(getByText('复制'))
    expect(onCopy).not.toHaveBeenCalled()
  })

  it('applies disabled style to 复制 when hasSelection is false', () => {
    const { getByText } = render(
      <TerminalContextMenu
        position={position}
        hasSelection={false}
        onCopy={vi.fn()}
        onPaste={vi.fn()}
        onClose={vi.fn()}
      />
    )
    // #484f58 = rgb(72, 79, 88)
    expect(getByText('复制').style.color).toBe('rgb(72, 79, 88)')
  })

  it('calls onCopy when 复制 is clicked and hasSelection is true', () => {
    const onCopy = vi.fn()
    const { getByText } = render(
      <TerminalContextMenu
        position={position}
        hasSelection={true}
        onCopy={onCopy}
        onPaste={vi.fn()}
        onClose={vi.fn()}
      />
    )
    fireEvent.click(getByText('复制'))
    expect(onCopy).toHaveBeenCalledTimes(1)
  })

  it('calls onPaste when 粘贴 is clicked', () => {
    const onPaste = vi.fn()
    const { getByText } = render(
      <TerminalContextMenu
        position={position}
        hasSelection={false}
        onCopy={vi.fn()}
        onPaste={onPaste}
        onClose={vi.fn()}
      />
    )
    fireEvent.click(getByText('粘贴'))
    expect(onPaste).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when mousedown fires outside the menu', () => {
    const onClose = vi.fn()
    render(
      <TerminalContextMenu
        position={position}
        hasSelection={false}
        onCopy={vi.fn()}
        onPaste={vi.fn()}
        onClose={onClose}
      />
    )
    // document.body is outside the menu div
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
