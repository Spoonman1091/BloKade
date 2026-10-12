import { describe, expect, it } from 'vitest'
import { migrateDocument } from './migrate'

describe('migrateDocument', () => {
  it('passes current documents through', () => {
    expect(migrateDocument({ schemaVersion: 1, name: 'x' })).toEqual({ ok: true, value: { schemaVersion: 1, name: 'x' } })
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
