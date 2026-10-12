import { newId } from './factory'
import { DocumentOpError, updateNode } from './ops'
import {
  MAX_EDGE_SIZE, MAX_MODIFIERS, MAX_OFFSET, MAX_PATTERN_ANGLE, MAX_PATTERN_COUNT, MAX_PICKED_EDGES, MIN_EDGE_SIZE,
  MIN_PATTERN_ANGLE,
  type BloKadeDocument, type EdgeFingerprint, type EdgeSelection, type MirrorPlane, type Modifier, type ModifierField,
  type ModifierType, type NodeId, type PatternAxis, type SceneNode,
} from './types'

export const MODIFIER_TYPES: readonly ModifierType[] = ['fillet', 'chamfer', 'linearPattern', 'circularPattern', 'mirror']

/** Kid-facing names, used in the panel and in error messages. */
export const MODIFIER_LABELS: Readonly<Record<ModifierType, string>> = {
  fillet: 'Round edges',
  chamfer: 'Bevel edges',
  linearPattern: 'Repeat in a row',
  circularPattern: 'Repeat in a circle',
  mirror: 'Mirror',
}

export const modifiersOf = (node: SceneNode): readonly Modifier[] => node.modifiers ?? []

export function createModifier(type: ModifierType, id: string): Modifier {
  switch (type) {
    case 'fillet': return { id, type, enabled: true, radius: 2, edges: { by: 'description', which: 'top' } }
    case 'chamfer': return { id, type, enabled: true, distance: 1, edges: { by: 'description', which: 'top' } }
    case 'linearPattern': return { id, type, enabled: true, count: 3, spacing: [25, 0, 0] }
    case 'circularPattern': return { id, type, enabled: true, count: 6, axis: 'z', angle: 360, center: [0, 0, 0] }
    case 'mirror': return { id, type, enabled: true, plane: 'YZ', keepOriginal: true }
  }
}

const withModifiers = (node: SceneNode, modifiers: readonly Modifier[]): SceneNode =>
  ({ ...node, modifiers: modifiers.length > 0 ? modifiers : undefined })

function nodeOf(doc: BloKadeDocument, id: NodeId): SceneNode {
  const node = Object.hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined
  if (!node) throw new DocumentOpError('That part no longer exists.')
  return node
}

function freshId(taken: readonly Modifier[]): string {
  const id = newId().slice(0, 8)
  return taken.some((m) => m.id === id) ? freshId(taken) : id
}

export function addModifier(
  doc: BloKadeDocument, nodeId: NodeId, type: ModifierType,
): { doc: BloKadeDocument; modifierId: string } {
  const current = modifiersOf(nodeOf(doc, nodeId))
  if (current.length >= MAX_MODIFIERS) throw new DocumentOpError(`A part can have up to ${MAX_MODIFIERS} modifiers.`)
  const modifier = createModifier(type, freshId(current))
  const next = updateNode(doc, nodeId, (node) => withModifiers(node, [...modifiersOf(node), modifier]))
  return { doc: next, modifierId: modifier.id }
}

function requireModifier(node: SceneNode, modifierId: string): Modifier {
  const found = modifiersOf(node).find((m) => m.id === modifierId)
  if (!found) throw new DocumentOpError('That modifier no longer exists.')
  return found
}

export function updateModifier(
  doc: BloKadeDocument, nodeId: NodeId, modifierId: string, fn: (modifier: Modifier) => Modifier,
): BloKadeDocument {
  return updateNode(doc, nodeId, (node) => {
    const before = requireModifier(node, modifierId)
    const after = fn(before)
    if (after.id !== before.id || after.type !== before.type) throw new DocumentOpError("A modifier's id and type can't change.")
    return after === before ? node : withModifiers(node, modifiersOf(node).map((m) => (m.id === modifierId ? after : m)))
  })
}

export function removeModifier(doc: BloKadeDocument, nodeId: NodeId, modifierId: string): BloKadeDocument {
  return updateNode(doc, nodeId, (node) => {
    requireModifier(node, modifierId)
    return withModifiers(node, modifiersOf(node).filter((m) => m.id !== modifierId))
  })
}

export function moveModifier(doc: BloKadeDocument, nodeId: NodeId, modifierId: string, delta: -1 | 1): BloKadeDocument {
  const list = modifiersOf(nodeOf(doc, nodeId))
  const from = list.findIndex((m) => m.id === modifierId)
  if (from === -1) throw new DocumentOpError('That modifier no longer exists.')
  const to = from + delta
  if (to < 0 || to >= list.length) return doc
  const reordered = list.map((m, i) => (i === from ? list[to] : i === to ? list[from] : m))
    .filter((m): m is Modifier => m !== undefined)
  return updateNode(doc, nodeId, (node) => withModifiers(node, reordered))
}

export const setModifierEnabled = (doc: BloKadeDocument, nodeId: NodeId, modifierId: string, enabled: boolean): BloKadeDocument =>
  updateModifier(doc, nodeId, modifierId, (m) => (m.enabled === enabled ? m : { ...m, enabled }))

export function setEdgeSelection(
  doc: BloKadeDocument, nodeId: NodeId, modifierId: string, edges: EdgeSelection,
): BloKadeDocument {
  return updateModifier(doc, nodeId, modifierId, (m) => {
    if (m.type !== 'fillet' && m.type !== 'chamfer') throw new DocumentOpError('Only Round edges and Bevel edges use edges.')
    return { ...m, edges }
  })
}

export function setPickedEdges(
  doc: BloKadeDocument, nodeId: NodeId, modifierId: string, fingerprints: readonly EdgeFingerprint[],
): BloKadeDocument {
  if (fingerprints.length > MAX_PICKED_EDGES) throw new DocumentOpError(`You can pick up to ${MAX_PICKED_EDGES} edges.`)
  return setEdgeSelection(doc, nodeId, modifierId, { by: 'picked', fingerprints })
}

const FINGERPRINT_TOLERANCE = 1e-3
const close = (a: readonly number[], b: readonly number[]): boolean =>
  a.every((v, i) => Math.abs(v - (b[i] ?? Number.NaN)) <= FINGERPRINT_TOLERANCE)

export const sameFingerprint = (a: EdgeFingerprint, b: EdgeFingerprint): boolean =>
  a.kind === b.kind && close(a.mid, b.mid) && close(a.dir, b.dir) && Math.abs(a.length - b.length) <= FINGERPRINT_TOLERANCE

/** Adds the edge if it isn't picked yet, otherwise removes it. */
export function togglePicked(list: readonly EdgeFingerprint[], fingerprint: EdgeFingerprint): EdgeFingerprint[] {
  return list.some((f) => sameFingerprint(f, fingerprint))
    ? list.filter((f) => !sameFingerprint(f, fingerprint))
    : [...list, fingerprint]
}

export function setPatternAxis(doc: BloKadeDocument, nodeId: NodeId, modifierId: string, axis: PatternAxis): BloKadeDocument {
  return updateModifier(doc, nodeId, modifierId, (m) => {
    if (m.type !== 'circularPattern') throw new DocumentOpError('Only Repeat in a circle has an axis.')
    return { ...m, axis }
  })
}

export function setMirror(
  doc: BloKadeDocument, nodeId: NodeId, modifierId: string, change: { plane?: MirrorPlane; keepOriginal?: boolean },
): BloKadeDocument {
  return updateModifier(doc, nodeId, modifierId, (m) => {
    if (m.type !== 'mirror') throw new DocumentOpError('Only Mirror has a plane.')
    return { ...m, plane: change.plane ?? m.plane, keepOriginal: change.keepOriginal ?? m.keepOriginal }
  })
}

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

/** Keeps modifier numbers in ranges the geometry engine can handle quickly. */
export function clampModifierField(field: ModifierField, value: number): number {
  switch (field) {
    case 'radius':
    case 'distance': return clamp(value, MIN_EDGE_SIZE, MAX_EDGE_SIZE)
    case 'count': return clamp(Math.round(value), 1, MAX_PATTERN_COUNT)
    case 'angle': return clamp(value, MIN_PATTERN_ANGLE, MAX_PATTERN_ANGLE)
    case 'spacing':
    case 'center': return clamp(value, -MAX_OFFSET, MAX_OFFSET)
  }
}
