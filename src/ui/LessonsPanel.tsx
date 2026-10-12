import { useStore } from 'zustand'
import type { DesignSession } from '../app/design-session'
import type { LessonStore } from '../learn/lesson-store'
import { startLesson } from '../learn/start-lesson'
import { TUTORIALS } from '../learn/tutorials'
import type { Tutorial } from '../learn/types'
import { LessonStep } from './LessonStep'

interface LessonsPanelProps {
  lessons: LessonStore
  session: DesignSession
  tutorials?: readonly Tutorial[]
}

function TutorialList({ lessons, session, tutorials }: Required<LessonsPanelProps>) {
  const done = useStore(lessons, (s) => s.progress.done)
  const focused = useStore(lessons, (s) => s.focused)
  return (
    <ol className="lesson-list">
      {tutorials.map((t) => {
        const finished = done.includes(t.id)
        return (
          <li key={t.id} className={t.id === focused ? 'lesson-item focused' : 'lesson-item'}>
            <span className="lesson-title">
              <span aria-hidden="true">{t.icon}</span> {t.title}
              {finished && <span className="lesson-check" data-testid={`lesson-done-${t.id}`} aria-label="Finished">✓</span>}
            </span>
            <p className="hint">{t.intro}</p>
            <button type="button" className="tool-button" data-testid={`lesson-start-${t.id}`}
              onClick={() => void startLesson(session, lessons, t)}>{finished ? 'Do it again' : 'Start'}</button>
          </li>
        )
      })}
    </ol>
  )
}

function Finished({ lessons, tutorials }: Pick<Required<LessonsPanelProps>, 'lessons' | 'tutorials'>) {
  const finished = useStore(lessons, (s) => s.finished)
  const title = tutorials.find((t) => t.id === finished)?.title ?? 'the lesson'
  return (
    <div className="lesson-finished" data-testid="lesson-finished" role="status">
      <p className="lesson-cheer">🎉 You finished <strong>{title}</strong>!</p>
      <button type="button" className="tool-button" data-testid="lessons-list-back"
        onClick={() => lessons.getState().clearFinished()}>Back to all lessons</button>
    </div>
  )
}

/** The 📘 Lessons column: the tutorial list, the active step, or a 🎉 when one is finished. */
export function LessonsPanel({ lessons, session, tutorials = TUTORIALS }: LessonsPanelProps) {
  const active = useStore(lessons, (s) => s.progress.active)
  const finished = useStore(lessons, (s) => s.finished)
  const tutorial = active ? tutorials.find((t) => t.id === active.tutorialId) : undefined
  return (
    <aside className="lessons-panel panel" aria-label="Lessons" data-testid="lessons-panel">
      <header className="lessons-header">
        <h2 data-help="panel-lessons">📘 Lessons</h2>
        <button type="button" className="icon-button" data-testid="lessons-close" aria-label="Close lessons"
          onClick={() => lessons.getState().closePanel()}>✕</button>
      </header>
      {active && tutorial
        ? <LessonStep key={`${tutorial.id}-${active.step}`} lessons={lessons} session={session} tutorial={tutorial} active={active} />
        : finished
          ? <Finished lessons={lessons} tutorials={tutorials} />
          : <TutorialList lessons={lessons} session={session} tutorials={tutorials} />}
    </aside>
  )
}
