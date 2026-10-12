import type { FieldKey, Modifier, ModifierField, SceneNode, Vec3 } from './types'

/** Every formula-capable field key. The schema uses this too, so files can't hold formulas for unknown fields. */
export const FIELD_KEY_PATTERN =
  /^(?:param\.([A-Za-z0-9_]+)|(position|rotation)\.([0-2])|mod\.([a-f0-9]{8})\.(radius|distance|count|angle|spacing|center)(?:\.([0-2]))?)$/

type Axis = 0 | 1 | 2
const VECTOR_FIELDS: ReadonlySet<ModifierField> = new Set(['spacing', 'center'])

type ParsedKey =
  | { readonly param: string }
  | { readonly part: 'position' | 'rotation'; readonly axis: Axis }
  | { readonly mod: string; readonly field: ModifierField; readonly axis?: Axis }

export const paramField = (name: string): FieldKey => `param.${name}`
export const positionField = (axis: Axis): FieldKey => `position.${axis}`
export const rotationField = (axis: Axis): FieldKey => `rotation.${axis}`
export const modifierField = (modifierId: string, field: ModifierField, axis?: Axis): FieldKey =>
  axis === undefined ? `mod.${modifierId}.${field}` : `mod.${modifierId}.${field}.${axis}`

function parseKey(key: string): ParsedKey | null {
  const match = FIELD_KEY_PATTERN.exec(key)
  if (!match) return null
  if (match[1]) return { param: match[1] }
  if (match[2]) return { part: match[2] as 'position' | 'rotation', axis: Number(match[3]) as Axis }
  const field = match[5] as ModifierField
  const axis = match[6] === undefined ? undefined : (Number(match[6]) as Axis)
  // Vector fields need an axis; single numbers must not have one.
  if (VECTOR_FIELDS.has(field) !== (axis !== undefined)) return null
  return { mod: match[4] ?? '', field, axis }
}

export const isFieldKey = (key: string): key is FieldKey => parseKey(key) !== null

export function modifierFieldOf(key: string): ModifierField | null {
  const parsed = parseKey(key)
  return parsed && 'mod' in parsed ? parsed.field : null
}

const withAxis = (v: Vec3, axis: Axis, value: number): Vec3 =>
  [axis === 0 ? value : v[0], axis === 1 ? value : v[1], axis === 2 ? value : v[2]]

function modifierNumber(m: Modifier, field: ModifierField, axis?: Axis): number | undefined {
  switch (field) {
    case 'radius': return m.type === 'fillet' ? m.radius : undefined
    case 'distance': return m.type === 'chamfer' ? m.distance : undefined
    case 'count': return m.type === 'linearPattern' || m.type === 'circularPattern' ? m.count : undefined
    case 'angle': return m.type === 'circularPattern' ? m.angle : undefined
    case 'spacing': return m.type === 'linearPattern' && axis !== undefined ? m.spacing[axis] : undefined
    case 'center': return m.type === 'circularPattern' && axis !== undefined ? m.center[axis] : undefined
  }
}

function withModifierNumber(m: Modifier, field: ModifierField, axis: Axis | undefined, value: number): Modifier {
  if (field === 'radius' && m.type === 'fillet') return { ...m, radius: value }
  if (field === 'distance' && m.type === 'chamfer') return { ...m, distance: value }
  if (field === 'count' && (m.type === 'linearPattern' || m.type === 'circularPattern')) return { ...m, count: value }
  if (field === 'angle' && m.type === 'circularPattern') return { ...m, angle: value }
  if (field === 'spacing' && m.type === 'linearPattern' && axis !== undefined) return { ...m, spacing: withAxis(m.spacing, axis, value) }
  if (field === 'center' && m.type === 'circularPattern' && axis !== undefined) return { ...m, center: withAxis(m.center, axis, value) }
  return m
}

const findModifier = (node: SceneNode, id: string): Modifier | undefined => (node.modifiers ?? []).find((m) => m.id === id)

/** The number a field holds, or undefined if this part has no such number field. */
export function readField(node: SceneNode, key: FieldKey): number | undefined {
  const parsed = parseKey(key)
  if (!parsed) return undefined
  if ('part' in parsed) return node.transform[parsed.part][parsed.axis]
  if ('mod' in parsed) {
    const modifier = findModifier(node, parsed.mod)
    return modifier ? modifierNumber(modifier, parsed.field, parsed.axis) : undefined
  }
  if (node.kind !== 'shape' || !Object.hasOwn(node.params, parsed.param)) return undefined
  const value = node.params[parsed.param]
  return typeof value === 'number' ? value : undefined
}

/** A copy of the part with the field set; the same part when the field is unknown or already equal. */
export function writeField(node: SceneNode, key: FieldKey, value: number): SceneNode {
  const parsed = parseKey(key)
  const current = readField(node, key)
  if (!parsed || current === undefined || current === value) return node
  if ('part' in parsed) {
    const vector = withAxis(node.transform[parsed.part], parsed.axis, value)
    return { ...node, transform: { ...node.transform, [parsed.part]: vector } }
  }
  if ('mod' in parsed) {
    const modifiers = (node.modifiers ?? []).map((m) => (m.id === parsed.mod ? withModifierNumber(m, parsed.field, parsed.axis, value) : m))
    return { ...node, modifiers }
  }
  return node.kind === 'shape' ? { ...node, params: { ...node.params, [parsed.param]: value } } : node
}

export function formulaOf(node: SceneNode, key: FieldKey): string | undefined {
  const formulas = node.formulas
  return formulas && Object.hasOwn(formulas, key) ? formulas[key] : undefined
}

/** The part's formulas as [field, text] pairs, skipping keys BloKade doesn't recognise. */
export function formulaEntries(node: SceneNode): readonly (readonly [FieldKey, string])[] {
  return Object.entries(node.formulas ?? {}).flatMap(([key, text]) => (isFieldKey(key) ? [[key, text] as const] : []))
}

/** Sets a field's formula, or removes it with null. A part left with no formulas has `formulas: undefined`. */
export function withFormula(node: SceneNode, key: FieldKey, formula: string | null): SceneNode {
  const others = Object.fromEntries(Object.entries(node.formulas ?? {}).filter(([k]) => k !== key))
  const formulas = formula === null ? others : { ...others, [key]: formula }
  return { ...node, formulas: Object.keys(formulas).length > 0 ? formulas : undefined }
}

/** Changes smaller than this are rounding noise (a drag's 6-decimal rounding), not a real edit. */
export const UNCHANGED_EPSILON = 1e-6

const sameValue = (a: number | undefined, b: number | undefined): boolean =>
  a === b || (a !== undefined && b !== undefined && Math.abs(a - b) < UNCHANGED_EPSILON)

/**
 * After an edit that set fields directly (a drag, align, snap or typed number), forget the formulas
 * whose value it changed: the edit wins. Edits that set formulas themselves are left alone.
 */
export function dropStaleFormulas(before: SceneNode, after: SceneNode): SceneNode {
  if (after.formulas !== before.formulas) return after
  return formulaEntries(after).reduce(
    (node, [key]) => (sameValue(readField(before, key), readField(after, key)) ? node : withFormula(node, key, null)),
    after,
  )
}
