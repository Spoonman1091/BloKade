import { createPortal } from 'react-dom'
import type { TargetRect } from '../learn/target'

const PAD = 4

/** A pulsing outline around the control a lesson step is about. Clicks pass straight through it. */
export function LessonHighlight({ rect }: { rect: TargetRect }) {
  return createPortal(
    <div className="lesson-highlight" data-testid="lesson-highlight" aria-hidden="true"
      style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + 2 * PAD, height: rect.height + 2 * PAD }} />,
    document.body,
  )
}
