import type { ChangeEvent, ReactNode } from 'react'
import type { ShapeKit } from '../plugins/kits'
import type { PluginRegistry } from '../plugins/registry'
import type { ShapePlugin } from '../plugins/types'
import { useStore, type StoreApi } from 'zustand'
import { moreShapesStore, type MoreShapesState } from './more-shapes-store'
import { palettePicture } from './PalettePicture'

interface ShapePaletteProps {
  registry: PluginRegistry
  kits: readonly ShapeKit[]
  onAdd(pluginId: string): void
  onAddKit(kitId: string): void
  /** Kade's own shapes. When given, they get their own My shapes section and leave the other grids. */
  mine?: readonly ShapePlugin[]
  /** When given, the Shapes grid ends with an Import STL button. */
  onImport?(file: File): void
  /** True while a chosen file is being read. */
  importBusy?: boolean
  /** Whether More shapes is open. Tests pass their own; the app uses the one saved in this browser. */
  moreShapes?: StoreApi<MoreShapesState>
}

const sectionOf = (plugin: ShapePlugin): 'shapes' | 'more' | 'fit' | 'hidden' => plugin.palette ?? 'shapes'

function PaletteButton({ testId, icon, name, onClick }: { testId: string; icon: ReactNode; name: string; onClick(): void }) {
  return (
    <button type="button" className="palette-button" data-testid={testId} onClick={onClick}>
      <span className="palette-icon" aria-hidden="true">{icon}</span>
      {name}
    </button>
  )
}

function ImportButton({ onImport, busy }: { onImport(file: File): void; busy: boolean }) {
  const onChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onImport(file)
  }
  return (
    <label className="palette-button" data-help="import-stl" aria-disabled={busy}>
      <span className="palette-icon" aria-hidden="true">📥</span>
      Import STL
      <input type="file" accept=".stl,model/stl" hidden disabled={busy} data-testid="import-stl" onChange={onChange} />
    </label>
  )
}

export function ShapePalette({ registry, kits, onAdd, onAddKit, mine, onImport, importBusy = false, moreShapes = moreShapesStore }: ShapePaletteProps) {
  const moreOpen = useStore(moreShapes, (s) => s.open)
  const mineIds = new Set((mine ?? []).map((p) => p.id))
  const plugins = registry.list().filter((p) => !mineIds.has(p.id))
  const more = plugins.filter((p) => sectionOf(p) === 'more')
  const pluginButton = (p: ShapePlugin) => <PaletteButton key={p.id} testId={`add-${p.id}`} icon={palettePicture(p.id, p.icon)} name={p.name} onClick={() => onAdd(p.id)} />
  return (
    <>
      <section className="panel" aria-label="Shapes">
        <h2 data-help="panel-shapes">Shapes</h2>
        <div className="palette-grid">{plugins.filter((p) => sectionOf(p) === 'shapes').map(pluginButton)}
          {onImport && <ImportButton onImport={onImport} busy={importBusy} />}
        </div>
      </section>
      {more.length > 0 && (
        <section className="panel" aria-label="More shapes">
          <h2>
            <button type="button" className="panel-toggle" data-testid="more-shapes-toggle" aria-expanded={moreOpen} onClick={() => moreShapes.getState().toggle()}>
              {moreOpen ? '▾' : '▸'} More shapes
            </button>
          </h2>
          {moreOpen && <div className="palette-grid">{more.map(pluginButton)}</div>}
        </section>
      )}
      <section className="panel" aria-label="Fit tools">
        <h2 data-help="panel-fit-tools">Fit tools</h2>
        <div className="palette-grid">
          {kits.map((k) => <PaletteButton key={k.id} testId={`add-kit-${k.id}`} icon={palettePicture(k.id, k.icon)} name={k.name} onClick={() => onAddKit(k.id)} />)}
          {plugins.filter((p) => sectionOf(p) === 'fit').map(pluginButton)}
        </div>
      </section>
      {mine && (
        <section className="panel" aria-label="My shapes">
          <h2 data-help="panel-my-shapes">My shapes</h2>
          {mine.length > 0
            ? <div className="palette-grid">{mine.map(pluginButton)}</div>
            : <p className="hint">Make your own with <strong>🛠️ My shapes</strong> at the top.</p>}
        </section>
      )}
    </>
  )
}
