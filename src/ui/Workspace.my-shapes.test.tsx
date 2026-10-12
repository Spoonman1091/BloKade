// @vitest-environment jsdom
import { EditorView } from 'codemirror'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildingGeometryApi, clientFor, fakeDeps } from '../app/testing/fakes'
import { renderMainScreen, sampleStores } from '../app/testing/main-screen'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode } from '../document/ops'
import { createMemoryShapeLibrary } from '../kade/library'
import { ALL_LESSONS } from '../learn/all-lessons'
import { createLessonStore } from '../learn/lesson-store'
import { createBloKadeStore } from '../store/store'

vi.mock('../viewport/Viewport', () => ({ Viewport: () => null }))
afterEach(cleanup)

const buildingDeps = (shapes = createMemoryShapeLibrary()) => fakeDeps({ client: clientFor(buildingGeometryApi()), shapes })

const codeView = (): EditorView => {
  const view = EditorView.findFromDOM(screen.getByTestId('code-box'))
  if (!view) throw new Error('no editor')
  return view
}

const carriedPlugins = (store: ReturnType<typeof createBloKadeStore>) => store.getState().history.present.plugins

describe('My shapes in the app', () => {
  it('keeps design shortcuts away from the code box (Review Focus 2)', async () => {
    const store = sampleStores()[0]!
    renderMainScreen(store, createLessonStore(null, ALL_LESSONS), buildingDeps())
    await userEvent.click(screen.getByTestId('my-shapes'))
    await userEvent.click(screen.getByTestId('new-shape'))
    const input = screen.getByTestId('code-input')
    const before = store.getState()
    expect(before.selection).toEqual(['b'])
    for (const key of [{ key: 'Delete' }, { key: 'Backspace' }, { key: 'z', ctrlKey: true }, { key: 'd', ctrlKey: true }, { key: 'h' }, { key: 'Escape' }]) {
      fireEvent.keyDown(input, key)
      fireEvent.keyDown(window, key)
    }
    expect(store.getState().history.present).toBe(before.history.present)
    expect(store.getState().selection).toEqual(before.selection)
  })
  it('opens My shapes and goes back to the same design', async () => {
    const store = sampleStores()[0]!
    renderMainScreen(store, undefined, buildingDeps())
    const before = store.getState().history.present
    await userEvent.click(screen.getByTestId('my-shapes'))
    expect(screen.queryByTestId('viewport')).toBeNull()
    await userEvent.click(screen.getByTestId('back-to-design'))
    expect(await screen.findByTestId('viewport')).toBeInTheDocument()
    expect(store.getState().history.present).toBe(before)
  })
  it('adds a new shape to the design, carrying its code', async () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    renderMainScreen(store, undefined, buildingDeps())
    await userEvent.click(screen.getByTestId('my-shapes'))
    await userEvent.click(screen.getByTestId('new-shape'))
    await waitFor(() => expect(screen.getByTestId('add-to-design')).toBeEnabled())
    await userEvent.click(screen.getByTestId('add-to-design'))
    await waitFor(() => expect(Object.keys(carriedPlugins(store))).toHaveLength(1))
    const [id] = Object.keys(carriedPlugins(store))
    expect(Object.values(store.getState().history.present.nodes)[0]).toMatchObject({ shapeType: id })
    // The palette's actions know about shapes checked after the first render.
    await userEvent.click(await screen.findByTestId(`add-${id}`))
    expect(Object.values(store.getState().history.present.nodes)).toHaveLength(2)
  })
  it('adds the code Kade just typed once it has settled and built', async () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    renderMainScreen(store, undefined, buildingDeps())
    await userEvent.click(screen.getByTestId('my-shapes'))
    await userEvent.click(screen.getByTestId('new-shape'))
    await waitFor(() => expect(screen.getByTestId('add-to-design')).toBeEnabled())
    codeView().dispatch({ changes: { from: 0, insert: '// a newer version\n' } })
    const typed = codeView().state.doc.toString()
    await waitFor(() => expect(screen.getByTestId('add-to-design')).toBeDisabled())
    await waitFor(() => expect(screen.getByTestId('add-to-design')).toBeEnabled())
    await userEvent.click(screen.getByTestId('add-to-design'))
    await waitFor(() => expect(Object.values(carriedPlugins(store))).toHaveLength(1))
    expect(Object.values(carriedPlugins(store))[0]?.code).toBe(typed)
    expect(await screen.findByTestId('viewport')).toBeInTheDocument()
    expect(screen.queryByTestId('newer-shapes')).toBeNull()
  })
  it('offers the newest version of a shape the design carries', async () => {
    const code = "export default { name: 'Gear' }"
    const shapes = createMemoryShapeLibrary([{ id: 'my-gear', name: 'Gear', code, updatedAt: 2 }])
    const gearPart = createShapeNode({ id: 'g', shapeType: 'my-gear', name: 'Gear', params: {}, color: '#fff' })
    const doc = addNode({ ...createEmptyDocument(), plugins: { 'my-gear': { name: 'Gear', code: 'older' } } }, gearPart)
    const store = createBloKadeStore({ designId: 'd', doc })
    renderMainScreen(store, undefined, buildingDeps(shapes))
    await userEvent.click(await screen.findByTestId('use-newest'))
    expect(store.getState().history.present.plugins['my-gear']?.code).toBe(code)
  })
})
