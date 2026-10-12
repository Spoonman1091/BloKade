import type { ShapeKit } from '../plugins/kits'
import type { PluginRegistry } from '../plugins/registry'
import type { ShapePlugin } from '../plugins/types'

interface ShapePaletteProps {
  registry: PluginRegistry
  kits: readonly ShapeKit[]
  onAdd(pluginId: string): void
  onAddKit(kitId: string): void
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

export function ShapePalette({ registry, kits, onAdd, onAddKit }: ShapePaletteProps) {
  const plugins = registry.list()
  const pluginButton = (p: ShapePlugin) => <PaletteButton key={p.id} testId={`add-${p.id}`} icon={p.icon} name={p.name} onClick={() => onAdd(p.id)} />
  return (
    <>
      <section className="panel" aria-label="Shapes">
        <h2>Shapes</h2>
        <div className="palette-grid">{plugins.filter((p) => sectionOf(p) === 'shapes').map(pluginButton)}</div>
      </section>
      <section className="panel" aria-label="Fit tools">
        <h2>Fit tools</h2>
        <div className="palette-grid">
          {kits.map((k) => <PaletteButton key={k.id} testId={`add-kit-${k.id}`} icon={k.icon} name={k.name} onClick={() => onAddKit(k.id)} />)}
          {plugins.filter((p) => sectionOf(p) === 'fit').map(pluginButton)}
        </div>
      </section>
    </>
  )
}
