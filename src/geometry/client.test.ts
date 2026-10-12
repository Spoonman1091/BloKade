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

function fakeWorker(running: readonly string[] = []) {
  const calls: { doc: BloKadeDocument; channel?: string; reply: Deferred<BuildResult> }[] = []
  const skipped: (readonly string[])[] = []
  const handle: WorkerHandle = {
    api: {
      rebuild: (doc, channel) => {
        const reply = deferred<BuildResult>()
        calls.push({ doc, channel, reply })
        return reply.promise
      },
      exportStl: async () => new ArrayBuffer(84),
      export3mf: async () => new ArrayBuffer(10),
      exportStep: async () => new ArrayBuffer(5),
      edgeCandidates: async () => [],
      overlap: async () => ({ status: 'none' }),
      inspect: async () => ({ ok: false, problem: 'unused' }),
      skipShapes: async (hashes) => { skipped.push(hashes) },
    },
    terminate: vi.fn(),
    runningShapes: () => running,
  }
  return { handle, calls, skipped }
}

const doc = (name: string) => createEmptyDocument(name)
const result = (tag: string): BuildResult => ({ nodes: { [tag]: { status: 'error', message: tag } } })
const never = <T>() => new Promise<T>(() => undefined)
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

  it('blames the code a stuck worker was running, and tells every new worker to skip it', async () => {
    vi.useFakeTimers()
    const first = fakeWorker(['loop-a'])
    const second = fakeWorker(['loop-b'])
    const third = fakeWorker()
    const spawn = vi.fn().mockReturnValueOnce(first.handle).mockReturnValueOnce(second.handle).mockReturnValueOnce(third.handle)
    const client = new GeometryClient(spawn, 30_000)
    const stuck = client.rebuild(doc('one'))
    const blamed = expect(stuck).rejects.toMatchObject({ name: 'GeometryTimeoutError', shapes: ['loop-a'] })
    await vi.advanceTimersByTimeAsync(30_000)
    await blamed
    expect(second.skipped).toEqual([['loop-a']])
    const again = client.rebuild(doc('two'))
    const blamedAgain = expect(again).rejects.toMatchObject({ shapes: ['loop-b'] })
    await vi.advanceTimersByTimeAsync(30_000)
    await blamedAgain
    expect(third.skipped).toEqual([['loop-a', 'loop-b']])
  })

  it('blames nothing when the worker was not running any of Kade\'s code', async () => {
    vi.useFakeTimers()
    const second = fakeWorker()
    const client = new GeometryClient(vi.fn().mockReturnValueOnce(fakeWorker().handle).mockReturnValueOnce(second.handle), 30_000)
    const stuck = client.rebuild(doc('one'))
    const blamed = expect(stuck).rejects.toMatchObject({ shapes: [] })
    await vi.advanceTimersByTimeAsync(30_000)
    await blamed
    expect(second.skipped).toEqual([])
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

describe('GeometryClient channels', () => {
  it('keeps one waiting rebuild per channel, so the preview never replaces the design', async () => {
    const { handle, calls } = fakeWorker()
    const client = new GeometryClient(() => handle)
    const first = client.rebuild(doc('one'))
    const preview = client.rebuild(doc('shape'), 'preview')
    const design = client.rebuild(doc('two'))
    calls[0]?.reply.resolve(result('one'))
    await first
    await flush()
    expect(calls[1]?.doc.name).toBe('two')
    calls[1]?.reply.resolve(result('two'))
    await expect(design).resolves.toEqual(result('two'))
    await flush()
    expect(calls[0]?.channel).toBe('design')
    expect(calls[2]).toMatchObject({ channel: 'preview' })
    calls[2]?.reply.resolve(result('shape'))
    await expect(preview).resolves.toEqual(result('shape'))
  })
  it('replaces a waiting preview with a newer one', async () => {
    const { handle, calls } = fakeWorker()
    const client = new GeometryClient(() => handle)
    void client.rebuild(doc('busy'))
    const old = client.rebuild(doc('a'), 'preview')
    void client.rebuild(doc('b'), 'preview')
    await expect(old).resolves.toBeNull()
    calls[0]?.reply.resolve(result('busy'))
    await flush()
    expect(calls[1]?.doc.name).toBe('b')
    expect(calls[1]?.channel).toBe('preview')
  })
})

describe('GeometryClient with runaway code', () => {
  it('restarts the worker when checking code never finishes', async () => {
    const stuck = fakeWorker()
    stuck.handle.api.inspect = () => never()
    const fresh = fakeWorker()
    const spawn = vi.fn().mockReturnValueOnce(stuck.handle).mockReturnValueOnce(fresh.handle)
    const client = new GeometryClient(spawn, 20)
    await expect(client.inspect('while (true) {}')).rejects.toBeInstanceOf(GeometryTimeoutError)
    expect(stuck.handle.terminate).toHaveBeenCalled()
    const next = client.rebuild(doc('after'))
    await flush()
    fresh.calls[0]?.reply.resolve(result('after'))
    await expect(next).resolves.toEqual(result('after'))
  })
  it('restarts the worker when a preview build never finishes, then builds the design', async () => {
    const stuck = fakeWorker()
    const fresh = fakeWorker()
    const spawn = vi.fn().mockReturnValueOnce(stuck.handle).mockReturnValueOnce(fresh.handle)
    const client = new GeometryClient(spawn, 20)
    await expect(client.rebuild(doc('loop'), 'preview')).rejects.toBeInstanceOf(GeometryTimeoutError)
    const next = client.rebuild(doc('design'))
    await flush()
    fresh.calls[0]?.reply.resolve(result('design'))
    await expect(next).resolves.toEqual(result('design'))
  })
  it('passes inspect results through', async () => {
    const { handle } = fakeWorker()
    handle.api.inspect = async () => ({ ok: false, problem: 'nope' })
    await expect(new GeometryClient(() => handle).inspect('x')).resolves.toEqual({ ok: false, problem: 'nope' })
  })
  it('does not send a check to the worker while a design rebuild is running', async () => {
    const { handle, calls } = fakeWorker()
    const inspect = vi.fn(async () => ({ ok: false, problem: 'x' }) as const)
    handle.api.inspect = inspect
    const client = new GeometryClient(() => handle)
    const design = client.rebuild(doc('one'))
    const checked = client.inspect('code')
    await flush()
    expect(inspect).not.toHaveBeenCalled()
    calls[0]?.reply.resolve(result('one'))
    await design
    await expect(checked).resolves.toEqual({ ok: false, problem: 'x' })
    expect(inspect).toHaveBeenCalledWith('code')
  })
  it('runs a design rebuild on the fresh worker after a stuck check', async () => {
    const stuck = fakeWorker()
    stuck.handle.api.inspect = () => never()
    const fresh = fakeWorker()
    const spawn = vi.fn().mockReturnValueOnce(stuck.handle).mockReturnValueOnce(fresh.handle)
    const client = new GeometryClient(spawn, 20)
    const checked = client.inspect('while (true) {}')
    const design = client.rebuild(doc('design'))
    await expect(checked).rejects.toBeInstanceOf(GeometryTimeoutError)
    await flush()
    expect(stuck.calls).toHaveLength(0)
    fresh.calls[0]?.reply.resolve(result('design'))
    await expect(design).resolves.toEqual(result('design'))
  })
  it('runs a preview that waited behind a stuck design on the fresh worker', async () => {
    const stuck = fakeWorker()
    const fresh = fakeWorker()
    const spawn = vi.fn().mockReturnValueOnce(stuck.handle).mockReturnValueOnce(fresh.handle)
    const client = new GeometryClient(spawn, 20)
    const design = client.rebuild(doc('loop'))
    const preview = client.rebuild(doc('shape'), 'preview')
    await expect(design).rejects.toBeInstanceOf(GeometryTimeoutError)
    await flush()
    expect(fresh.calls[0]).toMatchObject({ channel: 'preview' })
    fresh.calls[0]?.reply.resolve(result('shape'))
    await expect(preview).resolves.toEqual(result('shape'))
  })
})
