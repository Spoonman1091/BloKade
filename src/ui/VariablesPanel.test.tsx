// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode } from '../document/ops'
import { registry } from '../plugins/index'
import { createBloKadeStore } from '../store/store'
import { VariablesPanel } from './VariablesPanel'

function setup(extra: { name: string; expr: string }[] = []) {
  const box = { ...createShapeNode({ id: 'b', shapeType: 'box', name: 'Box', params: { width: 30, depth: 20, height: 20 }, color: '#f00' }), formulas: { 'param.width': 'wall * 10' } }
  const doc = addNode({ ...createEmptyDocument(), variables: [{ name: 'wall', expr: '3' }, { name: 'thick', expr: 'wall + 1' }, ...extra] }, box)
  const store = createBloKadeStore({ designId: 'd', doc })
  renderWithStore(<VariablesPanel registry={registry} />, store)
  const present = () => store.getState().history.present
  return { store, present }
}

async function setField(testId: string, text: string) {
  await userEvent.clear(screen.getByTestId(testId))
  await userEvent.type(screen.getByTestId(testId), `${text}{Enter}`)
}

describe('VariablesPanel', () => {
  it("lists variables with their values", () => {
    setup()
    expect(screen.getByTestId('var-expr-wall')).toHaveValue('3')
    expect(screen.getByTestId('var-expr-thick-value')).toHaveTextContent('= 4')
  })

  it('adds a variable with the next free name', async () => {
    const { present } = setup()
    await userEvent.click(screen.getByTestId('add-variable'))
    expect(present().variables.at(-1)).toEqual({ name: 'var1', expr: '10' })
  })

  it('changing a variable resizes the parts that use it', async () => {
    const { present } = setup()
    await setField('var-expr-wall', '5')
    expect(present().nodes.b).toMatchObject({ params: { width: 50 } })
    expect(screen.getByTestId('var-expr-thick-value')).toHaveTextContent('= 6')
  })

  it('renaming a variable rewrites the formulas that use it', async () => {
    const { present } = setup()
    await setField('var-name-wall', 'side')
    expect(present().nodes.b?.formulas).toEqual({ 'param.width': 'side * 10' })
    expect(present().variables[1]).toEqual({ name: 'thick', expr: 'side + 1' })
  })

  it('explains a bad name instead of renaming', async () => {
    const { store, present } = setup()
    await setField('var-name-wall', 'fit')
    expect(store.getState().notice).toContain('BloKade already uses "fit"')
    expect(present().variables[0]?.name).toBe('wall')
  })

  it('deleting a variable shows the problem on variables that used it', async () => {
    const { present } = setup()
    await userEvent.click(screen.getByTestId('var-delete-wall'))
    expect(present().variables.map((v) => v.name)).toEqual(['thick'])
    expect(screen.getByTestId('var-expr-thick-error')).toHaveTextContent(`"wall" isn't a variable`)
  })

  it('sets the fit gap, clamped to 2 mm', async () => {
    const { present } = setup()
    await setField('fit', '0.4')
    expect(present().settings.fit).toBe(0.4)
    await setField('fit', '7')
    expect(present().settings.fit).toBe(2)
  })

  it('a variable named like an Object.prototype member shows its value, not an error', () => {
    setup([{ name: 'constructor', expr: '5' }])
    expect(screen.getByTestId('var-expr-constructor-value')).toHaveTextContent('= 5')
    expect(screen.queryByTestId('var-expr-constructor-error')).toBeNull()
  })
})
