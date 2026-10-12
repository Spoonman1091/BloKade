// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fakeDeps } from '../app/testing/fakes'
import { registry } from '../plugins/index'
import type { PluginRegistry } from '../plugins/registry'
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

describe('App crash safety', () => {
  it('shows the friendly fallback when the workspace crashes', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken: PluginRegistry = { ...registry, list: () => { throw new Error('boom') } }
    const deps = fakeDeps({ registry: broken })
    render(<App deps={deps} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Something broke. Reload the page — your design is saved.')
    logged.mockRestore()
  })
})
