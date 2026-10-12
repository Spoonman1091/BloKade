import { createEmptyDocument, newId } from '../document/factory'
import type { BloKadeDocument } from '../document/types'
import { nextUntitledName } from './design-names'
import { NOT_FOUND, type DesignRepository } from './repository'

export interface InitialDesign {
  readonly id: string
  readonly doc: BloKadeDocument
  readonly notice: string | null
}

export const DAMAGED_DESIGN = 'One of your saved designs is damaged and could not be opened.'
export const STORAGE_UNAVAILABLE =
  "Saving in this browser isn't working, so use Designs → Save to file to keep your work."

async function firstLoadable(repo: DesignRepository, ids: readonly string[]) {
  let damaged = 0
  for (const id of ids) {
    try {
      const loaded = await repo.load(id)
      if (loaded.ok) return { id, doc: loaded.value, damaged }
      if (loaded.error !== NOT_FOUND) damaged += 1
    } catch (error) {
      console.error('Could not load design', id, error)
      damaged += 1
    }
  }
  return { id: null, doc: null, damaged }
}

/** Opens the last design, else the newest loadable one, else a new one. Never rejects. */
export async function openInitialDesign(repo: DesignRepository): Promise<InitialDesign> {
  try {
    const last = await repo.getLastOpened()
    const listed = await repo.list()
    const ids = [...new Set([last, ...listed.map((d) => d.id)].filter((id): id is string => typeof id === 'string'))]
    const opened = await firstLoadable(repo, ids)
    const notice = opened.damaged > 0 ? DAMAGED_DESIGN : null
    if (opened.id !== null) return { id: opened.id, doc: opened.doc, notice }
    const fresh = { id: newId(), doc: createEmptyDocument(nextUntitledName(listed.map((d) => d.name))) }
    await repo.save(fresh.id, fresh.doc)
    return { ...fresh, notice }
  } catch (error) {
    console.error('Design storage failed', error)
    return { id: newId(), doc: createEmptyDocument(), notice: STORAGE_UNAVAILABLE }
  }
}
