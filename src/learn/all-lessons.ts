import { CODE_LESSONS } from '../kade/lessons'
import { TUTORIALS } from './tutorials'
import type { AnyTutorial } from './types'

/** Every lesson, so progress and ✓ marks are kept for design lessons and coding lessons alike. */
export const ALL_LESSONS: readonly AnyTutorial[] = [...TUTORIALS, ...CODE_LESSONS]
