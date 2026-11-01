import { createStore, type StoreApi } from 'zustand'
import { browserStorage, type KeyValueStorage } from '../learn/progress'

export const MORE_SHAPES_KEY = 'blokade.moreShapes.v1'

/** Whether More shapes is open. Never throws: unreadable storage means open, the first-visit state. */
export function loadMoreShapesOpen(storage: KeyValueStorage | null): boolean {
  try {
    return storage?.getItem(MORE_SHAPES_KEY) !== 'closed'
  } catch {
    return true
  }
}

/** Remembers the state. Never throws: the section still toggles for this visit without storage. */
export function saveMoreShapesOpen(storage: KeyValueStorage | null, open: boolean): void {
  try {
    storage?.setItem(MORE_SHAPES_KEY, open ? 'open' : 'closed')
  } catch {
    // Some private windows refuse storage; the state just isn't remembered.
  }
}

export interface MoreShapesState {
  readonly open: boolean
  toggle(): void
}

/** Whether the More shapes section is open. It belongs to this browser, so it lives outside the design store. */
export function createMoreShapesStore(storage: KeyValueStorage | null): StoreApi<MoreShapesState> {
  return createStore<MoreShapesState>()((set, get) => ({
    open: loadMoreShapesOpen(storage),
    toggle: () => {
      const open = !get().open
      saveMoreShapesOpen(storage, open)
      set({ open })
    },
  }))
}

export const moreShapesStore = createMoreShapesStore(browserStorage())
