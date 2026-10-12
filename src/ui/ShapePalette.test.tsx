// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { registry } from '../plugins/index'
import { KITS } from '../plugins/kits'
import { createRegistry } from '../plugins/registry'
import { definePlugin } from '../plugins/types'
import { ShapePalette } from './ShapePalette'

describe('ShapePalette', () => {
  it('shows shapes, then fit tools with kits first, and hides kit-only parts', async () => {
    const onAdd = vi.fn()
    const onAddKit = vi.fn()
    render(<ShapePalette registry={registry} kits={KITS} onAdd={onAdd} onAddKit={onAddKit} />)
    const shapes = within(screen.getByRole('region', { name: 'Shapes' })).getAllByRole('button')
    expect(shapes).toHaveLength(7)
    const fit = within(screen.getByRole('region', { name: 'Fit tools' })).getAllByRole('button').map((b) => b.textContent)
    expect(fit).toEqual(['🧷Peg & socket', '🪝Snap-fit clip', '🔩Screw hole', '🪛Threaded rod', '🌀Threaded hole'])
    expect(screen.queryByTestId('add-peg')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Cylinder/ }))
    expect(onAdd).toHaveBeenCalledWith('cylinder')
    await userEvent.click(screen.getByTestId('add-kit-peg-socket'))
    expect(onAddKit).toHaveBeenCalledWith('peg-socket')
    await userEvent.click(screen.getByTestId('add-screw-hole'))
    expect(onAdd).toHaveBeenCalledWith('screw-hole')
  })

  it('leaves fit and kit-only plugins out of the Shapes grid', () => {
    const plugin = (id: string, palette?: 'shapes' | 'fit' | 'hidden') => definePlugin({
      id, name: id, icon: '🧪', version: 1, palette, params: {}, build: () => { throw new Error('unused') },
    })
    const { registry: mixed } = createRegistry([plugin('plain'), plugin('listed', 'shapes'), plugin('fitty', 'fit'), plugin('secret', 'hidden')])
    render(<ShapePalette registry={mixed} kits={[]} onAdd={vi.fn()} onAddKit={vi.fn()} />)
    const ids = (name: string) => within(screen.getByRole('region', { name })).getAllByRole('button').map((b) => b.dataset.testid)
    expect(ids('Shapes')).toEqual(['add-plain', 'add-listed'])
    expect(ids('Fit tools')).toEqual(['add-fitty'])
  })
})
