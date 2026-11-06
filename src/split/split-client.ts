import type { ImportUnit } from '../app/import-stl'
import { spawnSplitWorker } from './spawn-split'
import type { SplitApi } from './split-api'
import type { SplitResult } from './types'

export interface SplitWorkerHandle {
  readonly api: SplitApi
  terminate(): void
  /** Calls `fn` after each finished piece; returns the way to stop. */
  onProgress(fn: (done: number, total: number) => void): () => void
}

/** A call that was running when `cancel()` stopped the worker. It rejects with this, so the screen can stop waiting. */
export class SplitCancelled extends Error {
  override name = 'SplitCancelled'
  constructor() {
    super('Splitting was cancelled.')
  }
}

export interface SplitClient extends SplitApi {
  onProgress(fn: (done: number, total: number) => void): () => void
  /** Stops the worker and starts a fresh one. Calls in flight reject with SplitCancelled. */
  cancel(): void
  dispose(): void
}

interface Opened { readonly bytes: ArrayBuffer; readonly unit: ImportUnit }

/**
 * Page side of the split worker. Remembers the last opened file (a copy) and re-opens it in a fresh
 * worker before the next plan / pieces / save, so cancel leaves the screen usable.
 */
export function createSplitClient(spawn: () => SplitWorkerHandle = spawnSplitWorker): SplitClient {
  let handle = spawn()
  let kept: Opened | null = null
  let loaded = false
  let stop: () => void = () => undefined
  let cancelled: Promise<never> = new Promise<never>((_, reject) => { stop = () => reject(new SplitCancelled()) })
  cancelled.catch(() => undefined)
  const listeners = new Set<(done: number, total: number) => void>()
  let unhook = handle.onProgress((d, t) => listeners.forEach((l) => l(d, t)))

  const guard = <T>(work: Promise<T>): Promise<T> => Promise.race([work, cancelled])

  const reopen = async (): Promise<SplitResult<never> | null> => {
    if (loaded || !kept) return null
    const result = await handle.api.open(kept.bytes.slice(0), kept.unit)
    if (result.ok) { loaded = true; return null }
    return result
  }

  const withModel = <T>(call: (api: SplitApi) => Promise<SplitResult<T>>): Promise<SplitResult<T>> => {
    const current = handle
    return guard((async () => {
      const failed = await reopen()
      if (failed) return failed
      return call(current.api)
    })())
  }

  return {
    open(bytes, unit) {
      const copy: Opened = { bytes: bytes.slice(0), unit }
      kept = null
      loaded = false
      return guard(handle.api.open(bytes.slice(0), unit)).then((result) => {
        if (result.ok) { kept = copy; loaded = true }
        return result
      })
    },
    plan: (plate, settings) => withModel((api) => api.plan(plate, settings)),
    pieces: (plan, settings, plate) => withModel((api) => api.pieces(plan, settings, plate)),
    save: (name) => withModel((api) => api.save(name)),
    onProgress(fn) {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    cancel() {
      stop()
      cancelled = new Promise<never>((_, reject) => { stop = () => reject(new SplitCancelled()) })
      cancelled.catch(() => undefined)
      unhook()
      handle.terminate()
      handle = spawn()
      unhook = handle.onProgress((d, t) => listeners.forEach((l) => l(d, t)))
      loaded = false
    },
    dispose() {
      unhook()
      handle.terminate()
    },
  }
}
