import type { CrossSection, Manifold, ManifoldToplevel } from 'manifold-3d'
import { BASE_STEP, DIGIT_HEIGHT, ENGRAVE_DEPTH, TAB_LENGTH, THIN_TONGUE_MESSAGE, TONGUE_MIN_BASE, TONGUE_OUT } from './constants'
import { raisedOutline } from './cut-plan'
import { digitOutline } from './digits'
import { fitsPlate } from './grid'
import { prism, segmentEdits, type Edit, type JointContext } from './joint-solids'
import { layoutGrid, segmentsOf, type Bounds, type Cell } from './layout'
import type { OpenModel } from './model'
import { SplitProblem } from './problem'
import type { Cut, GridPlan, PieceMesh, PiecesResult, Plate, SplitSettings } from './types'

/** Extra room a joint needs either side of its centre line, past its own length, mm. */
const JOINT_CLEAR = 2
/** How far below the bottom the number's cutter starts, so it opens cleanly, mm. */
const ENGRAVE_CLEAR = 1

interface Joints { readonly edits: readonly Edit[]; readonly joined: ReadonlySet<number> }

/** Swaps `current` for `next`, freeing `current` when it was replaced. */
function replace(current: Manifold, next: Manifold): Manifold {
  if (next !== current) current.delete()
  return next
}

function jointsFor(wasm: ManifoldToplevel, model: OpenModel, cuts: readonly Cut[], bounds: Bounds, settings: SplitSettings): Joints {
  const { joint, baseThickness } = settings
  if (joint === 'none' || baseThickness === null || cuts.length === 0) return { edits: [], joined: new Set() }
  const reach = (joint === 'tabs' ? TAB_LENGTH : TONGUE_OUT) + JOINT_CLEAR
  const base: CrossSection = model.solid.slice(BASE_STEP)
  const raised = raisedOutline(model.solid, baseThickness)
  const edits: Edit[] = []
  const joined = new Set<number>()
  try {
    const ctx: JointContext = { wasm, solid: model.solid, base, raised, baseThickness, fitGap: settings.fitGap, reach }
    for (const segment of segmentsOf(layoutGrid(cuts, bounds), cuts, reach)) {
      const made = segmentEdits(ctx, segment, joint)
      edits.push(...made)
      if (made.length > 0) joined.add(segment.cutIndex)
    }
    return { edits, joined }
  } catch (error) {
    edits.forEach((e) => e.solid.delete())
    throw error
  } finally {
    base.delete()
    raised.delete()
  }
}

function cellBox(wasm: ManifoldToplevel, cell: Cell, bounds: Bounds): Manifold {
  const z0 = (bounds.min[2] ?? 0) - 1
  const z1 = (bounds.max[2] ?? 0) + 1
  const cube = wasm.Manifold.cube([cell.x[1] - cell.x[0], cell.y[1] - cell.y[0], z1 - z0])
  try {
    return cube.translate([cell.x[0], cell.y[0], z0])
  } finally {
    cube.delete()
  }
}

/** Engraves the number, mirrored, into the centre of the piece's underside. */
function engrave(wasm: ManifoldToplevel, piece: Manifold, n: number): Manifold {
  const bottom = piece.slice(BASE_STEP)
  const { min, max } = bottom.bounds()
  bottom.delete()
  const digits = digitOutline(wasm, n, DIGIT_HEIGHT)
  const placed = digits.translate([(min[0] + max[0]) / 2, (min[1] + max[1]) / 2])
  digits.delete()
  const mark = prism(placed, -ENGRAVE_CLEAR, ENGRAVE_DEPTH)
  placed.delete()
  try {
    return piece.subtract(mark)
  } finally {
    mark.delete()
  }
}

function applyEdits(wasm: ManifoldToplevel, plain: Manifold, edits: readonly Edit[]): Manifold {
  const adds = edits.filter((e) => e.kind === 'add').map((e) => e.solid)
  const removes = edits.filter((e) => e.kind === 'remove').map((e) => e.solid)
  let piece = adds.length > 0 ? replace(plain, wasm.Manifold.union([plain, ...adds])) : plain
  if (removes.length > 0) {
    const cutter = wasm.Manifold.union(removes)
    try {
      piece = replace(piece, piece.subtract(cutter))
    } finally {
      cutter.delete()
    }
  }
  return piece
}

function buildPiece(wasm: ManifoldToplevel, model: OpenModel, cell: Cell, bounds: Bounds, edits: readonly Edit[], numbers: boolean): Manifold {
  const box = cellBox(wasm, cell, bounds)
  const plain = model.solid.intersect(box)
  box.delete()
  const joined = applyEdits(wasm, plain, edits.filter((e) => e.piece === cell.index))
  if (!numbers) return joined
  try {
    return engrave(wasm, joined, cell.index + 1)
  } finally {
    joined.delete()
  }
}

/** xyz positions only, whatever extra properties the mesh carries. */
function positions(vertProperties: Float32Array, numProp: number): Float32Array {
  if (numProp === 3) return Float32Array.from(vertProperties)
  const count = vertProperties.length / numProp
  return Float32Array.from({ length: count * 3 }, (_, i) => vertProperties[Math.floor(i / 3) * numProp + (i % 3)] ?? 0)
}

function toPieceMesh(piece: Manifold, number: number, plate: Plate): PieceMesh {
  const mesh = piece.getMesh()
  const { min, max } = piece.boundingBox()
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]] as const
  return {
    number,
    vertices: positions(mesh.vertProperties, mesh.numProp),
    triangles: Uint32Array.from(mesh.triVerts),
    size,
    fits: fitsPlate(size[0], size[1], plate),
  }
}

/**
 * Cuts the model into the plan's grid of pieces, joined by tabs or a tongue on bare base
 * (straight, glued cuts elsewhere), each numbered underneath. Pieces stay in assembly position.
 * Throws SplitProblem when a tongue is asked for on a base too thin to hold one.
 */
export function makePieces(
  wasm: ManifoldToplevel,
  model: OpenModel,
  plan: GridPlan,
  settings: SplitSettings,
  plate: Plate,
  onProgress?: (done: number, total: number) => void,
): PiecesResult {
  if (settings.joint === 'tongue' && settings.baseThickness !== null && settings.baseThickness < TONGUE_MIN_BASE) {
    throw new SplitProblem(THIN_TONGUE_MESSAGE)
  }
  const bounds = model.solid.boundingBox()
  const { cells } = layoutGrid(plan.cuts, bounds)
  const { edits, joined } = jointsFor(wasm, model, plan.cuts, bounds, settings)
  try {
    const pieces = cells.map((cell) => {
      const piece = buildPiece(wasm, model, cell, bounds, edits, settings.numbers)
      try {
        return toPieceMesh(piece, cell.index + 1, plate)
      } finally {
        piece.delete()
        onProgress?.(cell.index + 1, cells.length)
      }
    })
    const glueCuts = plan.cuts.map((_, i) => i).filter((i) => !joined.has(i))
    return { pieces, glueCuts }
  } finally {
    edits.forEach((e) => e.solid.delete())
  }
}
