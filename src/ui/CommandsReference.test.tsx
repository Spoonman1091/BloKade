// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CAD_COMMANDS } from '../kade/commands'
import { CommandsReference } from './CommandsReference'

describe('CommandsReference', () => {
  it('lists every command with what it does and an example', () => {
    render(<CommandsReference onUseGear={vi.fn()} />)
    for (const command of CAD_COMMANDS) {
      expect(screen.getByText(command.call)).toBeInTheDocument()
      expect(screen.getByText(command.does, { exact: false })).toBeInTheDocument()
    }
    expect(screen.getByRole('heading', { name: 'Starting parts' })).toBeInTheDocument()
  })
  it('copies the gear into my shapes', async () => {
    const onUseGear = vi.fn()
    render(<CommandsReference onUseGear={onUseGear} />)
    await userEvent.click(screen.getByTestId('use-gear'))
    expect(onUseGear).toHaveBeenCalledOnce()
  })
})
