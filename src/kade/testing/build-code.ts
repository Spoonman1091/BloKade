import type { Shape3D } from 'replicad'
import { resolveParams } from '../../plugins/params'
import type { ShapePlugin } from '../../plugins/types'
import { readShapeDefinition } from '../definition'
import type { ShapeMeta } from '../meta'
import { runKadeBuild } from '../run-build'
import { fileModuleLoader } from './file-loader'

/** Node tests: load Kade's code, check it, and build it with its default settings (plus `values`). */
export async function buildKadeCode(
  code: string, values: Readonly<Record<string, unknown>> = {},
): Promise<{ shape: Shape3D; meta: ShapeMeta; dispose(): void }> {
  const loaded = await fileModuleLoader(code)
  const definition = readShapeDefinition(loaded.exports)
  if (!definition.ok) {
    loaded.dispose()
    throw new Error(definition.error)
  }
  const { meta, build } = definition.value
  const plugin: ShapePlugin = { id: 'test', name: meta.name, icon: meta.icon, version: 1, params: meta.params, build: () => { throw new Error('unused') } }
  const shape = runKadeBuild(build, resolveParams(plugin, values), loaded.source)
  return { shape, meta, dispose: () => { shape.delete(); loaded.dispose() } }
}
