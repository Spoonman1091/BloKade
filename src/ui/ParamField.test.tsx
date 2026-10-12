// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode } from '../document/ops'
import { createRegistry } from '../plugins/registry'
import { definePlugin } from '../plugins/types'
import { createBloKadeStore } from '../store/store'
import { ParamField } from './ParamField'
import { PropertiesPanel } from './PropertiesPanel'

const picker = definePlugin({
  id: 'picker', name: 'Picker', icon: '🧪', version: 1,
  params: {
    kind: { type: 'choice', default: 'round', label: 'Shape', options: [{ value: 'round', label: 'Round' }, { value: 'square', label: 'Square' }] },
    size: { type: 'mm', default: 8, label: 'Size' },
  },
  build: () => { throw new Error('unused') },
})
const squareFirst = definePlugin({
  id: 'square-first', name: 'Square first', icon: '🧪', version: 1,
  params: {
    kind: { type: 'choice', default: 'square', label: 'Shape', options: [{ value: 'round', label: 'Round' }, { value: 'square', label: 'Square' }] },
  },
  build: () => { throw new Error('unused') },
})
const { registry } = createRegistry([picker, squareFirst])

function setup() {
  const node = createShapeNode({ id: 'p', shapeType: 'picker', name: 'Picker', params: { kind: 'round', size: 8 }, color: '#fff' })
  const store = createBloKadeStore({ designId: 'd', doc: addNode(createEmptyDocument(), node) })
  renderWithStore(<PropertiesPanel registry={registry} />, store)
  act(() => store.getState().select(['p']))
  return store
}

describe('ParamField', () => {
  it('shows a choice as a list and saves the picked option', async () => {
    const store = setup()
    const select = screen.getByTestId('param-kind')
    expect(select).toHaveValue('round')
    expect(screen.getByRole('option', { name: 'Square' })).toBeInTheDocument()
    await userEvent.selectOptions(select, 'square')
    expect(store.getState().history.present.nodes.p).toMatchObject({ params: { kind: 'square', size: 8 } })
  })

  it('shows the option that is really built (the default) when the stored choice is not in the list', () => {
    const node = createShapeNode({ id: 'p', shapeType: 'square-first', name: 'Square first', params: { kind: 'hexagon' }, color: '#fff' })
    const store = createBloKadeStore({ designId: 'd', doc: addNode(createEmptyDocument(), node) })
    renderWithStore(<PropertiesPanel registry={registry} />, store)
    act(() => store.getState().select(['p']))
    expect(screen.getByTestId('param-kind')).toHaveValue('square')
  })

  it('still shows number params as value fields', () => {
    setup()
    expect(screen.getByTestId('param-size')).toHaveValue('8')
  })
})

it('shows a yes/no setting as a tick box and saves true or false', async () => {
  const setRaw = vi.fn()
  const node = createShapeNode({ id: 'n', shapeType: 'x', name: 'X', params: { round: false }, color: '#fff' })
  render(<ParamField node={node} name="round" spec={{ type: 'yesno', default: false, label: 'Round' }} errors={{}}
    setField={vi.fn()} setRaw={setRaw} />)
  const box = screen.getByTestId('param-round')
  expect(box).not.toBeChecked()
  await userEvent.click(box)
  expect(setRaw).toHaveBeenCalledWith('round', true)
  expect(screen.getByLabelText('Round')).toBe(box)
})
