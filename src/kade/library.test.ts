import 'fake-indexeddb/auto'
import { createStore, set } from 'idb-keyval'
import { describe, expect, it, vi } from 'vitest'
import { SHAPE_ID_PATTERN } from '../document/types'
import { createIdbShapeLibrary, createMemoryShapeLibrary, newShapeId, shapeFileName, type LibraryShape, type ShapeLibraryRepo } from './library'

let dbCounter = 0
const shape = (id: string, name: string): LibraryShape => ({ id, name, code: `export default { name: '${name}' }`, updatedAt: 1 })

const implementations: [string, () => ShapeLibraryRepo][] = [
  ['memory', () => createMemoryShapeLibrary()],
  ['indexeddb', () => createIdbShapeLibrary(`shapes-test-${++dbCounter}`)],
]

describe.each(implementations)('%s shape library', (_, make) => {
  it('saves, lists by name and removes', async () => {
    const repo = make()
    await repo.save(shape('my-b', 'Robot'))
    await repo.save(shape('my-a', 'Gear'))
    expect((await repo.list()).map((s) => s.name)).toEqual(['Gear', 'Robot'])
    await repo.remove('my-a')
    expect((await repo.list()).map((s) => s.id)).toEqual(['my-b'])
  })
  it('replaces a shape saved again with the same id', async () => {
    const repo = make()
    await repo.save(shape('my-a', 'Gear'))
    await repo.save({ ...shape('my-a', 'Gear'), code: 'new code' })
    expect(await repo.list()).toEqual([{ ...shape('my-a', 'Gear'), code: 'new code' }])
  })
})

describe('the IndexedDB shape library', () => {
  it('skips damaged entries instead of failing', async () => {
    const dbName = `shapes-test-${++dbCounter}`
    const store = createStore(dbName, 'shapes')
    await set('bad', { id: 'Not An Id', name: '', code: 5 }, store)
    await set('my-good', shape('my-good', 'Good'), store)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await createIdbShapeLibrary(dbName).list()).toEqual([shape('my-good', 'Good')])
    expect(error).toHaveBeenCalledOnce()
    error.mockRestore()
  })
})

describe('shape ids and file names', () => {
  it('makes ids that fit the design format', () => {
    const id = newShapeId()
    expect(id).toMatch(/^my-[0-9a-f]{10}$/)
    expect(SHAPE_ID_PATTERN.test(id)).toBe(true)
    expect(newShapeId()).not.toBe(id)
  })
  it('makes a .js file name from the shape name', () => {
    expect(shapeFileName('Robot Head!')).toBe('robot-head.js')
    expect(shapeFileName('🤖')).toBe('shape.js')
  })
})
