import { useState } from 'react'
import { useTargetRect } from '../learn/target'
import { LessonHighlight } from './LessonHighlight'
import { RichText } from './RichText'

interface StepCardProps {
  title: string
  icon: string
  stepIndex: number
  total: number
  step: { readonly text: string; readonly hint: string; readonly target?: string; readonly hasCheck: boolean }
  done: boolean
  onNext(): void
  onBack(): void
  onQuit(): void
}

/** One lesson step: what to do, a highlight on the control, and Back / Skip / Next / Show me. Design and code lessons share it. */
export function StepCard({ title, icon, stepIndex, total, step, done, onNext, onBack, onQuit }: StepCardProps) {
  const rect = useTargetRect(step.target)
  const [showHint, setShowHint] = useState(false)
  const last = stepIndex + 1 === total
  return (
    <section className="lesson-step" aria-label={title}>
      <h3><span aria-hidden="true">{icon}</span> {title}</h3>
      <p className="hint">Step {stepIndex + 1} of {total}</p>
      <progress className="lesson-progress" max={total} value={stepIndex} />
      <p className="lesson-text" data-testid="lesson-step"><RichText text={step.text} /></p>
      {step.target && !rect && <p className="hint" data-testid="lesson-find-it">Can't see it? <RichText text={step.hint} /></p>}
      {done && <p className="lesson-done" role="status">✓ Done!</p>}
      {showHint && <p className="lesson-hint" data-testid="lesson-hint-text">💡 <RichText text={step.hint} /></p>}
      <div className="lesson-actions">
        <button type="button" className="tool-button" data-testid="lesson-back" disabled={stepIndex === 0} onClick={onBack}>Back</button>
        {!step.hasCheck || done
          ? <button type="button" className="tool-button primary" data-testid="lesson-next" onClick={onNext}>{last ? 'Finish' : 'Next'}</button>
          : <button type="button" className="tool-button" data-testid="lesson-skip" onClick={onNext}>Skip</button>}
        <button type="button" className="tool-button" data-testid="lesson-hint" aria-pressed={showHint}
          onClick={() => setShowHint((shown) => !shown)}>💡 Show me</button>
      </div>
      <button type="button" className="link-button" data-testid="lesson-quit" onClick={onQuit}>Stop this lesson</button>
      {rect && <LessonHighlight rect={rect} />}
    </section>
  )
}

/** The 🎉 shown when a lesson is finished. */
export function FinishedCard({ title, onBack }: { title: string; onBack(): void }) {
  return (
    <div className="lesson-finished" data-testid="lesson-finished" role="status">
      <p className="lesson-cheer">🎉 You finished <strong>{title}</strong>!</p>
      <button type="button" className="tool-button" data-testid="lessons-list-back" onClick={onBack}>Back to all lessons</button>
    </div>
  )
}
