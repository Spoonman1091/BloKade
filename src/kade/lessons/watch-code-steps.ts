import type { LessonStore } from '../../learn/lesson-store'
import { watchLessonSteps } from '../../learn/step-watcher'
import type { CodeViewSource } from '../code-view'
import type { CodeLesson } from './types'

/** Moves the active coding lesson on when Kade's code passes the current step's check. */
export function watchCodeSteps(lessons: LessonStore, source: CodeViewSource, codeLessons: readonly CodeLesson[]): () => void {
  return watchLessonSteps(lessons, codeLessons, {
    read: () => {
      const view = source.read()
      return { view, ownerId: view.shapeId }
    },
    subscribe: source.subscribe,
  })
}
