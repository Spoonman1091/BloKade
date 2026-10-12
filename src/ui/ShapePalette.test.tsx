// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { registry } from '../plugins/index'
import { createRegistry } from '../plugins/registry'
import { definePlugin } from '../plugins/types'
import { ShapePalette } from './ShapePalette'

describe('ShapePalette', () => {
  it('shows one button per shape and adds the clicked one', async () => {
    const onAdd = vi.fn()
    render(<ShapePalette registry={registry} onAdd={onAdd} />)
    expect(screen.getAllByRole('button')).toHaveLength(7)
    await userEvent.click(screen.getByRole('button', { name: /Cylinder/ }))
    expect(onAdd).toHaveBeenCalledWith('cylinder')
  })

  it('leaves fit and kit-only plugins out of the Shapes grid', () => {
    const plugin = (id: string, palette?: 'shapes' | 'fit' | 'hidden') => definePlugin({
      id, name: id, icon: '🧪', version: 1, palette, params: {}, build: () => { throw new Error('unused') },
    })
    const { registry: mixed } = createRegistry([plugin('plain'), plugin('listed', 'shapes'), plugin('fitty', 'fit'), plugin('secret', 'hidden')])
    render(<ShapePalette registry={mixed} onAdd={vi.fn()} />)
    expect(screen.getAllByRole('button').map((b) => b.dataset.testid)).toEqual(['add-plain', 'add-listed'])
  })
})
