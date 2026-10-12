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
  /**
   * Kade's shapes for the My shapes palette: the library first, then shapes only the design carries.
   * A shape the design carries is offered as the design's copy (what Add would use), and left out if that copy is broken.
   */
  mine(): readonly ShapePlugin[]
}

/**
 * The page's shape list: built-ins and plugins/ folder files, then Kade's library, then the design's carried shapes.
 * A part uses the version its design carries. `carried` should be the shapes the design's parts use.
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
  const ownCopy = (p: ShapePlugin): ShapePlugin[] => {
    if (!Object.hasOwn(carried, p.id)) return [p]
    const copy = designById.get(p.id)
    return copy ? [copy] : []
  }
  const mine = [...fromLibrary.flatMap(ownCopy), ...fromDesign.filter((p) => !libraryById.has(p.id))]
  const list = [...base.list(), ...mine]
  return {
    // A design that carries a shape only ever uses its own version, even if that one is broken or unchecked.
    get: (id) => base.get(id) ?? (Object.hasOwn(carried, id) ? designById.get(id) : libraryById.get(id)),
    list: () => list,
    mine: () => mine,
  }
}
