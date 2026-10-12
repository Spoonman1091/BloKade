import type { Shape3D } from 'replicad'
import { modifiersOf } from '../document/modifiers'
import type { BloKadeDocument, GroupNode, Modifier, NodeId, SceneNode, ShapeNode } from '../document/types'
import type { CadToolkit } from '../plugins/cad-types'
import { resolveParams } from '../plugins/params'
import type { PluginRegistry } from '../plugins/registry'
import type { ParamValues, ShapePlugin } from '../plugins/types'
import { runKadeBuild, type KadeBuild } from '../kade/run-build'
import { findEdgeCandidates } from './edge-candidates'
import { applyModifiers, ModifierError } from './modifiers'
import { placeShape } from './transform'
import type { BuildChannel, EdgeCandidate, ModifierWarnings } from './types'

export class NodeBuildError extends Error {
  override name = 'NodeBuildError'
  constructor(message: string, readonly nodeId: NodeId) {
    super(message)
  }
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))
const stableKey = (values: Readonly<Record<string, unknown>>): string =>
  JSON.stringify(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)))
const lookup = (doc: BloKadeDocument, id: NodeId): SceneNode | undefined =>
  Object.hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined

const enabledModifiers = (node: SceneNode): readonly Modifier[] => modifiersOf(node).filter((m) => m.enabled)

/** Builds solids from the document with a per-node cache. Returned shapes are owned by the cache. */
export class Evaluator {
  private readonly cache = new Map<string, Shape3D>()
  private readonly warningCache = new Map<string, Readonly<Record<string, string>>>()
  private passWarnings = new Map<NodeId, Readonly<Record<string, string>>>()
  private channel: BuildChannel = 'design'
  /** Cache keys each channel's latest pass used. Entries no channel used are freed. */
  private readonly touchedBy = new Map<BuildChannel, Set<string>>()
  /** The edge-picking input, kept through the next pass so clicking edges doesn't rebuild it. */
  private pinned = new Set<string>()

  constructor(private registry: PluginRegistry, private readonly cad: CadToolkit) {}

  /** Swaps the shape list (for example to a design's carried shapes). Cached builds stay; Kade's are keyed by revision. */
  setRegistry(registry: PluginRegistry): void {
    this.registry = registry
  }

  beginPass(channel: BuildChannel = 'design'): void {
    this.channel = channel
    this.touchedBy.set(channel, new Set())
    this.passWarnings = new Map()
  }

  endPass(): void {
    const used = (key: string): boolean => this.pinned.has(key) || [...this.touchedBy.values()].some((keys) => keys.has(key))
    for (const [key, shape] of this.cache) {
      if (!used(key)) {
        shape.delete()
        this.cache.delete(key)
        this.warningCache.delete(key)
      }
    }
    // Edge picking happens on the design, so only a design pass lets go of its input.
    if (this.channel === 'design') this.pinned = new Set()
  }

  local(doc: BloKadeDocument, id: NodeId): Shape3D {
    const node = this.nodeOf(doc, id)
    const base = this.base(doc, node)
    const modifiers = enabledModifiers(node)
    if (modifiers.length === 0) return base
    const key = this.localKey(doc, node)
    const shape = this.entry(key, () => this.modified(base, modifiers, key, node.id))
    const found = this.warningCache.get(key)
    if (found && Object.keys(found).length > 0) this.passWarnings.set(node.id, found)
    return shape
  }

  /** Modifier notes for the parts built since beginPass(). */
  warnings(): ModifierWarnings {
    return Object.fromEntries(this.passWarnings)
  }

  edgeCandidates(doc: BloKadeDocument, id: NodeId, modifierId: string): EdgeCandidate[] {
    const node = this.nodeOf(doc, id)
    const target = modifiersOf(node).find((m) => m.id === modifierId)
    if (!target || (target.type !== 'fillet' && target.type !== 'chamfer')) {
      throw new NodeBuildError('Only Round edges and Bevel edges can pick edges.', id)
    }
    return findEdgeCandidates(this.modifierInput(doc, node, modifierId), target.edges)
  }

  /** The cached shape a modifier works on: the node's base with the enabled modifiers before it applied. */
  private modifierInput(doc: BloKadeDocument, node: SceneNode, modifierId: string): Shape3D {
    const all = modifiersOf(node)
    const before = all.slice(0, all.findIndex((m) => m.id === modifierId)).filter((m) => m.enabled)
    const base = this.base(doc, node)
    if (before.length === 0) return base
    const key = `${this.baseKey(doc, node)}|mods:${JSON.stringify(before)}`
    this.pinned = new Set([key])
    return this.entry(key, () => this.modified(base, before, key, node.id))
  }

  private base(doc: BloKadeDocument, node: SceneNode): Shape3D {
    return node.kind === 'shape' ? this.shapeLocal(node) : this.groupLocal(doc, node)
  }

  private modified(base: Shape3D, modifiers: readonly Modifier[], key: string, id: NodeId): Shape3D {
    const result = this.asBuildError(id, () => applyModifiers(base.clone(), modifiers))
    this.warningCache.set(key, result.warnings)
    return result.shape
  }

  private asBuildError<T>(id: NodeId, run: () => T): T {
    try {
      return run()
    } catch (error) {
      if (error instanceof ModifierError) throw new NodeBuildError(error.message, id)
      throw error
    }
  }

  private baseKey(doc: BloKadeDocument, node: SceneNode): string {
    return node.kind === 'shape' ? this.shapeKey(node) : this.groupKey(doc, node)
  }

  private localKey(doc: BloKadeDocument, node: SceneNode): string {
    const base = this.baseKey(doc, node)
    const modifiers = enabledModifiers(node)
    return modifiers.length > 0 ? `${base}|mods:${JSON.stringify(modifiers)}` : base
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
    this.touch(key)
    const hit = this.cache.get(key)
    if (hit) return hit
    const shape = make()
    this.cache.set(key, shape)
    return shape
  }

  private touch(key: string): void {
    const keys = this.touchedBy.get(this.channel) ?? new Set<string>()
    this.touchedBy.set(this.channel, keys)
    keys.add(key)
  }

  private shapeKey(node: ShapeNode): string {
    const plugin = this.registry.get(node.shapeType)
    const params = plugin ? resolveParams(plugin, node.params) : node.params
    return `shape:${node.shapeType}@${plugin?.revision ?? plugin?.version ?? 0}:${stableKey(params)}`
  }

  private groupKey(doc: BloKadeDocument, group: GroupNode): string {
    const parts = this.members(doc, group).map((m) => `${m.mode}:${this.placedKey(doc, m)}`)
    return `group:[${parts.join(',')}]`
  }

  private placedKey(doc: BloKadeDocument, node: SceneNode): string {
    return `${this.localKey(doc, node)}@${node.transform.position.join(',')}/${node.transform.rotation.join(',')}`
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
        return this.buildShape(plugin, params)
      } catch (error) {
        throw new NodeBuildError(`${plugin.name} couldn't be built: ${messageOf(error)}`, node.id)
      }
    })
  }

  private buildShape(plugin: ShapePlugin, params: ParamValues): Shape3D {
    if (plugin.toolkit !== 'kade') return plugin.build(params, this.cad)
    // Kade's builds take the friendly toolkit, not the internal one their type names.
    return runKadeBuild(plugin.build as unknown as KadeBuild, params, plugin.source ?? null, this.cad)
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
