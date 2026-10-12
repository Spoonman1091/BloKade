import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import type { BloKadeDocument } from '../document/types'
import { GeometryClient, GeometryTimeoutError, type WorkerHandle } from './client'
import type { BuildResult } from './types'

interface Deferred<T> { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void }
function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined
  let reject: (error: unknown) => void = () => undefined
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function fakeWorker() {
  const calls: { doc: BloKadeDocument; reply: Deferred<BuildResult> }[] = []
  const handle: WorkerHandle = {
    api: {
      rebuild: (doc) => {
        const reply = deferred<BuildResult>()
        calls.push({ doc, reply })
        return reply.promise
      },
      exportStl: async () => new ArrayBuffer(84),
      export3mf: async () => new ArrayBuffer(10),
      exportStep: async () => new ArrayBuffer(5),
      edgeCandidates: async () => [],
      overlap: async () => ({ status: 'none' }),
      inspect: async () => ({ ok: false, problem: 'unused' }),
    },
    terminate: vi.fn(),
  }
  return { handle, calls }
}

const doc = (name: string) => createEmptyDocument(name)
const result = (tag: string): BuildResult => ({ nodes: { [tag]: { status: 'error', message: tag } } })
const flush = () => new Promise((r) => setTimeout(r, 0))

afterEach(() => vi.useRealTimers())

describe('GeometryClient', () => {
  it('returns the build result', async () => {
    const { handle, calls } = fakeWorker()
    const client = new GeometryClient(() => handle)
    const pending = client.rebuild(doc('one'))
    calls[0]?.reply.resolve(result('one'))
    await expect(pending).resolves.toEqual(result('one'))
  })

  it('only builds the newest waiting document', async () => {
    const { handle, calls } = fakeWorker()
    const client = new GeometryClient(() => handle)
    const first = client.rebuild(doc('one'))
    const second = client.rebuild(doc('two'))
    const third = client.rebuild(doc('three'))
    await expect(second).resolves.toBeNull()
    expect(calls).toHaveLength(1)
    calls[0]?.reply.resolve(result('one'))
    await expect(first).resolves.toEqual(result('one'))
    await flush()
    expect(calls.map((c) => c.doc.name)).toEqual(['one', 'three'])
    calls[1]?.reply.resolve(result('three'))
    await expect(third).resolves.toEqual(result('three'))
  })

  it('passes worker errors through', async () => {
    const { handle, calls } = fakeWorker()
    const client = new GeometryClient(() => handle)
    const pending = client.rebuild(doc('one'))
    calls[0]?.reply.reject(new Error('engine failed to load'))
    await expect(pending).rejects.toThrow('engine failed to load')
  })

  it('restarts a stuck worker after the timeout', async () => {
    vi.useFakeTimers()
    const first = fakeWorker()
    const second = fakeWorker()
    const spawn = vi.fn().mockReturnValueOnce(first.handle).mockReturnValueOnce(second.handle)
    const client = new GeometryClient(spawn, 30_000)
    const pending = client.rebuild(doc('stuck'))
    const assertion = expect(pending).rejects.toBeInstanceOf(GeometryTimeoutError)
    await vi.advanceTimersByTimeAsync(30_000)
    await assertion
    expect(first.handle.terminate).toHaveBeenCalledOnce()
    expect(spawn).toHaveBeenCalledTimes(2)
    const next = client.rebuild(doc('after'))
    await vi.advanceTimersByTimeAsync(0)
    expect(second.calls.map((c) => c.doc.name)).toEqual(['after'])
    second.calls[0]?.reply.resolve(result('after'))
    await expect(next).resolves.toEqual(result('after'))
  })

  it('exports through the worker', async () => {
    const { handle } = fakeWorker()
    const client = new GeometryClient(() => handle)
    expect((await client.exportStl(doc('x'))).byteLength).toBe(84)
    expect((await client.export3mf(doc('x'), ['a'])).byteLength).toBe(10)
  })

  it('forwards STEP export and edge candidates to the worker', async () => {
    const step = new ArrayBuffer(3)
    const base = fakeWorker().handle
    const client = new GeometryClient(() => ({
      api: { ...base.api, exportStep: async () => step, edgeCandidates: async () => [] },
      terminate: () => undefined,
    }))
    await expect(client.exportStep(doc('x'))).resolves.toBe(step)
    await expect(client.edgeCandidates(doc('x'), 'a', 'deadbeef')).resolves.toEqual([])
  })

  it('forwards overlap checks to the worker', async () => {
    const result = { status: 'none' } as const
    const base = fakeWorker().handle
    const client = new GeometryClient(() => ({
      api: { ...base.api, overlap: async () => result },
      terminate: () => undefined,
    }))
    await expect(client.overlap(createEmptyDocument(), 'a', 'b')).resolves.toBe(result)
  })
})
