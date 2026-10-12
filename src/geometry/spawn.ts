import * as Comlink from 'comlink'
import type { WorkerHandle } from './client'
import type { GeometryApi } from './types'

export function spawnGeometryWorker(): WorkerHandle {
  const worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' })
  const remote = Comlink.wrap<GeometryApi>(worker)
  return {
    api: {
      rebuild: (doc) => remote.rebuild(doc),
      exportStl: (doc, ids) => remote.exportStl(doc, ids),
      export3mf: (doc, ids) => remote.export3mf(doc, ids),
      exportStep: (doc, ids) => remote.exportStep(doc, ids),
      edgeCandidates: (doc, nodeId, modifierId) => remote.edgeCandidates(doc, nodeId, modifierId),
    },
    terminate: () => worker.terminate(),
  }
}
