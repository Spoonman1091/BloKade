import { useMemo } from 'react'
import { createActions } from '../app/actions'
import type { AppDeps } from '../app/deps'
import { useAutosave } from '../app/useAutosave'
import { useGeometrySync } from '../app/useGeometrySync'
import { useBloKadeStore } from '../store/context'
import { Viewport } from '../viewport/Viewport'
import { ShapePalette } from './ShapePalette'
import { Toasts } from './Toasts'

export function Workspace({ deps }: { deps: AppDeps }) {
  const store = useBloKadeStore()
  const actions = useMemo(() => createActions(store, deps.registry), [store, deps.registry])
  useGeometrySync(store, deps.client)
  useAutosave(store, deps.repo)

  return (
    <div className="workspace">
      <header className="toolbar"><span className="brand">BloKade</span></header>
      <aside className="left-panel">
        <ShapePalette registry={deps.registry} onAdd={actions.addShape} />
      </aside>
      <main className="viewport" data-testid="viewport">
        <Viewport registry={deps.registry} />
      </main>
      <aside className="right-panel" />
      <Toasts />
    </div>
  )
}
