export type NodeId = string
export type Vec3 = readonly [number, number, number]
export type Mode = 'solid' | 'hole'
/** A shape parameter: a number, or a line of text for the Text shape. */
export type ParamValue = number | string

/** Position in mm; rotation in degrees, Euler XYZ (three.js convention: matrix = Rx·Ry·Rz). */
export interface Transform {
  readonly position: Vec3
  readonly rotation: Vec3
}

/**
 * A field that can hold a formula: `param.<name>`, `position.<0|1|2>` or `rotation.<0|1|2>`.
 * The field itself always keeps a plain number: the last value its formula worked out.
 */
export type FieldKey = `param.${string}` | `position.${0 | 1 | 2}` | `rotation.${0 | 1 | 2}`

interface NodeBase {
  readonly id: NodeId
  readonly name: string
  readonly mode: Mode
  readonly transform: Transform
  readonly hidden: boolean
  readonly color: string
  /** Formula text for fields that use one, keyed by FieldKey. Missing when no field has a formula. */
  readonly formulas?: Readonly<Record<string, string>>
}

export interface ShapeNode extends NodeBase {
  readonly kind: 'shape'
  readonly shapeType: string
  readonly params: Readonly<Record<string, ParamValue>>
}

export interface GroupNode extends NodeBase {
  readonly kind: 'group'
  readonly children: readonly NodeId[]
}

export type SceneNode = ShapeNode | GroupNode

/** A named number for formulas. `expr` is a number or a formula, such as "wall * 2". */
export interface Variable {
  readonly name: string
  readonly expr: string
}

export interface DocumentSettings {
  /** Grid snap in mm; 0 means snapping is off. */
  readonly gridSnap: number
  /** Extra gap in mm for parts that slot together; formulas read it as `fit`. */
  readonly fit: number
}

export interface BloKadeDocument {
  readonly schemaVersion: 2
  readonly name: string
  readonly units: 'mm'
  readonly settings: DocumentSettings
  readonly variables: readonly Variable[]
  readonly root: readonly NodeId[]
  readonly nodes: Readonly<Record<NodeId, SceneNode>>
}

export const CURRENT_SCHEMA_VERSION = 2
export const DEFAULT_GRID_SNAP = 1
export const DEFAULT_FIT = 0.2
export const MAX_FIT = 2
/** Longest text a text parameter may hold, in characters. */
export const MAX_TEXT_PARAM_LENGTH = 40
export const IDENTITY_TRANSFORM: Transform = { position: [0, 0, 0], rotation: [0, 0, 0] }
