import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import type { PrintCheckResult } from '../geometry/types'
import { createBloKadeStore } from '../store/store'
import { visiblePrintCheck } from '../store/print-check'
import { checkPrint } from './check-print'

const NOTHING: PrintCheckResult = { status: 'nothing' }
const CANT_BUILD = "Fix the part that can't build first, then check again."
const FALLBACK = "Couldn't check this design. Try again, or export it and check it in Bambu Studio."

function setup(printCheck = vi.fn(async (): Promise<PrintCheckResult> => NOTHING)) {
  const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
  return { store, client: { printCheck }, printCheck }
}

describe('checkPrint', () => {
  it('stores the result for the current design', async () => {
    const { store, client } = setup()
    await checkPrint(store, client)
    expect(visiblePrintCheck(store.getState().printCheck, store.getState().history.present)).toBe(NOTHING)
  })

  it('ignores a result for a design that changed meanwhile', async () => {
    let finish: (value: PrintCheckResult) => void = () => undefined
    const { store, client } = setup(vi.fn(() => new Promise<PrintCheckResult>((resolve) => { finish = resolve })))
    const running = checkPrint(store, client)
    store.getState().apply((d) => ({ ...d, name: 'Changed' }))
    finish(NOTHING)
    await running
    expect(store.getState().printCheck).toBeNull()
    expect(store.getState().printChecking).toBe(false)
  })

  it('shows the engine\'s message when a part can\'t build', async () => {
    const { store, client } = setup(vi.fn(async () => { throw new Error(CANT_BUILD) }))
    await checkPrint(store, client)
    expect(store.getState().notice).toBe(CANT_BUILD)
  })

  it('shows a friendly fallback for any other failure', async () => {
    const { store, client } = setup(vi.fn(async () => { throw new Error('worker exploded: at line 5') }))
    await checkPrint(store, client)
    expect(store.getState().notice).toBe(FALLBACK)
    const { store: second, client: other } = setup(vi.fn(async () => { throw 'nope' }))
    await checkPrint(second, other)
    expect(second.getState().notice).toBe(FALLBACK)
  })

  it('is checking while it waits, and stops after a failure too', async () => {
    let finish: (value: PrintCheckResult) => void = () => undefined
    const { store, client } = setup(vi.fn(() => new Promise<PrintCheckResult>((resolve) => { finish = resolve })))
    const running = checkPrint(store, client)
    expect(store.getState().printChecking).toBe(true)
    finish(NOTHING)
    await running
    expect(store.getState().printChecking).toBe(false)
    const failing = setup(vi.fn(async () => { throw new Error('x') }))
    await checkPrint(failing.store, failing.client)
    expect(failing.store.getState().printChecking).toBe(false)
  })

  it('forgets the result when another design opens', async () => {
    const { store, client } = setup()
    await checkPrint(store, client)
    expect(store.getState().printCheck).not.toBeNull()
    store.getState().openDesign('e', createEmptyDocument())
    expect(store.getState().printCheck).toBeNull()
  })
})
