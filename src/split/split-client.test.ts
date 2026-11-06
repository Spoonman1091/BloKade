import { describe, expect, it } from 'vitest'
import { UNEXPECTED_MESSAGE } from './constants'
import { createSplitApi, type SplitApi } from './split-api'
import { SplitCancelled, createSplitClient, type SplitWorkerHandle } from './split-client'
import { plateStl } from './test-meshes'
import type { Plate, SplitSettings } from './types'

const PLATE: Plate = { width: 180, depth: 180 }
const SETTINGS: SplitSettings = { joint: 'tabs', fitGap: 0.2, numbers: true, baseThickness: 6.4 }
const file = (): ArrayBuffer => plateStl({ width: 300, depth: 300, base: 6.4 })

/** A "worker" that is really an in-process api; `hang` makes plan never answer, like a stuck worker. */
function fakeSpawner() {
  const handles: { api: SplitApi; terminated: boolean; opens: number; emit(done: number, total: number): void }[] = []
  let hang = false
  const spawn = (): SplitWorkerHandle => {
    const listeners = new Set<(done: number, total: number) => void>()
    const inner = createSplitApi((d, t) => listeners.forEach((l) => l(d, t)))
    const record = { api: inner, terminated: false, opens: 0, emit: (d: number, t: number) => listeners.forEach((l) => l(d, t)) }
    const api: SplitApi = {
      open: (bytes, unit) => { record.opens++; return inner.open(bytes, unit) },
      plan: (plate, settings) => (hang ? new Promise(() => undefined) : inner.plan(plate, settings)),
      pieces: (plan, settings, plate) => inner.pieces(plan, settings, plate),
      save: (name) => inner.save(name),
    }
    handles.push(record)
    return { api, terminate: () => { record.terminated = true }, onProgress: (fn) => { listeners.add(fn); return () => listeners.delete(fn) } }
  }
  return { spawn, handles, setHang: (value: boolean) => { hang = value } }
}

describe('createSplitClient', () => {
  it('passes calls through and forwards progress', async () => {
    const { spawn, handles } = fakeSpawner()
    const client = createSplitClient(spawn)
    const seen: [number, number][] = []
    const off = client.onProgress((d, t) => seen.push([d, t]))
    expect((await client.open(file(), 'mm')).ok).toBe(true)
    handles[0]?.emit(1, 4)
    off()
    handles[0]?.emit(2, 4)
    expect(seen).toEqual([[1, 4]])
    client.dispose()
    expect(handles[0]?.terminated).toBe(true)
  })

  it('keeps the caller buffer intact', async () => {
    const { spawn } = fakeSpawner()
    const client = createSplitClient(spawn)
    const bytes = file()
    const length = bytes.byteLength
    await client.open(bytes, 'mm')
    expect(bytes.byteLength).toBe(length)
  })

  it('cancel restarts the worker, settles the call in flight, and re-opens the model for the next call', async () => {
    const { spawn, handles, setHang } = fakeSpawner()
    const client = createSplitClient(spawn)
    await client.open(file(), 'mm')
    setHang(true)
    const stuck = client.plan(PLATE, SETTINGS)
    client.cancel()
    await expect(stuck).rejects.toBeInstanceOf(SplitCancelled)
    expect(handles).toHaveLength(2)
    expect(handles[0]?.terminated).toBe(true)
    setHang(false)
    const plan = await client.plan(PLATE, SETTINGS)
    expect(plan.ok).toBe(true)
    expect(handles[1]?.opens).toBe(1)
    const again = await client.plan(PLATE, SETTINGS)
    expect(again.ok).toBe(true)
    expect(handles[1]?.opens).toBe(1)
  })

  it('has nothing to re-open when no model was opened', async () => {
    const { spawn } = fakeSpawner()
    const client = createSplitClient(spawn)
    client.cancel()
    const result = await client.plan(PLATE, SETTINGS)
    expect(result).toEqual({ ok: false, message: UNEXPECTED_MESSAGE })
  })
})
