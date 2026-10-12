import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { createBloKadeStore } from '../store/store'
import { lessonDesignName } from './names'
import type { TutorialStep } from './types'
import { isStepDone, lessonView } from './view'

describe('lessonView', () => {
  it('copies what checks may read from the store', () => {
    const store = createBloKadeStore({ designId: 'd1', doc: createEmptyDocument('Lesson: X') })
    store.getState().setTool('rotate')
    store.getState().setPickingWorkplane(true)
    const view = lessonView(store.getState())
    expect(view).toMatchObject({ designId: 'd1', tool: 'rotate', pickingWorkplane: true, workplane: null, overlapShown: false, canUndo: false })
    expect(view.doc.name).toBe('Lesson: X')
    store.getState().apply((d) => ({ ...d, name: 'Y' }))
    expect(lessonView(store.getState()).canUndo).toBe(true)
  })
})

describe('isStepDone', () => {
  const view = lessonView(createBloKadeStore({ designId: 'd', doc: createEmptyDocument() }).getState())

  it('is false for reading steps and follows the check otherwise', () => {
    expect(isStepDone({ id: 'read', text: 'Look', hint: 'h' }, view)).toBe(false)
    expect(isStepDone({ id: 'yes', text: 't', hint: 'h', check: () => true }, view)).toBe(true)
  })

  it('treats a throwing check as not done and logs it once', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const broken: TutorialStep = { id: 'broken-once', text: 't', hint: 'h', check: () => { throw new Error('boom') } }
    expect(isStepDone(broken, view)).toBe(false)
    expect(isStepDone(broken, view)).toBe(false)
    expect(logged).toHaveBeenCalledTimes(1)
    logged.mockRestore()
  })
})

describe('lessonDesignName', () => {
  it('names practice designs after the tutorial', () => {
    expect(lessonDesignName('Your first shape')).toBe('Lesson: Your first shape')
  })
})
