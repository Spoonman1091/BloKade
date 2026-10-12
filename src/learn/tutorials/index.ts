import type { Tutorial } from '../types'
import { firstShape } from './first-shape'
import { holesGroups } from './holes-groups'
import { moveTurnSize } from './move-turn-size'
import { perfectFit } from './perfect-fit'
import { readyToPrint } from './ready-to-print'
import { roundRepeat } from './round-repeat'
import { smartSizes } from './smart-sizes'
import { undoSave } from './undo-save'
import { workplaneTutorial } from './workplane'

/** In teaching order. */
export const TUTORIALS: readonly Tutorial[] = [
  firstShape, moveTurnSize, holesGroups, undoSave, smartSizes, workplaneTutorial, roundRepeat, perfectFit, readyToPrint,
]

export const tutorialById = (id: string): Tutorial | undefined => TUTORIALS.find((t) => t.id === id)
