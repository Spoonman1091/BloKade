import * as Comlink from 'comlink'
import type { WorkerHandle } from './client'
import { isShapeRunMessage, RunningShapes } from './shape-runs'
import type { GeometryApi } from './types'

export function spawnGeometryWorker(): WorkerHandle {
  const worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' })
  const remote = Comlink.wrap<GeometryApi>(worker)
  const running = new RunningShapes()
  worker.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (isShapeRunMessage(event.data)) running.note(event.data)
  })
  return {
    api: {
      rebuild: (doc, channel) => remote.rebuild(doc, channel),
      prepareStl: (bytes) => remote.prepareStl(bytes),
      exportStl: (doc, ids) => remote.exportStl(doc, ids),
      export3mf: (doc, ids) => remote.export3mf(doc, ids),
      exportStep: (doc, ids) => remote.exportStep(doc, ids),
      edgeCandidates: (doc, nodeId, modifierId) => remote.edgeCandidates(doc, nodeId, modifierId),
      overlap: (doc, a, b) => remote.overlap(doc, a, b),
      printCheck: (doc) => remote.printCheck(doc),
      inspect: (code) => remote.inspect(code),
      skipShapes: (hashes) => remote.skipShapes(hashes),
    },
    terminate: () => worker.terminate(),
    runningShapes: () => running.list(),
  }
}
