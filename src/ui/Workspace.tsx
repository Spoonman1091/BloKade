import { useMemo, useState } from 'react'
import { createActions } from '../app/actions'
import type { AppDeps } from '../app/deps'
import { exportDesign, type ExportFormat } from '../app/export'
import { useShortcuts } from '../app/shortcuts'
import { useAutosave } from '../app/useAutosave'
import { useGeometrySync } from '../app/useGeometrySync'
import { useBloKadeStore } from '../store/context'
import { Viewport } from '../viewport/Viewport'
import { DesignsDialog } from './DesignsDialog'
import { PropertiesPanel } from './PropertiesPanel'
import { SceneTree } from './SceneTree'
import { ShapePalette } from './ShapePalette'
import { Toasts } from './Toasts'
import { Toolbar } from './Toolbar'

export function Workspace({ deps }: { deps: AppDeps }) {
  const store = useBloKadeStore()
  const actions = useMemo(() => createActions(store, deps.registry), [store, deps.registry])
  const [showDesigns, setShowDesigns] = useState(false)
  useGeometrySync(store, deps.client)
  const flushAutosave = useAutosave(store, deps.repo, deps.openTabChannel)
  useShortcuts(actions, !showDesigns)
  const onExport = (format: ExportFormat): void => void exportDesign({ client: deps.client, store, format })

  return (
    <div className="workspace">
      <Toolbar actions={actions} onExport={onExport} onOpenDesigns={() => setShowDesigns(true)} />
      <aside className="left-panel">
        <ShapePalette registry={deps.registry} onAdd={actions.addShape} />
        <SceneTree registry={deps.registry} />
      </aside>
      <main className="viewport" data-testid="viewport">
        <Viewport registry={deps.registry} />
      </main>
      <aside className="right-panel">
        <PropertiesPanel registry={deps.registry} />
      </aside>
      {showDesigns && <DesignsDialog repo={deps.repo} flushAutosave={flushAutosave} onClose={() => setShowDesigns(false)} />}
      <Toasts />
    </div>
  )
}
