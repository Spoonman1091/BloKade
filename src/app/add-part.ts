import { createShapeNode } from '../document/factory'
import { paramField } from '../document/fields'
import { setFieldInput, type NormalizeField } from '../document/formula-ops'
import { addNode } from '../document/ops'
import type { BloKadeDocument, NodeId, Vec3 } from '../document/types'
import { defaultParams } from '../plugins/params'
import { isNumberSpec, type ParamSpec, type ShapePlugin } from '../plugins/types'

export interface NewPart {
  readonly color: string
  readonly name?: string
  readonly position?: Vec3
  readonly rotation?: Vec3
  /** Extra formulas by parameter name, for example a kit's `{ size: 'peg_size' }`. */
  readonly formulas?: Readonly<Record<string, string>>
}

/** Parameters that start as a formula, like a clearance of `fit`. */
export function startingFormulas(plugin: ShapePlugin): Record<string, string> {
  return Object.fromEntries(Object.entries<ParamSpec>(plugin.params).flatMap(([name, spec]) =>
    isNumberSpec(spec) && spec.formula !== undefined ? [[name, spec.formula] as const] : []))
}

/** Adds a new part with its plugin's default sizes, its starting mode and its starting formulas. */
export function addPart(
  doc: BloKadeDocument, plugin: ShapePlugin, input: NewPart, normalize: NormalizeField,
): { doc: BloKadeDocument; id: NodeId } {
  const node = createShapeNode({
    shapeType: plugin.id, name: input.name ?? plugin.name, params: defaultParams(plugin), color: input.color,
    position: input.position, rotation: input.rotation, mode: plugin.mode ?? 'solid',
  })
  const formulas = { ...startingFormulas(plugin), ...input.formulas }
  const withFormulas = Object.entries(formulas).reduce(
    (d, [name, text]) => setFieldInput(d, node.id, paramField(name), text, normalize), addNode(doc, node))
  return { doc: withFormulas, id: node.id }
}
