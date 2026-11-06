import { describe, expect, it } from 'vitest'
import { DEFAULT_FIT_GAP } from './constants'
import { createSplitApi } from './split-api'
import { binaryStl } from '../import/testing/stl-files'
import type { Plate, SplitSettings } from './types'

const LIMIT_MS = 30_000
const A1_MINI: Plate = { width: 180, depth: 180 }
const TABS: SplitSettings = { joint: 'tabs', fitGap: DEFAULT_FIT_GAP, numbers: true, baseThickness: 6 }
const BASE = 6
const SIDE = 300
const DOME_HEIGHT = 20
/** Grid cells per side: 2 * N * N triangles for the top, so N = 500 gives 500,000 there and about as many beneath. */
const N = 500

/** A flat plate (z 0..BASE) with a finely subdivided dome on top, around 1,000,000 triangles. */
function domePlate(): ArrayBuffer {
  const side = N + 1
  const vertices: number[] = []
  const triangles: number[] = []
  const height = (i: number, j: number): number => {
    const x = (i / N - 0.5) * 2
    const y = (j / N - 0.5) * 2
    const r2 = x * x + y * y
    return BASE + (r2 < 0.64 ? DOME_HEIGHT * (1 - r2 / 0.64) : 0)
  }
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) vertices.push((i / N - 0.5) * SIDE, (j / N - 0.5) * SIDE, height(i, j))
  const bottomStart = vertices.length / 3
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) vertices.push((i / N - 0.5) * SIDE, (j / N - 0.5) * SIDE, 0)
  const top = (i: number, j: number): number => j * side + i
  const bottom = (i: number, j: number): number => bottomStart + j * side + i
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    triangles.push(top(i, j), top(i + 1, j), top(i + 1, j + 1), top(i, j), top(i + 1, j + 1), top(i, j + 1))
    triangles.push(bottom(i, j), bottom(i + 1, j + 1), bottom(i + 1, j), bottom(i, j), bottom(i, j + 1), bottom(i + 1, j + 1))
  }
  // Side walls tie the top and bottom rings together.
  const wall = (a: [number, number], b: [number, number]): void => {
    triangles.push(bottom(...a), bottom(...b), top(...b), bottom(...a), top(...b), top(...a))
  }
  for (let k = 0; k < N; k++) {
    wall([k, 0], [k + 1, 0])
    wall([N, k], [N, k + 1])
    wall([k + 1, N], [k, N])
    wall([0, k + 1], [0, k])
  }
  return binaryStl({ vertices, triangles })
}

describe.skipIf(!process.env.BLOKADE_TIMING)('split timing', () => {
  it('splits a 1,000,000-triangle plate into 4 pieces with tabs in under 30 s', async () => {
    const file = domePlate()
    const api = createSplitApi(() => undefined)
    const started = performance.now()
    const opened = await api.open(file, 'mm')
    if (!opened.ok) throw new Error(opened.message)
    expect(opened.value.triangleCount).toBeGreaterThan(900_000)
    const plan = await api.plan(A1_MINI, TABS)
    if (!plan.ok) throw new Error(plan.message)
    const made = await api.pieces(plan.value.grid, TABS, A1_MINI)
    if (!made.ok) throw new Error(made.message)
    const elapsed = performance.now() - started
    console.info(`split timing: ${opened.value.triangleCount} triangles, ${made.value.pieces.length} pieces, ${Math.round(elapsed)} ms`)
    expect(made.value.pieces).toHaveLength(4)
    expect(elapsed).toBeLessThan(LIMIT_MS)
  }, 120_000)
})
