import { definePlugin } from '../types'

/** A ramp: tall at -X, sloping down to the ground at +X. */
export default definePlugin({
  id: 'wedge',
  name: 'Wedge',
  icon: '📐',
  version: 1,
  params: {
    length: { type: 'mm', default: 20, label: 'Length' },
    width: { type: 'mm', default: 20, label: 'Width' },
    height: { type: 'mm', default: 20, label: 'Height' },
  },
  size: { x: 'length', y: 'width', z: 'height' },
  build: ({ length, width, height }, cad) =>
    cad.extrudeSide([[-length / 2, 0], [length / 2, 0], [-length / 2, height]], width),
})
