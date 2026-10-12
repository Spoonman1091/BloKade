import { createEmptyDocument, newId } from '../document/factory'
import type { BloKadeDocument } from '../document/types'
import type { DesignRepository } from './repository'

export interface InitialDesign {
  readonly id: string
  readonly doc: BloKadeDocument
  readonly notice: string | null
}

export const DAMAGED_DESIGN = 'One of your saved designs is damaged and could not be opened.'
export const STORAGE_UNAVAILABLE =
  "Saving in this browser isn't working, so use Designs → Save to file to keep your work."

async function firstLoadable(repo: DesignRepository, ids: readonly string[]) {
  for (const [skipped, id] of ids.entries()) {
    const loaded = await repo.load(id)
    if (loaded.ok) return { id, doc: loaded.value, skipped }
  }
  return null
}

/** Opens the last design, else the newest loadable one, else a new one. Never rejects. */
export async function openInitialDesign(repo: DesignRepository): Promise<InitialDesign> {
  try {
    const last = await repo.getLastOpened()
    const listed = (await repo.list()).map((d) => d.id)
    const ids = [...new Set([last, ...listed].filter((id): id is string => typeof id === 'string'))]
    const opened = await firstLoadable(repo, ids)
    if (opened) return { id: opened.id, doc: opened.doc, notice: opened.skipped > 0 ? DAMAGED_DESIGN : null }
    const fresh = { id: newId(), doc: createEmptyDocument() }
    await repo.save(fresh.id, fresh.doc)
    return { ...fresh, notice: ids.length > 0 ? DAMAGED_DESIGN : null }
  } catch (error) {
    console.error('Design storage failed', error)
    return { id: newId(), doc: createEmptyDocument(), notice: STORAGE_UNAVAILABLE }
  }
}
