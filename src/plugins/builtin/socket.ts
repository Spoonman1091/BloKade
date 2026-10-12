import { definePlugin } from '../types'

/** The hole a peg slides into: the peg's size plus extra room on every side. */
export default definePlugin({
  id: 'socket',
  name: 'Socket',
  icon: '⭕',
  version: 1,
  mode: 'hole',
  palette: 'hidden',
  params: {
    shape: { type: 'choice', default: 'round', label: 'Shape', options: [{ value: 'round', label: 'Round' }, { value: 'square', label: 'Square' }] },
    size: { type: 'mm', default: 8, min: 1, max: 100, label: 'Peg size' },
    depth: { type: 'mm', default: 11, min: 1, max: 200, label: 'Depth' },
    clearance: { type: 'mm', default: 0.2, min: 0, max: 2, label: 'Extra room', formula: 'fit' },
  },
  size: { z: 'depth' },
  build: ({ shape, size, depth, clearance }, cad) => {
    const across = size + 2 * clearance
    return shape === 'square' ? cad.box(across, across, depth) : cad.cylinder(across, depth)
  },
})
