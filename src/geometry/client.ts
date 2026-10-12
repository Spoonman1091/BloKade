import type { BloKadeDocument, NodeId } from '../document/types'
import type { InspectResult } from '../kade/meta'
import type { BuildChannel, BuildResult, EdgeCandidate, GeometryApi, OverlapResult } from './types'

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
  readonly channel: BuildChannel
  resolve(result: BuildResult | null): void
  reject(error: unknown): void
}

interface PendingInspect {
  readonly code: string
  resolve(result: InspectResult): void
  reject(error: unknown): void
}

/**
 * Talks to the geometry worker, one queued job at a time. Each build channel keeps only its newest
 * waiting rebuild. The design goes first, then waiting inspects (oldest first, none dropped), then
 * the preview. Every job goes through `call`, so a stuck worker restarts after the timeout.
 */
export class GeometryClient {
  private handle: WorkerHandle
  private busy = false
  private inspects: readonly PendingInspect[] = []
  private pending: Readonly<Record<BuildChannel, PendingRebuild | null>> = { design: null, preview: null }

  constructor(private readonly spawn: () => WorkerHandle, private readonly timeoutMs = REBUILD_TIMEOUT_MS) {
    this.handle = spawn()
  }

  /** Newest request per channel wins; the design goes before the preview. */
  rebuild(doc: BloKadeDocument, channel: BuildChannel = 'design'): Promise<BuildResult | null> {
    return new Promise((resolve, reject) => {
      this.pending[channel]?.resolve(null)
      this.pending = { ...this.pending, [channel]: { doc, channel, resolve, reject } }
      this.pump()
    })
  }

  /** Checks one of Kade's shapes in the worker. Runaway code restarts the worker like a stuck build. */
  inspect(code: string): Promise<InspectResult> {
    return new Promise((resolve, reject) => {
      this.inspects = [...this.inspects, { code, resolve, reject }]
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
    if (this.busy) return
    const run = this.takeNext()
    if (!run) return
    this.busy = true
    run().finally(() => {
      this.busy = false
      this.pump()
    })
  }

  /** Picks the next job (design, then inspects, then preview) and removes it from the queue. */
  private takeNext(): (() => Promise<void>) | null {
    const rebuild = this.pending.design
    if (rebuild) return this.startRebuild(rebuild)
    const [inspect, ...rest] = this.inspects
    if (inspect) {
      this.inspects = rest
      return () => this.call((api) => api.inspect(inspect.code)).then(inspect.resolve, inspect.reject)
    }
    const preview = this.pending.preview
    return preview ? this.startRebuild(preview) : null
  }

  private startRebuild(job: PendingRebuild): () => Promise<void> {
    this.pending = { ...this.pending, [job.channel]: null }
    return () => this.call((api) => api.rebuild(job.doc, job.channel)).then(job.resolve, job.reject)
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
