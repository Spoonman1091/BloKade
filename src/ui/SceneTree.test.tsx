// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createActions } from '../app/actions'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument } from '../document/factory'
import { addModifier } from '../document/modifiers'
import { registry } from '../plugins/index'
import { createBloKadeStore } from '../store/store'
import { SceneTree } from './SceneTree'

function setup() {
  const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
  const actions = createActions(store, registry)
  renderWithStore(<SceneTree registry={registry} />, store)
  const doc = () => store.getState().history.present
  return { store, actions, doc }
}

describe('SceneTree', () => {
  it('invites Kade to add a shape when empty', () => {
    setup()
    expect(screen.getByText(/No parts yet/)).toBeInTheDocument()
  })

  it('selects with click and shift-click', async () => {
    const { store, actions, doc } = setup()
    act(() => {
      actions.addShape('box')
      actions.addShape('sphere')
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('treeitem', { name: 'Box' }))
    await user.keyboard('{Shift>}')
    await user.click(screen.getByRole('treeitem', { name: 'Sphere' }))
    await user.keyboard('{/Shift}')
    expect(store.getState().selection).toEqual(doc().root)
    expect(screen.getByRole('treeitem', { name: 'Box' })).toHaveAttribute('aria-selected', 'true')
  })

  it('toggles hole and hidden', async () => {
    const { actions, doc } = setup()
    act(() => actions.addShape('box'))
    const id = doc().root[0] as string
    await userEvent.click(screen.getByRole('button', { name: 'Make Box a hole' }))
    await userEvent.click(screen.getByRole('button', { name: 'Hide Box' }))
    expect(doc().nodes[id]).toMatchObject({ mode: 'hole', hidden: true })
  })

  it('renames on double-click', async () => {
    const { actions, doc } = setup()
    act(() => actions.addShape('box'))
    await userEvent.dblClick(screen.getByRole('treeitem', { name: 'Box' }))
    const input = screen.getByRole('textbox', { name: 'Part name' })
    await userEvent.clear(input)
    await userEvent.type(input, 'Base{Enter}')
    expect(doc().nodes[doc().root[0] as string]?.name).toBe('Base')
  })

  it('drags a part into a group and back out', () => {
    const { store, actions, doc } = setup()
    act(() => {
      actions.addShape('box')
      actions.addShape('box')
      store.getState().select(doc().root)
      actions.groupSelection()
      actions.addShape('sphere')
    })
    const [groupId, sphereId] = doc().root as [string, string]
    fireEvent.dragStart(screen.getByRole('treeitem', { name: 'Sphere' }))
    fireEvent.dragOver(screen.getByRole('treeitem', { name: 'Group' }))
    fireEvent.drop(screen.getByRole('treeitem', { name: 'Group' }))
    expect(doc().root).toEqual([groupId])
    fireEvent.dragStart(screen.getByRole('treeitem', { name: 'Sphere' }))
    fireEvent.drop(screen.getByTestId('drop-top-level'))
    expect(doc().root).toEqual([groupId, sphereId])
  })

  it('shows a problem badge', () => {
    const { store, actions, doc } = setup()
    act(() => actions.addShape('torus'))
    act(() => store.getState().applyBuild('d', { nodes: { [doc().root[0] as string]: { status: 'error', message: 'Too thin' } } }))
    expect(screen.getByLabelText('Problem: Too thin')).toBeInTheDocument()
  })

  it('shows the modifiers a part has', () => {
    const { store, actions } = setup()
    act(() => actions.addShape('box'))
    const id = store.getState().history.present.root[0]
    if (!id) throw new Error('needs a part')
    act(() => store.getState().apply((d) => addModifier(d, id, 'fillet').doc))
    expect(screen.getByTestId(`tree-mods-${id}`)).toHaveAttribute('title', 'Round edges')
  })
})
