import { GeometryClient } from '../../geometry/client'
import type { GeometryApi } from '../../geometry/types'
import { createMemoryShapeLibrary } from '../../kade/library'
import type { InspectResult } from '../../kade/meta'
import { createMemoryDesignRepository } from '../../persistence/memory-repository'
import { registry } from '../../plugins/index'
import type { AppDeps } from '../deps'
import { boxMesh } from './meshes'

/**
 * Tests only: reads `name: '…'` and `icon: '…'` from the code and reports one Size setting. Code containing BROKEN
 * gets a problem. The real check runs Kade's code in the worker.
 */
export function fakeInspect(code: string): InspectResult {
  if (code.includes('BROKEN')) return { ok: false, problem: 'Line 1: this test shape is broken.' }
  const name = code.match(/name:\s*'([^']*)'/)?.[1] ?? 'Shape'
  const icon = code.match(/icon:\s*'([^']*)'/)?.[1] ?? '🧩'
  return { ok: true, meta: { name, icon, params: { size: { type: 'mm', default: 20, label: 'Size' } } } }
}

export function fakeGeometryApi(overrides: Partial<GeometryApi> = {}): GeometryApi {
  return {
    rebuild: async () => ({ nodes: {} }),
    exportStl: async () => new ArrayBuffer(84),
    export3mf: async () => new ArrayBuffer(22),
    exportStep: async () => new TextEncoder().encode('ISO-10303-21;').buffer as ArrayBuffer,
    edgeCandidates: async () => [],
    overlap: async () => ({ status: 'none' }),
    inspect: async (code) => fakeInspect(code),
    ...overrides,
  }
}

export function fakeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    repo: createMemoryDesignRepository(),
    client: new GeometryClient(() => ({ api: fakeGeometryApi(), terminate: () => undefined })),
    registry,
    pluginProblems: [],
    shapes: createMemoryShapeLibrary(),
    openTabChannel: () => null,
    ...overrides,
  }
}

/** A geometry api that builds every top-level part as a 20 mm box, so previews show and "it works" checks pass. */
export function buildingGeometryApi(): GeometryApi {
  return fakeGeometryApi({
    rebuild: async (doc) => ({ nodes: Object.fromEntries(doc.root.map((id) => [id, { status: 'ok' as const, mesh: boxMesh(20, 20, 20) }])) }),
  })
}

export const clientFor = (api: GeometryApi): GeometryClient => new GeometryClient(() => ({ api, terminate: () => undefined }))
