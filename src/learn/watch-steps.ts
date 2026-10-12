import { useEffect } from 'react'
import type { BloKadeStore } from '../store/store'
import { currentStepOf, type LessonStore } from './lesson-store'
import { TUTORIALS } from './tutorials'
import type { Tutorial } from './types'
import { isStepDone, lessonView } from './view'

/**
 * Moves the active lesson on when a change to the design makes the current step's check turn true.
 * A step that is already done when Kade reaches it (e.g. after Back) waits for Next instead.
 */
export function watchSteps(store: BloKadeStore, lessons: LessonStore, tutorials: readonly Tutorial[] = TUTORIALS): () => void {
  let seen: { key: string; done: boolean } | null = null
  const evaluate = (): void => {
    const { progress } = lessons.getState()
    const active = progress.active
    const step = currentStepOf(progress, tutorials)
    if (!active || !step) {
      seen = null
      return
    }
    const view = lessonView(store.getState())
    if (view.designId !== active.designId) {
      seen = null
      return
    }
    const key = `${active.tutorialId}:${active.step}:${active.designId}`
    const done = isStepDone(step, view)
    const arriving = seen?.key !== key
    const becameDone = !arriving && done && seen?.done === false
    seen = { key, done }
    if (becameDone) lessons.getState().next()
  }
  const stopStore = store.subscribe(evaluate)
  const stopLessons = lessons.subscribe(evaluate)
  evaluate()
  return () => {
    stopStore()
    stopLessons()
  }
}

export function useStepWatcher(store: BloKadeStore, lessons: LessonStore): void {
  useEffect(() => watchSteps(store, lessons), [store, lessons])
}
