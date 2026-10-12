// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HelpMode } from './HelpMode'

function setup(active = true) {
  const onAction = vi.fn()
  const onExit = vi.fn()
  const onLearnMore = vi.fn()
  const keydown = vi.fn()
  document.addEventListener('keydown', keydown)
  render(<>
    <button type="button" data-testid="mode-hole" onClick={onAction} onPointerDown={onAction}>Hole</button>
    <button type="button" data-testid="mystery" onClick={onAction}>?</button>
    <button type="button" data-testid="help-mode" data-help-toggle="" onClick={onExit}>❓</button>
    <HelpMode active={active} onExit={onExit} onLearnMore={onLearnMore} />
  </>)
  return { onAction, onExit, onLearnMore, keydown }
}

describe('HelpMode (Review Focus 3)', () => {
  it('shows help instead of doing the action', () => {
    const { onAction } = setup()
    fireEvent.pointerDown(screen.getByText('Hole'))
    fireEvent.click(screen.getByText('Hole'))
    expect(onAction).not.toHaveBeenCalled()
    expect(screen.getByTestId('help-card')).toHaveTextContent('A hole cuts away the solid parts in its group.')
    expect(document.body.classList.contains('help-mode')).toBe(true)
  })

  it('says when there is no help yet', () => {
    setup()
    fireEvent.click(screen.getByText('?'))
    expect(screen.getByTestId('help-card')).toHaveTextContent('No help for this yet.')
  })

  it('opens the matching lesson from Learn more', () => {
    const { onLearnMore } = setup()
    fireEvent.click(screen.getByText('Hole'))
    fireEvent.click(screen.getByTestId('help-card-learn'))
    expect(onLearnMore).toHaveBeenCalledWith('holes-groups')
  })

  it('leaves on Esc without letting the app see the key, and on Close or ❓', () => {
    const { onExit, keydown } = setup()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(keydown).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Hole'))
    fireEvent.click(screen.getByTestId('help-card-close'))
    expect(onExit).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByTestId('help-mode'))
    expect(onExit).toHaveBeenCalledTimes(3)
  })

  it('does nothing when it is off', () => {
    const { onAction } = setup(false)
    fireEvent.click(screen.getByText('Hole'))
    expect(onAction).toHaveBeenCalled()
    expect(screen.queryByTestId('help-card')).toBeNull()
    expect(document.body.classList.contains('help-mode')).toBe(false)
  })
})
