// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { CodeView } from '../kade/code-view'
import { createEditorStore } from '../kade/editor-store'
import type { CodeLesson } from '../kade/lessons/types'
import { createMemoryShapeLibrary } from '../kade/library'
import { createLessonStore } from '../learn/lesson-store'
import { CodeLessonsPanel } from './CodeLessonsPanel'

const lesson: CodeLesson = {
  id: 'code-test', title: 'Practice', icon: '🧪', intro: 'Try it out.', starter: "export default { name: 'Practice' }",
  steps: [
    { id: 'build', text: 'Make it **build**.', target: 'code-input', hint: 'Fix the code.', check: (v) => v.built },
    { id: 'read', text: 'Well done.', hint: 'Just read it.' },
  ],
}
const view = (over: Partial<CodeView>): CodeView => ({
  shapeId: null, code: '', typing: false, syntaxOk: true, problem: null, built: false, bounds: null, meta: null, ...over,
})

function setup() {
  const editor = createEditorStore(createMemoryShapeLibrary())
  const lessons = createLessonStore(null, [lesson])
  const ui = (v: CodeView) => <CodeLessonsPanel lessons={lessons} editor={editor} view={v} codeLessons={[lesson]} />
  const utils = render(ui(view({})))
  return { editor, lessons, rerender: (v: CodeView) => utils.rerender(ui(v)) }
}

describe('CodeLessonsPanel', () => {
  it('starts a lesson on a new shape and shows its first step', async () => {
    const { editor, lessons, rerender } = setup()
    expect(screen.getByText('Try it out.')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('code-lesson-start-code-test'))
    const id = editor.getState().selectedId
    expect(lessons.getState().progress.active?.designId).toBe(id)
    rerender(view({ shapeId: id }))
    expect(screen.getByTestId('lesson-step')).toHaveTextContent('Make it build.')
    expect(screen.getByTestId('lesson-skip')).toBeInTheDocument()
    rerender(view({ shapeId: id, built: true }))
    expect(screen.getByTestId('lesson-next')).toBeInTheDocument()
  })
  it('pauses on another shape and goes back to the lesson\'s shape', async () => {
    const { editor, rerender } = setup()
    await userEvent.click(screen.getByTestId('code-lesson-start-code-test'))
    const id = editor.getState().selectedId
    act(() => editor.getState().create())
    rerender(view({ shapeId: editor.getState().selectedId }))
    await userEvent.click(screen.getByTestId('code-lesson-go-back'))
    expect(editor.getState().selectedId).toBe(id)
  })
  it('offers to start again when the lesson\'s shape is gone', async () => {
    const { editor, lessons, rerender } = setup()
    await userEvent.click(screen.getByTestId('code-lesson-start-code-test'))
    await act(async () => editor.getState().remove(editor.getState().selectedId ?? ''))
    rerender(view({}))
    await userEvent.click(screen.getByTestId('code-lesson-restart'))
    expect(lessons.getState().progress.active?.designId).toBe(editor.getState().selectedId)
  })
  it('cheers at the end and shows a ✓ in the list', async () => {
    const { editor, lessons, rerender } = setup()
    await userEvent.click(screen.getByTestId('code-lesson-start-code-test'))
    rerender(view({ shapeId: editor.getState().selectedId }))
    act(() => { lessons.getState().next(); lessons.getState().next() })
    rerender(view({ shapeId: editor.getState().selectedId }))
    expect(screen.getByTestId('lesson-finished')).toHaveTextContent('You finished Practice!')
    await userEvent.click(screen.getByTestId('lessons-list-back'))
    expect(screen.getByTestId('code-lesson-done-code-test')).toBeInTheDocument()
  })
})
