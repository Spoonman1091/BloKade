import type { PluginRegistry } from '../plugins/registry'

export function ShapePalette({ registry, onAdd }: { registry: PluginRegistry; onAdd(pluginId: string): void }) {
  return (
    <section className="panel" aria-label="Shapes">
      <h2>Shapes</h2>
      <div className="palette-grid">
        {registry.list().map((plugin) => (
          <button key={plugin.id} type="button" className="palette-button" data-testid={`add-${plugin.id}`} onClick={() => onAdd(plugin.id)}>
            <span className="palette-icon" aria-hidden="true">{plugin.icon}</span>
            {plugin.name}
          </button>
        ))}
      </div>
    </section>
  )
}
