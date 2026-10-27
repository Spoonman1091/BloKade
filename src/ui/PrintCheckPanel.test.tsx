// @vitest-environment jsdom
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument } from '../document/factory'
import type { PrintCheckResult } from '../geometry/types'
import { printerStore } from '../printers/printer-store'
import { DEFAULT_PRINTER } from '../printers/printers'
import { createBloKadeStore } from '../store/store'
import { PrintCheckPanel } from './PrintCheckPanel'

const floating: PrintCheckResult = {
  status: 'checked', floating: { amount: 1, mesh: {} as never }, thin: null, overhang: null, thinFinished: true,
}

function setup() {
  const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
  renderWithStore(<PrintCheckPanel />, store)
  const show = (result: PrintCheckResult) => act(() => {
    store.getState().setPrintCheck({ doc: store.getState().history.present, result })
  })
  return { store, show }
}

describe('PrintCheckPanel', () => {
  afterEach(() => printerStore.getState().setPrinter(DEFAULT_PRINTER))

  it('shows nothing until there is a result', () => {
    setup()
    expect(screen.queryByTestId('print-check-result')).toBeNull()
  })

  it('shows each finding, with bold text', () => {
    const { show } = setup()
    show(floating)
    const panel = screen.getByTestId('print-check-result')
    expect(panel).toHaveAttribute('role', 'status')
    expect(panel).toHaveTextContent('1 piece is floating above the plate.')
    expect(panel.querySelector('strong')).toHaveTextContent('1 piece is floating')
  })

  it('names the chosen printer when all is clear', () => {
    const { show } = setup()
    show({ status: 'checked', floating: null, thin: null, overhang: null, thinFinished: true })
    expect(screen.getByTestId('print-check-result')).toHaveTextContent('Looks ready to print on the Bambu Lab A1 mini.')
  })

  it('hides after an edit', () => {
    const { store, show } = setup()
    show(floating)
    act(() => store.getState().apply((d) => ({ ...d, name: 'Changed' })))
    expect(screen.queryByTestId('print-check-result')).toBeNull()
  })

  it('closes with the X button', async () => {
    const { store, show } = setup()
    show(floating)
    await userEvent.click(screen.getByTestId('print-check-close'))
    expect(store.getState().printCheck).toBeNull()
    expect(screen.queryByTestId('print-check-result')).toBeNull()
  })
})
