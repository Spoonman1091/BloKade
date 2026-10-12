import { Matrix4 } from 'three'
import { createGroupNode, newId } from './factory'
import { matrixToTransform, transformToMatrix, worldMatrix } from './transform-math'
import { descendantsOf, isDescendant, parentOf, siblingsOf } from './tree'
import type { BloKadeDocument, Mode, NodeId, SceneNode, Vec3 } from './types'

export class DocumentOpError extends Error {
  override name = 'DocumentOpError'
}

export const DUPLICATE_OFFSET: Vec3 = [5, 5, 0]

function hasNode(doc: BloKadeDocument, id: NodeId): boolean {
  return Object.hasOwn(doc.nodes, id)
}

function requireNode(doc: BloKadeDocument, id: NodeId): SceneNode {
  if (!hasNode(doc, id)) throw new DocumentOpError('That part no longer exists.')
  return doc.nodes[id] as SceneNode
}

function withChildren(doc: BloKadeDocument, parentId: NodeId | null, children: readonly NodeId[]): BloKadeDocument {
  if (parentId === null) return { ...doc, root: children }
  const parent = requireNode(doc, parentId)
  if (parent.kind !== 'group') throw new DocumentOpError('Only groups can hold other parts.')
  return { ...doc, nodes: { ...doc.nodes, [parentId]: { ...parent, children } } }
}

export function addNode(doc: BloKadeDocument, node: SceneNode, parentId: NodeId | null = null): BloKadeDocument {
  if (hasNode(doc, node.id)) throw new DocumentOpError(`A part with id ${node.id} already exists.`)
  const withNode = { ...doc, nodes: { ...doc.nodes, [node.id]: node } }
  return withChildren(withNode, parentId, [...siblingsOf(doc, parentId), node.id])
}

export function updateNode(
  doc: BloKadeDocument, id: NodeId, fn: (node: SceneNode) => SceneNode,
): BloKadeDocument {
  const node = requireNode(doc, id)
  const next = fn(node)
  if (next.id !== id || next.kind !== node.kind) throw new DocumentOpError("A part's id and kind can't change.")
  return { ...doc, nodes: { ...doc.nodes, [id]: next } }
}

function stripChild(node: SceneNode, doomed: ReadonlySet<NodeId>): SceneNode {
  if (node.kind !== 'group') return node
  return { ...node, children: node.children.filter((c) => !doomed.has(c)) }
}

export function removeNodes(doc: BloKadeDocument, ids: readonly NodeId[]): BloKadeDocument {
  const doomed = new Set(ids.flatMap((id) => (hasNode(doc, id) ? [id, ...descendantsOf(doc, id)] : [])))
  const nodes = Object.fromEntries(
    Object.entries(doc.nodes)
      .filter(([id]) => !doomed.has(id))
      .map(([id, node]) => [id, stripChild(node, doomed)] as const),
  )
  return { ...doc, root: doc.root.filter((id) => !doomed.has(id)), nodes }
}

function requireGroupParent(doc: BloKadeDocument, parentId: NodeId | null): void {
  if (parentId === null) return
  if (requireNode(doc, parentId).kind !== 'group') throw new DocumentOpError('Only groups can hold other parts.')
}

export function moveNode(doc: BloKadeDocument, id: NodeId, newParentId: NodeId | null): BloKadeDocument {
  requireNode(doc, id)
  requireGroupParent(doc, newParentId)
  if (newParentId === id || (newParentId !== null && isDescendant(doc, id, newParentId))) {
    throw new DocumentOpError("A group can't go inside itself.")
  }
  const oldParentId = parentOf(doc, id) ?? null
  if (oldParentId === newParentId) return doc
  const world = worldMatrix(doc, id)
  const detached = withChildren(doc, oldParentId, siblingsOf(doc, oldParentId).filter((c) => c !== id))
  const parentWorld = newParentId === null ? new Matrix4() : worldMatrix(detached, newParentId)
  const local = new Matrix4().multiplyMatrices(parentWorld.clone().invert(), world)
  const moved = updateNode(detached, id, (n) => ({ ...n, transform: matrixToTransform(local) }))
  return withChildren(moved, newParentId, [...siblingsOf(moved, newParentId), id])
}

export function groupNodes(
  doc: BloKadeDocument, ids: readonly NodeId[], groupId: NodeId = newId(),
): { doc: BloKadeDocument; groupId: NodeId } {
  if (hasNode(doc, groupId)) throw new DocumentOpError(`A part with id ${groupId} already exists.`)
  const unique = [...new Set(ids)]
  if (unique.length < 2) throw new DocumentOpError('Pick at least two parts to group.')
  const parents = new Set(unique.map((id) => {
    requireNode(doc, id)
    return parentOf(doc, id) ?? null
  }))
  if (parents.size !== 1) throw new DocumentOpError('Parts must be at the same level to group them.')
  const parentId = [...parents][0] ?? null
  const siblings = siblingsOf(doc, parentId)
  const chosen = siblings.filter((id) => unique.includes(id))
  const insertAt = siblings.findIndex((id) => unique.includes(id))
  const remaining = siblings.filter((id) => !unique.includes(id))
  const first = requireNode(doc, chosen[0] ?? '')
  const group = createGroupNode({ id: groupId, children: chosen, color: first.color })
  const withGroup = { ...doc, nodes: { ...doc.nodes, [groupId]: group } }
  const newSiblings = [...remaining.slice(0, insertAt), groupId, ...remaining.slice(insertAt)]
  return { doc: withChildren(withGroup, parentId, newSiblings), groupId }
}

export function ungroupNode(
  doc: BloKadeDocument, id: NodeId,
): { doc: BloKadeDocument; childIds: readonly NodeId[] } {
  const group = requireNode(doc, id)
  if (group.kind !== 'group') throw new DocumentOpError("That's not a group.")
  const parentId = parentOf(doc, id) ?? null
  const groupMatrix = transformToMatrix(group.transform)
  const lifted = Object.fromEntries(
    group.children.map((cid) => {
      const child = requireNode(doc, cid)
      const m = new Matrix4().multiplyMatrices(groupMatrix, transformToMatrix(child.transform))
      return [cid, { ...child, transform: matrixToTransform(m) }] as const
    }),
  )
  const others = Object.fromEntries(Object.entries(doc.nodes).filter(([key]) => key !== id))
  const siblings = siblingsOf(doc, parentId)
  const at = siblings.indexOf(id)
  const newSiblings = [...siblings.slice(0, at), ...group.children, ...siblings.slice(at + 1)]
  const nodes = { ...others, ...lifted }
  return { doc: withChildren({ ...doc, nodes }, parentId, newSiblings), childIds: group.children }
}

function copySubtree(doc: BloKadeDocument, id: NodeId): { topId: NodeId; nodes: SceneNode[] } {
  const ids = [id, ...descendantsOf(doc, id)]
  const fresh = new Map(ids.map((old) => [old, newId()]))
  const rename = (old: NodeId): NodeId => fresh.get(old) ?? old
  const nodes = ids.map((old): SceneNode => {
    const n = requireNode(doc, old)
    return n.kind === 'group' ? { ...n, id: rename(old), children: n.children.map(rename) } : { ...n, id: rename(old) }
  })
  return { topId: rename(id), nodes }
}

const addVec = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]

/** Ids the user selected that are not already inside another selected group. */
function topmostSelected(doc: BloKadeDocument, ids: readonly NodeId[]): NodeId[] {
  return ids.filter((id) => {
    requireNode(doc, id)
    return !ids.some((other) => other !== id && isDescendant(doc, other, id))
  })
}

export function duplicateNodes(
  doc: BloKadeDocument, ids: readonly NodeId[],
): { doc: BloKadeDocument; newIds: readonly NodeId[] } {
  return topmostSelected(doc, ids).reduce(
    (acc, id) => {
      const { topId, nodes } = copySubtree(acc.doc, id)
      const parentId = parentOf(acc.doc, id) ?? null
      const offsetNodes = nodes.map((n): SceneNode => (n.id === topId
        ? { ...n, transform: { ...n.transform, position: addVec(n.transform.position, DUPLICATE_OFFSET) } }
        : n))
      const copied = Object.fromEntries(offsetNodes.map((n) => [n.id, n] as const))
      const withNodes = { ...acc.doc, nodes: { ...acc.doc.nodes, ...copied } }
      const siblings = siblingsOf(acc.doc, parentId)
      const at = siblings.indexOf(id) + 1
      const nextDoc = withChildren(withNodes, parentId, [...siblings.slice(0, at), topId, ...siblings.slice(at)])
      return { doc: nextDoc, newIds: [...acc.newIds, topId] }
    },
    { doc, newIds: [] as readonly NodeId[] },
  )
}

export function setMode(doc: BloKadeDocument, ids: readonly NodeId[], mode: Mode): BloKadeDocument {
  return ids.reduce((d, id) => updateNode(d, id, (n) => ({ ...n, mode })), doc)
}

export function setHidden(doc: BloKadeDocument, ids: readonly NodeId[], hidden: boolean): BloKadeDocument {
  return ids.reduce((d, id) => updateNode(d, id, (n) => ({ ...n, hidden })), doc)
}

export function renameNode(doc: BloKadeDocument, id: NodeId, name: string): BloKadeDocument {
  const trimmed = name.trim()
  if (!trimmed) throw new DocumentOpError("Names can't be empty.")
  return updateNode(doc, id, (n) => ({ ...n, name: trimmed }))
}

export function renameDocument(doc: BloKadeDocument, name: string): BloKadeDocument {
  const trimmed = name.trim()
  if (!trimmed) throw new DocumentOpError("Names can't be empty.")
  return { ...doc, name: trimmed }
}

export function setGridSnap(doc: BloKadeDocument, gridSnap: number): BloKadeDocument {
  if (!Number.isFinite(gridSnap) || gridSnap < 0) throw new DocumentOpError('Grid snap must be zero or more.')
  return { ...doc, settings: { ...doc.settings, gridSnap } }
}
