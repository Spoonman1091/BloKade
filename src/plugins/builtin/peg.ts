import { definePlugin } from '../types'

/** A round or square pin. Its socket (added with it by the Peg & socket kit) is a little bigger by `fit`. */
export default definePlugin({
  id: 'peg',
  name: 'Peg',
  icon: '📌',
  version: 1,
  palette: 'hidden',
  params: {
    shape: { type: 'choice', default: 'round', label: 'Shape', options: [{ value: 'round', label: 'Round' }, { value: 'square', label: 'Square' }] },
    size: { type: 'mm', default: 8, min: 1, max: 100, label: 'Size across' },
    length: { type: 'mm', default: 10, min: 1, max: 200, label: 'Length' },
  },
  size: { x: 'size', y: 'size', z: 'length' },
  build: ({ shape, size, length }, cad) => (shape === 'square' ? cad.box(size, size, length) : cad.cylinder(size, length)),
})
