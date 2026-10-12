import type { Shape3D } from 'replicad'
import type { BloKadeDocument, GroupNode, NodeId, SceneNode, ShapeNode } from '../document/types'
import type { CadToolkit } from '../plugins/cad-types'
import { resolveParams } from '../plugins/params'
import type { PluginRegistry } from '../plugins/registry'
import { placeShape } from './transform'

export class NodeBuildError extends Error {
  override name = 'NodeBuildError'
  constructor(message: string, readonly nodeId: NodeId) {
    super(message)
  }
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))
const stableKey = (values: Readonly<Record<string, number>>): string =>
  JSON.stringify(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)))
const lookup = (doc: BloKadeDocument, id: NodeId): SceneNode | undefined =>
  Object.hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined

/** Builds solids from the document with a per-node cache. Returned shapes are owned by the cache. */
export class Evaluator {
  private readonly cache = new Map<string, Shape3D>()
  private touched = new Set<string>()

  constructor(private readonly registry: PluginRegistry, private readonly cad: CadToolkit) {}

  beginPass(): void {
    this.touched = new Set()
  }

  endPass(): void {
    for (const [key, shape] of this.cache) {
      if (!this.touched.has(key)) {
        shape.delete()
        this.cache.delete(key)
      }
    }
  }

  local(doc: BloKadeDocument, id: NodeId): Shape3D {
    const node = this.nodeOf(doc, id)
    return node.kind === 'shape' ? this.shapeLocal(node) : this.groupLocal(doc, node)
  }

  placed(doc: BloKadeDocument, id: NodeId): Shape3D {
    const node = this.nodeOf(doc, id)
    const local = this.local(doc, id)
    return this.entry(this.placedKey(doc, node), () => placeShape(local.clone(), node.transform))
  }

  private nodeOf(doc: BloKadeDocument, id: NodeId): SceneNode {
    const node = lookup(doc, id)
    if (!node) throw new NodeBuildError('This part is missing from the design.', id)
    return node
  }

  private entry(key: string, make: () => Shape3D): Shape3D {
    this.touched.add(key)
    const hit = this.cache.get(key)
    if (hit) return hit
    const shape = make()
    this.cache.set(key, shape)
    return shape
  }

  private shapeKey(node: ShapeNode): string {
    const plugin = this.registry.get(node.shapeType)
    const params = plugin ? resolveParams(plugin, node.params) : node.params
    return `shape:${node.shapeType}@${plugin?.version ?? 0}:${stableKey(params)}`
  }

  private groupKey(doc: BloKadeDocument, group: GroupNode): string {
    const parts = this.members(doc, group).map((m) => `${m.mode}:${this.placedKey(doc, m)}`)
    return `group:[${parts.join(',')}]`
  }

  private placedKey(doc: BloKadeDocument, node: SceneNode): string {
    const local = node.kind === 'shape' ? this.shapeKey(node) : this.groupKey(doc, node)
    return `${local}@${node.transform.position.join(',')}/${node.transform.rotation.join(',')}`
  }

  private members(doc: BloKadeDocument, group: GroupNode): SceneNode[] {
    return group.children.flatMap((id) => {
      const child = lookup(doc, id)
      return child && !child.hidden ? [child] : []
    })
  }

  private shapeLocal(node: ShapeNode): Shape3D {
    const plugin = this.registry.get(node.shapeType)
    if (!plugin) {
      throw new NodeBuildError(`BloKade doesn't know the shape "${node.shapeType}". Is its plugin missing?`, node.id)
    }
    const params = resolveParams(plugin, node.params)
    return this.entry(this.shapeKey(node), () => {
      try {
        return plugin.build(params, this.cad)
      } catch (error) {
        throw new NodeBuildError(`${plugin.name} couldn't be built: ${messageOf(error)}`, node.id)
      }
    })
  }

  private groupLocal(doc: BloKadeDocument, group: GroupNode): Shape3D {
    const members = this.members(doc, group)
    const solids = members.filter((m) => m.mode === 'solid')
    const holes = members.filter((m) => m.mode === 'hole')
    if (solids.length === 0) {
      throw new NodeBuildError(
        "This group has no solid parts, so there's nothing to keep. Add a solid or switch a part from Hole to Solid.",
        group.id,
      )
    }
    // Touch every member (cheap cache hits) so their entries survive endPass even when the group itself is a hit.
    const placed = (m: SceneNode) => this.placedMember(doc, group, m)
    const solidShapes = solids.map(placed)
    const holeShapes = holes.map(placed)
    return this.entry(this.groupKey(doc, group), () => {
      const [first, ...rest] = solidShapes
      let acc = (first as Shape3D).clone()
      try {
        for (const s of rest) acc = swap(acc, acc.fuse(s))
        for (const h of holeShapes) acc = swap(acc, acc.cut(h))
        if (acc.faces.length === 0) {
          throw new NodeBuildError('The holes cut away everything in this group.', group.id)
        }
      } catch (error) {
        acc.delete()
        throw error
      }
      return acc
    })
  }

  private placedMember(doc: BloKadeDocument, group: GroupNode, member: SceneNode): Shape3D {
    try {
      return this.placed(doc, member.id)
    } catch (error) {
      throw new NodeBuildError(`"${member.name}" inside this group has a problem: ${messageOf(error)}`, group.id)
    }
  }
}

/** Frees the previous intermediate shape and returns the next one. */
function swap(previous: Shape3D, next: Shape3D): Shape3D {
  previous.delete()
  return next
}
