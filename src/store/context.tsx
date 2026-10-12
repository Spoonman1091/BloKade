import { createContext, useContext, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { BloKadeState, BloKadeStore } from './store'

const StoreContext = createContext<BloKadeStore | null>(null)

export function StoreProvider({ store, children }: { store: BloKadeStore; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useBloKadeStore(): BloKadeStore {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useBloKadeStore must be used inside <StoreProvider>')
  return store
}

/** Selectors must return stable values (state fields or primitives), never fresh arrays/objects. */
export function useBloKade<T>(selector: (state: BloKadeState) => T): T {
  return useStore(useBloKadeStore(), selector)
}
