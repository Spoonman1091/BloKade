import { GeometryClient } from '../geometry/client'
import { spawnGeometryWorker } from '../geometry/spawn'
import { createIdbDesignRepository } from '../persistence/idb-repository'
import type { DesignRepository } from '../persistence/repository'
import { pluginProblems, registry } from '../plugins/index'
import type { PluginRegistry } from '../plugins/registry'

export interface AppDeps {
  readonly repo: DesignRepository
  readonly client: GeometryClient
  readonly registry: PluginRegistry
  readonly pluginProblems: readonly string[]
}

export function createAppDeps(): AppDeps {
  return { repo: createIdbDesignRepository(), client: new GeometryClient(spawnGeometryWorker), registry, pluginProblems }
}
