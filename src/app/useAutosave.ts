import { useCallback, useEffect, useRef } from 'react'
import { createAutosaver, type Autosaver } from '../persistence/autosave'
import type { DesignRepository } from '../persistence/repository'
import type { BloKadeStore } from '../store/store'

const AUTOSAVE_BROKEN = "Autosave isn't working in this browser. Use Designs → Save to file to keep your work."

/** Saves the open design 1 s after each change. Returns a function that saves immediately. */
export function useAutosave(store: BloKadeStore, repo: DesignRepository): () => Promise<void> {
  const saver = useRef<Autosaver | null>(null)

  useEffect(() => {
    const autosaver = createAutosaver({
      save: (id, doc) => repo.save(id, doc),
      onError: (error) => {
        console.error('Autosave failed', error)
        store.getState().notify(AUTOSAVE_BROKEN)
      },
    })
    saver.current = autosaver
    const unsubscribe = store.subscribe((next, prev) => {
      if (next.history.present !== prev.history.present) autosaver.schedule(next.designId, next.history.present)
    })
    const flushOnHide = (): void => void autosaver.flush()
    window.addEventListener('pagehide', flushOnHide)
    return () => {
      unsubscribe()
      window.removeEventListener('pagehide', flushOnHide)
      void autosaver.flush()
      saver.current = null
    }
  }, [store, repo])

  return useCallback(() => saver.current?.flush() ?? Promise.resolve(), [])
}
