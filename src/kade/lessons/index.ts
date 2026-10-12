import { errorsLesson, firstShape, functionsLesson, numbers, variables } from './basics'
import { addCut, moveTurn, outlines, repeatLesson, settingsLesson } from './shapes'
import type { CodeLesson } from './types'

/** In teaching order. */
export const CODE_LESSONS: readonly CodeLesson[] = [
  numbers, variables, functionsLesson, errorsLesson, firstShape, settingsLesson, addCut, moveTurn, outlines, repeatLesson,
]
