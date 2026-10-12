import { GeometryClient } from '../../geometry/client'
import type { GeometryApi } from '../../geometry/types'
import { createMemoryDesignRepository } from '../../persistence/memory-repository'
import { registry } from '../../plugins/index'
import type { AppDeps } from '../deps'

export function fakeGeometryApi(overrides: Partial<GeometryApi> = {}): GeometryApi {
  return {
    rebuild: async () => ({ nodes: {} }),
    exportStl: async () => new ArrayBuffer(84),
    export3mf: async () => new ArrayBuffer(22),
    exportStep: async () => new TextEncoder().encode('ISO-10303-21;').buffer as ArrayBuffer,
    edgeCandidates: async () => [],
    overlap: async () => ({ status: 'none' }),
    ...overrides,
  }
}

export function fakeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    repo: createMemoryDesignRepository(),
    client: new GeometryClient(() => ({ api: fakeGeometryApi(), terminate: () => undefined })),
    registry,
    pluginProblems: [],
    openTabChannel: () => null,
    ...overrides,
  }
}
