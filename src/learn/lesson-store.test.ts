import { describe, expect, it, vi } from 'vitest'
import { currentStepOf, createLessonStore } from './lesson-store'
import { PROGRESS_KEY, type KeyValueStorage } from './progress'
import type { Tutorial } from './types'

const tiny: Tutorial = {
  id: 'tiny', title: 'Tiny', icon: '🔹', intro: 'i',
  steps: [{ id: 'a', text: 'a', hint: 'h' }, { id: 'b', text: 'b', hint: 'h' }],
}
const memory = (initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } => {
  const data = { ...initial }
  return { data, getItem: (k) => (Object.hasOwn(data, k) ? data[k] ?? null : null), setItem: (k, v) => { data[k] = v } }
}

describe('lesson store', () => {
  it('starts, steps through and finishes a lesson', () => {
    const storage = memory()
    const lessons = createLessonStore(storage, [tiny])
    lessons.getState().begin('tiny', 'design-1')
    expect(lessons.getState()).toMatchObject({ panelOpen: true, progress: { active: { tutorialId: 'tiny', step: 0, designId: 'design-1' } } })
    expect(currentStepOf(lessons.getState().progress, [tiny])?.id).toBe('a')
    lessons.getState().next()
    expect(currentStepOf(lessons.getState().progress, [tiny])?.id).toBe('b')
    lessons.getState().back()
    lessons.getState().back()
    expect(lessons.getState().progress.active?.step).toBe(0)
    lessons.getState().next()
    lessons.getState().next()
    expect(lessons.getState()).toMatchObject({ finished: 'tiny', progress: { active: null, done: ['tiny'] } })
    expect(JSON.parse(storage.data[PROGRESS_KEY] ?? '{}')).toMatchObject({ done: ['tiny'], active: null })
  })

  it('does not list a lesson twice when it is done again', () => {
    const lessons = createLessonStore(memory(), [tiny])
    for (const _ of [1, 2]) {
      lessons.getState().begin('tiny', 'd')
      lessons.getState().next()
      lessons.getState().next()
    }
    expect(lessons.getState().progress.done).toEqual(['tiny'])
  })

  it('opens, toggles and focuses the panel, and quits a lesson', () => {
    const lessons = createLessonStore(memory(), [tiny])
    lessons.getState().openPanel('tiny')
    expect(lessons.getState()).toMatchObject({ panelOpen: true, focused: 'tiny' })
    lessons.getState().togglePanel()
    expect(lessons.getState().panelOpen).toBe(false)
    lessons.getState().begin('tiny', 'd')
    lessons.getState().quit()
    expect(lessons.getState().progress.active).toBeNull()
    lessons.getState().hideNudge()
    expect(lessons.getState().progress.nudgeHidden).toBe(true)
  })

  it('drops saved lessons that no longer exist and clamps steps (Review Focus 4)', () => {
    const saved = (active: object) => memory({ [PROGRESS_KEY]: JSON.stringify({ done: ['tiny', 'gone'], active, nudgeHidden: false }) })
    const unknown = createLessonStore(saved({ tutorialId: 'gone', step: 0, designId: 'd' }), [tiny])
    expect(unknown.getState().progress).toMatchObject({ done: ['tiny'], active: null })
    const tooFar = createLessonStore(saved({ tutorialId: 'tiny', step: 9, designId: 'd' }), [tiny])
    expect(tooFar.getState().progress.active?.step).toBe(1)
  })

  it('logs nothing when there is no storage at all', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const lessons = createLessonStore(null, [tiny])
    lessons.getState().begin('tiny', 'd')
    lessons.getState().next()
    expect(lessons.getState().progress.active?.step).toBe(1)
    expect(logged).not.toHaveBeenCalled()
    logged.mockRestore()
  })

  it('keeps working and logs once when saving fails (Review Focus 4)', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const broken: KeyValueStorage = { getItem: () => null, setItem: () => { throw new Error('full') } }
    const lessons = createLessonStore(broken, [tiny])
    lessons.getState().begin('tiny', 'd')
    lessons.getState().next()
    expect(lessons.getState().progress.active?.step).toBe(1)
    expect(logged).toHaveBeenCalledTimes(1)
    logged.mockRestore()
  })
})
