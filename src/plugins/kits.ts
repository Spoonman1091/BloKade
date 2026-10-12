import type { Vec3 } from '../document/types'
import { computeFormula } from '../formulas/formula'
import type { PluginRegistry } from './registry'
import { isNumberSpec } from './types'

export interface KitPart {
  readonly shapeType: string
  readonly name: string
  /** Where this part goes, from the first part (turned with the workplane). */
  readonly offset: Vec3
  /** Formulas by number-parameter name. They may use the kit's variables and `fit`. */
  readonly formulas: Readonly<Record<string, string>>
}

/** Several parts added together and kept matched through shared variables. */
export interface ShapeKit {
  readonly id: string
  readonly name: string
  readonly icon: string
  /** Shared sizes. If a name is taken, every one of them gets the same number added (peg_size2…). */
  readonly variables: readonly { readonly name: string; readonly expr: string }[]
  readonly parts: readonly KitPart[]
}

const pegAndSocket: ShapeKit = {
  id: 'peg-socket',
  name: 'Peg & socket',
  icon: '🧷',
  variables: [{ name: 'peg_size', expr: '8' }, { name: 'peg_length', expr: '10' }],
  parts: [
    { shapeType: 'peg', name: 'Peg', offset: [0, 0, 0], formulas: { size: 'peg_size', length: 'peg_length' } },
    { shapeType: 'socket', name: 'Socket', offset: [25, 0, 0], formulas: { size: 'peg_size', depth: 'peg_length + 1' } },
  ],
}

const snapFit: ShapeKit = {
  id: 'snap-fit',
  name: 'Snap-fit clip',
  icon: '🪝',
  variables: [{ name: 'clip_width', expr: '6' }, { name: 'clip_thickness', expr: '1.5' }],
  parts: [
    { shapeType: 'snap-clip', name: 'Snap clip', offset: [0, 0, 0], formulas: { width: 'clip_width', thickness: 'clip_thickness' } },
    { shapeType: 'snap-catch', name: 'Snap catch', offset: [25, 0, 0], formulas: { width: 'clip_width', thickness: 'clip_thickness' } },
  ],
}

export const KITS: readonly ShapeKit[] = [pegAndSocket, snapFit]

function partProblems(kit: ShapeKit, part: KitPart, registry: PluginRegistry): string[] {
  const plugin = registry.get(part.shapeType)
  if (!plugin) return [`Kit "${kit.name}": there is no "${part.shapeType}" shape.`]
  const scope = new Map([...kit.variables.map((v) => [v.name, 1] as const), ['fit', 0.2] as const])
  const allowed = [...kit.variables.map((v) => v.name), 'fit'].join(' and ')
  return Object.entries(part.formulas).flatMap(([name, text]) => {
    const spec = Object.hasOwn(plugin.params, name) ? plugin.params[name] : undefined
    if (!spec || !isNumberSpec(spec)) return [`Kit "${kit.name}": "${name}" on ${plugin.name} is not a number size.`]
    if (!computeFormula(text, scope).ok) return [`Kit "${kit.name}": the formula for "${name}" on ${plugin.name} uses something besides ${allowed}.`]
    return []
  })
}

/** Problems that would stop a kit working, in plain words. Checked by a test for the built-in kits. */
export function kitProblems(kits: readonly ShapeKit[], registry: PluginRegistry): string[] {
  return kits.flatMap((kit) => kit.parts.flatMap((part) => partProblems(kit, part, registry)))
}
