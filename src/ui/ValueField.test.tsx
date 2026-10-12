// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ValueField } from './ValueField'

describe('ValueField', () => {
  it('shows a formula, its result, and commits typed text on Enter', async () => {
    const onCommit = vi.fn()
    render(<ValueField label="Width" value={30} formula="wall * 10" testId="w" onCommit={onCommit} />)
    expect(screen.getByTestId('w')).toHaveValue('wall * 10')
    expect(screen.getByTestId('w-value')).toHaveTextContent('= 30')
    await userEvent.clear(screen.getByTestId('w'))
    await userEvent.type(screen.getByTestId('w'), 'wall * 2{Enter}')
    expect(onCommit).toHaveBeenCalledWith('wall * 2')
  })

  it('shows a problem instead of a result', () => {
    render(<ValueField label="Width" value={30} formula="wal" error={`"wal" isn't a variable.`} testId="w" onCommit={vi.fn()} />)
    expect(screen.getByTestId('w-error')).toHaveTextContent(`"wal" isn't a variable.`)
    expect(screen.getByTestId('w')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByTestId('w-value')).toBeNull()
  })

  it('does not commit an untouched field, an empty field, or after Escape', async () => {
    const onCommit = vi.fn()
    render(<><ValueField label="Width" value={1 / 3} testId="w" onCommit={onCommit} /><button type="button">elsewhere</button></>)
    await userEvent.click(screen.getByTestId('w'))
    await userEvent.click(screen.getByText('elsewhere'))
    await userEvent.clear(screen.getByTestId('w'))
    await userEvent.click(screen.getByText('elsewhere'))
    await userEvent.type(screen.getByTestId('w'), '9{Escape}')
    await userEvent.click(screen.getByText('elsewhere'))
    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByTestId('w')).toHaveValue('0.333')
  })
})
