import { useCallback, useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { CarriedShape } from '../document/types'
import { carriedInUse } from '../kade/carried'
import { createShapeCatalog, namesFromChecks, type ShapeCatalog } from '../kade/catalog'
import { createEditorStore, type EditorStore } from '../kade/editor-store'
import type { LibraryShape } from '../kade/library'
import type { ShapeRegistry } from '../kade/shape-registry'
import { useShapeRegistry } from '../kade/useShapeRegistry'
import type { BloKadeStore } from '../store/store'
import type { AppDeps } from './deps'

export interface ShapeSetup {
  readonly editor: EditorStore
  readonly catalog: ShapeCatalog
  /** Built-ins, the plugins/ folder, Kade's library and the open design's carried shapes. */
  readonly registry: ShapeRegistry
  readonly library: readonly LibraryShape[]
  /** The code to copy into a design when Kade adds one of their shapes (the library's code at the moment of adding). */
  carriedCodeOf(id: string): CarriedShape | undefined
}

/** Kade's shapes for the whole app: the library, the worker's answers about the code, and the combined shape list. */
export function useShapeSetup(deps: AppDeps, store: BloKadeStore): ShapeSetup {
  const [editor] = useState(() => createEditorStore(deps.shapes))
  const [catalog] = useState(() => createShapeCatalog((code) => deps.client.inspect(code)))
  useEffect(() => {
    void editor.getState().load()
  }, [editor])
  const library = useStore(editor, (s) => s.shapes)
  // Only copies parts use: adding a shape replaces a copy no part uses, so the library's version is the one to offer.
  const carried = useStore(store, useShallow((s) => carriedInUse(s.history.present)))
  const registry = useShapeRegistry({ base: deps.registry, catalog, library, carried })
  const results = useStore(catalog, (s) => s.results)
  useEffect(() => {
    editor.getState().syncNames(namesFromChecks(library, results))
  }, [editor, library, results])
  // Read at call time, not from the last render: Add settles Kade's typing just before it asks for the code.
  const carriedCodeOf = useCallback((id: string): CarriedShape | undefined => {
    const shape = editor.getState().shapes.find((s) => s.id === id)
    return shape ? { name: shape.name, code: shape.code } : undefined
  }, [editor])
  return { editor, catalog, registry, library, carriedCodeOf }
}
