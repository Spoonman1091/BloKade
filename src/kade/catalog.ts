import { createStore, type StoreApi } from 'zustand/vanilla'
import { GeometryTimeoutError } from '../geometry/client'
import { codeHash } from './hash'
import { CHECK_FAILED, TOO_LONG } from './messages'
import type { InspectResult } from './meta'

export interface CatalogState {
  /** What the worker said about each piece of code, by code hash. */
  readonly results: Readonly<Record<string, InspectResult>>
  /** Asks the worker about this code. Each code is only ever asked about once. */
  request(code: string): void
}

export type ShapeCatalog = StoreApi<CatalogState>

export const resultFor = (results: CatalogState['results'], code: string): InspectResult | undefined => {
  const key = codeHash(code)
  return Object.hasOwn(results, key) ? results[key] : undefined
}

function failureOf(error: unknown): InspectResult {
  if (error instanceof GeometryTimeoutError) return { ok: false, problem: TOO_LONG }
  console.error("Could not check one of Kade's shapes", error)
  return { ok: false, problem: CHECK_FAILED }
}

/**
 * The page's memory of Kade's shapes. The worker runs the code; the page only keeps the answers.
 * An answer is kept for the whole session: changed code has a new hash and is asked about again.
 */
export function createShapeCatalog(inspect: (code: string) => Promise<InspectResult>): ShapeCatalog {
  const asked = new Set<string>()
  return createStore<CatalogState>()((set) => ({
    results: {},
    request: (code) => {
      const key = codeHash(code)
      if (asked.has(key)) return
      asked.add(key)
      void inspect(code).catch(failureOf).then((result) => set((s) => ({ results: { ...s.results, [key]: result } })))
    },
  }))
}
