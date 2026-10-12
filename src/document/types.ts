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
 * A field that can hold a formula: `param.<name>`, `position.<0|1|2>`, `rotation.<0|1|2>`, or a modifier
 * number `mod.<modifierId>.<field>` (vector fields end in `.0`/`.1`/`.2`).
 * The field itself always keeps a plain number: the last value its formula worked out.
 */
export type FieldKey = `param.${string}` | `position.${0 | 1 | 2}` | `rotation.${0 | 1 | 2}` | `mod.${string}`

interface NodeBase {
  readonly id: NodeId
  readonly name: string
  readonly mode: Mode
  readonly transform: Transform
  readonly hidden: boolean
  readonly color: string
  /** Formula text for fields that use one, keyed by FieldKey. Missing when no field has a formula. */
  readonly formulas?: Readonly<Record<string, string>>
  /** Changes applied after the part is built, in order (round edges, repeat, mirror…). Missing means none. */
  readonly modifiers?: readonly Modifier[]
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

export type ModifierType = 'fillet' | 'chamfer' | 'linearPattern' | 'circularPattern' | 'mirror'
export type EdgeWhich = 'all' | 'top' | 'bottom' | 'vertical' | 'horizontal'
export type EdgeKind = 'line' | 'circle' | 'other'
export type PatternAxis = 'x' | 'y' | 'z'
export type MirrorPlane = 'XY' | 'XZ' | 'YZ'
/** Number fields a modifier can have; `spacing` and `center` are vectors (axis 0/1/2). */
export type ModifierField = 'radius' | 'distance' | 'count' | 'angle' | 'spacing' | 'center'

/** Where an edge sat on its part, relative to the part's bounding box, so it can be found again after resizing. */
export interface EdgeFingerprint {
  readonly kind: EdgeKind
  /** Edge midpoint as fractions (0–1) of the bounding box on each axis. */
  readonly mid: Vec3
  /** Unit direction at the midpoint; the first non-zero component is positive. */
  readonly dir: Vec3
  /** Length as a fraction of the bounding-box diagonal. */
  readonly length: number
}

export type EdgeSelection =
  | { readonly by: 'description'; readonly which: EdgeWhich }
  | { readonly by: 'picked'; readonly fingerprints: readonly EdgeFingerprint[] }

interface ModifierBase {
  /** 8 hex characters, unique within its part. */
  readonly id: string
  readonly enabled: boolean
}

export interface FilletModifier extends ModifierBase {
  readonly type: 'fillet'
  readonly radius: number
  readonly edges: EdgeSelection
}

export interface ChamferModifier extends ModifierBase {
  readonly type: 'chamfer'
  readonly distance: number
  readonly edges: EdgeSelection
}

export interface LinearPatternModifier extends ModifierBase {
  readonly type: 'linearPattern'
  readonly count: number
  readonly spacing: Vec3
}

export interface CircularPatternModifier extends ModifierBase {
  readonly type: 'circularPattern'
  readonly count: number
  readonly axis: PatternAxis
  /** Total angle the copies spread over; 360 means all the way round. */
  readonly angle: number
  /** A point on the rotation axis, in the part's own frame. */
  readonly center: Vec3
}

export interface MirrorModifier extends ModifierBase {
  readonly type: 'mirror'
  readonly plane: MirrorPlane
  readonly keepOriginal: boolean
}

export type Modifier =
  | FilletModifier
  | ChamferModifier
  | LinearPatternModifier
  | CircularPatternModifier
  | MirrorModifier

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
  readonly schemaVersion: 3
  readonly name: string
  readonly units: 'mm'
  readonly settings: DocumentSettings
  readonly variables: readonly Variable[]
  readonly root: readonly NodeId[]
  readonly nodes: Readonly<Record<NodeId, SceneNode>>
}

export const CURRENT_SCHEMA_VERSION = 3
export const DEFAULT_GRID_SNAP = 1
export const DEFAULT_FIT = 0.2
export const MAX_FIT = 2
export const MAX_VARIABLES = 200
/** Longest text a text parameter may hold, in characters. */
export const MAX_TEXT_PARAM_LENGTH = 40
export const MAX_MODIFIERS = 10
export const MAX_PATTERN_COUNT = 50
/** Most copies one part's modifiers may make in total: pattern counts multiplied, ×2 for a kept-original mirror. */
export const MAX_COPIES = 200
export const MAX_PICKED_EDGES = 100
export const MIN_EDGE_SIZE = 0.05
export const MAX_EDGE_SIZE = 500
export const MAX_OFFSET = 2000
export const MIN_PATTERN_ANGLE = 1
export const MAX_PATTERN_ANGLE = 360
export const IDENTITY_TRANSFORM: Transform = { position: [0, 0, 0], rotation: [0, 0, 0] }
