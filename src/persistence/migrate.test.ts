import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { migrateDocument } from './migrate'

describe('migrateDocument', () => {
  it('passes current documents through', () => {
    expect(migrateDocument({ schemaVersion: 5, name: 'x' })).toEqual({ ok: true, value: { schemaVersion: 5, name: 'x' } })
  })

  it('gives version 3 designs an empty list of carried shapes', () => {
    const v3 = { ...createEmptyDocument(), schemaVersion: 3 } as Record<string, unknown>
    delete v3.plugins
    const result = migrateDocument(v3)
    expect(result.ok && result.value).toMatchObject({ schemaVersion: 5, plugins: {}, models: {} })
  })

  it('gives version 4 designs an empty list of imported models', () => {
    const v4 = { ...createEmptyDocument(), schemaVersion: 4 } as Record<string, unknown>
    delete v4.models
    const result = migrateDocument(v4)
    expect(result.ok && result.value).toMatchObject({ schemaVersion: 5, models: {} })
  })

  it('upgrades version 1 designs with no variables and the default fit gap', () => {
    expect(migrateDocument({ schemaVersion: 1, name: 'x', settings: { gridSnap: 0.5 } })).toEqual({
      ok: true,
      value: { schemaVersion: 5, name: 'x', settings: { gridSnap: 0.5, fit: 0.2 }, variables: [], plugins: {}, models: {} },
    })
  })

  it('upgrades version 2 designs without changing them', () => {
    expect(migrateDocument({ schemaVersion: 2, name: 'x', variables: [] })).toEqual({
      ok: true, value: { schemaVersion: 5, name: 'x', variables: [], plugins: {}, models: {} },
    })
  })

  it('runs migrations in order', () => {
    const migrations = {
      1: (d: Readonly<Record<string, unknown>>) => ({ ...d, a: true }),
      2: (d: Readonly<Record<string, unknown>>) => ({ ...d, b: d.a === true }),
    }
    expect(migrateDocument({ schemaVersion: 1 }, 3, migrations)).toEqual({
      ok: true, value: { schemaVersion: 3, a: true, b: true },
    })
  })

  it('refuses newer designs', () => {
    expect(migrateDocument({ schemaVersion: 9 })).toEqual({
      ok: false, error: 'This design was made with a newer version of BloKade. Update BloKade to open it.',
    })
  })

  it('refuses things that are not designs', () => {
    for (const raw of [null, 'text', [], { schemaVersion: 'one' }, { schemaVersion: 0 }]) {
      expect(migrateDocument(raw).ok).toBe(false)
    }
  })

  it('refuses when a migration step is missing', () => {
    expect(migrateDocument({ schemaVersion: 1 }, 2, {}).ok).toBe(false)
  })
})
