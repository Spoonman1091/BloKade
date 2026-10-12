// @vitest-environment jsdom
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createActions } from '../app/actions'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument } from '../document/factory'
import { registry } from '../plugins/index'
import { createBloKadeStore } from '../store/store'
import { PropertiesPanel } from './PropertiesPanel'

function setup() {
  const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
  const actions = createActions(store, registry)
  renderWithStore(<PropertiesPanel registry={registry} />, store)
  act(() => actions.addShape('box'))
  const mods = () => {
    const id = store.getState().selection[0]
    return (id ? store.getState().history.present.nodes[id]?.modifiers : undefined) ?? []
  }
  return { store, mods }
}

async function setField(testId: string, text: string) {
  await userEvent.clear(screen.getByTestId(testId))
  await userEvent.type(screen.getByTestId(testId), `${text}{Enter}`)
}

describe('ModifierStack', () => {
  it('adds a Round edges modifier and changes its size', async () => {
    const { mods } = setup()
    await userEvent.selectOptions(screen.getByTestId('add-modifier'), 'fillet')
    expect(mods()).toMatchObject([{ type: 'fillet', radius: 2 }])
    await setField('mod-radius-0', '3')
    expect(mods()[0]).toMatchObject({ radius: 3 })
    await setField('mod-radius-0', '9999')
    expect(mods()[0]).toMatchObject({ radius: 500 })
  })

  it('takes formulas in modifier fields', async () => {
    const { store, mods } = setup()
    act(() => store.getState().apply((d) => ({ ...d, variables: [{ name: 'n', expr: '4' }] })))
    await userEvent.selectOptions(screen.getByTestId('add-modifier'), 'linearPattern')
    await setField('mod-count-0', 'n + 1')
    expect(mods()[0]).toMatchObject({ count: 5 })
    expect(screen.getByTestId('mod-count-0-value')).toHaveTextContent('= 5')
    await setField('mod-spacing-y-0', '12')
    expect(mods()[0]).toMatchObject({ spacing: [25, 12, 0] })
  })

  it('switches, reorders and deletes modifiers', async () => {
    const { mods } = setup()
    await userEvent.selectOptions(screen.getByTestId('add-modifier'), 'fillet')
    await userEvent.selectOptions(screen.getByTestId('add-modifier'), 'mirror')
    await userEvent.click(screen.getByTestId('mod-enabled-0'))
    expect(mods()[0]).toMatchObject({ enabled: false })
    await userEvent.click(screen.getByTestId('mod-up-1'))
    expect(mods().map((m) => m.type)).toEqual(['mirror', 'fillet'])
    expect(screen.getByTestId('mod-up-0')).toBeDisabled()
    await userEvent.click(screen.getByTestId('mod-delete-0'))
    expect(mods().map((m) => m.type)).toEqual(['fillet'])
  })

  it('chooses edges by description, and starts picking edges by hand', async () => {
    const { store, mods } = setup()
    await userEvent.selectOptions(screen.getByTestId('add-modifier'), 'chamfer')
    await userEvent.selectOptions(screen.getByTestId('mod-edges-0'), 'bottom')
    expect(mods()[0]).toMatchObject({ edges: { by: 'description', which: 'bottom' } })
    await userEvent.click(screen.getByTestId('mod-pick-0'))
    expect(store.getState().pickingEdges).toMatchObject({ modifierId: mods()[0]?.id })
    expect(screen.getByTestId('mod-pick-0')).toHaveTextContent('Done picking')
    await userEvent.click(screen.getByTestId('mod-pick-0'))
    expect(store.getState().pickingEdges).toBeNull()
  })

  it('edits circle and mirror settings', async () => {
    const { mods } = setup()
    await userEvent.selectOptions(screen.getByTestId('add-modifier'), 'circularPattern')
    await userEvent.selectOptions(screen.getByTestId('mod-axis-0'), 'x')
    await setField('mod-angle-0', '90')
    await setField('mod-center-x-0', '-30')
    expect(mods()[0]).toMatchObject({ axis: 'x', angle: 90, center: [-30, 0, 0] })
    await userEvent.selectOptions(screen.getByTestId('add-modifier'), 'mirror')
    await userEvent.selectOptions(screen.getByTestId('mod-plane-1'), 'XY')
    await userEvent.click(screen.getByTestId('mod-keep-1'))
    expect(mods()[1]).toMatchObject({ plane: 'XY', keepOriginal: false })
  })

  it('shows warnings from the last build', async () => {
    const { store, mods } = setup()
    await userEvent.selectOptions(screen.getByTestId('add-modifier'), 'fillet')
    const nodeId = store.getState().selection[0] ?? ''
    act(() => store.getState().applyBuild('d', { nodes: {}, warnings: { [nodeId]: { [mods()[0]?.id ?? '']: 'Lost track of 1 edge' } } }))
    expect(screen.getByTestId('mod-warning-0')).toHaveTextContent('Lost track of 1 edge')
  })
})
