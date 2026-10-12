// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { codeHash } from '../kade/hash'
import { createPreviewStore, PREVIEW_ID, showShape } from '../kade/preview'
import { buildShapeRegistry } from '../kade/shape-registry'
import { registry as base } from '../plugins/index'
import { ShapePreview } from './ShapePreview'

vi.mock('../viewport/Viewport', () => ({ Viewport: () => null }))

const shape = { id: 'my-gear', name: 'Gear', code: "export default { name: 'Gear' }", updatedAt: 1 }
const registry = buildShapeRegistry({
  base, library: [], carried: { 'my-gear': { name: 'Gear', code: shape.code } },
  results: { [codeHash(shape.code)]: { ok: true, meta: { name: 'Gear', icon: '⚙️', params: { teeth: { type: 'whole', default: 12, label: 'Teeth' } } } } },
})

describe('ShapePreview', () => {
  it("shows the shape's settings and changes them in the preview", async () => {
    const store = createPreviewStore()
    showShape(store, shape)
    render(<ShapePreview store={store} registry={registry} canAdd onAdd={vi.fn()} />)
    const teeth = screen.getByTestId('param-teeth')
    await userEvent.clear(teeth)
    await userEvent.type(teeth, '20{Enter}')
    expect(store.getState().history.present.nodes[PREVIEW_ID]).toMatchObject({ params: { teeth: 20 } })
  })
  it('adds the shape to the design when it works', async () => {
    const onAdd = vi.fn()
    const store = createPreviewStore()
    showShape(store, shape)
    const { rerender } = render(<ShapePreview store={store} registry={registry} canAdd={false} onAdd={onAdd} />)
    expect(screen.getByTestId('add-to-design')).toBeDisabled()
    rerender(<ShapePreview store={store} registry={registry} canAdd onAdd={onAdd} />)
    await userEvent.click(screen.getByTestId('add-to-design'))
    expect(onAdd).toHaveBeenCalledOnce()
  })
})
