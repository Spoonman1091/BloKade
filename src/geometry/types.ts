import type { BloKadeDocument, NodeId } from '../document/types'

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

/** One entry per top-level node; meshes are in the node's local frame (before its own transform). */
export interface BuildResult {
  readonly nodes: Readonly<Record<NodeId, NodeBuild>>
}

export interface GeometryApi {
  rebuild(doc: BloKadeDocument): Promise<BuildResult>
  exportStl(doc: BloKadeDocument, ids?: readonly NodeId[]): Promise<ArrayBuffer>
  export3mf(doc: BloKadeDocument, ids?: readonly NodeId[]): Promise<ArrayBuffer>
}
