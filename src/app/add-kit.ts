import { Euler, MathUtils, Vector3 } from 'three'
import { pickColor } from '../document/factory'
import type { NormalizeField } from '../document/formula-ops'
import { DocumentOpError } from '../document/ops'
import type { BloKadeDocument, NodeId, Vec3 } from '../document/types'
import { addVariable } from '../document/variable-ops'
import { renameVariableIn } from '../formulas/formula'
import type { ShapeKit } from '../plugins/kits'
import type { PluginRegistry } from '../plugins/registry'
import type { Workplane } from '../store/store'
import { addPart } from './add-part'

/** The kit's variable names, all with the same smallest number that makes every one of them free. */
export function kitVariableNames(doc: BloKadeDocument, kit: ShapeKit): Map<string, string> {
  const taken = new Set(doc.variables.map((v) => v.name))
  const named = (n: number) => new Map(kit.variables.map((v) => [v.name, n === 1 ? v.name : `${v.name}${n}`] as const))
  const free = (n: number): Map<string, string> => {
    const names = named(n)
    return [...names.values()].some((name) => taken.has(name)) ? free(n + 1) : names
  }
  return free(1)
}

function placeOffset(offset: Vec3, workplane: Workplane | null): Vec3 {
  if (!workplane) return offset
  const [rx, ry, rz] = workplane.rotation.map((deg) => MathUtils.degToRad(deg))
  const turned = new Vector3(...offset).applyEuler(new Euler(rx, ry, rz, 'XYZ'))
  return [workplane.origin[0] + turned.x, workplane.origin[1] + turned.y, workplane.origin[2] + turned.z]
}

const renameAll = (text: string, names: Map<string, string>): string =>
  [...names].reduce((acc, [from, to]) => (from === to ? acc : renameVariableIn(acc, from, to)), text)

/** Adds a kit's variables and parts in one go. The caller commits it as a single undo step. */
export function addKit(
  doc: BloKadeDocument, kit: ShapeKit, registry: PluginRegistry, normalize: NormalizeField,
  workplane: Workplane | null, firstColorIndex: number,
): { doc: BloKadeDocument; ids: NodeId[] } {
  const names = kitVariableNames(doc, kit)
  const withVariables = kit.variables.reduce((d, v) => addVariable(d, names.get(v.name) ?? v.name, v.expr, normalize), doc)
  return kit.parts.reduce<{ doc: BloKadeDocument; ids: NodeId[] }>((acc, part, i) => {
    const plugin = registry.get(part.shapeType)
    if (!plugin) throw new DocumentOpError(`BloKade doesn't have a "${part.shapeType}" shape.`)
    const formulas = Object.fromEntries(Object.entries(part.formulas).map(([k, text]) => [k, renameAll(text, names)]))
    const { doc: next, id } = addPart(acc.doc, plugin, {
      name: part.name, color: pickColor(firstColorIndex + i), formulas,
      position: placeOffset(part.offset, workplane), rotation: workplane?.rotation,
    }, normalize)
    return { doc: next, ids: [...acc.ids, id] }
  }, { doc: withVariables, ids: [] })
}
