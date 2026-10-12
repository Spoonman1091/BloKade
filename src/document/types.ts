export type NodeId = string
export type Vec3 = readonly [number, number, number]
export type Mode = 'solid' | 'hole'

/** Position in mm; rotation in degrees, Euler XYZ (three.js convention: matrix = Rx·Ry·Rz). */
export interface Transform {
  readonly position: Vec3
  readonly rotation: Vec3
}

interface NodeBase {
  readonly id: NodeId
  readonly name: string
  readonly mode: Mode
  readonly transform: Transform
  readonly hidden: boolean
  readonly color: string
}

export interface ShapeNode extends NodeBase {
  readonly kind: 'shape'
  readonly shapeType: string
  readonly params: Readonly<Record<string, number>>
}

export interface GroupNode extends NodeBase {
  readonly kind: 'group'
  readonly children: readonly NodeId[]
}

export type SceneNode = ShapeNode | GroupNode

export interface DocumentSettings {
  /** Grid snap in mm; 0 means snapping is off. */
  readonly gridSnap: number
}

export interface BloKadeDocument {
  readonly schemaVersion: 1
  readonly name: string
  readonly units: 'mm'
  readonly settings: DocumentSettings
  readonly root: readonly NodeId[]
  readonly nodes: Readonly<Record<NodeId, SceneNode>>
}

export const CURRENT_SCHEMA_VERSION = 1
export const DEFAULT_GRID_SNAP = 1
export const IDENTITY_TRANSFORM: Transform = { position: [0, 0, 0], rotation: [0, 0, 0] }
