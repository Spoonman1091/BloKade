import type { LessonStore } from '../../learn/lesson-store'
import type { EditorStore } from '../editor-store'
import type { CodeLesson } from './types'

/** Makes the lesson's starter code a new shape (so Kade's shapes stay safe) and begins the lesson on it. */
export function startCodeLesson(editor: EditorStore, lessons: LessonStore, lesson: CodeLesson): void {
  const shape = editor.getState().create(lesson.starter)
  lessons.getState().begin(lesson.id, shape.id)
}
