import { useEffect, useState } from 'react'
import type { AppDeps } from '../app/deps'
import { openInitialDesign, type InitialDesign } from '../persistence/bootstrap'
import { StoreProvider } from '../store/context'
import { createBloKadeStore, type BloKadeStore } from '../store/store'
import { Workspace } from './Workspace'

// React StrictMode runs effects twice in development; start each app only once
// so a first-time visitor doesn't get two "Untitled design" entries.
const startups = new WeakMap<AppDeps, Promise<InitialDesign>>()
function startOnce(deps: AppDeps): Promise<InitialDesign> {
  const existing = startups.get(deps)
  if (existing) return existing
  const started = openInitialDesign(deps.repo)
  startups.set(deps, started)
  return started
}

export function App({ deps }: { deps: AppDeps }) {
  const [store, setStore] = useState<BloKadeStore | null>(null)

  useEffect(() => {
    let active = true
    void startOnce(deps).then(({ id, doc, notice }) => {
      if (!active) return
      const created = createBloKadeStore({ designId: id, doc })
      const messages = [notice, ...deps.pluginProblems].filter((m): m is string => Boolean(m))
      if (messages.length > 0) created.getState().notify(messages.join(' '))
      // Remembering the last design is a convenience; autosave reports real storage failures.
      deps.repo.setLastOpened(id).catch((error: unknown) => console.error('Could not remember last design', error))
      setStore(created)
    })
    return () => {
      active = false
    }
  }, [deps])

  if (!store) return <div className="splash">Starting BloKade…</div>
  return (
    <StoreProvider store={store}>
      <Workspace deps={deps} />
    </StoreProvider>
  )
}
