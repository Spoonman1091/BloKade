import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Manifold, ManifoldToplevel } from 'manifold-3d'
import { TAB_LENGTH } from './constants'
import { findBaseThickness, placeCuts } from './cut-plan'
import { misfitCells, planGrid } from './grid'
import { loadManifold } from './manifold'
import { openModel } from './model'
import { plateStl, type Raised } from './test-meshes'

let wasm: ManifoldToplevel
const solids: Manifold[] = []
beforeAll(async () => { wasm = await loadManifold() })
afterAll(() => { solids.forEach((s) => s.delete()) })

function plate(raised?: readonly Raised[], width = 254, depth = 305): Manifold {
  const result = openModel(wasm, plateStl({ width, depth, base: 6.4, raised }), 'mm')
  if (!result.ok) throw new Error(result.message)
  solids.push(result.value.solid)
  return result.value.solid
}

describe('findBaseThickness', () => {
  it('finds the top of the base under raised detail', () => {
    expect(findBaseThickness(plate([{ x: [-20, 20], y: [-40, 40], height: 5 }]))).toBeCloseTo(6.4, 1)
  })

  it('is the full height for a plain box', () => {
    const box = wasm.Manifold.cube([50, 50, 6.4], false)
    solids.push(box)
    expect(findBaseThickness(box)).toBeCloseTo(6.4, 1)
  })

  it('is the full height for a plain plate read from an STL', () => {
    expect(findBaseThickness(plate())).toBeCloseTo(6.4, 1)
  })

  it('is null for a sphere-like shape', () => {
    const ball = wasm.Manifold.sphere(40, 64)
    const placed = ball.translate([0, 0, 40])
    ball.delete()
    solids.push(placed)
    expect(findBaseThickness(placed)).toBeNull()
  })
})

describe('placeCuts', () => {
  const a1 = { width: 180, depth: 180 }
  const fit = { plate: a1, reserve: TAB_LENGTH }

  it('keeps even cuts on a plain plate, whose base is its full height', () => {
    const solid = plate()
    const grid = planGrid(254, 305, a1, TAB_LENGTH)
    if (!grid) throw new Error('no grid')
    const base = findBaseThickness(solid)
    expect(base).not.toBeNull()
    expect(placeCuts(wasm, solid, grid, base, fit).cuts.map((c) => c.at)).toEqual(grid.cuts.map((c) => c.at))
  })

  it('moves the cut off a raised strip and keeps the other in the middle', () => {
    const solid = plate([{ x: [-10, 10], y: [-152.5, 152.5], height: 5 }])
    const grid = planGrid(254, 305, a1, TAB_LENGTH)
    if (!grid) throw new Error('no grid')
    const placed = placeCuts(wasm, solid, grid, 6.4, fit)
    const xCut = placed.cuts.find((c) => c.axis === 'x')
    const yCut = placed.cuts.find((c) => c.axis === 'y')
    expect(Math.abs(xCut?.at ?? 0)).toBe(11)
    expect(yCut?.at).toBe(0)
  })

  it('stays inside the window', () => {
    const solid = plate([{ x: [-60, 60], y: [-152.5, 152.5], height: 5 }])
    const grid = planGrid(254, 305, a1, TAB_LENGTH)
    if (!grid) throw new Error('no grid')
    const cut = placeCuts(wasm, solid, grid, 6.4, fit).cuts.find((c) => c.axis === 'x')
    expect(cut).toBeDefined()
    expect(cut!.at).toBeGreaterThanOrEqual(cut!.min)
    expect(cut!.at).toBeLessThanOrEqual(cut!.max)
  })

  it('keeps the even positions with no base', () => {
    const solid = plate()
    const grid = planGrid(254, 305, a1, TAB_LENGTH)
    if (!grid) throw new Error('no grid')
    expect(placeCuts(wasm, solid, grid, null, fit)).toEqual(grid)
  })
  it('never returns cuts that make a piece too big: falls back to even cuts on that axis (R19)', () => {
    // Raised strips push the first cut far left and the second right, which alone would make piece 2 192 mm long.
    const solid = plate([{ x: [-148, -90], y: [-50, 50], height: 5 }, { x: [-25, 22], y: [-50, 50], height: 5 }], 500, 100)
    const grid = planGrid(500, 100, a1, TAB_LENGTH)
    if (!grid) throw new Error('no grid')
    expect(grid.cuts).toHaveLength(3)
    const placed = placeCuts(wasm, solid, grid, 6.4, fit)
    expect(misfitCells(placed, { width: 500, depth: 100 }, a1, TAB_LENGTH)).toEqual([])
  })
})
