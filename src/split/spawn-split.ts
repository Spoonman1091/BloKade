import * as Comlink from 'comlink'
import { isSplitProgress } from './split-progress'
import type { SplitApi } from './split-api'
import type { SplitWorkerHandle } from './split-client'

export function spawnSplitWorker(): SplitWorkerHandle {
  const worker = new Worker(new URL('./split.worker.ts', import.meta.url), { type: 'module' })
  const remote = Comlink.wrap<SplitApi>(worker)
  const listeners = new Set<(done: number, total: number) => void>()
  worker.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (!isSplitProgress(event.data)) return
    const { done, total } = event.data.splitProgress
    listeners.forEach((listener) => listener(done, total))
  })
  return {
    api: {
      open: (bytes, unit) => remote.open(Comlink.transfer(bytes, [bytes]), unit),
      plan: (plate, settings) => remote.plan(plate, settings),
      pieces: (plan, settings, plate) => remote.pieces(plan, settings, plate),
      save: (name) => remote.save(name),
    },
    terminate: () => worker.terminate(),
    onProgress: (fn) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
  }
}
