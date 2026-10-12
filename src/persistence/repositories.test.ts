import 'fake-indexeddb/auto'
import { createStore, set } from 'idb-keyval'
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { createIdbDesignRepository } from './idb-repository'
import { createMemoryDesignRepository } from './memory-repository'
import { duplicateDesign, NOT_FOUND, renameDesign, type DesignRepository } from './repository'

let dbCounter = 0
function clock() {
  let t = 0
  return () => ++t
}

const implementations: [string, () => DesignRepository][] = [
  ['memory', () => createMemoryDesignRepository({ now: clock() })],
  ['indexeddb', () => createIdbDesignRepository({ dbName: `test-${++dbCounter}`, now: clock() })],
]

describe.each(implementations)('%s design repository', (_, make) => {
  it('saves, lists newest first, loads and removes', async () => {
    const repo = make()
    await repo.save('a', createEmptyDocument('First'))
    await repo.save('b', createEmptyDocument('Second'))
    expect((await repo.list()).map((d) => d.name)).toEqual(['Second', 'First'])
    expect(await repo.load('a')).toEqual({ ok: true, value: createEmptyDocument('First') })
    await repo.remove('a')
    expect((await repo.list()).map((d) => d.id)).toEqual(['b'])
    expect(await repo.load('a')).toEqual({ ok: false, error: NOT_FOUND })
  })

  it('updates the summary when saving again', async () => {
    const repo = make()
    await repo.save('a', createEmptyDocument('Old'))
    await repo.save('a', createEmptyDocument('New'))
    expect((await repo.list()).map((d) => d.name)).toEqual(['New'])
  })

  it('remembers the last opened design', async () => {
    const repo = make()
    expect(await repo.getLastOpened()).toBeNull()
    await repo.setLastOpened('b')
    expect(await repo.getLastOpened()).toBe('b')
  })

  it('duplicates and renames designs', async () => {
    const repo = make()
    await repo.save('a', createEmptyDocument('Stand'))
    const copy = await duplicateDesign(repo, 'a')
    expect(copy.ok && copy.value.doc.name).toBe('Stand copy')
    expect(await renameDesign(repo, 'a', '  Better Stand ')).toMatchObject({ ok: true, value: { name: 'Better Stand' } })
    expect(await renameDesign(repo, 'a', '  ')).toEqual({ ok: false, error: "Names can't be empty." })
    expect(await duplicateDesign(repo, 'missing')).toEqual({ ok: false, error: NOT_FOUND })
  })
})

describe('damaged stored designs', () => {
  it('memory: reports a damaged design instead of throwing', async () => {
    const repo = createMemoryDesignRepository({ seed: { bad: { schemaVersion: 1, nonsense: true } } })
    const result = await repo.load('bad')
    expect(result.ok).toBe(false)
  })

  it('indexeddb: reports a damaged design instead of throwing', async () => {
    const dbName = `test-${++dbCounter}`
    const repo = createIdbDesignRepository({ dbName })
    await set('design:bad', { hello: 'world' }, createStore(dbName, 'designs'))
    expect((await repo.load('bad')).ok).toBe(false)
  })
})
