import { useMemo } from 'react'
import { createFieldNormalizer } from '../app/field-normalizer'
import { formulaOf, paramField, positionField, rotationField } from '../document/fields'
import { formulaErrors, setFieldInput } from '../document/formula-ops'
import { renameNode, setMode, updateNode } from '../document/ops'
import type { FieldKey, SceneNode, ShapeNode } from '../document/types'
import { resolveParams } from '../plugins/params'
import type { PluginRegistry } from '../plugins/registry'
import type { NumberParamType, ParamSpec } from '../plugins/types'
import { useBloKade } from '../store/context'
import { AlignTools } from './AlignTools'
import { TextField } from './NumberField'
import { ValueField } from './ValueField'

const AXES = [['x', 0], ['y', 1], ['z', 2]] as const
const UNIT: Record<NumberParamType, string> = { mm: ' (mm)', angle: ' (°)', whole: '', number: '' }

interface FieldsProps {
  node: SceneNode
  errors: Readonly<Record<string, string>>
  setField(key: FieldKey, text: string): void
}

function ShapeParams({ node, errors, setField, registry }: FieldsProps & { node: ShapeNode; registry: PluginRegistry }) {
  const apply = useBloKade((s) => s.apply)
  const plugin = registry.get(node.shapeType)
  if (!plugin) return <p className="error-text">This shape's plugin is missing, so its size can't be changed.</p>
  const setText = (key: string, text: string): void => apply((d) => updateNode(d, node.id, (n) => (
    n.kind === 'shape' ? { ...n, params: resolveParams(plugin, { ...n.params, [key]: text }) } : n
  )))
  return (
    <>
      <h3>Size</h3>
      {Object.entries<ParamSpec>(plugin.params).map(([key, spec]) => {
        const raw = node.params[key]
        if (spec.type === 'text') {
          return <TextField key={key} label={spec.label} value={typeof raw === 'string' ? raw : spec.default}
            testId={`param-${key}`} onCommit={(text) => setText(key, text)} />
        }
        const field = paramField(key)
        return <ValueField key={key} label={`${spec.label}${UNIT[spec.type]}`} value={typeof raw === 'number' ? raw : spec.default}
          formula={formulaOf(node, field)} error={errors[field]} testId={`param-${key}`} onCommit={(text) => setField(field, text)} />
      })}
    </>
  )
}

function Placement({ node, errors, setField }: FieldsProps) {
  const row = (part: 'position' | 'rotation', prefix: string) => (
    <div className="field-row">
      {AXES.map(([axis, index]) => {
        const field = part === 'position' ? positionField(index) : rotationField(index)
        return <ValueField key={axis} label={axis} value={node.transform[part][index]} formula={formulaOf(node, field)}
          error={errors[field]} testId={`${prefix}-${axis}`} onCommit={(text) => setField(field, text)} />
      })}
    </div>
  )
  return (
    <>
      <h3>Position (mm)</h3>
      {row('position', 'pos')}
      <h3>Rotation (°)</h3>
      {row('rotation', 'rot')}
    </>
  )
}

export function PropertiesPanel({ registry }: { registry: PluginRegistry }) {
  const doc = useBloKade((s) => s.history.present)
  const selection = useBloKade((s) => s.selection)
  const errors = useBloKade((s) => s.errors)
  const apply = useBloKade((s) => s.apply)
  const normalize = useMemo(() => createFieldNormalizer(registry), [registry])
  const fieldErrors = useMemo(() => formulaErrors(doc), [doc])
  const node = selection.length === 1 && selection[0] ? doc.nodes[selection[0]] : undefined

  if (selection.length > 1) {
    return (
      <section className="panel" aria-label="Properties">
        <h2>Properties</h2>
        <p className="hint">{selection.length} parts selected. Group them, or pick one to change it.</p>
        <AlignTools />
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
  const setField = (key: FieldKey, text: string): void => apply((d) => setFieldInput(d, node.id, key, text, normalize))
  const nodeErrors = fieldErrors[node.id] ?? {}
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
      {node.kind === 'shape' && <ShapeParams key={`params-${node.id}`} node={node} errors={nodeErrors} setField={setField} registry={registry} />}
      <Placement key={`place-${node.id}`} node={node} errors={nodeErrors} setField={setField} />
    </section>
  )
}
