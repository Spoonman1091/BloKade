import { useEffect } from 'react'
import type { BloKadeStore } from '../store/store'
import type { LessonStore } from './lesson-store'
import { watchLessonSteps } from './step-watcher'
import { TUTORIALS } from './tutorials'
import type { Tutorial } from './types'
import { lessonView } from './view'

/**
 * Moves the active lesson on when a change to the design makes the current step's check turn true.
 * A step that is already done when Kade reaches it (e.g. after Back) waits for Next instead.
 */
export function watchSteps(store: BloKadeStore, lessons: LessonStore, tutorials: readonly Tutorial[] = TUTORIALS): () => void {
  return watchLessonSteps(lessons, tutorials, {
    read: () => {
      const view = lessonView(store.getState())
      return { view, ownerId: view.designId }
    },
    subscribe: (listener) => store.subscribe(listener),
  })
}

export function useStepWatcher(store: BloKadeStore, lessons: LessonStore): void {
  useEffect(() => watchSteps(store, lessons), [store, lessons])
}
