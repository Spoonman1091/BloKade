import { createStore, type StoreApi } from 'zustand'
import { browserStorage, type KeyValueStorage } from '../learn/progress'

export const MORE_SHAPES_KEY = 'blokade.moreShapes.v1'

export interface MoreShapesSaved {
  readonly open: boolean
  /** True until Kade has opened the section once; any saved value means he already has. */
  readonly isNew: boolean
}

/** What was saved. Never throws: nothing saved, or unreadable storage, means closed and new, the first-visit state. */
export function loadMoreShapes(storage: KeyValueStorage | null): MoreShapesSaved {
  try {
    const saved = storage?.getItem(MORE_SHAPES_KEY) ?? null
    return { open: saved === 'open', isNew: saved === null }
  } catch {
    return { open: false, isNew: true }
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
  readonly isNew: boolean
  toggle(): void
}

/** Whether the More shapes section is open. It belongs to this browser, so it lives outside the design store. */
export function createMoreShapesStore(storage: KeyValueStorage | null): StoreApi<MoreShapesState> {
  return createStore<MoreShapesState>()((set, get) => ({
    ...loadMoreShapes(storage),
    toggle: () => {
      const open = !get().open
      saveMoreShapesOpen(storage, open)
      set({ open, isNew: false })
    },
  }))
}

export const moreShapesStore = createMoreShapesStore(browserStorage())
