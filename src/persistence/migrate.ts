import { CURRENT_SCHEMA_VERSION, DEFAULT_FIT } from '../document/types'
import { fail, ok, type Result } from '../shared/result'

export type Migration = (doc: Readonly<Record<string, unknown>>) => Record<string, unknown>

const asRecord = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : {}

/** MIGRATIONS[n] upgrades a version-n document to version n + 1. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // Version 2 (Milestone 2) adds design variables and the `fit` gap.
  1: (doc) => ({ ...doc, variables: [], settings: { ...asRecord(doc.settings), fit: DEFAULT_FIT } }),
  // Version 3 (Milestone 3) adds optional modifiers; older parts simply have none.
  2: (doc) => ({ ...doc }),
  // Version 4 (Milestone 6) lets a design carry the code of Kade's own shapes.
  3: (doc) => ({ ...doc, plugins: {} }),
}

const NOT_A_DESIGN = "This file isn't a BloKade design."

export function migrateDocument(
  raw: unknown, current: number = CURRENT_SCHEMA_VERSION, migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): Result<unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return fail(NOT_A_DESIGN)
  const doc = raw as Readonly<Record<string, unknown>>
  const start = doc.schemaVersion
  if (typeof start !== 'number' || !Number.isInteger(start) || start < 1) return fail(NOT_A_DESIGN)
  if (start > current) return fail('This design was made with a newer version of BloKade. Update BloKade to open it.')
  const steps = Array.from({ length: current - start }, (_, i) => start + i)
  const missing = steps.find((version) => !migrations[version])
  if (missing !== undefined) return fail(`BloKade can't upgrade designs from version ${missing}.`)
  return ok(steps.reduce<Readonly<Record<string, unknown>>>((acc, version) => {
    const migrate = migrations[version]
    return migrate ? { ...migrate(acc), schemaVersion: version + 1 } : acc
  }, doc))
}
