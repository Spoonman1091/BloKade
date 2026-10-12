import type { Axis, Box } from '../document/box'
import type { ParamValue, Vec3 } from '../document/types'
import { MAX_MM } from '../plugins/params'
import { isNumberSpec, type ShapePlugin } from '../plugins/types'

export type HandleKind = 'side' | 'top' | 'corner'

/** A size handle on a part, in the part's own frame. */
export interface SizeHandle {
  readonly id: string
  readonly kind: HandleKind
  /** −1, 0 or +1 per axis: which way the handle's face points. 0 means the handle doesn't change that axis. */
  readonly dir: Vec3
  readonly position: Vec3
}

export interface SizeDragInput {
  readonly plugin: ShapePlugin
  readonly params: Readonly<Record<string, ParamValue>>
  /** The part's box in its own frame when the drag started. */
  readonly box: Box
  readonly handle: SizeHandle
  /** How far the pointer moved along the handle's track since the drag started, in the part's own frame. */
  readonly moved: Vec3
  /** Grid step to snap sizes to; 0 means no snapping. */
  readonly snap: number
  /** Alt on a corner: change every size by the same factor. */
  readonly keepProportions: boolean
}

export interface SizeChange {
  readonly key: string
  readonly label: string
  readonly value: number
}

export interface SizeDragResult {
  /** Factor per axis, about the part's own origin; 1 for axes the drag doesn't change. */
  readonly scale: Vec3
  /** The size settings the drag changes, with their new values, in x, y, z order. */
  readonly changes: readonly SizeChange[]
  /** The biggest size, when a size stopped there. */
  readonly biggest: number | null
}

/** Smallest size, in mm, when snapping is off. */
export const FREE_MIN_SIZE = 0.1

const AXES = [0, 1, 2] as const
const AXIS_NAMES = ['x', 'y', 'z'] as const
const SIGNS = [-1, 1] as const
const signName = (sign: number): string => (sign > 0 ? '+' : '-')

const sizeKey = (plugin: ShapePlugin, axis: Axis): string | undefined => plugin.size?.[AXIS_NAMES[axis]]
const mid = (box: Box, axis: Axis): number => (box.min[axis] + box.max[axis]) / 2
const at = (box: Box, axis: Axis, sign: number): number => (sign > 0 ? box.max[axis] : box.min[axis])

function sideHandles(plugin: ShapePlugin, box: Box): SizeHandle[] {
  return ([0, 1] as const).flatMap((axis) => (sizeKey(plugin, axis) === undefined ? [] : SIGNS.map((sign) => ({
    id: `${AXIS_NAMES[axis]}${signName(sign)}`,
    kind: 'side' as const,
    dir: (axis === 0 ? [sign, 0, 0] : [0, sign, 0]) as Vec3,
    position: (axis === 0 ? [at(box, 0, sign), mid(box, 1), mid(box, 2)] : [mid(box, 0), at(box, 1, sign), mid(box, 2)]) as Vec3,
  }))))
}

function topHandle(plugin: ShapePlugin, box: Box): SizeHandle[] {
  return sizeKey(plugin, 2) === undefined ? [] : [{ id: 'z+', kind: 'top', dir: [0, 0, 1], position: [mid(box, 0), mid(box, 1), box.max[2]] }]
}

function cornerHandles(plugin: ShapePlugin, box: Box): SizeHandle[] {
  if (sizeKey(plugin, 0) === undefined || sizeKey(plugin, 1) === undefined) return []
  return SIGNS.flatMap((sx) => SIGNS.map((sy) => ({
    id: `corner-x${signName(sx)}y${signName(sy)}`,
    kind: 'corner' as const,
    dir: [sx, sy, 0] as Vec3,
    position: [at(box, 0, sx), at(box, 1, sy), box.min[2]] as Vec3,
  })))
}

/** The handles a part gets: one per side face and the top for each size it has, and bottom corners when it has x and y. */
export function handlesFor(plugin: ShapePlugin, box: Box): readonly SizeHandle[] {
  return [...sideHandles(plugin, box), ...topHandle(plugin, box), ...cornerHandles(plugin, box)]
}

/** Each size setting once, in x, y, z order. */
function sizeKeys(plugin: ShapePlugin, axes: readonly Axis[] = AXES): readonly string[] {
  return [...new Set(axes.flatMap((axis) => sizeKey(plugin, axis) ?? []))]
}

const labelOf = (plugin: ShapePlugin, key: string): string =>
  (Object.hasOwn(plugin.params, key) ? plugin.params[key]?.label : undefined) ?? key

function numberAt(params: Readonly<Record<string, ParamValue>>, key: string): number | null {
  const value = Object.hasOwn(params, key) ? params[key] : undefined
  return typeof value === 'number' && value > 0 ? value : null
}

/** The factor the pointer asks for on each dragged size, keeping the bigger change when two axes share one. */
function wantedFactors({ plugin, box, handle, moved }: SizeDragInput): Readonly<Record<string, number>> {
  return AXES.reduce<Readonly<Record<string, number>>>((acc, axis) => {
    const key = sizeKey(plugin, axis)
    const size = box.max[axis] - box.min[axis]
    if (handle.dir[axis] === 0 || key === undefined || size <= 0) return acc
    const factor = (size + handle.dir[axis] * moved[axis]) / size
    const current = Object.hasOwn(acc, key) ? acc[key] : undefined
    return current === undefined || Math.abs(factor - 1) > Math.abs(current - 1) ? { ...acc, [key]: factor } : acc
  }, {})
}

/** Alt on a corner: every size gets the bigger of the dragged factors. */
function proportional(plugin: ShapePlugin, wanted: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
  const values = Object.values(wanted)
  if (values.length === 0) return wanted
  const factor = Math.max(...values)
  return Object.fromEntries(sizeKeys(plugin).map((key) => [key, factor]))
}

interface Limits {
  readonly min: number
  readonly max: number
}

function limitsOf(plugin: ShapePlugin, key: string, snap: number): Limits {
  const spec = Object.hasOwn(plugin.params, key) ? plugin.params[key] : undefined
  const number = spec && isNumberSpec(spec) ? spec : undefined
  return { min: Math.max(snap > 0 ? snap : FREE_MIN_SIZE, number?.min ?? 0), max: number?.max ?? MAX_MM }
}

const round2 = (v: number): number => Math.round(v * 100) / 100

interface Settled {
  readonly change: SizeChange
  readonly capped: boolean
}

function settleKey(input: SizeDragInput, key: string, factor: number, snap: number): Settled | null {
  const old = numberAt(input.params, key)
  if (old === null) return null
  const change = (value: number): SizeChange => ({ key, label: labelOf(input.plugin, key), value })
  if (factor === 1) return { change: change(old), capped: false }
  const limits = limitsOf(input.plugin, key, snap)
  const wanted = old * factor
  const snapped = snap > 0 ? round2(Math.round(wanted / snap) * snap) : round2(wanted)
  return { change: change(Math.min(Math.max(snapped, limits.min), limits.max)), capped: snapped > limits.max }
}

/** New values for each size. With Alt, the first size snaps and the others follow its factor exactly. */
function settleAll(input: SizeDragInput, factors: Readonly<Record<string, number>>, together: boolean): readonly Settled[] {
  const keys = sizeKeys(input.plugin).filter((key) => Object.hasOwn(factors, key))
  const factorOf = (key: string): number => factors[key] ?? 1
  const [lead, ...rest] = keys
  if (!together || lead === undefined) return keys.flatMap((key) => settleKey(input, key, factorOf(key), input.snap) ?? [])
  const first = settleKey(input, lead, factorOf(lead), input.snap)
  const old = numberAt(input.params, lead)
  if (!first || old === null) return []
  const factor = first.change.value / old
  return [first, ...rest.flatMap((key) => settleKey(input, key, factor, 0) ?? [])]
}

/** Turns a handle drag into new size settings and the matching scale per axis. */
export function dragToScale(input: SizeDragInput): SizeDragResult {
  const together = input.keepProportions && input.handle.kind === 'corner'
  const wanted = wantedFactors(input)
  const settled = settleAll(input, together ? proportional(input.plugin, wanted) : wanted, together)
  const valueOf = Object.fromEntries(settled.map((s) => [s.change.key, s.change.value]))
  const axisScale = (axis: Axis): number => {
    const key = sizeKey(input.plugin, axis)
    const old = key === undefined ? null : numberAt(input.params, key)
    const next = key !== undefined && Object.hasOwn(valueOf, key) ? valueOf[key] : undefined
    return old === null || next === undefined ? 1 : next / old
  }
  const capped = settled.find((s) => s.capped)
  return {
    scale: [axisScale(0), axisScale(1), axisScale(2)],
    changes: settled.map((s) => s.change),
    biggest: capped ? capped.change.value : null,
  }
}

/** The hover tip for a handle, using the size settings' own labels. */
export function handleTip(plugin: ShapePlugin, handle: SizeHandle): string {
  const dragged = AXES.filter((axis) => handle.dir[axis] !== 0)
  const names = sizeKeys(plugin, dragged).map((key) => labelOf(plugin, key)).join(' and ')
  const tip = `Drag to change the ${names}.`
  return handle.kind === 'corner' ? `${tip} Hold Alt to keep the shape's proportions.` : tip
}
