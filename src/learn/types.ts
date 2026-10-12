import type { BloKadeDocument, NodeId } from '../document/types'
import type { ToolMode, Workplane } from '../store/store'

/** Everything a tutorial step's check may look at. Never the DOM or the 3D view. */
export interface LessonView {
  readonly doc: BloKadeDocument
  readonly selection: readonly NodeId[]
  readonly tool: ToolMode
  readonly workplane: Workplane | null
  readonly pickingWorkplane: boolean
  readonly designId: string
  /** An overlap check result is showing for the current design and selection. */
  readonly overlapShown: boolean
  readonly canUndo: boolean
}

export interface TutorialStep<V = LessonView> {
  /** Unique within its tutorial. */
  readonly id: string
  /** One instruction. `**text**` shows in bold. */
  readonly text: string
  /** `data-testid` of the control to highlight. */
  readonly target?: string
  /** The step is done when this returns true. Missing means a reading step with a Next button. */
  readonly check?: (view: V) => boolean
  /** Longer help for 💡 Show me. It also says where to find the control. */
  readonly hint: string
}

export interface Tutorial<V = LessonView> {
  readonly id: string
  readonly title: string
  readonly icon: string
  readonly intro: string
  readonly steps: readonly TutorialStep<V>[]
}

/** Any lesson, design or code, for lists that hold both kinds. Its checks can't be called through this type. */
export type AnyTutorial = Tutorial<never>
