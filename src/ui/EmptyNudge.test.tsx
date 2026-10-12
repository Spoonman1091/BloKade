// @vitest-environment jsdom
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode } from '../document/ops'
import { createLessonStore } from '../learn/lesson-store'
import { createBloKadeStore } from '../store/store'
import { EmptyNudge } from './EmptyNudge'

function setup() {
  const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
  const lessons = createLessonStore(null)
  const onStart = vi.fn()
  renderWithStore(<EmptyNudge lessons={lessons} onStart={onStart} />, store)
  return { store, lessons, onStart }
}

describe('EmptyNudge', () => {
  it('suggests the first lesson in an empty design', async () => {
    const { onStart } = setup()
    expect(screen.getByTestId('empty-nudge')).toHaveTextContent('New here? Try 📘 Learn → Your first shape')
    await userEvent.click(screen.getByTestId('nudge-start'))
    expect(onStart).toHaveBeenCalled()
  })

  it('hides once there is a part, during a lesson, or for good', async () => {
    const { store, lessons } = setup()
    act(() => store.getState().apply((d) => addNode(d, createShapeNode({ shapeType: 'box', name: 'Box', params: {}, color: '#fff' }))))
    expect(screen.queryByTestId('empty-nudge')).toBeNull()
    act(() => store.getState().undo())
    act(() => lessons.getState().begin('first-shape', 'd'))
    expect(screen.queryByTestId('empty-nudge')).toBeNull()
    act(() => lessons.getState().quit())
    await userEvent.click(screen.getByTestId('nudge-hide'))
    expect(screen.queryByTestId('empty-nudge')).toBeNull()
    expect(lessons.getState().progress.nudgeHidden).toBe(true)
  })
})
