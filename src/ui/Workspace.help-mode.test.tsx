// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderMainScreen, sampleStores } from '../app/testing/main-screen'

vi.mock('../viewport/Viewport', () => ({ Viewport: () => null }))
afterEach(cleanup)

describe('help mode in the whole app', () => {
  it('never changes the design, the selection or the tool', () => {
    const store = sampleStores()[0]!
    renderMainScreen(store)
    const before = store.getState()
    fireEvent.click(screen.getByTestId('help-mode'))
    expect(document.body.classList.contains('help-mode')).toBe(true)
    fireEvent.keyDown(document.body, { key: 'Delete' })
    fireEvent.click(screen.getByTestId('add-box'))
    fireEvent.click(screen.getByTestId('delete'))
    const after = store.getState()
    expect(after.history.present).toBe(before.history.present)
    expect(after.selection).toEqual(before.selection)
    expect(after.tool).toBe(before.tool)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(document.body.classList.contains('help-mode')).toBe(false)
    expect(screen.queryByTestId('help-card')).toBeNull()
    expect(store.getState().history.present).toBe(before.history.present)
  })
})
