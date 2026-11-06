import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Manifold, ManifoldToplevel } from 'manifold-3d'
import { DEFAULT_FIT_GAP, DIGIT_HEIGHT, ENGRAVE_DEPTH, TAB_LENGTH, THIN_TONGUE_MESSAGE, TONGUE_OUT } from './constants'
import { findBaseThickness } from './cut-plan'
import { digitOutline } from './digits'
import { planGrid } from './grid'
import { loadManifold } from './manifold'
import { openModel, type OpenModel } from './model'
import { makePieces } from './pieces'
import { SplitProblem } from './problem'
import { plateStl, type Raised } from './test-meshes'
import type { GridPlan, PieceMesh, Plate, SplitSettings } from './types'

const A1_MINI: Plate = { width: 180, depth: 180 }
const BASE = 6.4
const TABS: SplitSettings = { joint: 'tabs', fitGap: DEFAULT_FIT_GAP, numbers: true, baseThickness: BASE }
const QUADRANT_BLOCK: Raised = { x: [40, 100], y: [40, 120], height: 5 }

let wasm: ManifoldToplevel
const models: OpenModel[] = []
beforeAll(async () => { wasm = await loadManifold() })
afterAll(() => models.forEach((m) => m.solid.delete()))

function open(width: number, depth: number, base: number, raised?: readonly Raised[]): OpenModel {
  const result = openModel(wasm, plateStl({ width, depth, base, raised }), 'mm')
  if (!result.ok) throw new Error(result.message)
  models.push(result.value)
  return result.value
}

function planFor(model: OpenModel, reserve: number): GridPlan {
  const plan = planGrid(model.info.size[0], model.info.size[1], A1_MINI, reserve)
  if (!plan) throw new Error('no plan')
  return plan
}

/** Rebuilds a piece as a Manifold; throws if the mesh is not watertight. Caller frees it. */
function solidOf(piece: PieceMesh): Manifold {
  const mesh = new wasm.Mesh({ numProp: 3, vertProperties: piece.vertices, triVerts: piece.triangles })
  const solid = wasm.Manifold.ofMesh(mesh)
  if (solid.status() !== 'NoError') throw new Error(`piece ${piece.number}: ${solid.status()}`)
  return solid
}

function withSolids<T>(pieces: readonly PieceMesh[], read: (solids: readonly Manifold[]) => T): T {
  const solids = pieces.map(solidOf)
  try {
    return read(solids)
  } finally {
    solids.forEach((s) => s.delete())
  }
}

function volumes(pieces: readonly PieceMesh[]): number[] {
  return withSolids(pieces, (solids) => solids.map((s) => s.volume()))
}

function engravingVolume(n: number): number {
  const outline = digitOutline(wasm, n, DIGIT_HEIGHT)
  try {
    return outline.area() * ENGRAVE_DEPTH
  } finally {
    outline.delete()
  }
}

function boundsOf(piece: PieceMesh): { min: number[]; max: number[] } {
  return withSolids([piece], ([s]) => s?.boundingBox() ?? { min: [0, 0, 0], max: [0, 0, 0] })
}

describe('makePieces on a chest plate with a raised block (A1 mini, tabs)', () => {
  it('makes 4 numbered, watertight pieces that fit the plate', () => {
    const model = open(254, 305, BASE, [QUADRANT_BLOCK])
    const result = makePieces(wasm, model, planFor(model, TAB_LENGTH), TABS, A1_MINI)
    expect(result.pieces.map((p) => p.number)).toEqual([1, 2, 3, 4])
    expect(result.pieces.every((p) => p.fits)).toBe(true)
    expect(result.glueCuts).toEqual([])
    expect(() => volumes(result.pieces)).not.toThrow()
  })

  it('numbers row by row from the front-left', () => {
    const model = open(254, 305, BASE, [QUADRANT_BLOCK])
    const { pieces } = makePieces(wasm, model, planFor(model, TAB_LENGTH), { ...TABS, numbers: false }, A1_MINI)
    const centres = pieces.map((p) => {
      const { min, max } = boundsOf(p)
      return [((min[0] ?? 0) + (max[0] ?? 0)) / 2, ((min[1] ?? 0) + (max[1] ?? 0)) / 2]
    })
    expect(centres.map(([x, y]) => [Math.sign(x ?? 0), Math.sign(y ?? 0)])).toEqual([[-1, -1], [1, -1], [-1, 1], [1, 1]])
  })

  it('leaves no overlap between any two pieces', () => {
    const model = open(254, 305, BASE, [QUADRANT_BLOCK])
    const { pieces } = makePieces(wasm, model, planFor(model, TAB_LENGTH), TABS, A1_MINI)
    withSolids(pieces, (solids) => {
      solids.forEach((a, i) => solids.slice(i + 1).forEach((b) => {
        const both = a.intersect(b)
        expect(both.volume()).toBeLessThan(0.01)
        both.delete()
      }))
    })
  })

  it('keeps the volume, less only the fit gaps and the numbers', () => {
    const model = open(254, 305, BASE, [QUADRANT_BLOCK])
    const plan = planFor(model, TAB_LENGTH)
    const { pieces } = makePieces(wasm, model, plan, TABS, A1_MINI)
    const cutLengths = plan.cuts.reduce((sum, c) => sum + (c.axis === 'x' ? 305 : 254), 0)
    const allowed = cutLengths * BASE * 0.2 * 2 + 4 * Math.max(...[1, 2, 3, 4].map(engravingVolume)) + 1
    const total = volumes(pieces).reduce((a, b) => a + b, 0)
    expect(Math.abs(total - model.solid.volume())).toBeLessThan(allowed)
  })

  it('adds tabs: every piece differs from its plain straight cut', () => {
    const model = open(254, 305, BASE, [QUADRANT_BLOCK])
    const plan = planFor(model, TAB_LENGTH)
    const plain = volumes(makePieces(wasm, model, plan, { ...TABS, joint: 'none', numbers: false }, A1_MINI).pieces)
    const tabbed = volumes(makePieces(wasm, model, plan, { ...TABS, numbers: false }, A1_MINI).pieces)
    tabbed.forEach((v, i) => expect(Math.abs(v - (plain[i] ?? 0))).toBeGreaterThan(1))
  })

  it('reports progress after each piece', () => {
    const model = open(254, 305, BASE, [QUADRANT_BLOCK])
    const calls: [number, number][] = []
    makePieces(wasm, model, planFor(model, TAB_LENGTH), TABS, A1_MINI, (done, total) => calls.push([done, total]))
    expect(calls).toEqual([[1, 4], [2, 4], [3, 4], [4, 4]])
  })
})

/** A 254 x 305 plate with its back-right quarter removed: an L. */
function openL(): OpenModel {
  const plate = open(254, 305, BASE)
  const corner = wasm.Manifold.cube([200, 200, 20]).translate([0, 0, -5])
  const solid = plate.solid.subtract(corner)
  corner.delete()
  const model = { solid, info: plate.info }
  models.push(model)
  return model
}

describe('makePieces on odd shapes', () => {
  it('skips empty cells and numbers the rest 1..N', () => {
    const model = openL()
    const { pieces } = makePieces(wasm, model, planFor(model, TAB_LENGTH), TABS, A1_MINI)
    expect(pieces.map((p) => p.number)).toEqual([1, 2, 3])
    pieces.forEach((p) => {
      expect(p.triangles.length).toBeGreaterThan(0)
      p.size.forEach((s) => expect(Number.isFinite(s)).toBe(true))
    })
    expect(() => volumes(pieces)).not.toThrow()
  })

  it('gives a plain flat plate tabs on every cut', () => {
    const model = open(254, 305, BASE)
    const plan = planFor(model, TAB_LENGTH)
    const settings = { ...TABS, baseThickness: findBaseThickness(model.solid) }
    const { pieces, glueCuts } = makePieces(wasm, model, plan, settings, A1_MINI)
    expect(glueCuts).toEqual([])
    const plain = volumes(makePieces(wasm, model, plan, { ...settings, joint: 'none' }, A1_MINI).pieces)
    volumes(pieces).forEach((v, i) => expect(Math.abs(v - (plain[i] ?? 0))).toBeGreaterThan(1))
  })
})

describe('makePieces fallbacks', () => {
  it('glues a cut that runs along raised detail its whole length, with no tabs on it', () => {
    const model = open(254, 305, BASE, [{ x: [-15, 15], y: [-152.5, 152.5], height: 5 }])
    const plan = planFor(model, TAB_LENGTH)
    const xCut = plan.cuts.findIndex((c) => c.axis === 'x')
    const at = plan.cuts[xCut]?.at ?? 0
    const { pieces, glueCuts } = makePieces(wasm, model, plan, TABS, A1_MINI)
    expect(glueCuts).toEqual([xCut])
    const [left, right] = [[pieces[0], pieces[2]], [pieces[1], pieces[3]]]
    left.forEach((p) => p && expect(boundsOf(p).max[0]).toBeLessThanOrEqual(at + 1e-4))
    right.forEach((p) => p && expect(boundsOf(p).min[0]).toBeGreaterThanOrEqual(at - 1e-4))
  })

  it('cuts straight and glues every cut when there is no base', () => {
    const model = open(254, 305, BASE)
    const plan = planFor(model, 0)
    const { pieces, glueCuts } = makePieces(wasm, model, plan, { ...TABS, baseThickness: null }, A1_MINI)
    expect(glueCuts).toEqual(plan.cuts.map((_, i) => i))
    expect(pieces).toHaveLength(plan.cols * plan.rows)
    const total = volumes(pieces).reduce((a, b) => a + b, 0)
    expect(Math.abs(total - model.solid.volume())).toBeLessThan(pieces.length * Math.max(...[1, 2, 3, 4].map(engravingVolume)) + 1)
  })

  it('keeps a model that already fits as one piece with no glue', () => {
    const model = open(150, 120, BASE, [{ x: [-20, 20], y: [-20, 20], height: 5 }])
    const result = makePieces(wasm, model, planFor(model, TAB_LENGTH), TABS, A1_MINI)
    expect(result.pieces).toHaveLength(1)
    expect(result.pieces[0]?.number).toBe(1)
    expect(result.pieces[0]?.fits).toBe(true)
    expect(result.glueCuts).toEqual([])
  })

  it('refuses a tongue on a 3 mm base with the thin-tongue message', () => {
    const model = open(254, 305, 3, [QUADRANT_BLOCK])
    const plan = planFor(model, TONGUE_OUT)
    const run = (): unknown => makePieces(wasm, model, plan, { ...TABS, joint: 'tongue', baseThickness: 3 }, A1_MINI)
    expect(run).toThrow(SplitProblem)
    expect(run).toThrow(THIN_TONGUE_MESSAGE)
  })

  it('joins with a tongue on a thick base, without overlap', () => {
    const model = open(254, 305, BASE, [QUADRANT_BLOCK])
    const plan = planFor(model, TONGUE_OUT)
    const { pieces, glueCuts } = makePieces(wasm, model, plan, { ...TABS, joint: 'tongue' }, A1_MINI)
    expect(glueCuts).toEqual([])
    withSolids(pieces, (solids) => {
      solids.forEach((a, i) => solids.slice(i + 1).forEach((b) => {
        const both = a.intersect(b)
        expect(both.volume()).toBeLessThan(0.01)
        both.delete()
      }))
    })
  })
})
