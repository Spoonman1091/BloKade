// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { preparedModel } from '../app/testing/prepared'
import { buildingGeometryApi, clientFor, fakeDeps } from '../app/testing/fakes'
import { renderMainScreen, sampleStores } from '../app/testing/main-screen'
import { cubeMesh } from '../geometry/testing/meshes'
import { createMemoryShapeLibrary } from '../kade/library'
import { ALL_LESSONS } from '../learn/all-lessons'
import { createLessonStore } from '../learn/lesson-store'
import { ImportDialog } from '../ui/ImportDialog'
import { helpFor, helpKeyOf } from './lookup'

vi.mock('../viewport/Viewport', () => ({ Viewport: () => null }))
afterEach(cleanup)

/** Buttons and fields, plus the code box and every heading that has a help id. */
const MY_SHAPES_CONTROLS = 'button, input, select, textarea, [data-help], [data-testid="code-input"], [data-testid="code-box"]'

function missingHelpIn(selector: string): string[] {
  return [...document.querySelectorAll(selector)].flatMap((el) => {
    const found = helpKeyOf(el)
    const entry = found ? helpFor(found.key, found.label) : null
    return entry ? [] : [el.outerHTML.slice(0, 120)]
  })
}

const missingHelp = () => missingHelpIn('button, input, select, textarea')

describe('help coverage', () => {
  it('has help for every control on the main screen', () => {
    for (const store of sampleStores()) {
      renderMainScreen(store)
      expect(missingHelp()).toEqual([])
      cleanup()
    }
  })

  it('has help for every control in the Lessons panel', () => {
    const lessons = createLessonStore(null)
    lessons.getState().openPanel()
    renderMainScreen(sampleStores()[3]!, lessons)
    expect(missingHelp()).toEqual([])
    cleanup()
    lessons.getState().begin('first-shape', 'empty')
    renderMainScreen(sampleStores()[3]!, lessons)
    expect(missingHelp()).toEqual([])
  })
})

describe('help coverage in the import dialog', () => {
  it('has help for every control in the import dialog', () => {
    render(<ImportDialog fileName="a.stl" model={preparedModel(cubeMesh(20), { simplified: true, hasGaps: true })} onImport={() => {}} onCancel={() => {}} />)
    expect(missingHelp()).toEqual([])
  })
})

describe('help coverage in My shapes', () => {
  it('has help for every control in My shapes, in all its states', async () => {
    const deps = fakeDeps({ client: clientFor(buildingGeometryApi()), shapes: createMemoryShapeLibrary() })
    renderMainScreen(sampleStores()[3]!, createLessonStore(null, ALL_LESSONS), deps)
    expect(missingHelpIn(MY_SHAPES_CONTROLS)).toEqual([])
    await userEvent.click(screen.getByTestId('my-shapes'))
    expect(missingHelpIn(MY_SHAPES_CONTROLS)).toEqual([])
    await userEvent.click(screen.getByTestId('new-shape'))
    await screen.findByTestId('code-ok')
    expect(missingHelpIn(MY_SHAPES_CONTROLS)).toEqual([])
    await userEvent.click(screen.getByTestId('delete-shape'))
    expect(missingHelpIn(MY_SHAPES_CONTROLS)).toEqual([])
    await userEvent.click(screen.getByTestId('delete-shape-no'))
    await userEvent.click(screen.getByTestId('code-lesson-start-code-numbers'))
    await screen.findByTestId('lesson-step')
    expect(missingHelpIn(MY_SHAPES_CONTROLS)).toEqual([])
    const other = screen.getAllByRole('button', { pressed: false }).find((b) => b.dataset.testid?.startsWith('shape-item-'))
    if (other) await userEvent.click(other)
    await screen.findByTestId('code-lesson-go-back')
    expect(missingHelpIn(MY_SHAPES_CONTROLS)).toEqual([])
    await userEvent.click(screen.getByTestId('tab-commands'))
    expect(missingHelpIn(MY_SHAPES_CONTROLS)).toEqual([])
  })
})
