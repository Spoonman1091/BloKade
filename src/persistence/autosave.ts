import type { BloKadeDocument } from '../document/types'

export const AUTOSAVE_DELAY_MS = 1000

export interface Autosaver {
  schedule(id: string, doc: BloKadeDocument): void
  flush(): Promise<void>
  cancel(): void
}

export function createAutosaver(options: {
  save(id: string, doc: BloKadeDocument): Promise<void>
  onError(error: unknown): void
  delayMs?: number
}): Autosaver {
  const delayMs = options.delayMs ?? AUTOSAVE_DELAY_MS
  let timer: ReturnType<typeof setTimeout> | null = null
  let queued: { id: string; doc: BloKadeDocument } | null = null
  let failing = false
  let inFlight: Promise<void> | null = null

  const clearTimer = (): void => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  const save = async (job: { id: string; doc: BloKadeDocument }): Promise<void> => {
    try {
      await options.save(job.id, job.doc)
      failing = false
    } catch (error) {
      if (!failing) options.onError(error)
      failing = true
    }
  }

  /** Waits for any save already in flight, then saves the queued job (if any). Never rejects. */
  const flush = (): Promise<void> => {
    clearTimer()
    const job = queued
    queued = null
    const next = (inFlight ?? Promise.resolve()).then(() => (job ? save(job) : undefined))
    inFlight = next
    void next.then(() => {
      if (inFlight === next) inFlight = null
    })
    return next
  }

  return {
    schedule(id, doc) {
      if (queued && queued.id !== id) void flush()
      queued = { id, doc }
      clearTimer()
      timer = setTimeout(() => void flush(), delayMs)
    },
    flush,
    cancel() {
      clearTimer()
      queued = null
    },
  }
}
