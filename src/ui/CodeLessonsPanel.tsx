import { useStore } from 'zustand'
import type { CodeView } from '../kade/code-view'
import type { EditorStore } from '../kade/editor-store'
import { startCodeLesson } from '../kade/lessons/start'
import type { CodeLesson } from '../kade/lessons/types'
import type { LessonStore } from '../learn/lesson-store'
import type { ActiveLesson } from '../learn/progress'
import { isStepDone } from '../learn/view'
import { FinishedCard, StepCard } from './LessonCards'

interface CodeLessonsPanelProps {
  lessons: LessonStore
  editor: EditorStore
  view: CodeView
  codeLessons: readonly CodeLesson[]
}

function CodeLessonList({ lessons, editor, codeLessons }: Omit<CodeLessonsPanelProps, 'view'>) {
  const done = useStore(lessons, (s) => s.progress.done)
  return (
    <ol className="lesson-list">
      {codeLessons.map((lesson) => {
        const finished = done.includes(lesson.id)
        return (
          <li key={lesson.id} className="lesson-item">
            <span className="lesson-title">
              <span aria-hidden="true">{lesson.icon}</span> {lesson.title}
              {finished && <span className="lesson-check" data-testid={`code-lesson-done-${lesson.id}`} aria-label="Finished">✓</span>}
            </span>
            <p className="hint">{lesson.intro}</p>
            <button type="button" className="tool-button" data-testid={`code-lesson-start-${lesson.id}`}
              onClick={() => startCodeLesson(editor, lessons, lesson)}>{finished ? 'Do it again' : 'Start'}</button>
          </li>
        )
      })}
    </ol>
  )
}

interface PausedProps { lessons: LessonStore; editor: EditorStore; lesson: CodeLesson; active: ActiveLesson }

function PausedCodeLesson({ lessons, editor, lesson, active }: PausedProps) {
  const exists = useStore(editor, (s) => s.shapes.some((shape) => shape.id === active.designId))
  return (
    <div className="lesson-paused" role="status">
      <p>This lesson uses its own shape. Go back to it to keep going.</p>
      {exists
        ? <button type="button" className="tool-button" data-testid="code-lesson-go-back" onClick={() => editor.getState().select(active.designId)}>Go back</button>
        : <button type="button" className="tool-button" data-testid="code-lesson-restart" onClick={() => startCodeLesson(editor, lessons, lesson)}>Start again</button>}
      <button type="button" className="link-button" data-testid="lesson-quit" onClick={() => lessons.getState().quit()}>Stop this lesson</button>
    </div>
  )
}

/** 📘 Lessons inside My shapes: the coding lessons, the active step, or a 🎉. Progress is shared with the design lessons. */
export function CodeLessonsPanel({ lessons, editor, view, codeLessons }: CodeLessonsPanelProps) {
  const active = useStore(lessons, (s) => s.progress.active)
  const finished = useStore(lessons, (s) => s.finished)
  const lesson = active ? codeLessons.find((l) => l.id === active.tutorialId) : undefined
  const step = active && lesson ? lesson.steps[active.step] : undefined
  if (active && lesson && step) {
    if (view.shapeId !== active.designId) return <PausedCodeLesson lessons={lessons} editor={editor} lesson={lesson} active={active} />
    const { next, back, quit } = lessons.getState()
    return (
      <StepCard key={`${lesson.id}-${active.step}`} title={lesson.title} icon={lesson.icon} stepIndex={active.step} total={lesson.steps.length}
        step={{ text: step.text, hint: step.hint, target: step.target, hasCheck: step.check !== undefined }}
        done={isStepDone(step, view)} onNext={next} onBack={back} onQuit={quit} />
    )
  }
  const finishedLesson = codeLessons.find((l) => l.id === finished)
  if (finishedLesson) return <FinishedCard title={finishedLesson.title} onBack={() => lessons.getState().clearFinished()} />
  return <CodeLessonList lessons={lessons} editor={editor} codeLessons={codeLessons} />
}
