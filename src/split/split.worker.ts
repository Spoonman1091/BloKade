import * as Comlink from 'comlink'
import { createSplitApi, type SplitApi } from './split-api'
import { splitProgressMessage } from './split-progress'
import type { PieceMesh } from './types'

const post = (message: unknown): void => {
  (globalThis as unknown as { postMessage(message: unknown): void }).postMessage(message)
}

const inner = createSplitApi((done, total) => post(splitProgressMessage(done, total)))

/** Copies of the pieces' arrays, so sending them leaves the worker's own pieces intact for Save. */
const sendable = (pieces: readonly PieceMesh[]): { pieces: PieceMesh[]; buffers: Transferable[] } => {
  const copies = pieces.map((p) => ({ ...p, vertices: p.vertices.slice(), triangles: p.triangles.slice() }))
  return { pieces: copies, buffers: copies.flatMap((p) => [p.vertices.buffer, p.triangles.buffer]) }
}

const api: SplitApi = {
  open: async (bytes, unit) => {
    const result = await inner.open(bytes, unit)
    if (!result.ok) return result
    const { vertices, triangles } = result.value.preview
    return Comlink.transfer(result, [vertices.buffer, triangles.buffer])
  },
  plan: (plate, settings) => inner.plan(plate, settings),
  pieces: async (plan, settings, plate) => {
    const result = await inner.pieces(plan, settings, plate)
    if (!result.ok) return result
    const { pieces, buffers } = sendable(result.value.pieces)
    return Comlink.transfer({ ok: true as const, value: { ...result.value, pieces } }, buffers)
  },
  save: async (name) => {
    const result = await inner.save(name)
    return result.ok ? Comlink.transfer(result, [result.value.buffer]) : result
  },
}

Comlink.expose(api)
