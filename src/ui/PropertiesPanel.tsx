import { renameNode, setMode, updateNode } from '../document/ops'
import type { SceneNode, ShapeNode, Vec3 } from '../document/types'
import { resolveParams } from '../plugins/params'
import type { PluginRegistry } from '../plugins/registry'
import type { NumberParamSpec } from '../plugins/types'
import { useBloKade } from '../store/context'
import { NumberField, TextField } from './NumberField'

const AXES = ['x', 'y', 'z'] as const
const UNIT: Record<NumberParamSpec['type'], string> = { mm: ' (mm)', angle: ' (°)', whole: '', number: '' }

const withAxis = (v: Vec3, index: number, value: number): Vec3 =>
  [index === 0 ? value : v[0], index === 1 ? value : v[1], index === 2 ? value : v[2]]

function ShapeParams({ node, registry }: { node: ShapeNode; registry: PluginRegistry }) {
  const apply = useBloKade((s) => s.apply)
  const plugin = registry.get(node.shapeType)
  if (!plugin) return <p className="error-text">This shape's plugin is missing, so its size can't be changed.</p>
  return (
    <>
      <h3>Size</h3>
      {Object.entries<NumberParamSpec>(plugin.params).map(([key, spec]) => (
        <NumberField
          key={key}
          label={`${spec.label}${UNIT[spec.type]}`}
          value={node.params[key] ?? spec.default}
          testId={`param-${key}`}
          onCommit={(value) => apply((d) => updateNode(d, node.id, (n) => (
            n.kind === 'shape' ? { ...n, params: resolveParams(plugin, { ...n.params, [key]: value }) } : n
          )))}
        />
      ))}
    </>
  )
}

function Placement({ node }: { node: SceneNode }) {
  const apply = useBloKade((s) => s.apply)
  const setPart = (part: 'position' | 'rotation', index: number, value: number): void =>
    apply((d) => updateNode(d, node.id, (n) => ({
      ...n, transform: { ...n.transform, [part]: withAxis(n.transform[part], index, value) },
    })))
  return (
    <>
      <h3>Position (mm)</h3>
      <div className="field-row">
        {AXES.map((axis, i) => (
          <NumberField key={axis} label={axis} value={node.transform.position[i] ?? 0} testId={`pos-${axis}`} onCommit={(v) => setPart('position', i, v)} />
        ))}
      </div>
      <h3>Rotation (°)</h3>
      <div className="field-row">
        {AXES.map((axis, i) => (
          <NumberField key={axis} label={axis} value={node.transform.rotation[i] ?? 0} testId={`rot-${axis}`} onCommit={(v) => setPart('rotation', i, v)} />
        ))}
      </div>
    </>
  )
}

export function PropertiesPanel({ registry }: { registry: PluginRegistry }) {
  const doc = useBloKade((s) => s.history.present)
  const selection = useBloKade((s) => s.selection)
  const errors = useBloKade((s) => s.errors)
  const apply = useBloKade((s) => s.apply)
  const node = selection.length === 1 && selection[0] ? doc.nodes[selection[0]] : undefined

  if (selection.length > 1) {
    return (
      <section className="panel" aria-label="Properties">
        <h2>Properties</h2>
        <p className="hint">{selection.length} parts selected. Group them, or pick one to change it.</p>
      </section>
    )
  }
  if (!node) {
    return (
      <section className="panel" aria-label="Properties">
        <h2>Properties</h2>
        <p className="hint">Click a shape to change it. Add shapes from the left.</p>
      </section>
    )
  }
  const error = errors[node.id]
  return (
    <section className="panel" aria-label="Properties">
      <h2>Properties</h2>
      <TextField key={`name-${node.id}`} label="Name" value={node.name} testId="prop-name" onCommit={(name) => apply((d) => renameNode(d, node.id, name))} />
      <div className="mode-toggle" role="group" aria-label="Solid or hole">
        <button type="button" className="tool-button" data-testid="mode-solid" aria-pressed={node.mode === 'solid'}
          onClick={() => apply((d) => setMode(d, [node.id], 'solid'))}>Solid</button>
        <button type="button" className="tool-button" data-testid="mode-hole" aria-pressed={node.mode === 'hole'}
          onClick={() => apply((d) => setMode(d, [node.id], 'hole'))}>Hole</button>
      </div>
      {error && <p className="error-text" role="alert">⚠ {error}</p>}
      {node.kind === 'shape' && <ShapeParams key={`params-${node.id}`} node={node} registry={registry} />}
      <Placement key={`place-${node.id}`} node={node} />
    </section>
  )
}
