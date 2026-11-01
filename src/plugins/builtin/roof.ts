import { definePlugin } from '../types'

/** A gable roof: a triangle seen from the front, pulled out along Y. */
export default definePlugin({
  id: 'roof',
  name: 'Roof',
  icon: '🏠',
  version: 1,
  palette: 'more',
  params: {
    length: { type: 'mm', default: 20, label: 'Length' },
    width: { type: 'mm', default: 20, label: 'Width' },
    height: { type: 'mm', default: 20, label: 'Height' },
  },
  size: { x: 'length', y: 'width', z: 'height' },
  build: ({ length, width, height }, cad) =>
    cad.extrudeSide([[-length / 2, 0], [length / 2, 0], [0, height]], width),
})
