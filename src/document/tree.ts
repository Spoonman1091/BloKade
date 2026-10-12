import type { BloKadeDocument, NodeId } from './types'

export function parentOf(doc: BloKadeDocument, id: NodeId): NodeId | null | undefined {
  if (doc.root.includes(id)) return null
  for (const node of Object.values(doc.nodes)) {
    if (node.kind === 'group' && node.children.includes(id)) return node.id
  }
  return undefined
}

export function siblingsOf(doc: BloKadeDocument, parentId: NodeId | null): readonly NodeId[] {
  if (parentId === null) return doc.root
  const parent = doc.nodes[parentId]
  return parent?.kind === 'group' ? parent.children : []
}

export function descendantsOf(doc: BloKadeDocument, id: NodeId): NodeId[] {
  const node = doc.nodes[id]
  if (node?.kind !== 'group') return []
  return node.children.flatMap((child) => [child, ...descendantsOf(doc, child)])
}

export function isDescendant(doc: BloKadeDocument, ancestorId: NodeId, id: NodeId): boolean {
  return descendantsOf(doc, ancestorId).includes(id)
}

export function rootAncestorOf(doc: BloKadeDocument, id: NodeId): NodeId | undefined {
  const parent = parentOf(doc, id)
  if (parent === undefined) return undefined
  return parent === null ? id : rootAncestorOf(doc, parent)
}
