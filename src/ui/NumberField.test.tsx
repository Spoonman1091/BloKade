// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { NumberField } from './NumberField'

function setup(value = 20) {
  const onCommit = vi.fn()
  const view = render(<NumberField label="Width" value={value} onCommit={onCommit} testId="w" />)
  return { onCommit, input: screen.getByTestId('w') as HTMLInputElement, view }
}

describe('NumberField', () => {
  it('commits on Enter', async () => {
    const { onCommit, input } = setup()
    await userEvent.clear(input)
    await userEvent.type(input, '35{Enter}')
    expect(onCommit).toHaveBeenCalledWith(35)
  })

  it('commits on blur', async () => {
    const { onCommit, input } = setup()
    await userEvent.clear(input)
    await userEvent.type(input, '7')
    await userEvent.tab()
    expect(onCommit).toHaveBeenCalledWith(7)
  })

  it('reverts junk without committing', async () => {
    const { onCommit, input } = setup()
    await userEvent.clear(input)
    await userEvent.type(input, 'abc{Enter}')
    expect(onCommit).not.toHaveBeenCalled()
    expect(input.value).toBe('20')
  })

  it('reverts on Escape', async () => {
    const { onCommit, input } = setup()
    await userEvent.type(input, '99{Escape}')
    expect(input.value).toBe('20')
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('does not commit an unchanged value', async () => {
    const { onCommit, input } = setup()
    await userEvent.type(input, '{Enter}')
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('shows new values from outside (undo)', () => {
    const { view, input } = setup(20)
    view.rerender(<NumberField label="Width" value={42} onCommit={vi.fn()} testId="w" />)
    expect(input.value).toBe('42')
  })

  it('does not commit when an untouched rounded field is blurred', async () => {
    const onCommit = vi.fn()
    render(<NumberField label="Width" value={1 / 3} onCommit={onCommit} testId="w" />)
    const input = screen.getByTestId('w') as HTMLInputElement
    await userEvent.click(input)
    await userEvent.tab()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('shows the model value when a commit leaves it unchanged', async () => {
    const { onCommit, input } = setup()
    await userEvent.clear(input)
    await userEvent.type(input, '20.0{Enter}')
    expect(onCommit).not.toHaveBeenCalled()
    expect(input.value).toBe('20')
  })

  it('does not revert or re-commit when a blur lands right after Enter', () => {
    const onCommit = vi.fn()
    function Wrapper() {
      const [value, setValue] = useState(20)
      return <NumberField label="Width" value={value} testId="w" onCommit={(n) => { onCommit(n); setValue(n) }} />
    }
    render(<Wrapper />)
    const input = screen.getByTestId('w') as HTMLInputElement
    fireEvent.change(input, { target: { value: '30' } })
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' })
      fireEvent.blur(input)
    })
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(30)
    expect(input.value).toBe('30')
  })
})
