import { createStore, del, get, set, update } from 'idb-keyval'
import { fail } from '../shared/result'
import { parseDesign } from './design-file'
import { NOT_FOUND, sortNewestFirst, upsertSummary, type DesignRepository, type DesignSummary } from './repository'

const INDEX_KEY = 'index'
const LAST_OPENED_KEY = 'last-opened'
const designKey = (id: string): string => `design:${id}`

export function createIdbDesignRepository(
  options: { dbName?: string; now?: () => number } = {},
): DesignRepository {
  const store = createStore(options.dbName ?? 'blokade', 'designs')
  const now = options.now ?? Date.now

  return {
    list: async () => sortNewestFirst((await get<DesignSummary[]>(INDEX_KEY, store)) ?? []),
    load: async (id) => {
      const raw: unknown = await get(designKey(id), store)
      return raw === undefined ? fail(NOT_FOUND) : parseDesign(raw)
    },
    save: async (id, doc) => {
      await set(designKey(id), doc, store)
      await update<DesignSummary[]>(INDEX_KEY, (old) => upsertSummary(old ?? [], { id, name: doc.name, updatedAt: now() }), store)
    },
    remove: async (id) => {
      await del(designKey(id), store)
      await update<DesignSummary[]>(INDEX_KEY, (old) => (old ?? []).filter((d) => d.id !== id), store)
    },
    getLastOpened: async () => (await get<string>(LAST_OPENED_KEY, store)) ?? null,
    setLastOpened: async (id) => set(LAST_OPENED_KEY, id, store),
  }
}
