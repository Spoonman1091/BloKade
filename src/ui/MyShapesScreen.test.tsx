// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildingGeometryApi, clientFor, fakeInspect } from '../app/testing/fakes'
import { createShapeCatalog } from '../kade/catalog'
import { createEditorStore } from '../kade/editor-store'
import { createMemoryShapeLibrary } from '../kade/library'
import { createLessonStore } from '../learn/lesson-store'
import { ALL_LESSONS } from '../learn/all-lessons'
import { registry } from '../plugins/index'
import { MyShapesScreen } from './MyShapesScreen'

vi.mock('../viewport/Viewport', () => ({ Viewport: () => null }))

function setup() {
  const editor = createEditorStore(createMemoryShapeLibrary())
  const lessons = createLessonStore(null, ALL_LESSONS)
  const catalog = createShapeCatalog(async (code) => fakeInspect(code))
  const onBack = vi.fn()
  const onAdd = vi.fn()
  render(<MyShapesScreen editor={editor} lessons={lessons} catalog={catalog} base={registry} client={clientFor(buildingGeometryApi())}
    helpMode={false} onHelpMode={vi.fn()} onBack={onBack} onAdd={onAdd} />)
  return { editor, lessons, onBack, onAdd }
}

describe('MyShapesScreen', () => {
  it('makes a new shape, shows that it works, and adds it to the design', async () => {
    const { editor, onAdd } = setup()
    await userEvent.click(screen.getByTestId('new-shape'))
    expect(screen.getByTestId('code-input')).toHaveTextContent("name: 'My shape'")
    await screen.findByTestId('code-ok')
    await waitFor(() => expect(screen.getByTestId('add-to-design')).toBeEnabled())
    await userEvent.click(screen.getByTestId('add-to-design'))
    expect(onAdd).toHaveBeenCalledWith(editor.getState().selectedId)
  })
  it('shows the problem with broken code', async () => {
    const { editor } = setup()
    act(() => { editor.getState().create("export default { name: 'BROKEN' }") })
    expect(await screen.findByTestId('problem-0')).toHaveTextContent('this test shape is broken')
    expect(screen.getByTestId('add-to-design')).toBeDisabled()
  })
  it('lists the commands and copies the gear into my shapes', async () => {
    const { editor } = setup()
    await userEvent.click(screen.getByTestId('tab-commands'))
    await userEvent.click(screen.getByTestId('use-gear'))
    expect(editor.getState().shapes.map((s) => s.name)).toEqual(['Gear'])
  })
  it('starts a coding lesson', async () => {
    const { lessons } = setup()
    await userEvent.click(screen.getByTestId('code-lesson-start-code-numbers'))
    expect(lessons.getState().progress.active?.tutorialId).toBe('code-numbers')
    expect(await screen.findByTestId('lesson-step')).toHaveTextContent('Change 20 to 40')
  })
  it('goes back to the design', async () => {
    const { onBack } = setup()
    await userEvent.click(screen.getByTestId('back-to-design'))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
