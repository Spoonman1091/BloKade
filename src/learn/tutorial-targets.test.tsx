// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderMainScreen, sampleStores } from '../app/testing/main-screen'
import { createMemoryDesignRepository } from '../persistence/memory-repository'
import { StoreProvider } from '../store/context'
import { DesignsDialog } from '../ui/DesignsDialog'
import { TUTORIALS } from './tutorials'

vi.mock('../viewport/Viewport', () => ({ Viewport: () => <div data-testid="viewport-canvas" /> }))
afterEach(cleanup)

function renderedIds(): Set<string> {
  return new Set([...document.querySelectorAll('[data-testid]')].map((el) => el.getAttribute('data-testid') ?? ''))
}

describe('tutorial targets', () => {
  it('only point at controls that exist in the app', () => {
    const ids = new Set<string>()
    for (const store of sampleStores()) {
      renderMainScreen(store)
      for (const id of renderedIds()) ids.add(id)
      cleanup()
      render(<StoreProvider store={store}><DesignsDialog repo={createMemoryDesignRepository()} flushAutosave={async () => undefined} onClose={() => undefined} /></StoreProvider>)
      for (const id of renderedIds()) ids.add(id)
      cleanup()
    }
    // Variables a lesson creates have names the sample design doesn't use.
    const dynamic = (target: string) => /^var-(name-var1|expr-wall)$/.test(target)
    const missing = TUTORIALS.flatMap((t) => t.steps.flatMap((s) =>
      s.target && !ids.has(s.target) && !dynamic(s.target) ? [`${t.id}/${s.id} → ${s.target}`] : []))
    expect(missing).toEqual([])
  })
})
