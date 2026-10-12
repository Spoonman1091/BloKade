import { getOC, type Edge, type Shape3D } from 'replicad'
import { MODIFIER_LABELS } from '../document/modifiers'
import {
  MAX_COPIES,
  type ChamferModifier,
  type CircularPatternModifier,
  type FilletModifier,
  type LinearPatternModifier,
  type MirrorModifier,
  type Modifier,
  type PatternAxis,
  type Vec3,
} from '../document/types'
import { edgeInfos, read as readVector, shapeBox } from './edge-info'
import { edgeTolerance, midOf, selectedEdges } from './edge-select'

/** A modifier problem in plain words; the Evaluator turns it into the part's warning badge. */
export class ModifierError extends Error {
  override name = 'ModifierError'
}

export interface ModifiedShape {
  readonly shape: Shape3D
  /** Non-fatal notes by modifier id, such as edges that couldn't be found again. */
  readonly warnings: Readonly<Record<string, string>>
}

interface Applied {
  readonly shape: Shape3D
  readonly warning: string | null
}

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)

function lostWarning(lost: number): string | null {
  if (lost === 0) return null
  return `Lost track of ${lost} ${plural(lost, 'edge', 'edges')} — click Pick edges to choose ${plural(lost, 'it', 'them')} again.`
}

/** OpenCascade can return a broken solid instead of failing when a rounding is too big. */
function isSound(shape: Shape3D): boolean {
  const analyzer = new (getOC().BRepCheck_Analyzer)(shape.wrapped, true, false)
  try {
    return analyzer.IsValid()
  } finally {
    analyzer.delete()
  }
}

/** Rounds or bevels the chosen edges. Does not consume `shape`; always returns a new shape. */
function roundEdges(shape: Shape3D, modifier: FilletModifier | ChamferModifier): Applied {
  const box = shapeBox(shape)
  const infos = edgeInfos(shape)
  const { indices, lost } = selectedEdges(modifier.edges, infos, box)
  if (indices.size === 0) return { shape: shape.clone(), warning: lostWarning(lost) ?? 'No edges match, so this does nothing yet.' }
  const mids = [...indices].flatMap((i) => (infos[i] ? [midOf(infos[i])] : []))
  const tol = edgeTolerance(box)
  const size = modifier.type === 'fillet' ? modifier.radius : modifier.distance
  const pick = (edge: Edge): number | null => {
    const m = readVector(edge.pointAt(0.5))
    return mids.some((p) => Math.hypot(p[0] - m[0], p[1] - m[1], p[2] - m[2]) <= tol) ? size : null
  }
  const tooBig = new ModifierError(`${MODIFIER_LABELS[modifier.type]}: ${size} mm is too big for these edges. Try a smaller size.`)
  let out: Shape3D
  try {
    out = modifier.type === 'fillet' ? shape.fillet(pick) : shape.chamfer(pick)
  } catch {
    throw tooBig
  }
  if (!isSound(out)) {
    out.delete()
    throw tooBig
  }
  return { shape: out, warning: lostWarning(lost) }
}

const AXIS_DIRECTION: Readonly<Record<PatternAxis, [number, number, number]>> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }

/** Fuses two shapes into one. Consumes both, even if the fuse fails. */
function fuseTwo(a: Shape3D, b: Shape3D): Shape3D {
  try {
    return a.fuse(b)
  } finally {
    a.delete()
    b.delete()
  }
}

/** Builds every copy; if one fails, frees the ones already made. */
function buildCopies(count: number, copy: (i: number) => Shape3D): Shape3D[] {
  const made: Shape3D[] = []
  try {
    for (let i = 0; i < count; i++) made.push(copy(i))
    return made
  } catch (error) {
    made.forEach((s) => s.delete())
    throw error
  }
}

/** Fuses neighbours in pairs, halving the list. Consumes `level`; a throw frees everything still alive. */
function fusePairs(level: readonly Shape3D[]): Shape3D[] {
  const next: Shape3D[] = []
  let i = 0
  try {
    for (; i < level.length; i += 2) {
      const [a, b] = [level[i] as Shape3D, level[i + 1]]
      next.push(b ? fuseTwo(a, b) : a)
    }
    return next
  } catch (error) {
    // fuseTwo already freed the failed pair.
    [...next, ...level.slice(i + 2)].forEach((s) => s.delete())
    throw error
  }
}

/**
 * Builds copy 0..count-1 and fuses them as a balanced tree: each round fuses neighbours in pairs, so
 * every fuse works on similar-sized pieces instead of one ever-growing shape (much faster for big repeats).
 */
function fuseCopies(count: number, copy: (i: number) => Shape3D): Shape3D {
  let level = buildCopies(count, copy)
  while (level.length > 1) level = fusePairs(level)
  return level[0] as Shape3D
}

const scaled = (v: Vec3, k: number): [number, number, number] => [v[0] * k, v[1] * k, v[2] * k]

function linearPattern(shape: Shape3D, m: LinearPatternModifier): Shape3D {
  return fuseCopies(m.count, (i) => (i === 0 ? shape.clone() : shape.clone().translate(scaled(m.spacing, i))))
}

/** Degrees between neighbouring copies: all the way round shares 360° evenly; less spreads over the angle. */
export function circularStep(m: CircularPatternModifier): number {
  if (m.count <= 1) return 0
  return m.angle >= 360 ? 360 / m.count : m.angle / (m.count - 1)
}

function circularPattern(shape: Shape3D, m: CircularPatternModifier): Shape3D {
  const step = circularStep(m)
  const center: [number, number, number] = [m.center[0], m.center[1], m.center[2]]
  return fuseCopies(m.count, (i) =>
    (i === 0 ? shape.clone() : shape.clone().rotate(step * i, center, AXIS_DIRECTION[m.axis])))
}

function mirrored(shape: Shape3D, m: MirrorModifier): Shape3D {
  const flipped = shape.clone().mirror(m.plane, [0, 0, 0])
  if (!m.keepOriginal) return flipped
  let original: Shape3D
  try {
    original = shape.clone()
  } catch (error) {
    flipped.delete()
    throw error
  }
  return fuseTwo(original, flipped)
}

/** Boolean unions can return a broken solid instead of failing; refuse it. */
function sound(out: Shape3D, modifier: Modifier): Applied {
  if (isSound(out)) return { shape: out, warning: null }
  out.delete()
  throw new ModifierError(`${MODIFIER_LABELS[modifier.type]} couldn't be applied. Try different settings.`)
}

/** Applies one modifier without consuming `shape`. */
function applyOne(shape: Shape3D, modifier: Modifier): Applied {
  try {
    switch (modifier.type) {
      case 'fillet':
      case 'chamfer': return roundEdges(shape, modifier)
      case 'linearPattern': return sound(linearPattern(shape, modifier), modifier)
      case 'circularPattern': return sound(circularPattern(shape, modifier), modifier)
      case 'mirror': return sound(mirrored(shape, modifier), modifier)
    }
  } catch (error) {
    if (error instanceof ModifierError) throw error
    throw new ModifierError(`${MODIFIER_LABELS[modifier.type]} couldn't be applied. Try different settings.`)
  }
}

/** How many copies a stack makes: pattern counts multiplied, ×2 for a mirror that keeps the original. */
export function copiesMade(modifiers: readonly Modifier[]): number {
  return modifiers.reduce((n, m) => {
    if (m.type === 'linearPattern' || m.type === 'circularPattern') return n * m.count
    return m.type === 'mirror' && m.keepOriginal ? n * 2 : n
  }, 1)
}

function applyOrFree(shape: Shape3D, modifier: Modifier): Applied {
  try {
    return applyOne(shape, modifier)
  } catch (error) {
    shape.delete()
    throw error
  }
}

/**
 * Most repeat work allowed: copies made × faces on the part being repeated. Fusing detailed copies gets slow
 * fast — measured with real OpenCascade (Node, balanced-tree fuse): "HELLO WORLD" text (166 faces) ×20 with
 * overlapping copies took ~24 s (3320 work), ×50 would be 8300 work and runs past the 30 s rebuild limit;
 * 200 boxes (6 faces, 1200 work) take under 1 s. 3500 keeps 20 detailed copies and every simple repeat allowed.
 */
export const MAX_REPEAT_WORK = 3500

function faceCount(shape: Shape3D): number {
  const faces = shape.faces
  faces.forEach((f) => f.delete())
  return faces.length
}

/** Why a stack is too big to build in time, or null. Looks only at counts and the input's face count. */
function tooBigReason(input: Shape3D, enabled: readonly Modifier[]): string | null {
  const copies = copiesMade(enabled)
  if (copies > MAX_COPIES) return `These modifiers make ${copies} copies. BloKade can make up to ${MAX_COPIES} at once — use smaller counts.`
  if (copies > 1 && copies * faceCount(input) > MAX_REPEAT_WORK) return 'This part is too detailed to repeat that many times. Try fewer copies.'
  return null
}

/** Refuses stacks too big to build in time, before any geometry work. Frees `input` when it refuses or fails. */
function checkBudget(input: Shape3D, enabled: readonly Modifier[]): void {
  let reason: string | null
  try {
    reason = tooBigReason(input, enabled)
  } catch (error) {
    input.delete()
    throw error
  }
  if (reason === null) return
  input.delete()
  throw new ModifierError(reason)
}

/** Applies the enabled modifiers in order. Consumes `input`; the caller owns the result. */
export function applyModifiers(input: Shape3D, modifiers: readonly Modifier[]): ModifiedShape {
  const enabled = modifiers.filter((m) => m.enabled)
  checkBudget(input, enabled)
  return enabled.reduce<ModifiedShape>((acc, modifier) => {
    const applied = applyOrFree(acc.shape, modifier)
    acc.shape.delete()
    return { shape: applied.shape, warnings: applied.warning ? { ...acc.warnings, [modifier.id]: applied.warning } : acc.warnings }
  }, { shape: input, warnings: {} })
}
