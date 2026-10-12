import type { FieldKey, SceneNode, Vec3 } from './types'

const FIELD_KEY = /^(?:param\.([A-Za-z0-9_]+)|(position|rotation)\.([0-2]))$/

type Axis = 0 | 1 | 2
type ParsedKey = { readonly param: string } | { readonly part: 'position' | 'rotation'; readonly axis: Axis }

export const paramField = (name: string): FieldKey => `param.${name}`
export const positionField = (axis: Axis): FieldKey => `position.${axis}`
export const rotationField = (axis: Axis): FieldKey => `rotation.${axis}`
export const isFieldKey = (key: string): key is FieldKey => FIELD_KEY.test(key)

function parseKey(key: FieldKey): ParsedKey | null {
  const match = FIELD_KEY.exec(key)
  if (!match) return null
  if (match[1]) return { param: match[1] }
  return { part: match[2] as 'position' | 'rotation', axis: Number(match[3]) as Axis }
}

const withAxis = (v: Vec3, axis: Axis, value: number): Vec3 =>
  [axis === 0 ? value : v[0], axis === 1 ? value : v[1], axis === 2 ? value : v[2]]

/** The number a field holds, or undefined if this part has no such number field. */
export function readField(node: SceneNode, key: FieldKey): number | undefined {
  const parsed = parseKey(key)
  if (!parsed) return undefined
  if ('part' in parsed) return node.transform[parsed.part][parsed.axis]
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
