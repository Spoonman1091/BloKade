import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { createMemoryDesignRepository } from '../persistence/memory-repository'
import type { DesignRepository } from '../persistence/repository'
import { createBloKadeStore } from '../store/store'
import { createLessonStore } from './lesson-store'
import { LESSON_DESIGN_FAILED, resumeLesson, startLesson } from './start-lesson'
import { firstShape } from './tutorials/first-shape'

function setup(repo: DesignRepository = createMemoryDesignRepository()) {
  const store = createBloKadeStore({ designId: 'mine', doc: createEmptyDocument('My robot') })
  const session = { repo, store, flushAutosave: async () => undefined }
  const lessons = createLessonStore(null)
  return { repo, store, session, lessons }
}

describe('startLesson', () => {
  it('opens a fresh practice design named after the tutorial and begins it', async () => {
    const { store, session, lessons } = setup()
    await startLesson(session, lessons, firstShape)
    const { designId, history } = store.getState()
    expect(history.present.name).toBe('Lesson: Your first shape')
    expect(lessons.getState().progress.active).toEqual({ tutorialId: 'first-shape', step: 0, designId })
  })

  it("explains when the practice design can't be made", async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const broken = { ...createMemoryDesignRepository(), save: async () => { throw new Error('quota') } }
    const { store, session, lessons } = setup(broken)
    await startLesson(session, lessons, firstShape)
    expect(store.getState().notice).toBe(LESSON_DESIGN_FAILED)
    expect(lessons.getState().progress.active).toBeNull()
    logged.mockRestore()
  })
})

describe('resumeLesson (Review Focus 2)', () => {
  it('goes back to the practice design', async () => {
    const { store, session, lessons } = setup()
    await startLesson(session, lessons, firstShape)
    const practice = store.getState().designId
    await session.repo.save('mine', createEmptyDocument('My robot'))
    store.getState().openDesign('mine', createEmptyDocument('My robot'))
    expect(await resumeLesson(session, lessons)).toBe('resumed')
    expect(store.getState().designId).toBe(practice)
  })

  it('reports a practice design that was deleted', async () => {
    const { store, session, lessons } = setup()
    await startLesson(session, lessons, firstShape)
    await session.repo.remove(store.getState().designId)
    store.getState().openDesign('mine', createEmptyDocument('My robot'))
    expect(await resumeLesson(session, lessons)).toBe('missing')
    expect(store.getState().designId).toBe('mine')
  })
})
