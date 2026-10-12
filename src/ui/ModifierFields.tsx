import { formulaOf, modifierField } from '../document/fields'
import { setEdgeSelection, setMirror, setPatternAxis } from '../document/modifiers'
import type {
  ChamferModifier, CircularPatternModifier, EdgeWhich, FieldKey, FilletModifier, MirrorModifier, Modifier, ModifierField, SceneNode, Vec3,
} from '../document/types'
import { useBloKade } from '../store/context'
import { AXIS_OPTIONS, EDGE_OPTIONS, PLANE_OPTIONS } from './modifier-icons'
import { ValueField } from './ValueField'

export interface ModifierFieldsProps {
  node: SceneNode
  modifier: Modifier
  index: number
  errors: Readonly<Record<string, string>>
  setField(key: FieldKey, text: string): void
}

const AXES = [['x', 0], ['y', 1], ['z', 2]] as const

function NumberInput({ node, modifier, index, errors, setField, field, label, value }: ModifierFieldsProps & {
  field: ModifierField; label: string; value: number
}) {
  const key = modifierField(modifier.id, field)
  return <ValueField label={label} value={value} formula={formulaOf(node, key)} error={errors[key]}
    testId={`mod-${field}-${index}`} onCommit={(text) => setField(key, text)} />
}

function VectorInput({ node, modifier, index, errors, setField, field, label, value }: ModifierFieldsProps & {
  field: 'spacing' | 'center'; label: string; value: Vec3
}) {
  return (
    <>
      <h4>{label}</h4>
      <div className="field-row">
        {AXES.map(([axis, i]) => {
          const key = modifierField(modifier.id, field, i)
          return <ValueField key={axis} label={axis} value={value[i]} formula={formulaOf(node, key)} error={errors[key]}
            testId={`mod-${field}-${axis}-${index}`} onCommit={(text) => setField(key, text)} />
        })}
      </div>
    </>
  )
}

function EdgeChoice({ node, modifier, index }: { node: SceneNode; modifier: FilletModifier | ChamferModifier; index: number }) {
  const apply = useBloKade((s) => s.apply)
  const picking = useBloKade((s) => s.pickingEdges)
  const setPicking = useBloKade((s) => s.setPickingEdges)
  const active = picking?.nodeId === node.id && picking.modifierId === modifier.id
  const value = active || modifier.edges.by === 'picked' ? 'picked' : modifier.edges.which
  const target = { nodeId: node.id, modifierId: modifier.id }
  const choose = (next: string): void => {
    if (next === 'picked') {
      setPicking(target)
      return
    }
    apply((d) => setEdgeSelection(d, node.id, modifier.id, { by: 'description', which: next as EdgeWhich }))
    if (active) setPicking(null)
  }
  return (
    <>
      <label className="field">
        <span>Which edges</span>
        <select data-testid={`mod-edges-${index}`} value={value} onChange={(e) => choose(e.target.value)}>
          {EDGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          <option value="picked">Edges I pick</option>
        </select>
      </label>
      <button type="button" className="tool-button" data-testid={`mod-pick-${index}`} aria-pressed={active}
        onClick={() => setPicking(active ? null : target)}>
        {active ? 'Done picking' : '👆 Pick edges'}
      </button>
      {modifier.edges.by === 'picked' && (
        <p className="hint" data-testid={`mod-picked-${index}`}>
          {modifier.edges.fingerprints.length} {modifier.edges.fingerprints.length === 1 ? 'edge' : 'edges'} picked
        </p>
      )}
    </>
  )
}

function CircleFields(props: ModifierFieldsProps & { modifier: CircularPatternModifier }) {
  const { node, modifier: m, index } = props
  const apply = useBloKade((s) => s.apply)
  return (
    <>
      <NumberInput {...props} field="count" label="How many" value={m.count} />
      <NumberInput {...props} field="angle" label="Spread over (°)" value={m.angle} />
      <label className="field">
        <span>Turn around</span>
        <select data-testid={`mod-axis-${index}`} value={m.axis}
          onChange={(e) => apply((d) => setPatternAxis(d, node.id, m.id, e.target.value as typeof m.axis))}>
          {AXIS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <VectorInput {...props} field="center" label="Center (mm, from the part's own origin)" value={m.center} />
    </>
  )
}

function MirrorFields({ node, modifier: m, index }: ModifierFieldsProps & { modifier: MirrorModifier }) {
  const apply = useBloKade((s) => s.apply)
  return (
    <>
      <label className="field">
        <span>Flip</span>
        <select data-testid={`mod-plane-${index}`} value={m.plane}
          onChange={(e) => apply((d) => setMirror(d, node.id, m.id, { plane: e.target.value as typeof m.plane }))}>
          {PLANE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label className="checkbox-field">
        <input type="checkbox" data-testid={`mod-keep-${index}`} checked={m.keepOriginal}
          onChange={(e) => apply((d) => setMirror(d, node.id, m.id, { keepOriginal: e.target.checked }))} />
        Keep the original too
      </label>
    </>
  )
}

export function ModifierFields(props: ModifierFieldsProps) {
  const { node, modifier: m, index } = props
  switch (m.type) {
    case 'fillet':
      return <><NumberInput {...props} field="radius" label="Roundness (mm)" value={m.radius} /><EdgeChoice node={node} modifier={m} index={index} /></>
    case 'chamfer':
      return <><NumberInput {...props} field="distance" label="Bevel size (mm)" value={m.distance} /><EdgeChoice node={node} modifier={m} index={index} /></>
    case 'linearPattern':
      return <><NumberInput {...props} field="count" label="How many" value={m.count} /><VectorInput {...props} field="spacing" label="Step between copies (mm)" value={m.spacing} /></>
    case 'circularPattern':
      return <CircleFields {...props} modifier={m} />
    case 'mirror':
      return <MirrorFields {...props} modifier={m} />
  }
}
