import { useCallback, useEffect, useRef } from 'react'
import { withoutUnusedModels } from '../document/models'
import { createAutosaver, type Autosaver } from '../persistence/autosave'
import type { DesignRepository } from '../persistence/repository'
import { createTabGuard, openTabChannel, type TabChannel } from '../persistence/tab-guard'
import type { BloKadeStore } from '../store/store'

const AUTOSAVE_BROKEN = "Autosave isn't working in this browser. Use Designs → Save to file to keep your work."
export const OPEN_IN_ANOTHER_TAB = 'This design is open in another tab — reload this tab to keep going.'

/**
 * Saves the open design 1 s after each change. Returns a function that saves immediately.
 * If another tab opens the same design, this tab stops saving it and asks to be reloaded.
 */
export function useAutosave(
  store: BloKadeStore, repo: DesignRepository, openChannel: () => TabChannel | null = openTabChannel,
): () => Promise<void> {
  const saver = useRef<Autosaver | null>(null)

  useEffect(() => {
    const guard = createTabGuard({
      channel: openChannel(),
      onLocked: () => {
        autosaver.cancel()
        store.getState().setStickyNotice(OPEN_IN_ANOTHER_TAB)
      },
    })
    const autosaver = createAutosaver({
      save: (id, doc) => repo.save(id, withoutUnusedModels(doc)),
      onError: (error) => {
        console.error('Autosave failed', error)
        store.getState().notify(AUTOSAVE_BROKEN)
      },
      isBlocked: (id) => guard.isLocked(id),
      onSaved: (id) => guard.saved(id),
    })
    saver.current = autosaver
    guard.opened(store.getState().designId)
    const unsubscribe = store.subscribe((next, prev) => {
      if (next.designId !== prev.designId) {
        guard.opened(next.designId)
        if (next.stickyNotice === OPEN_IN_ANOTHER_TAB) store.getState().setStickyNotice(null)
      }
      if (next.history.present === prev.history.present || guard.isLocked(next.designId)) return
      autosaver.schedule(next.designId, next.history.present)
    })
    const flushOnHide = (): void => void autosaver.flush()
    window.addEventListener('pagehide', flushOnHide)
    return () => {
      unsubscribe()
      window.removeEventListener('pagehide', flushOnHide)
      // Stop listening right away (React may mount this again at once); the final save still honours the lock.
      guard.dispose()
      void autosaver.flush()
      saver.current = null
    }
  }, [store, repo, openChannel])

  return useCallback(() => saver.current?.flush() ?? Promise.resolve(), [])
}
