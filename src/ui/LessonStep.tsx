import { useState } from 'react'
import type { DesignSession } from '../app/design-session'
import type { LessonStore } from '../learn/lesson-store'
import type { ActiveLesson } from '../learn/progress'
import { resumeLesson, startLesson } from '../learn/start-lesson'
import type { Tutorial } from '../learn/types'
import { isStepDone, lessonView } from '../learn/view'
import { useBloKade } from '../store/context'
import { StepCard } from './LessonCards'

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
  if (!step) return null
  if (paused) return <PausedLesson lessons={lessons} session={session} tutorial={tutorial} />
  const { next, back, quit } = lessons.getState()
  return (
    <StepCard title={tutorial.title} icon={tutorial.icon} stepIndex={active.step} total={tutorial.steps.length}
      step={{ text: step.text, hint: step.hint, target: step.target, hasCheck: step.check !== undefined }}
      done={done} onNext={next} onBack={back} onQuit={quit} />
  )
}
