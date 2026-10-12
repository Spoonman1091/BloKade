import { Vector3 } from 'three'
import type { Box } from '../document/box'
import { keepUnchanged, transformToMatrix } from '../document/transform-math'
import type { BloKadeDocument, NodeId, SceneNode, ShapeNode, Vec3 } from '../document/types'
import type { ShapePlugin } from '../plugins/types'
import type { ToolMode } from '../store/store'
import { dragToScale, type SizeDragResult, type SizeHandle } from './face-handles'
import { movedSince } from './handle-drag'
import { formatMm } from './measure'
import { paramsFromScale } from './sizing'

export interface SizeDragStart {
  readonly node: ShapeNode
  readonly plugin: ShapePlugin
  /** The part's box in its own frame when the drag started. */
  readonly box: Box
  readonly handle: SizeHandle
  /** Where the pointer was on the handle's track (see trackPoint). */
  readonly from: Vec3
}

export interface SizeDragModifiers {
  /** Grid step to snap sizes to; 0 means no snapping (Shift held, or snapping off). */
  readonly snap: number
  /** Alt held: a corner keeps the shape's proportions. */
  readonly keepProportions: boolean
}

export interface SizeDragFrame {
  /** Factor per axis to show the part at while dragging, about its own origin. */
  readonly scale: Vec3
  /** Where the part sits so the far side stays put. */
  readonly position: Vec3
  /** The live size text. */
  readonly text: string
}

export const COPIES_HINT = 'This part has copies or a mirror image. Type its sizes in Properties instead.'

/** Modifiers that change a part's outline, so handles on its box would be in the wrong place. */
const OUTLINE_CHANGERS: ReadonlySet<string> = new Set(['linearPattern', 'circularPattern', 'mirror'])

const round6 = (v: number): number => {
  const r = Math.round(v * 1e6) / 1e6
  return Object.is(r, -0) ? 0 : r
}

/** Size handles follow the part's box, which copies and mirror images change. */
export const resizesByHandle = (node: SceneNode): boolean =>
  node.kind === 'shape' && !(node.modifiers ?? []).some((m) => m.enabled && OUTLINE_CHANGERS.has(m.type))

/** The hint shown in the 3D view when the Size tool can't put handles on the selected part. */
export function sizeHintFor(doc: BloKadeDocument, selection: readonly NodeId[], tool: ToolMode): string | null {
  const [id] = selection
  if (tool !== 'size' || selection.length !== 1 || id === undefined || !doc.root.includes(id)) return null
  const node = Object.hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined
  return node && node.kind === 'shape' && !resizesByHandle(node) ? COPIES_HINT : null
}

/** How far the part moves, in its own frame, so the side opposite the handle stays where it was. */
export function anchorShift(box: Box, handle: SizeHandle, scale: Vec3): Vec3 {
  // `+ 0` turns -0 (from 0 × a negative number) into 0.
  const shift = (axis: 0 | 1 | 2): number => anchorOn(box, handle, scale, axis) + 0
  return [shift(0), shift(1), shift(2)]
}

/** The face or corner that must stay still on one axis decides the shift; a linked axis grows about the origin. */
function anchorOn(box: Box, handle: SizeHandle, scale: Vec3, axis: 0 | 1 | 2): number {
  const s = scale[axis]
  const d = handle.dir[axis]
  if (s === 1) return 0
  if (d > 0) return box.min[axis] * (1 - s)
  if (d < 0) return box.max[axis] * (1 - s)
  return axis === 2 && handle.kind === 'corner' ? box.min[2] * (1 - s) : 0
}

function rotate(v: Vec3, rotation: Vec3): Vec3 {
  const p = new Vector3(...v).applyMatrix4(transformToMatrix({ position: [0, 0, 0], rotation }))
  return [p.x, p.y, p.z]
}

/** "Width 30 mm", "Width 30 mm × Depth 25 mm", or "Biggest size: 2000 mm". */
export function sizeText(result: SizeDragResult): string {
  if (result.biggest !== null) return `Biggest size: ${formatMm(result.biggest)} mm`
  return result.changes.map((c) => `${c.label} ${formatMm(c.value)} mm`).join(' × ')
}

/** The live preview for the pointer at `to` on the handle's track. */
export function sizeDragFrame(start: SizeDragStart, to: Vec3, mods: SizeDragModifiers): SizeDragFrame {
  const { node, plugin, box, handle } = start
  const result = dragToScale({
    plugin, params: node.params, box, handle, moved: movedSince(start.from, to),
    snap: mods.snap, keepProportions: mods.keepProportions,
  })
  const shift = rotate(anchorShift(box, handle, result.scale), node.transform.rotation)
  const [x, y, z] = node.transform.position
  return { scale: result.scale, position: [x + shift[0], y + shift[1], z + shift[2]], text: sizeText(result) }
}

/** The part after the drag, or null when the drag changed nothing. */
export function finishSizeDrag(start: SizeDragStart, frame: SizeDragFrame): ShapeNode | null {
  if (frame.scale.every((s) => s === 1)) return null
  const { node, plugin } = start
  const position: Vec3 = [round6(frame.position[0]), round6(frame.position[1]), round6(frame.position[2])]
  return {
    ...node,
    params: paramsFromScale(plugin, node.params, frame.scale),
    transform: { position: keepUnchanged(node.transform.position, position), rotation: node.transform.rotation },
  }
}
