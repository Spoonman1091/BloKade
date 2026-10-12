// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CodeView } from '../kade/code-view'
import { ProblemList } from './ProblemList'

const view = (over: Partial<CodeView>): CodeView => ({
  shapeId: 'my-a', code: '', typing: false, syntaxOk: true, problem: null, built: false, bounds: null, meta: null, ...over,
})

describe('ProblemList', () => {
  it('shows a problem with a line as a button that jumps there', async () => {
    const onJump = vi.fn()
    render(<ProblemList view={view({ problem: 'Line 4: there\'s nothing called "widht" — check the spelling.' })} onJump={onJump} />)
    await userEvent.click(screen.getByTestId('problem-0'))
    expect(onJump).toHaveBeenCalledWith(4)
    expect(screen.getByRole('alert')).toHaveTextContent('nothing called "widht"')
  })
  it('shows a problem without a line as text', () => {
    render(<ProblemList view={view({ problem: 'Your shape needs a name.' })} onJump={vi.fn()} />)
    expect(screen.queryByTestId('problem-0')).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent('Your shape needs a name.')
  })
  it('cheers when the shape works, and says when it is checking', () => {
    const { rerender } = render(<ProblemList view={view({ built: true })} onJump={vi.fn()} />)
    expect(screen.getByTestId('code-ok')).toHaveTextContent('Your shape works!')
    rerender(<ProblemList view={view({})} onJump={vi.fn()} />)
    expect(screen.getByTestId('code-checking')).toBeInTheDocument()
    rerender(<ProblemList view={view({ shapeId: null })} onJump={vi.fn()} />)
    expect(screen.queryByTestId('code-checking')).toBeNull()
  })
})
