import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { currentCode, createEditorStore, LOAD_FAILED, SAVE_DELAY_MS, SAVE_FAILED, selectedShape } from './editor-store'
import { createMemoryShapeLibrary, type LibraryShape, type ShapeLibraryRepo } from './library'
import { nameInCode, NEW_SHAPE_CODE } from './starter'

const shape = (id: string, name: string): LibraryShape => ({ id, name, code: `export default { name: '${name}' }`, updatedAt: 1 })

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('the editor store', () => {
  it('loads the library and selects the first shape', async () => {
    const editor = createEditorStore(createMemoryShapeLibrary([shape('my-b', 'Robot'), shape('my-a', 'Gear')]))
    await editor.getState().load()
    expect(editor.getState().loaded).toBe(true)
    expect(editor.getState().shapes.map((s) => s.name)).toEqual(['Gear', 'Robot'])
    expect(selectedShape(editor.getState())?.name).toBe('Gear')
  })
  it('creates new shapes with unique names and saves them', async () => {
    const repo = createMemoryShapeLibrary()
    const editor = createEditorStore(repo)
    const first = editor.getState().create()
    const second = editor.getState().create()
    expect([first.name, second.name]).toEqual(['My shape', 'My shape 2'])
    expect(nameInCode(second.code)).toBe('My shape 2')
    expect(editor.getState().selectedId).toBe(second.id)
    await vi.runAllTimersAsync()
    expect((await repo.list()).map((s) => s.id).sort()).toEqual([first.id, second.id].sort())
  })
  it('keeps typing as a draft and settles it 500 ms after typing stops', async () => {
    const repo = createMemoryShapeLibrary()
    const editor = createEditorStore(repo, () => 42)
    const { id } = editor.getState().create(NEW_SHAPE_CODE)
    editor.getState().setCode(id, 'draft one')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS - 100)
    editor.getState().setCode(id, 'draft two')
    expect(currentCode(editor.getState(), id)).toBe('draft two')
    expect(selectedShape(editor.getState())?.code).toBe(NEW_SHAPE_CODE)
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(selectedShape(editor.getState())).toMatchObject({ code: 'draft two', updatedAt: 42 })
    expect(editor.getState().drafts).toEqual({})
    expect((await repo.list())[0]?.code).toBe('draft two')
  })
  it('settles drafts at once on flush', async () => {
    const editor = createEditorStore(createMemoryShapeLibrary())
    const { id } = editor.getState().create()
    editor.getState().setCode(id, 'now')
    await editor.getState().flush()
    expect(selectedShape(editor.getState())?.code).toBe('now')
  })
  it('duplicates a shape with a new name in its code', () => {
    const editor = createEditorStore(createMemoryShapeLibrary())
    const original = editor.getState().create()
    const copy = editor.getState().duplicate(original.id)
    expect(copy?.name).toBe('My shape copy')
    expect(nameInCode(copy?.code ?? '')).toBe('My shape copy')
    expect(editor.getState().duplicate('my-missing')).toBeNull()
  })
  it('deletes a shape and selects another', async () => {
    const repo = createMemoryShapeLibrary([shape('my-a', 'A'), shape('my-b', 'B')])
    const editor = createEditorStore(repo)
    await editor.getState().load()
    await editor.getState().remove('my-a')
    expect(editor.getState().shapes.map((s) => s.id)).toEqual(['my-b'])
    expect(editor.getState().selectedId).toBe('my-b')
    expect((await repo.list()).map((s) => s.id)).toEqual(['my-b'])
  })
  it('takes names from the checked code', async () => {
    const repo = createMemoryShapeLibrary([shape('my-a', 'A')])
    const editor = createEditorStore(repo)
    await editor.getState().load()
    editor.getState().syncNames({ 'my-a': 'Rocket', 'my-gone': 'X' })
    expect(editor.getState().shapes[0]?.name).toBe('Rocket')
    await vi.runAllTimersAsync()
    expect((await repo.list())[0]?.name).toBe('Rocket')
  })
})

describe('the editor store when browser storage fails (Review Focus 5)', () => {
  const failing: ShapeLibraryRepo = {
    list: async () => { throw new Error('blocked') },
    save: async () => { throw new Error('quota') },
    remove: async () => { throw new Error('blocked') },
  }

  it('says the library could not be opened and still lets Kade make shapes', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const editor = createEditorStore(failing)
    await editor.getState().load()
    expect(editor.getState()).toMatchObject({ loaded: true, notice: LOAD_FAILED })
    const made = editor.getState().create()
    editor.getState().setCode(made.id, 'still works')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(selectedShape(editor.getState())?.code).toBe('still works')
    expect(editor.getState().notice).toBe(SAVE_FAILED)
    expect(error.mock.calls.filter(([message]) => message === 'Could not save a shape')).toHaveLength(1)
    error.mockRestore()
  })
})
