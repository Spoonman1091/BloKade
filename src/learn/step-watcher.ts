import { currentStepOf, type LessonStore } from './lesson-store'
import type { Tutorial } from './types'
import { isStepDone } from './view'

/** Where a kind of lesson gets the view its checks look at, and which design or shape that view belongs to. */
export interface StepViewSource<V> {
  read(): { readonly view: V; readonly ownerId: string | null }
  subscribe(listener: () => void): () => void
}

/**
 * Moves the active lesson on when its current step's check turns true, for lessons in `tutorials` only.
 * A step that is already done when Kade reaches it (for example after Back) waits for Next instead.
 */
export function watchLessonSteps<V>(lessons: LessonStore, tutorials: readonly Tutorial<V>[], source: StepViewSource<V>): () => void {
  let seen: { key: string; done: boolean } | null = null
  const evaluate = (): void => {
    const { progress } = lessons.getState()
    const active = progress.active
    const step = currentStepOf(progress, tutorials)
    const { view, ownerId } = source.read()
    if (!active || !step || ownerId !== active.designId) {
      seen = null
      return
    }
    const key = `${active.tutorialId}:${active.step}:${active.designId}`
    const done = isStepDone(step, view)
    const becameDone = seen?.key === key && done && !seen.done
    seen = { key, done }
    if (becameDone) lessons.getState().next()
  }
  const stops = [source.subscribe(evaluate), lessons.subscribe(evaluate)]
  evaluate()
  return () => stops.forEach((stop) => stop())
}
