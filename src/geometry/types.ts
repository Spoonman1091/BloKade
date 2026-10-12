import type { BloKadeDocument, EdgeFingerprint, NodeId } from '../document/types'
import type { InspectResult } from '../kade/meta'

export interface MeshData {
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly indices: Uint32Array
  /** Line-segment endpoints (x,y,z pairs) for drawing edges. */
  readonly edges: Float32Array
}

export type NodeBuild =
  | { readonly status: 'ok'; readonly mesh: MeshData }
  | { readonly status: 'error'; readonly message: string }

/** Non-fatal modifier notes by part and modifier id (for example "Lost track of 2 edges"). */
export type ModifierWarnings = Readonly<Record<NodeId, Readonly<Record<string, string>>>>

/** One edge Kade can click while picking edges: where it is and whether it's chosen now. */
export interface EdgeCandidate {
  readonly fingerprint: EdgeFingerprint
  /** Flat x,y,z points along the edge, in the part's own frame. */
  readonly points: readonly number[]
  readonly picked: boolean
}

/** One entry per top-level node; meshes are in the node's local frame (before its own transform). */
export interface BuildResult {
  readonly nodes: Readonly<Record<NodeId, NodeBuild>>
  readonly warnings?: ModifierWarnings
}

/** Where two parts take up the same space: its volume (mm³) and shape, in world coordinates. */
export type OverlapResult =
  | { readonly status: 'none' }
  | { readonly status: 'overlap'; readonly volume: number; readonly mesh: MeshData }

/** Which screen a rebuild is for. Each keeps its own cache entries, so the preview and the design don't push each other out. */
export type BuildChannel = 'design' | 'preview'

export interface GeometryApi {
  rebuild(doc: BloKadeDocument, channel?: BuildChannel): Promise<BuildResult>
  exportStl(doc: BloKadeDocument, ids?: readonly NodeId[]): Promise<ArrayBuffer>
  export3mf(doc: BloKadeDocument, ids?: readonly NodeId[]): Promise<ArrayBuffer>
  exportStep(doc: BloKadeDocument, ids?: readonly NodeId[]): Promise<ArrayBuffer>
  edgeCandidates(doc: BloKadeDocument, nodeId: NodeId, modifierId: string): Promise<EdgeCandidate[]>
  overlap(doc: BloKadeDocument, a: NodeId, b: NodeId): Promise<OverlapResult>
  /** Loads and checks one of Kade's shapes: its name, icon and settings, or a friendly problem. */
  inspect(code: string): Promise<InspectResult>
  /** Kade's code (by code hash) that got an earlier worker stuck: never load or build it; it fails with TOO_LONG. */
  skipShapes(hashes: readonly string[]): Promise<void>
}
