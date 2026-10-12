// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fakeDeps } from '../app/testing/fakes'
import { App } from './App'

vi.mock('../viewport/Viewport', () => ({ Viewport: () => null }))

describe('App', () => {
  it('starts up and shows the shape palette', async () => {
    render(<App deps={fakeDeps()} />)
    expect(screen.getByText('Starting BloKade…')).toBeInTheDocument()
    expect(await screen.findByTestId('add-box')).toBeInTheDocument()
  })

  it("tells Kade when one of his plugins is broken", async () => {
    render(<App deps={fakeDeps({ pluginProblems: ['Plugin "Gear" has a problem: build must be a function'] })} />)
    expect(await screen.findByRole('status')).toHaveTextContent('Gear')
  })
})
