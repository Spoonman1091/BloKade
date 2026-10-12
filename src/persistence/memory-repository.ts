import { fail } from '../shared/result'
import { parseDesign } from './design-file'
import { NOT_FOUND, sortNewestFirst, upsertSummary, type DesignRepository, type DesignSummary } from './repository'

/** In-memory designs; used by tests and as a fallback. Seed values may be deliberately damaged. */
export function createMemoryDesignRepository(
  options: { seed?: Readonly<Record<string, unknown>>; now?: () => number } = {},
): DesignRepository {
  const now = options.now ?? Date.now
  const designs = new Map<string, unknown>(Object.entries(options.seed ?? {}))
  let index: readonly DesignSummary[] = Object.keys(options.seed ?? {}).map((id) => ({ id, name: id, updatedAt: 0 }))
  let lastOpened: string | null = null

  return {
    list: async () => sortNewestFirst(index),
    load: async (id) => (designs.has(id) ? parseDesign(structuredClone(designs.get(id))) : fail(NOT_FOUND)),
    save: async (id, doc) => {
      designs.set(id, structuredClone(doc))
      index = upsertSummary(index, { id, name: doc.name, updatedAt: now() })
    },
    remove: async (id) => {
      designs.delete(id)
      index = index.filter((d) => d.id !== id)
      if (lastOpened === id) lastOpened = null
    },
    getLastOpened: async () => lastOpened,
    setLastOpened: async (id) => {
      lastOpened = id
    },
  }
}
