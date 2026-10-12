import type { ShapeKit } from '../plugins/kits'
import type { PluginRegistry } from '../plugins/registry'
import type { ShapePlugin } from '../plugins/types'

interface ShapePaletteProps {
  registry: PluginRegistry
  kits: readonly ShapeKit[]
  onAdd(pluginId: string): void
  onAddKit(kitId: string): void
  /** Kade's own shapes. When given, they get their own My shapes section and leave the other grids. */
  mine?: readonly ShapePlugin[]
}

const sectionOf = (plugin: ShapePlugin): 'shapes' | 'fit' | 'hidden' => plugin.palette ?? 'shapes'

function PaletteButton({ testId, icon, name, onClick }: { testId: string; icon: string; name: string; onClick(): void }) {
  return (
    <button type="button" className="palette-button" data-testid={testId} onClick={onClick}>
      <span className="palette-icon" aria-hidden="true">{icon}</span>
      {name}
    </button>
  )
}

export function ShapePalette({ registry, kits, onAdd, onAddKit, mine }: ShapePaletteProps) {
  const mineIds = new Set((mine ?? []).map((p) => p.id))
  const plugins = registry.list().filter((p) => !mineIds.has(p.id))
  const pluginButton = (p: ShapePlugin) => <PaletteButton key={p.id} testId={`add-${p.id}`} icon={p.icon} name={p.name} onClick={() => onAdd(p.id)} />
  return (
    <>
      <section className="panel" aria-label="Shapes">
        <h2 data-help="panel-shapes">Shapes</h2>
        <div className="palette-grid">{plugins.filter((p) => sectionOf(p) === 'shapes').map(pluginButton)}</div>
      </section>
      <section className="panel" aria-label="Fit tools">
        <h2 data-help="panel-fit-tools">Fit tools</h2>
        <div className="palette-grid">
          {kits.map((k) => <PaletteButton key={k.id} testId={`add-kit-${k.id}`} icon={k.icon} name={k.name} onClick={() => onAddKit(k.id)} />)}
          {plugins.filter((p) => sectionOf(p) === 'fit').map(pluginButton)}
        </div>
      </section>
      {mine && (
        <section className="panel" aria-label="My shapes">
          <h2 data-help="panel-my-shapes">My shapes</h2>
          {mine.length > 0
            ? <div className="palette-grid">{mine.map(pluginButton)}</div>
            : <p className="hint">Make your own with <strong>🧩 My shapes</strong> at the top.</p>}
        </section>
      )}
    </>
  )
}
