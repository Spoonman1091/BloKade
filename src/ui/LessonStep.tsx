import { useState } from 'react'
import type { DesignSession } from '../app/design-session'
import type { LessonStore } from '../learn/lesson-store'
import type { ActiveLesson } from '../learn/progress'
import { resumeLesson, startLesson } from '../learn/start-lesson'
import { useTargetRect } from '../learn/target'
import type { Tutorial } from '../learn/types'
import { isStepDone, lessonView } from '../learn/view'
import { useBloKade } from '../store/context'
import { LessonHighlight } from './LessonHighlight'
import { RichText } from './RichText'

interface LessonStepProps {
  lessons: LessonStore
  session: DesignSession
  tutorial: Tutorial
  active: ActiveLesson
}

function PausedLesson({ lessons, session, tutorial }: Omit<LessonStepProps, 'active'>) {
  const [missing, setMissing] = useState(false)
  const goBack = async (): Promise<void> => setMissing((await resumeLesson(session, lessons)) === 'missing')
  return (
    <div className="lesson-paused" role="status">
      <p>This lesson uses its own design. Go back to it to keep going.</p>
      {missing ? (
        <>
          <p className="hint">That lesson design is gone. You can start the lesson again.</p>
          <button type="button" className="tool-button" data-testid="lesson-restart"
            onClick={() => void startLesson(session, lessons, tutorial)}>Start again</button>
        </>
      ) : (
        <button type="button" className="tool-button" data-testid="lesson-go-back" onClick={() => void goBack()}>Go back</button>
      )}
      <button type="button" className="link-button" data-testid="lesson-quit" onClick={() => lessons.getState().quit()}>Stop this lesson</button>
    </div>
  )
}

/** One step of the active lesson: what to do, a highlight on the control, and Back / Skip / Next / Show me. */
export function LessonStep({ lessons, session, tutorial, active }: LessonStepProps) {
  const step = tutorial.steps[active.step]
  const paused = useBloKade((s) => s.designId !== active.designId)
  const done = useBloKade((s) => (step ? isStepDone(step, lessonView(s)) : false))
  const rect = useTargetRect(paused ? undefined : step?.target)
  const [showHint, setShowHint] = useState(false)
  if (!step) return null
  if (paused) return <PausedLesson lessons={lessons} session={session} tutorial={tutorial} />
  const { next, back, quit } = lessons.getState()
  const total = tutorial.steps.length
  const last = active.step + 1 === total
  return (
    <section className="lesson-step" aria-label={tutorial.title}>
      <h3><span aria-hidden="true">{tutorial.icon}</span> {tutorial.title}</h3>
      <p className="hint">Step {active.step + 1} of {total}</p>
      <progress className="lesson-progress" max={total} value={active.step} />
      <p className="lesson-text" data-testid="lesson-step"><RichText text={step.text} /></p>
      {step.target && !rect && <p className="hint" data-testid="lesson-find-it">Can't see it? {step.hint}</p>}
      {done && <p className="lesson-done" role="status">✓ Done!</p>}
      {showHint && <p className="lesson-hint" data-testid="lesson-hint-text">💡 {step.hint}</p>}
      <div className="lesson-actions">
        <button type="button" className="tool-button" data-testid="lesson-back" disabled={active.step === 0} onClick={back}>Back</button>
        {!step.check || done
          ? <button type="button" className="tool-button primary" data-testid="lesson-next" onClick={next}>{last ? 'Finish' : 'Next'}</button>
          : <button type="button" className="tool-button" data-testid="lesson-skip" onClick={next}>Skip</button>}
        <button type="button" className="tool-button" data-testid="lesson-hint" aria-pressed={showHint}
          onClick={() => setShowHint((shown) => !shown)}>💡 Show me</button>
      </div>
      <button type="button" className="link-button" data-testid="lesson-quit" onClick={quit}>Stop this lesson</button>
      {rect && <LessonHighlight rect={rect} />}
    </section>
  )
}
