import { vi } from 'vitest'
import type { OpenedModel } from '../../../split/split-api'
import { SplitCancelled, type SplitClient } from '../../../split/split-client'
import type { Cut, GridPlan, PieceMesh, PiecesResult, SplitResult } from '../../../split/types'

export const CUTS: readonly Cut[] = [
  { axis: 'x', min: -60, max: 60, at: 0 },
  { axis: 'y', min: -70, max: 70, at: 10 },
]
export const GRID: GridPlan = { cols: 2, rows: 2, cuts: CUTS }
export const OPENED: OpenedModel = {
  size: [254, 305, 12], triangleCount: 812000,
  preview: { vertices: new Float32Array(9), triangles: new Uint32Array(3) },
}
const ok = <T,>(value: T): SplitResult<T> => ({ ok: true, value })

export const piece = (number: number, fits = true, cell = number - 1): PieceMesh => ({
  number, cell, vertices: new Float32Array(9), triangles: new Uint32Array(3), size: [100, 100, 12], fits, turned: false,
})
export const FOUR: PiecesResult = { pieces: [1, 2, 3, 4].map((n) => piece(n)), glueCuts: [], glueSegments: [] }

export interface FakeOptions {
  base?: number | null
  pieces?: PiecesResult
  /** pieces() never answers until cancel() rejects it. */
  hangPieces?: boolean
  /** plan() never answers until cancel() rejects it. */
  hangPlan?: boolean
  /** save() never answers until cancel() rejects it. */
  hangSave?: boolean
}

/** A SplitClient with every call recorded and answers set by `options` (read at call time, so tests can change it). */
export function fakeSplitClient(options: FakeOptions = {}) {
  const settings = { base: 6.4, pieces: FOUR, hangPieces: false, hangPlan: false, hangSave: false, ...options }
  const listeners = new Set<(done: number, total: number) => void>()
  let reject: (() => void) | null = null
  const hang = <T,>(): Promise<T> => new Promise<T>((_, no) => { reject = () => no(new SplitCancelled()) })
  const client = {
    open: vi.fn(async (..._args: Parameters<SplitClient['open']>) => ok(OPENED)),
    plan: vi.fn(async (..._args: Parameters<SplitClient['plan']>) =>
      settings.hangPlan ? hang<never>() : ok({ grid: GRID, baseThickness: settings.base })),
    pieces: vi.fn(async (..._args: Parameters<SplitClient['pieces']>): Promise<SplitResult<PiecesResult>> => {
      listeners.forEach((l) => l(1, 4))
      if (settings.hangPieces) return hang()
      return ok(settings.pieces)
    }),
    save: vi.fn(async (..._args: Parameters<SplitClient['save']>) => (settings.hangSave ? hang<never>() : ok(new Uint8Array([1, 2, 3])))),
    onProgress: vi.fn((fn: (done: number, total: number) => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }),
    cancel: vi.fn(() => { reject?.(); reject = null }),
    dispose: vi.fn(),
  } satisfies SplitClient
  return { client, settings }
}
