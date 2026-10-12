import { describe, expect, it } from 'vitest'
import { createLessonStore } from '../../learn/lesson-store'
import { createEditorStore, selectedShape } from '../editor-store'
import { createMemoryShapeLibrary } from '../library'
import { startCodeLesson } from './start'
import type { CodeLesson } from './types'

const lesson: CodeLesson = {
  id: 'code-test', title: 'Test', icon: '🧪', intro: 'i', starter: "export default { name: 'Practice' }",
  steps: [{ id: 'a', text: 't', hint: 'h', check: (v) => v.built }],
}

describe('startCodeLesson', () => {
  it('makes the starter code a new shape and begins the lesson on it', () => {
    const editor = createEditorStore(createMemoryShapeLibrary())
    const lessons = createLessonStore(null, [lesson])
    startCodeLesson(editor, lessons, lesson)
    const shape = selectedShape(editor.getState())
    expect(shape?.code).toBe(lesson.starter)
    expect(lessons.getState().progress.active).toEqual({ tutorialId: 'code-test', step: 0, designId: shape?.id })
    expect(lessons.getState().panelOpen).toBe(true)
  })
})
