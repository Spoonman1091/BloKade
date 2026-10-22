import {
  CURRENT_SCHEMA_VERSION, DEFAULT_FIT, DEFAULT_GRID_SNAP, IDENTITY_TRANSFORM,
  type BloKadeDocument, type GroupNode, type Mode, type NodeId, type ParamValue, type ShapeNode, type Vec3,
} from './types'

export const SHAPE_COLORS: readonly string[] = ['#ff6b6b', '#4f9dff', '#ffd93d', '#6bcb77', '#c77dff', '#ff9f43']
export const HOLE_COLOR = '#9aa5b1'

/** Random id. Uses getRandomValues because randomUUID is unavailable over plain HTTP. */
export function newId(): NodeId {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function pickColor(index: number): string {
  return SHAPE_COLORS[index % SHAPE_COLORS.length] ?? '#4f9dff'
}

export function createEmptyDocument(name = 'Untitled design'): BloKadeDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name,
    units: 'mm',
    settings: { gridSnap: DEFAULT_GRID_SNAP, fit: DEFAULT_FIT },
    variables: [],
    root: [],
    nodes: {},
    plugins: {},
    models: {},
  }
}

export function createShapeNode(input: {
  shapeType: string
  name: string
  params: Readonly<Record<string, ParamValue>>
  color: string
  id?: NodeId
  position?: Vec3
  rotation?: Vec3
  mode?: Mode
}): ShapeNode {
  return {
    id: input.id ?? newId(),
    kind: 'shape',
    name: input.name,
    shapeType: input.shapeType,
    params: input.params,
    mode: input.mode ?? 'solid',
    hidden: false,
    color: input.color,
    transform: { position: input.position ?? IDENTITY_TRANSFORM.position, rotation: input.rotation ?? IDENTITY_TRANSFORM.rotation },
  }
}

export function createGroupNode(input: {
  children: readonly NodeId[]
  name?: string
  color?: string
  id?: NodeId
}): GroupNode {
  return {
    id: input.id ?? newId(),
    kind: 'group',
    name: input.name ?? 'Group',
    children: input.children,
    mode: 'solid',
    hidden: false,
    color: input.color ?? pickColor(0),
    transform: IDENTITY_TRANSFORM,
  }
}
