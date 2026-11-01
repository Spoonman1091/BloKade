import { definePlugin } from '../types'
import { quarterEllipse } from './shape-profile'

/** A barrel roof: half an ellipse seen from the front, pulled out along Y. */
export default definePlugin({
  id: 'round-roof',
  name: 'Round roof',
  icon: '🌉',
  version: 1,
  palette: 'more',
  params: {
    length: { type: 'mm', default: 20, label: 'Length' },
    width: { type: 'mm', default: 20, label: 'Width' },
    height: { type: 'mm', default: 10, label: 'Height' },
  },
  size: { x: 'length', y: 'width', z: 'height' },
  build: ({ length, width, height }, cad) =>
    cad.extrudeSide(
      [
        [-length / 2, 0],
        [length / 2, 0],
        quarterEllipse(0, 0, length / 2, height),
        quarterEllipse(0, 0, -length / 2, height, false),
      ],
      width,
    ),
})
