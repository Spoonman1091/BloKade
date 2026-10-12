import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { createMemoryDesignRepository } from '../persistence/memory-repository'
import { createBloKadeStore } from '../store/store'
import { openFreshDesign, openSavedDesign } from './design-session'

function setup() {
  const repo = createMemoryDesignRepository()
  const store = createBloKadeStore({ designId: 'start', doc: createEmptyDocument('Start') })
  const flushAutosave = vi.fn(async () => undefined)
  return { repo, store, session: { repo, store, flushAutosave }, flushAutosave }
}

describe('design session', () => {
  it('saves a fresh design and opens it', async () => {
    const { repo, store, session, flushAutosave } = setup()
    const id = await openFreshDesign(session, 'Lesson: Your first shape')
    expect(flushAutosave).toHaveBeenCalled()
    expect(store.getState()).toMatchObject({ designId: id, history: { present: { name: 'Lesson: Your first shape' } } })
    expect((await repo.list()).map((d) => d.id)).toContain(id)
    expect(await repo.getLastOpened()).toBe(id)
  })

  it('opens a saved design, or explains that it is gone', async () => {
    const { repo, store, session } = setup()
    await repo.save('kept', createEmptyDocument('Kept'))
    expect(await openSavedDesign(session, 'kept')).toEqual({ ok: true, value: 'kept' })
    expect(store.getState().designId).toBe('kept')
    const missing = await openSavedDesign(session, 'gone')
    expect(missing.ok).toBe(false)
    expect(store.getState().designId).toBe('kept')
  })
})
