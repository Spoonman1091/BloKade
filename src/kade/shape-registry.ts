import type { CarriedShape } from '../document/types'
import type { PluginRegistry } from '../plugins/registry'
import type { ShapePlugin } from '../plugins/types'
import { resultFor, type CatalogState } from './catalog'
import { codeHash } from './hash'
import type { LibraryShape } from './library'
import { metaToPlugin } from './meta'

export interface ShapeSources {
  readonly base: PluginRegistry
  readonly library: readonly LibraryShape[]
  readonly carried: Readonly<Record<string, CarriedShape>>
  readonly results: CatalogState['results']
}

export interface ShapeRegistry extends PluginRegistry {
  /** Kade's shapes for the My shapes palette: the library first, then shapes only the design carries. */
  mine(): readonly ShapePlugin[]
}

/**
 * The page's shape list: built-ins and plugins/ folder files, then Kade's library, then the design's carried shapes.
 * A part uses the version its design carries; the palette shows the library's.
 */
export function buildShapeRegistry({ base, library, carried, results }: ShapeSources): ShapeRegistry {
  const pluginOf = (id: string, code: string): ShapePlugin[] => {
    if (base.get(id)) return []
    const result = resultFor(results, code)
    return result?.ok ? [metaToPlugin(id, result.meta, codeHash(code))] : []
  }
  const fromLibrary = library.flatMap((shape) => pluginOf(shape.id, shape.code))
  const fromDesign = Object.entries(carried).flatMap(([id, shape]) => pluginOf(id, shape.code))
  const libraryById = new Map(fromLibrary.map((p) => [p.id, p]))
  const designById = new Map(fromDesign.map((p) => [p.id, p]))
  const mine = [...fromLibrary, ...fromDesign.filter((p) => !libraryById.has(p.id))]
  const list = [...base.list(), ...mine]
  return {
    get: (id) => base.get(id) ?? designById.get(id) ?? libraryById.get(id),
    list: () => list,
    mine: () => mine,
  }
}
