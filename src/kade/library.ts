import { createStore, del, entries, set } from 'idb-keyval'
import { z } from 'zod'
import { newId } from '../document/factory'
import { MAX_SHAPE_CODE_LENGTH, MAX_SHAPE_NAME_LENGTH, SHAPE_ID_PATTERN } from '../document/types'

/** One of Kade's shapes, kept in this browser. */
export interface LibraryShape {
  readonly id: string
  readonly name: string
  readonly code: string
  readonly updatedAt: number
}

export interface ShapeLibraryRepo {
  /** Sorted by name. Damaged entries are skipped. */
  list(): Promise<readonly LibraryShape[]>
  save(shape: LibraryShape): Promise<void>
  remove(id: string): Promise<void>
}

const libraryShape = z.object({
  id: z.string().regex(SHAPE_ID_PATTERN),
  name: z.string().min(1).max(MAX_SHAPE_NAME_LENGTH),
  code: z.string().max(MAX_SHAPE_CODE_LENGTH),
  updatedAt: z.number(),
})

/** Ids for Kade's shapes. Kade never types one. */
export const newShapeId = (): string => `my-${newId().slice(0, 10)}`

export const sortByName = (shapes: readonly LibraryShape[]): LibraryShape[] =>
  [...shapes].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))

export function shapeFileName(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `${slug || 'shape'}.js`
}

function goodShapes(raw: readonly unknown[]): LibraryShape[] {
  const parsed = raw.map((value) => libraryShape.safeParse(value))
  const damaged = parsed.filter((p) => !p.success).length
  if (damaged > 0) console.error(`Skipped ${damaged} damaged shape(s) in Kade's shape library.`)
  return parsed.flatMap((p) => (p.success ? [p.data] : []))
}

/** Kade's shapes in their own IndexedDB database, next to the designs. */
export function createIdbShapeLibrary(dbName = 'blokade-shapes'): ShapeLibraryRepo {
  const store = createStore(dbName, 'shapes')
  return {
    list: async () => sortByName(goodShapes((await entries(store)).map(([, value]) => value))),
    save: (shape) => set(shape.id, shape, store),
    remove: (id) => del(id, store),
  }
}

/** Tests, and a stand-in for browsers where IndexedDB is blocked. */
export function createMemoryShapeLibrary(initial: readonly LibraryShape[] = []): ShapeLibraryRepo {
  let shapes: ReadonlyMap<string, LibraryShape> = new Map(initial.map((s) => [s.id, s]))
  return {
    list: async () => sortByName([...shapes.values()]),
    save: async (shape) => {
      shapes = new Map([...shapes, [shape.id, shape]])
    },
    remove: async (id) => {
      shapes = new Map([...shapes].filter(([key]) => key !== id))
    },
  }
}
