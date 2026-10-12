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

  const clearTimer = (): void => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  const flush = async (): Promise<void> => {
    clearTimer()
    const job = queued
    queued = null
    if (!job) return
    try {
      await options.save(job.id, job.doc)
      failing = false
    } catch (error) {
      if (!failing) options.onError(error)
      failing = true
    }
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
