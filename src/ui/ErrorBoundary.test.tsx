// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CRASH_MESSAGE, ErrorBoundary } from './ErrorBoundary'

function Boom(): never {
  throw new Error('kaboom')
}

describe('ErrorBoundary', () => {
  it('shows a friendly message and a reload button when something breaks', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = vi.fn()
    render(<ErrorBoundary onReload={reload}><Boom /></ErrorBoundary>)
    expect(screen.getByRole('alert')).toHaveTextContent('Something broke. Reload the page — your design is saved.')
    expect(CRASH_MESSAGE).toBe('Something broke. Reload the page — your design is saved.')
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(reload).toHaveBeenCalledOnce()
    expect(logged).toHaveBeenCalledWith('BloKade crashed', expect.any(Error), expect.anything())
    logged.mockRestore()
  })

  it('renders its children when nothing breaks', () => {
    render(<ErrorBoundary><p>All good</p></ErrorBoundary>)
    expect(screen.getByText('All good')).toBeInTheDocument()
  })
})
