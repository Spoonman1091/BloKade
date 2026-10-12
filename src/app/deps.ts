import { GeometryClient } from '../geometry/client'
import { spawnGeometryWorker } from '../geometry/spawn'
import { createIdbDesignRepository } from '../persistence/idb-repository'
import type { DesignRepository } from '../persistence/repository'
import { openTabChannel, type TabChannel } from '../persistence/tab-guard'
import { pluginProblems, registry } from '../plugins/index'
import type { PluginRegistry } from '../plugins/registry'

export interface AppDeps {
  readonly repo: DesignRepository
  readonly client: GeometryClient
  readonly registry: PluginRegistry
  readonly pluginProblems: readonly string[]
  /** Channel used to notice the same design open in another tab (null = not supported). */
  readonly openTabChannel: () => TabChannel | null
}

export function createAppDeps(): AppDeps {
  return { repo: createIdbDesignRepository(), client: new GeometryClient(spawnGeometryWorker), registry, pluginProblems, openTabChannel }
}
