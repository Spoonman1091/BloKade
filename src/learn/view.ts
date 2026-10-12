import { canUndo } from '../history/history'
import { visibleOverlapOf } from '../store/overlap'
import type { BloKadeState } from '../store/store'
import type { LessonView, TutorialStep } from './types'

export function lessonView(state: BloKadeState): LessonView {
  return {
    doc: state.history.present,
    selection: state.selection,
    tool: state.tool,
    workplane: state.workplane,
    pickingWorkplane: state.pickingWorkplane,
    designId: state.designId,
    overlapShown: visibleOverlapOf(state) !== null,
    canUndo: canUndo(state.history),
  }
}

const reported = new WeakSet<object>()

/** True when the step's check passes. A check that throws counts as "not done yet" and is logged once. */
export function isStepDone<V>(step: TutorialStep<V>, view: V): boolean {
  if (!step.check) return false
  try {
    return step.check(view)
  } catch (error) {
    if (!reported.has(step)) {
      reported.add(step)
      console.error(`Lesson step "${step.id}" could not be checked`, error)
    }
    return false
  }
}
