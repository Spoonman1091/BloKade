import { openFreshDesign, openSavedDesign, type DesignSession } from '../app/design-session'
import type { LessonStore } from './lesson-store'
import { lessonDesignName } from './names'
import type { Tutorial } from './types'

export const LESSON_DESIGN_FAILED = "BloKade couldn't make a design for this lesson. Try again in a moment."

export async function startLesson(session: DesignSession, lessons: LessonStore, tutorial: Tutorial): Promise<void> {
  try {
    const designId = await openFreshDesign(session, lessonDesignName(tutorial.title))
    lessons.getState().begin(tutorial.id, designId)
  } catch (error) {
    console.error('Could not start the lesson', error)
    session.store.getState().notify(LESSON_DESIGN_FAILED)
  }
}

/** Opens the active lesson's practice design again. 'missing' when it was deleted or can't be loaded. */
export async function resumeLesson(session: DesignSession, lessons: LessonStore): Promise<'resumed' | 'missing'> {
  const active = lessons.getState().progress.active
  if (!active) return 'missing'
  if (session.store.getState().designId === active.designId) return 'resumed'
  try {
    return (await openSavedDesign(session, active.designId)).ok ? 'resumed' : 'missing'
  } catch (error) {
    console.error('Could not reopen the lesson design', error)
    return 'missing'
  }
}
