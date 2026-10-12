import type { BloKadeDocument, NodeId } from '../document/types'
import type { BuildResult, EdgeCandidate, GeometryApi, OverlapResult } from './types'

export interface WorkerHandle {
  readonly api: GeometryApi
  terminate(): void
}

export const REBUILD_TIMEOUT_MS = 30_000

export class GeometryTimeoutError extends Error {
  override name = 'GeometryTimeoutError'
  constructor() {
    super('The geometry engine got stuck on your last change, so BloKade restarted it. Try undoing that change.')
  }
}

interface PendingRebuild {
  readonly doc: BloKadeDocument
  resolve(result: BuildResult | null): void
  reject(error: unknown): void
}

/** Talks to the geometry worker: one rebuild at a time, newest request wins, stuck workers restart. */
export class GeometryClient {
  private handle: WorkerHandle
  private busy = false
  private pending: PendingRebuild | null = null

  constructor(private readonly spawn: () => WorkerHandle, private readonly timeoutMs = REBUILD_TIMEOUT_MS) {
    this.handle = spawn()
  }

  rebuild(doc: BloKadeDocument): Promise<BuildResult | null> {
    return new Promise((resolve, reject) => {
      this.pending?.resolve(null)
      this.pending = { doc, resolve, reject }
      this.pump()
    })
  }

  exportStl(doc: BloKadeDocument, ids?: readonly NodeId[]): Promise<ArrayBuffer> {
    return this.call((api) => api.exportStl(doc, ids))
  }

  export3mf(doc: BloKadeDocument, ids?: readonly NodeId[]): Promise<ArrayBuffer> {
    return this.call((api) => api.export3mf(doc, ids))
  }

  exportStep(doc: BloKadeDocument, ids?: readonly NodeId[]): Promise<ArrayBuffer> {
    return this.call((api) => api.exportStep(doc, ids))
  }

  edgeCandidates(doc: BloKadeDocument, nodeId: NodeId, modifierId: string): Promise<EdgeCandidate[]> {
    return this.call((api) => api.edgeCandidates(doc, nodeId, modifierId))
  }

  overlap(doc: BloKadeDocument, a: NodeId, b: NodeId): Promise<OverlapResult> {
    return this.call((api) => api.overlap(doc, a, b))
  }

  dispose(): void {
    this.handle.terminate()
  }

  private pump(): void {
    const job = this.pending
    if (this.busy || !job) return
    this.pending = null
    this.busy = true
    this.call((api) => api.rebuild(job.doc))
      .then(job.resolve, job.reject)
      .finally(() => {
        this.busy = false
        this.pump()
      })
  }

  private call<T>(fn: (api: GeometryApi) => Promise<T>): Promise<T> {
    const handle = this.handle
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        this.restart(handle)
        reject(new GeometryTimeoutError())
      }, this.timeoutMs)
    })
    return Promise.race([fn(handle.api), timeout]).finally(() => clearTimeout(timer))
  }

  private restart(stuck: WorkerHandle): void {
    if (this.handle !== stuck) return
    stuck.terminate()
    this.handle = this.spawn()
  }
}
