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

export const piece = (number: number, fits = true): PieceMesh => ({
  number, vertices: new Float32Array(9), triangles: new Uint32Array(3), size: [100, 100, 12], fits,
})
export const FOUR: PiecesResult = { pieces: [1, 2, 3, 4].map((n) => piece(n)), glueCuts: [] }

export interface FakeOptions {
  base?: number | null
  pieces?: PiecesResult
  /** pieces() never answers until cancel() rejects it. */
  hangPieces?: boolean
}

/** A SplitClient with every call recorded and answers set by `options` (read at call time, so tests can change it). */
export function fakeSplitClient(options: FakeOptions = {}) {
  const settings = { base: 6.4, pieces: FOUR, hangPieces: false, ...options }
  const listeners = new Set<(done: number, total: number) => void>()
  let reject: (() => void) | null = null
  const client = {
    open: vi.fn(async (..._args: Parameters<SplitClient['open']>) => ok(OPENED)),
    plan: vi.fn(async (..._args: Parameters<SplitClient['plan']>) => ok({ grid: GRID, baseThickness: settings.base })),
    pieces: vi.fn(async (..._args: Parameters<SplitClient['pieces']>): Promise<SplitResult<PiecesResult>> => {
      listeners.forEach((l) => l(1, 4))
      if (settings.hangPieces) return new Promise((_, no) => { reject = () => no(new SplitCancelled()) })
      return ok(settings.pieces)
    }),
    save: vi.fn(async () => ok(new Uint8Array([1, 2, 3]))),
    onProgress: vi.fn((fn: (done: number, total: number) => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }),
    cancel: vi.fn(() => { reject?.(); reject = null }),
    dispose: vi.fn(),
  } satisfies SplitClient
  return { client, settings }
}
