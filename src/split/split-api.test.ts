import { unzipSync } from 'fflate'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_FIT_GAP, GAPS_MESSAGE, TOO_MANY_MESSAGE, UNEXPECTED_MESSAGE } from './constants'
import { createSplitApi, type SplitApi } from './split-api'
import { plateStl, withoutTriangle } from './test-meshes'
import type { GridPlan, Plate, SplitSettings } from './types'

const A1_MINI: Plate = { width: 180, depth: 180 }
const TABS: SplitSettings = { joint: 'tabs', fitGap: DEFAULT_FIT_GAP, numbers: true, baseThickness: 6.4 }

const stl = (width: number, depth: number): ArrayBuffer => plateStl({ width, depth, base: 6.4 })

async function okValue<T>(result: Promise<{ ok: true; value: T } | { ok: false; message: string }>): Promise<T> {
  const r = await result
  if (!r.ok) throw new Error(r.message)
  return r.value
}

describe('createSplitApi', () => {
  const apis: SplitApi[] = []
  afterEach(() => vi.restoreAllMocks())

  it('opens, plans, makes pieces and saves a 4-file ZIP, reporting progress', async () => {
    const progress: [number, number][] = []
    const api = createSplitApi((done, total) => progress.push([done, total]))
    apis.push(api)
    const info = await okValue(api.open(stl(300, 300), 'mm'))
    expect(info.size[0]).toBeCloseTo(300)
    expect(info.preview.vertices.length).toBeGreaterThan(0)
    expect(info.preview.triangles.length).toBeGreaterThan(0)
    const plan = await okValue(api.plan(A1_MINI, TABS))
    expect(plan.baseThickness).toBeCloseTo(6.4, 1)
    expect(plan.grid.cols * plan.grid.rows).toBe(4)
    const made = await okValue(api.pieces(plan.grid, TABS, A1_MINI))
    expect(made.pieces).toHaveLength(4)
    expect(progress).toEqual([[1, 4], [2, 4], [3, 4], [4, 4]])
    const zip = await okValue(api.save('plate'))
    expect(Object.keys(unzipSync(zip)).sort()).toEqual(['plate-1.stl', 'plate-2.stl', 'plate-3.stl', 'plate-4.stl'])
  })

  it('replaces the first model when a second is opened', async () => {
    const api = createSplitApi(() => undefined)
    await okValue(api.open(stl(300, 300), 'mm'))
    const first = await okValue(api.plan(A1_MINI, TABS))
    expect(first.grid.cols * first.grid.rows).toBe(4)
    await okValue(api.open(stl(100, 100), 'mm'))
    const second = await okValue(api.plan(A1_MINI, TABS))
    expect(second.grid.cols * second.grid.rows).toBe(1)
  })

  it('says so when the model needs too many pieces', async () => {
    const api = createSplitApi(() => undefined)
    await okValue(api.open(plateStl({ width: 1200, depth: 1200, base: 6 }), 'mm'))
    expect(await api.plan({ width: 100, depth: 100 }, TABS)).toEqual({ ok: false, message: TOO_MANY_MESSAGE })
  })

  it('says so when the model has gaps', async () => {
    const api = createSplitApi(() => undefined)
    expect(await api.open(withoutTriangle(stl(300, 300), 3), 'mm')).toEqual({ ok: false, message: GAPS_MESSAGE })
  })

  it('gives the unexpected message for calls before a model is open, and for save before pieces', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const api = createSplitApi(() => undefined)
    const grid: GridPlan = { cols: 1, rows: 1, cuts: [] }
    expect(await api.plan(A1_MINI, TABS)).toEqual({ ok: false, message: UNEXPECTED_MESSAGE })
    expect(await api.pieces(grid, TABS, A1_MINI)).toEqual({ ok: false, message: UNEXPECTED_MESSAGE })
    expect(await api.save('x')).toEqual({ ok: false, message: UNEXPECTED_MESSAGE })
  })

  it('maps a thin tongue base to its own message', async () => {
    const api = createSplitApi(() => undefined)
    await okValue(api.open(stl(300, 300), 'mm'))
    const tongue: SplitSettings = { ...TABS, joint: 'tongue', baseThickness: 3 }
    const plan = await okValue(api.plan(A1_MINI, tongue))
    const result = await api.pieces(plan.grid, tongue, A1_MINI)
    expect(result).toEqual({ ok: false, message: 'The base is too thin for a tongue.' })
  })
})
