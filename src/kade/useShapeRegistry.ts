import { useEffect, useMemo } from 'react'
import { useStore } from 'zustand'
import type { CarriedShape } from '../document/types'
import type { PluginRegistry } from '../plugins/registry'
import type { ShapeCatalog } from './catalog'
import type { LibraryShape } from './library'
import { buildShapeRegistry, type ShapeRegistry } from './shape-registry'

interface Input {
  readonly base: PluginRegistry
  readonly catalog: ShapeCatalog
  readonly library: readonly LibraryShape[]
  readonly carried: Readonly<Record<string, CarriedShape>>
}

/** The combined shape list, rebuilt when the library, the carried shapes or the worker's answers change. */
export function useShapeRegistry({ base, catalog, library, carried }: Input): ShapeRegistry {
  const results = useStore(catalog, (s) => s.results)
  useEffect(() => {
    const { request } = catalog.getState()
    for (const shape of library) request(shape.code)
    for (const shape of Object.values(carried)) request(shape.code)
  }, [catalog, library, carried])
  return useMemo(() => buildShapeRegistry({ base, library, carried, results }), [base, library, carried, results])
}
