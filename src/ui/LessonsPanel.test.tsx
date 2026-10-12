// @vitest-environment jsdom
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createActions } from '../app/actions'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument } from '../document/factory'
import { createLessonStore } from '../learn/lesson-store'
import { shapesOf } from '../learn/checks'
import type { Tutorial } from '../learn/types'
import { createMemoryDesignRepository } from '../persistence/memory-repository'
import { registry } from '../plugins/index'
import { createBloKadeStore } from '../store/store'
import { LessonsPanel } from './LessonsPanel'

const lesson: Tutorial = {
  id: 'boxes', title: 'Boxes', icon: '🟦', intro: 'Make boxes.',
  steps: [
    { id: 'add', text: 'Click **Box**.', target: 'add-box', hint: 'Top left.', check: (v) => shapesOf(v, 'box').length > 0 },
    { id: 'read', text: 'Well done.', hint: 'Just read it.' },
  ],
}

function setup() {
  const repo = createMemoryDesignRepository()
  const store = createBloKadeStore({ designId: 'mine', doc: createEmptyDocument('Mine') })
  const lessons = createLessonStore(null, [lesson])
  const session = { repo, store, flushAutosave: async () => undefined }
  renderWithStore(<LessonsPanel lessons={lessons} session={session} tutorials={[lesson]} />, store)
  return { repo, store, lessons, actions: createActions(store, registry) }
}

describe('LessonsPanel', () => {
  it('lists tutorials and starts one in a practice design', async () => {
    const { store } = setup()
    expect(screen.getByText('Make boxes.')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('lesson-start-boxes'))
    await waitFor(() => expect(store.getState().history.present.name).toBe('Lesson: Boxes'))
    expect(screen.getByTestId('lesson-step')).toHaveTextContent('Click Box.')
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument()
  })

  it('shows Skip until a step is done, then Done and Next, and finishes with a ✓', async () => {
    const { lessons, actions } = setup()
    await userEvent.click(screen.getByTestId('lesson-start-boxes'))
    await screen.findByTestId('lesson-skip')
    expect(screen.getByTestId('lesson-find-it')).toHaveTextContent("Can't see it? Top left.")
    await userEvent.click(screen.getByTestId('lesson-hint'))
    expect(screen.getByTestId('lesson-hint-text')).toHaveTextContent('Top left.')
    act(() => actions.addShape('box'))
    act(() => lessons.getState().back())
    expect(screen.getByText('✓ Done!')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('lesson-next'))
    expect(screen.getByTestId('lesson-step')).toHaveTextContent('Well done.')
    await userEvent.click(screen.getByTestId('lesson-next'))
    expect(screen.getByTestId('lesson-finished')).toHaveTextContent('You finished Boxes!')
    await userEvent.click(screen.getByTestId('lessons-list-back'))
    expect(screen.getByTestId('lesson-done-boxes')).toBeInTheDocument()
  })

  it('pauses in another design and goes back (Review Focus 2)', async () => {
    const { store, repo } = setup()
    await userEvent.click(screen.getByTestId('lesson-start-boxes'))
    const practice = await waitFor(() => {
      const id = store.getState().designId
      expect(id).not.toBe('mine')
      return id
    })
    await repo.save('mine', createEmptyDocument('Mine'))
    act(() => store.getState().openDesign('mine', createEmptyDocument('Mine')))
    expect(screen.getByText('This lesson uses its own design. Go back to it to keep going.')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('lesson-go-back'))
    await waitFor(() => expect(store.getState().designId).toBe(practice))
    expect(screen.getByTestId('lesson-step')).toBeInTheDocument()
  })

  it('offers Start again when the practice design is gone (Review Focus 2)', async () => {
    const { store, repo } = setup()
    await userEvent.click(screen.getByTestId('lesson-start-boxes'))
    await waitFor(() => expect(store.getState().designId).not.toBe('mine'))
    await repo.remove(store.getState().designId)
    act(() => store.getState().openDesign('mine', createEmptyDocument('Mine')))
    await userEvent.click(screen.getByTestId('lesson-go-back'))
    await userEvent.click(await screen.findByTestId('lesson-restart'))
    await waitFor(() => expect(store.getState().history.present.name).toBe('Lesson: Boxes'))
    expect(screen.getByTestId('lesson-step')).toBeInTheDocument()
  })

  it('stops a lesson and closes the panel', async () => {
    const { lessons } = setup()
    await userEvent.click(screen.getByTestId('lesson-start-boxes'))
    await userEvent.click(await screen.findByTestId('lesson-quit'))
    expect(lessons.getState().progress.active).toBeNull()
    await userEvent.click(screen.getByTestId('lessons-close'))
    expect(lessons.getState().panelOpen).toBe(false)
  })
})
