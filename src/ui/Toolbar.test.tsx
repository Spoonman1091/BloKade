// @vitest-environment jsdom
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createActions } from '../app/actions'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument } from '../document/factory'
import { registry } from '../plugins/index'
import { createBloKadeStore } from '../store/store'
import { Toolbar } from './Toolbar'

function setup() {
  const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument('My Robot') })
  const actions = createActions(store, registry)
  const onExport = vi.fn()
  const onOpenDesigns = vi.fn()
  const onLearn = vi.fn()
  const onHelpMode = vi.fn()
  const onMyShapes = vi.fn()
  renderWithStore(<Toolbar actions={actions} onExport={onExport} onOpenDesigns={onOpenDesigns} learnOpen={false} onLearn={onLearn} helpMode={false} onHelpMode={onHelpMode} onMyShapes={onMyShapes} />, store)
  return { store, actions, onExport, onOpenDesigns, onLearn, onHelpMode, onMyShapes, doc: () => store.getState().history.present }
}

describe('Toolbar', () => {
  it('enables buttons only when they can do something', () => {
    const { store, actions } = setup()
    expect(screen.getByTestId('undo')).toBeDisabled()
    expect(screen.getByTestId('group')).toBeDisabled()
    act(() => {
      actions.addShape('box')
      actions.addShape('box')
      store.getState().select(store.getState().history.present.root)
    })
    expect(screen.getByTestId('undo')).toBeEnabled()
    expect(screen.getByTestId('group')).toBeEnabled()
    expect(screen.getByTestId('ungroup')).toBeDisabled()
  })

  it('groups the selection', async () => {
    const { store, actions, doc } = setup()
    act(() => {
      actions.addShape('box')
      actions.addShape('box')
      store.getState().select(doc().root)
    })
    await userEvent.click(screen.getByTestId('group'))
    expect(doc().root).toHaveLength(1)
  })

  it('switches handle modes', async () => {
    const { store } = setup()
    await userEvent.click(screen.getByTestId('tool-size'))
    expect(store.getState().tool).toBe('size')
    expect(screen.getByTestId('tool-size')).toHaveAttribute('aria-pressed', 'true')
  })

  it('changes grid snap', async () => {
    const { doc } = setup()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Grid snap' }), '0.5')
    expect(doc().settings.gridSnap).toBe(0.5)
  })

  it('exports and opens the designs dialog', async () => {
    const { onExport, onOpenDesigns } = setup()
    await userEvent.click(screen.getByTestId('export-3mf'))
    await userEvent.click(screen.getByTestId('open-designs'))
    expect(onExport).toHaveBeenCalledWith('3mf')
    expect(onOpenDesigns).toHaveBeenCalledOnce()
    expect(screen.getByTestId('open-designs')).toHaveTextContent('My Robot')
  })

  it('opens the lessons', async () => {
    const { onLearn } = setup()
    await userEvent.click(screen.getByTestId('learn'))
    expect(onLearn).toHaveBeenCalled()
  })

  it('turns help mode on', async () => {
    const { onHelpMode } = setup()
    await userEvent.click(screen.getByTestId('help-mode'))
    expect(onHelpMode).toHaveBeenCalled()
  })

  it('exports STEP', async () => {
    const { onExport } = setup()
    await userEvent.click(screen.getByTestId('export-step'))
    expect(onExport).toHaveBeenCalledWith('step')
  })

  it('picks a workplane and goes back to the ground', async () => {
    const { store } = setup()
    await userEvent.click(screen.getByTestId('workplane'))
    expect(store.getState().pickingWorkplane).toBe(true)
    expect(screen.queryByTestId('workplane-reset')).toBeNull()
    act(() => store.getState().setWorkplane({ origin: [0, 0, 5], rotation: [0, 0, 0] }))
    await userEvent.click(screen.getByTestId('workplane-reset'))
    expect(store.getState().workplane).toBeNull()
  })

  it('opens My shapes', async () => {
    const { onMyShapes } = setup()
    await userEvent.click(screen.getByTestId('my-shapes'))
    expect(onMyShapes).toHaveBeenCalledOnce()
  })
})
