import type { GeometryClient } from '../geometry/client'
import type { BloKadeStore } from '../store/store'

/** The one engine message that is safe and useful to show as it is. */
const CANT_BUILD = "Fix the part that can't build first, then check again."
const FAILED = "Couldn't check this design. Try again, or export it and check it in Bambu Studio."

/** Looks for print problems in the whole design and stores the answer, unless the design changed meanwhile. */
export async function checkPrint(store: BloKadeStore, client: Pick<GeometryClient, 'printCheck'>): Promise<void> {
  const doc = store.getState().history.present
  const stillCurrent = (): boolean => store.getState().history.present === doc
  store.getState().setPrintChecking(true)
  try {
    const result = await client.printCheck(doc)
    if (stillCurrent()) store.getState().setPrintCheck({ doc, result })
  } catch (error) {
    if (stillCurrent()) store.getState().notify(error instanceof Error && error.message === CANT_BUILD ? CANT_BUILD : FAILED)
  } finally {
    store.getState().setPrintChecking(false)
  }
}
