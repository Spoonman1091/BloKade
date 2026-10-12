import { newId } from '../document/factory'
import type { BloKadeDocument } from '../document/types'
import { fail, ok, type Result } from '../shared/result'

export interface DesignSummary {
  readonly id: string
  readonly name: string
  readonly updatedAt: number
}

export interface DesignRepository {
  /** Newest first. */
  list(): Promise<readonly DesignSummary[]>
  load(id: string): Promise<Result<BloKadeDocument>>
  save(id: string, doc: BloKadeDocument): Promise<void>
  remove(id: string): Promise<void>
  getLastOpened(): Promise<string | null>
  setLastOpened(id: string): Promise<void>
}

export const NOT_FOUND = "That design couldn't be found."

export const sortNewestFirst = (list: readonly DesignSummary[]): DesignSummary[] =>
  [...list].sort((a, b) => b.updatedAt - a.updatedAt)

export const upsertSummary = (list: readonly DesignSummary[], summary: DesignSummary): DesignSummary[] =>
  [...list.filter((d) => d.id !== summary.id), summary]

export async function duplicateDesign(
  repo: DesignRepository, id: string,
): Promise<Result<{ id: string; doc: BloKadeDocument }>> {
  const loaded = await repo.load(id)
  if (!loaded.ok) return loaded
  const copy = { id: newId(), doc: { ...loaded.value, name: `${loaded.value.name} copy` } }
  await repo.save(copy.id, copy.doc)
  return ok(copy)
}

export async function renameDesign(repo: DesignRepository, id: string, name: string): Promise<Result<BloKadeDocument>> {
  const trimmed = name.trim()
  if (!trimmed) return fail("Names can't be empty.")
  const loaded = await repo.load(id)
  if (!loaded.ok) return loaded
  const renamed = { ...loaded.value, name: trimmed }
  await repo.save(id, renamed)
  return ok(renamed)
}
