// @vitest-environment jsdom
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createActions } from '../app/actions'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument } from '../document/factory'
import { MAX_MM, MIN_MM } from '../plugins/params'
import { registry } from '../plugins/index'
import { createBloKadeStore } from '../store/store'
import { PropertiesPanel } from './PropertiesPanel'

function setup() {
  const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
  const actions = createActions(store, registry)
  renderWithStore(<PropertiesPanel registry={registry} />, store)
  const selected = () => {
    const id = store.getState().selection[0]
    return id ? store.getState().history.present.nodes[id] : undefined
  }
  return { store, actions, selected }
}

async function setField(testId: string, text: string) {
  const input = screen.getByTestId(testId)
  await userEvent.clear(input)
  await userEvent.type(input, `${text}{Enter}`)
}

describe('PropertiesPanel', () => {
  it('shows a hint when nothing is selected', () => {
    setup()
    expect(screen.getByText(/Click a shape to change it/)).toBeInTheDocument()
  })

  it('edits shape sizes, clamping impossible values', async () => {
    const { actions, selected } = setup()
    act(() => actions.addShape('box'))
    await setField('param-width', '40')
    expect(selected()).toMatchObject({ params: { width: 40 } })
    await setField('param-height', '-5')
    expect(selected()).toMatchObject({ params: { height: MIN_MM } })
  })

  it('shows the clamped value when the size does not change', async () => {
    const { actions } = setup()
    act(() => actions.addShape('box'))
    await setField('param-height', '-5')
    await setField('param-height', '-7')
    expect((screen.getByTestId('param-height') as HTMLInputElement).value).toBe(String(MIN_MM))
  })

  it('edits position, rotation and name', async () => {
    const { actions, selected } = setup()
    act(() => actions.addShape('box'))
    await setField('pos-x', '12')
    await setField('rot-z', '45')
    await setField('prop-name', 'Base')
    expect(selected()?.transform).toEqual({ position: [12, 0, 0], rotation: [0, 0, 45] })
    expect(selected()?.name).toBe('Base')
  })

  it('keeps positions within the build limits', async () => {
    const { actions, selected } = setup()
    act(() => actions.addShape('box'))
    await setField('pos-x', '1e9')
    await setField('pos-y', '-5000')
    await setField('pos-z', '-12')
    expect(selected()?.transform.position).toEqual([MAX_MM, -MAX_MM, -12])
    expect((screen.getByTestId('pos-x') as HTMLInputElement).value).toBe(String(MAX_MM))
  })

  it('switches between solid and hole', async () => {
    const { actions, selected } = setup()
    act(() => actions.addShape('cylinder'))
    await userEvent.click(screen.getByTestId('mode-hole'))
    expect(selected()?.mode).toBe('hole')
    expect(screen.getByTestId('mode-hole')).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows build problems', () => {
    const { store, actions } = setup()
    act(() => actions.addShape('torus'))
    const id = store.getState().selection[0] as string
    act(() => store.getState().applyBuild('d', { nodes: { [id]: { status: 'error', message: 'Ring too thin' } } }))
    expect(screen.getByRole('alert')).toHaveTextContent('Ring too thin')
  })

  it('summarizes a multi-selection', () => {
    const { store, actions } = setup()
    act(() => {
      actions.addShape('box')
      actions.addShape('box')
      store.getState().select(store.getState().history.present.root)
    })
    expect(screen.getByText(/2 parts selected/)).toBeInTheDocument()
  })
})
