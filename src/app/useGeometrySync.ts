import { useEffect } from 'react'
import type { BloKadeDocument } from '../document/types'
import { GeometryTimeoutError, type GeometryClient } from '../geometry/client'
import type { BloKadeStore } from '../store/store'

const ENGINE_PROBLEM = "The geometry engine had a problem, so your shapes can't update right now. Try reloading the page."

/** Rebuilds geometry whenever the document changes and feeds results into the store. */
export function useGeometrySync(store: BloKadeStore, client: GeometryClient): void {
  useEffect(() => {
    const rebuild = (doc: BloKadeDocument, designId: string): void => {
      client.rebuild(doc).then(
        (result) => {
          if (result) store.getState().applyBuild(designId, result)
        },
        (error: unknown) => {
          if (!(error instanceof GeometryTimeoutError)) console.error('Geometry rebuild failed', error)
          store.getState().notify(error instanceof GeometryTimeoutError ? error.message : ENGINE_PROBLEM)
        },
      )
    }
    const initial = store.getState()
    rebuild(initial.history.present, initial.designId)
    return store.subscribe((next, prev) => {
      if (next.history.present !== prev.history.present) rebuild(next.history.present, next.designId)
    })
  }, [store, client])
}
