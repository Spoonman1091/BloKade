import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { DAMAGED_DESIGN, openInitialDesign, STORAGE_UNAVAILABLE } from './bootstrap'
import { createMemoryDesignRepository } from './memory-repository'
import type { DesignRepository } from './repository'

describe('openInitialDesign', () => {
  it('creates and saves a new design the first time', async () => {
    const repo = createMemoryDesignRepository()
    const opened = await openInitialDesign(repo)
    expect(opened.notice).toBeNull()
    expect(opened.doc.root).toEqual([])
    expect((await repo.list()).map((d) => d.id)).toEqual([opened.id])
  })

  it('does not reuse the name of a damaged design when starting fresh', async () => {
    const repo = createMemoryDesignRepository({ seed: { 'Untitled design': { schemaVersion: 1 } } })
    const opened = await openInitialDesign(repo)
    expect(opened.doc.name).toBe('Untitled design 2')
  })

  it('reopens the last design', async () => {
    const repo = createMemoryDesignRepository()
    await repo.save('a', createEmptyDocument('A'))
    await repo.save('b', createEmptyDocument('B'))
    await repo.setLastOpened('a')
    expect((await openInitialDesign(repo)).doc.name).toBe('A')
  })

  it('skips a damaged design and says so', async () => {
    const repo = createMemoryDesignRepository({ seed: { bad: { schemaVersion: 1 } } })
    await repo.save('good', createEmptyDocument('Good'))
    await repo.setLastOpened('bad')
    const opened = await openInitialDesign(repo)
    expect(opened.doc.name).toBe('Good')
    expect(opened.notice).toBe(DAMAGED_DESIGN)
  })

  it('starts fresh with a warning when storage is broken', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken: DesignRepository = {
      list: vi.fn().mockRejectedValue(new Error('no idb')),
      load: vi.fn(), save: vi.fn(), remove: vi.fn(),
      getLastOpened: vi.fn().mockRejectedValue(new Error('no idb')),
      setLastOpened: vi.fn(),
    }
    const opened = await openInitialDesign(broken)
    expect(opened.notice).toBe(STORAGE_UNAVAILABLE)
    expect(opened.doc.root).toEqual([])
    expect(logged).toHaveBeenCalled()
    logged.mockRestore()
  })

  it('says nothing when the last design was deleted', async () => {
    const repo = createMemoryDesignRepository()
    await repo.save('a', createEmptyDocument('A'))
    await repo.setLastOpened('a')
    await repo.remove('a')
    expect((await openInitialDesign(repo)).notice).toBeNull()
  })

  it('says nothing when last-opened points at a design that does not exist', async () => {
    const repo = createMemoryDesignRepository()
    await repo.setLastOpened('ghost')
    const opened = await openInitialDesign(repo)
    expect(opened.notice).toBeNull()
    expect(opened.doc.root).toEqual([])
  })

  it('skips a design whose load throws and opens the next one', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const inner = createMemoryDesignRepository()
    await inner.save('good', createEmptyDocument('Good'))
    await inner.save('boom', createEmptyDocument('Boom'))
    await inner.setLastOpened('boom')
    const repo: DesignRepository = {
      ...inner,
      load: (id) => (id === 'boom' ? Promise.reject(new Error('idb get failed')) : inner.load(id)),
    }
    const opened = await openInitialDesign(repo)
    expect(opened.doc.name).toBe('Good')
    expect(opened.notice).toBe(DAMAGED_DESIGN)
    expect(logged).toHaveBeenCalled()
    logged.mockRestore()
  })
})
