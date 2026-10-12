// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { registry } from '../plugins/index'
import { ShapePalette } from './ShapePalette'

describe('ShapePalette', () => {
  it('shows one button per shape and adds the clicked one', async () => {
    const onAdd = vi.fn()
    render(<ShapePalette registry={registry} onAdd={onAdd} />)
    expect(screen.getAllByRole('button')).toHaveLength(6)
    await userEvent.click(screen.getByRole('button', { name: /Cylinder/ }))
    expect(onAdd).toHaveBeenCalledWith('cylinder')
  })
})
