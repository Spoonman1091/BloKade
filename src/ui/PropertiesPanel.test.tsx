// @vitest-environment jsdom
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createActions } from '../app/actions'
import { boxMesh } from '../app/testing/meshes'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addImportedPart } from '../document/models'
import { addNode, updateNode } from '../document/ops'
import { cubeMesh } from '../geometry/testing/meshes'
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

describe("PropertiesPanel with one of Kade's shapes", () => {
  function kadeSetup() {
    const head = createShapeNode({ id: 'h', shapeType: 'my-0a1b2c3d4e', name: 'Robot head', params: {}, color: '#fff' })
    const doc = addNode({ ...createEmptyDocument(), plugins: { 'my-0a1b2c3d4e': { name: 'Robot head', code: 'x' } } }, head)
    const store = createBloKadeStore({ designId: 'd', doc })
    renderWithStore(<PropertiesPanel registry={registry} />, store)
    act(() => store.getState().select(['h']))
    return store
  }
  it("says the shape's code is being checked", () => {
    kadeSetup()
    expect(screen.getByText("BloKade is checking this shape's code. Its size shows up in a moment.")).toBeInTheDocument()
    expect(screen.queryByText(/plugin/)).toBeNull()
  })
  it("says the shape's code has a problem", () => {
    const store = kadeSetup()
    act(() => store.getState().applyBuild('d', { nodes: { h: { status: 'error', message: 'Robot head couldn\'t be built: Line 3: oops' } } }))
    expect(screen.getByText("This shape's code has a problem, so its size can't change yet.")).toBeInTheDocument()
    expect(screen.queryByText(/plugin/)).toBeNull()
  })
})

describe('PropertiesPanel with an imported model', () => {
  it('shows Width, Depth and Height but no Model field', () => {
    const mesh = cubeMesh(10)
    const { doc, id } = addImportedPart(createEmptyDocument(), {
      name: 'Gear', vertices: new Float32Array(mesh.vertices), triangles: new Uint32Array(mesh.triangles), size: [10, 10, 10], color: '#fff',
    })
    const store = createBloKadeStore({ designId: 'd', doc })
    renderWithStore(<PropertiesPanel registry={registry} />, store)
    act(() => store.getState().select([id]))
    expect(screen.getByLabelText(/^Width/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Depth/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Height/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Model/)).toBeNull()
    expect(screen.queryByTestId('param-model')).toBeNull()
  })
})

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

  it('takes a formula, shows its result, and keeps the formula text', async () => {
    const { store, actions, selected } = setup()
    act(() => store.getState().apply((d) => ({ ...d, variables: [{ name: 'wall', expr: '3' }] })))
    act(() => actions.addShape('box'))
    await setField('param-width', 'wall * 10')
    expect(selected()).toMatchObject({ params: { width: 30 }, formulas: { 'param.width': 'wall * 10' } })
    expect(screen.getByTestId('param-width')).toHaveValue('wall * 10')
    expect(screen.getByTestId('param-width-value')).toHaveTextContent('= 30')
  })

  it("shows a broken formula's problem and keeps the old size (Review Focus 1)", async () => {
    const { actions, selected } = setup()
    act(() => actions.addShape('box'))
    await setField('param-width', 'wal * 10')
    expect(selected()).toMatchObject({ params: { width: 20 } })
    expect(screen.getByTestId('param-width-error')).toHaveTextContent(`"wal" isn't a variable`)
  })

  it('takes formulas for position and rotation', async () => {
    const { store, actions, selected } = setup()
    act(() => store.getState().apply((d) => ({ ...d, variables: [{ name: 'wall', expr: '3' }] })))
    act(() => actions.addShape('box'))
    await setField('pos-x', 'wall + 1')
    await setField('rot-z', '90 / wall')
    expect(selected()?.transform).toEqual({ position: [4, 0, 0], rotation: [0, 0, 30] })
  })

  it("edits a Text shape's letters", async () => {
    const { actions, selected } = setup()
    act(() => actions.addShape('text'))
    await setField('param-text', 'Hi Kade')
    expect(selected()).toMatchObject({ params: { text: 'Hi Kade' } })
  })

  it('shows line-up buttons for two or more parts and uses them', async () => {
    const { store, actions } = setup()
    act(() => actions.addShape('box'))
    act(() => actions.addShape('box'))
    const [a, b] = store.getState().history.present.root
    if (!a || !b) throw new Error('missing parts')
    act(() => {
      store.getState().apply((d) => updateNode(d, b, (n) => ({ ...n, transform: { ...n.transform, position: [30, 0, 0] } })))
      store.getState().applyBuild('d', { nodes: { [a]: { status: 'ok', mesh: boxMesh(20, 20, 20) }, [b]: { status: 'ok', mesh: boxMesh(20, 20, 20) } } })
      store.getState().select([a, b])
    })
    await userEvent.click(screen.getByTestId('align-x-min'))
    expect(store.getState().history.present.nodes[b]?.transform.position[0]).toBe(0)
  })
})
