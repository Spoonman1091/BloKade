import { useStore } from 'zustand'
import type { LessonStore } from '../learn/lesson-store'
import { useBloKade } from '../store/context'

/** A friendly pointer to the first lesson, shown in an empty design until Kade says "Don't show again". */
export function EmptyNudge({ lessons, onStart }: { lessons: LessonStore; onStart(): void }) {
  const empty = useBloKade((s) => s.history.present.root.length === 0)
  const hidden = useStore(lessons, (s) => s.progress.nudgeHidden || s.progress.active !== null)
  if (!empty || hidden) return null
  return (
    <div className="empty-nudge" data-testid="empty-nudge" role="note">
      <p>New here? Try <strong>📘 Learn → Your first shape</strong></p>
      <div className="lesson-actions">
        <button type="button" className="tool-button primary" data-testid="nudge-start" onClick={onStart}>Show me</button>
        <button type="button" className="tool-button" data-testid="nudge-hide" onClick={() => lessons.getState().hideNudge()}>Don't show again</button>
      </div>
    </div>
  )
}
