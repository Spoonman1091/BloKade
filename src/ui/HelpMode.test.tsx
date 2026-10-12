// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HelpMode } from './HelpMode'

let spy: ((e: Event) => void) | null = null
afterEach(() => {
  if (spy) document.removeEventListener('keydown', spy)
  spy = null
})

function setup(active = true) {
  const onAction = vi.fn()
  const onExit = vi.fn()
  const onLearnMore = vi.fn()
  const keydown = vi.fn()
  spy = keydown
  document.addEventListener('keydown', keydown)
  render(<>
    <button type="button" data-testid="mode-hole" onClick={onAction} onPointerDown={onAction}>Hole</button>
    <button type="button" data-testid="mystery" onClick={onAction}>?</button>
    <input data-testid="field" onKeyDown={onAction} onChange={onAction} onInput={onAction} />
    <div draggable data-testid="row" onDragStart={onAction} onDrop={onAction}>Row</div>
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

  it('keeps typing out of fields', () => {
    const { onAction } = setup()
    const field = screen.getByTestId('field')
    fireEvent.keyDown(field, { key: 'a' })
    fireEvent.keyDown(field, { key: 'Enter' })
    fireEvent.input(field, { target: { value: 'x' } })
    fireEvent.change(field, { target: { value: 'y' } })
    expect(onAction).not.toHaveBeenCalled()
  })

  it('lets Tab move focus and takes focus out of a field on entry', () => {
    const onAction = vi.fn()
    const ui = (active: boolean) => <><input data-testid="f" onKeyDown={onAction} /><HelpMode active={active} onExit={vi.fn()} onLearnMore={vi.fn()} /></>
    const { rerender } = render(ui(false))
    screen.getByTestId('f').focus()
    expect(document.activeElement).toBe(screen.getByTestId('f'))
    rerender(ui(true))
    expect(document.activeElement).toBe(document.body)
    fireEvent.keyDown(screen.getByTestId('f'), { key: 'Tab' })
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('stops drags from reparenting', () => {
    const { onAction } = setup()
    fireEvent.dragStart(screen.getByTestId('row'))
    fireEvent.drop(screen.getByTestId('row'))
    expect(onAction).not.toHaveBeenCalled()
  })
})
