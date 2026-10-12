// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode } from '../document/ops'
import { createBloKadeStore } from '../store/store'
import { NewerShapesBanner } from './NewerShapesBanner'

describe('NewerShapesBanner', () => {
  it('offers the newest version and swaps it in as one undo step', async () => {
    const gearPart = createShapeNode({ id: 'g', shapeType: 'my-gear', name: 'Gear', params: {}, color: '#fff' })
    const doc = addNode({ ...createEmptyDocument(), plugins: { 'my-gear': { name: 'Gear', code: 'v1' } } }, gearPart)
    const store = createBloKadeStore({ designId: 'd', doc })
    renderWithStore(<NewerShapesBanner library={[{ id: 'my-gear', name: 'Gear', code: 'v2', updatedAt: 2 }]} />, store)
    expect(screen.getByTestId('newer-shapes')).toHaveTextContent('Gear has a newer version in My shapes.')
    await userEvent.click(screen.getByTestId('use-newest'))
    expect(store.getState().history.present.plugins['my-gear']?.code).toBe('v2')
    expect(screen.queryByTestId('newer-shapes')).toBeNull()
    store.getState().undo()
    expect(store.getState().history.present).toBe(doc)
  })
  it('stays hidden when the design is up to date', () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    renderWithStore(<NewerShapesBanner library={[{ id: 'my-gear', name: 'Gear', code: 'v2', updatedAt: 2 }]} />, store)
    expect(screen.queryByTestId('newer-shapes')).toBeNull()
  })
})
