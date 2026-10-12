import type { Tutorial } from '../../learn/types'
import type { CodeView } from '../code-view'

/** A coding lesson: its checks look at what Kade's code does. */
export interface CodeLesson extends Tutorial<CodeView> {
  /** The code the lesson's practice shape starts with. */
  readonly starter: string
}
