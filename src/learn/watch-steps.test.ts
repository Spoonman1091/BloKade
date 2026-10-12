import { describe, expect, it } from 'vitest'
import { createActions } from '../app/actions'
import { createEmptyDocument } from '../document/factory'
import { registry } from '../plugins/index'
import { createBloKadeStore } from '../store/store'
import { createLessonStore } from './lesson-store'
import { shapesOf } from './checks'
import type { Tutorial } from './types'
import { watchSteps } from './watch-steps'

const boxLesson: Tutorial = {
  id: 'boxes', title: 'Boxes', icon: '🟦', intro: 'i',
  steps: [
    { id: 'one', text: 'Add a box', hint: 'h', check: (v) => shapesOf(v, 'box').length >= 1 },
    { id: 'read', text: 'Read this', hint: 'h' },
    { id: 'two', text: 'Add another', hint: 'h', check: (v) => shapesOf(v, 'box').length >= 2 },
  ],
}

function setup() {
  const store = createBloKadeStore({ designId: 'practice', doc: createEmptyDocument() })
  const actions = createActions(store, registry)
  const lessons = createLessonStore(null, [boxLesson])
  lessons.getState().begin('boxes', 'practice')
  const stop = watchSteps(store, lessons, [boxLesson])
  const step = () => lessons.getState().progress.active?.step
  return { store, actions, lessons, stop, step }
}

describe('watchSteps', () => {
  it('moves on when a change makes the step done, and waits on reading steps', () => {
    const { actions, step, stop } = setup()
    expect(step()).toBe(0)
    actions.addShape('box')
    expect(step()).toBe(1)
    actions.addShape('cylinder')
    expect(step()).toBe(1)
    stop()
  })

  it('does not jump ahead from a step that is already done when Kade arrives at it (Review Focus 1)', () => {
    const { actions, lessons, step, stop } = setup()
    actions.addShape('box')
    actions.addShape('box')
    lessons.getState().next()
    expect(step()).toBe(2)
    actions.addShape('cylinder')
    expect(step()).toBe(2)
    lessons.getState().back()
    lessons.getState().back()
    expect(step()).toBe(0)
    actions.addShape('sphere')
    expect(step()).toBe(0)
    stop()
  })

  it('keeps waiting when Kade undoes their work (Review Focus 1)', () => {
    const { store, actions, step, stop } = setup()
    actions.addShape('cylinder')
    actions.undo()
    expect(step()).toBe(0)
    store.getState().apply((d) => d)
    expect(step()).toBe(0)
    stop()
  })

  it('does not advance when an undo leaves the check not done, and advances on the next false-to-true change', () => {
    const { actions, lessons, step, stop } = setup()
    actions.addShape('box')
    actions.addShape('box')
    lessons.getState().next()
    expect(step()).toBe(2)
    actions.undo()
    expect(step()).toBe(2)
    actions.addShape('box')
    expect(lessons.getState().progress.active).toBeNull()
    expect(lessons.getState().progress.done).toContain('boxes')
    stop()
  })

  it('ignores changes in another design (Review Focus 2)', () => {
    const { store, actions, step, stop } = setup()
    store.getState().openDesign('other', createEmptyDocument('Other'))
    actions.addShape('box')
    expect(step()).toBe(0)
    stop()
  })

  it('does not advance when Kade returns to the practice design and the check flips to true', () => {
    const doneWhenClear: Tutorial = {
      id: 'clear', title: 'Clear', icon: '🟦', intro: 'i',
      steps: [{ id: 'c', text: 'Deselect', hint: 'h', check: (v) => v.selection.length === 0 && shapesOf(v, 'box').length >= 1 }],
    }
    const store = createBloKadeStore({ designId: 'practice', doc: createEmptyDocument() })
    const actions = createActions(store, registry)
    const lessons = createLessonStore(null, [doneWhenClear])
    actions.addShape('box')
    lessons.getState().begin('clear', 'practice')
    const stop = watchSteps(store, lessons, [doneWhenClear])
    expect(store.getState().selection.length).toBeGreaterThan(0)
    const practiceDoc = store.getState().history.present
    store.getState().openDesign('other', createEmptyDocument('Other'))
    store.getState().openDesign('practice', practiceDoc)
    expect(lessons.getState().progress.active?.step).toBe(0)
    expect(lessons.getState().progress.done).not.toContain('clear')
    stop()
  })

  it('stops watching when unsubscribed', () => {
    const { actions, step, stop } = setup()
    stop()
    actions.addShape('box')
    expect(step()).toBe(0)
  })
})
