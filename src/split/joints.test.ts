import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { CrossSection, Manifold, ManifoldToplevel } from 'manifold-3d'
import { BASE_STEP, TAB_LENGTH, TAB_NECK, TAB_TIP, TONGUE_OUT } from './constants'
import { findBaseThickness, raisedOutline } from './cut-plan'
import { bareStretches, tabOutlines, tongueOutline } from './joints'
import { loadManifold } from './manifold'
import { openModel } from './model'
import { plateStl, type Raised } from './test-meshes'
import type { Cut } from './types'

let wasm: ManifoldToplevel
const solids: Manifold[] = []
const sections: CrossSection[] = []
beforeAll(async () => { wasm = await loadManifold() })
afterAll(() => { solids.forEach((s) => s.delete()); sections.forEach((s) => s.delete()) })

const REACH = TAB_LENGTH + 2
const CUT: Cut = { axis: 'x', min: -20, max: 20, at: 0 }
const ALONG: readonly [number, number] = [-152.5, 152.5]

function outlines(raised?: readonly Raised[]): { base: CrossSection; raised: CrossSection } {
  const result = openModel(wasm, plateStl({ width: 254, depth: 305, base: 6.4, raised }), 'mm')
  if (!result.ok) throw new Error(result.message)
  const solid = result.value.solid
  solids.push(solid)
  const thickness = findBaseThickness(solid) ?? 6.4
  const base = solid.slice(BASE_STEP)
  const top = raisedOutline(solid, thickness)
  sections.push(base, top)
  return { base, raised: top }
}

describe('bareStretches', () => {
  it('trims a bare cut by the reach at both ends', () => {
    const { base, raised } = outlines()
    const stretches = bareStretches(wasm, base, raised, CUT, ALONG, REACH)
    expect(stretches).toHaveLength(1)
    const [first, last] = [stretches[0]?.[0] ?? 0, stretches[0]?.[1] ?? 0]
    expect(first).toBeGreaterThanOrEqual(-152.5 + REACH - 1e-6)
    expect(first).toBeLessThanOrEqual(-152.5 + REACH + 1)
    expect(last).toBeLessThanOrEqual(152.5 - REACH + 1e-6)
    expect(last).toBeGreaterThanOrEqual(152.5 - REACH - 1)
  })

  it('keeps only the side without raised detail', () => {
    const { base, raised } = outlines([{ x: [-30, 30], y: [-152.5, 0], height: 5 }])
    const stretches = bareStretches(wasm, base, raised, CUT, ALONG, REACH)
    expect(stretches.length).toBeGreaterThan(0)
    for (const [a] of stretches) expect(a).toBeGreaterThanOrEqual(REACH - 1e-6)
  })

  it('finds nothing when detail runs along the whole cut', () => {
    const { base, raised } = outlines([{ x: [-30, 30], y: [-150, 150], height: 5 }])
    expect(bareStretches(wasm, base, raised, CUT, ALONG, REACH)).toEqual([])
  })
})

describe('tabOutlines', () => {
  it('puts about 6 tabs on a bare cut, alternating owners', () => {
    const { base, raised } = outlines()
    const tabs = tabOutlines(wasm, CUT, bareStretches(wasm, base, raised, CUT, ALONG, REACH))
    tabs.forEach((t) => sections.push(t.outline))
    expect(tabs).toHaveLength(6)
    expect(tabs.map((t) => t.owner)).toEqual([-1, 1, -1, 1, -1, 1])
  })

  it('has a wider tip than neck and the trapezoid area', () => {
    expect(TAB_TIP).toBeGreaterThan(TAB_NECK)
    const [tab] = tabOutlines(wasm, CUT, [[0, 40]])
    if (!tab) throw new Error('no tab')
    sections.push(tab.outline)
    const expected = ((TAB_NECK + TAB_TIP) / 2) * TAB_LENGTH
    expect(Math.abs(tab.outline.area() - expected) / expected).toBeLessThan(0.01)
    expect(tab.owner).toBe(-1)
    const box = tab.outline.bounds()
    expect(box.min[0]).toBeCloseTo(0)
    expect(box.max[0]).toBeCloseTo(TAB_LENGTH)
  })

  it('points an owner + tab toward -axis, and works on y cuts', () => {
    const cut: Cut = { axis: 'y', min: -20, max: 20, at: 5 }
    const tabs = tabOutlines(wasm, cut, [[0, 100]])
    tabs.forEach((t) => sections.push(t.outline))
    const second = tabs[1]
    if (!second) throw new Error('no second tab')
    expect(second.owner).toBe(1)
    const box = second.outline.bounds()
    expect(box.max[1]).toBeCloseTo(5)
    expect(box.min[1]).toBeCloseTo(5 - TAB_LENGTH)
  })
})

describe('tongueOutline', () => {
  it('is the stretch long and TONGUE_OUT deep on the + side', () => {
    const outline = tongueOutline(wasm, CUT, [-30, 50])
    sections.push(outline)
    expect(outline.area()).toBeCloseTo(80 * TONGUE_OUT)
    const box = outline.bounds()
    expect(box.min[0]).toBeCloseTo(0)
    expect(box.max[0]).toBeCloseTo(TONGUE_OUT)
    expect(box.min[1]).toBeCloseTo(-30)
    expect(box.max[1]).toBeCloseTo(50)
  })
})
