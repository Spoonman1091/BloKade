// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HelpTooltips, TOOLTIP_DELAY_MS } from './HelpTooltips'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function setup(props: { suppressKey?: string | null; disabled?: boolean } = {}) {
  render(<>
    <button type="button" data-testid="mode-hole">Hole</button>
    <button type="button" data-testid="mystery">?</button>
    <HelpTooltips suppressKey={props.suppressKey ?? null} disabled={props.disabled ?? false} />
  </>)
}

describe('HelpTooltips', () => {
  it('shows a tip after a short wait and hides it on leave and Esc', () => {
    setup()
    fireEvent.pointerOver(screen.getByText('Hole'))
    expect(screen.queryByTestId('help-tooltip')).toBeNull()
    act(() => vi.advanceTimersByTime(TOOLTIP_DELAY_MS))
    expect(screen.getByTestId('help-tooltip')).toHaveTextContent('Turns this part into empty space.')
    fireEvent.pointerOut(screen.getByText('Hole'), { relatedTarget: null })
    expect(screen.queryByTestId('help-tooltip')).toBeNull()
    fireEvent.focusIn(screen.getByText('Hole'))
    act(() => vi.advanceTimersByTime(TOOLTIP_DELAY_MS))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('help-tooltip')).toBeNull()
  })

  it('shows nothing for controls without help, the highlighted control, or when disabled', () => {
    setup({ suppressKey: 'mode-hole' })
    fireEvent.pointerOver(screen.getByText('?'))
    fireEvent.pointerOver(screen.getByText('Hole'))
    act(() => vi.advanceTimersByTime(TOOLTIP_DELAY_MS * 2))
    expect(screen.queryByTestId('help-tooltip')).toBeNull()
  })

  it('stays quiet while help mode is on', () => {
    setup({ disabled: true })
    fireEvent.pointerOver(screen.getByText('Hole'))
    act(() => vi.advanceTimersByTime(TOOLTIP_DELAY_MS))
    expect(screen.queryByTestId('help-tooltip')).toBeNull()
  })
})
