import { createEmptyDocument, newId } from '../document/factory'
import type { BloKadeDocument } from '../document/types'
import type { DesignRepository } from '../persistence/repository'
import { ok, type Result } from '../shared/result'
import type { BloKadeStore } from '../store/store'

/** What it takes to switch the open design safely: save the current one first, then remember the new one. */
export interface DesignSession {
  readonly repo: DesignRepository
  readonly store: BloKadeStore
  flushAutosave(): Promise<void>
}

export async function switchToDesign(session: DesignSession, id: string, doc: BloKadeDocument): Promise<void> {
  await session.flushAutosave()
  session.store.getState().openDesign(id, doc)
  await session.repo.setLastOpened(id)
}

/** Saves a new empty design called `name` and opens it. Returns its id. */
export async function openFreshDesign(session: DesignSession, name: string): Promise<string> {
  await session.flushAutosave()
  const id = newId()
  const doc = createEmptyDocument(name)
  await session.repo.save(id, doc)
  await switchToDesign(session, id, doc)
  return id
}

export async function openSavedDesign(session: DesignSession, id: string): Promise<Result<string>> {
  const loaded = await session.repo.load(id)
  if (!loaded.ok) return loaded
  await switchToDesign(session, id, loaded.value)
  return ok(id)
}
