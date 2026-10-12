import { definePlugin } from '../types'

export default definePlugin({
  id: 'box',
  name: 'Box',
  icon: '🟦',
  version: 1,
  params: {
    width: { type: 'mm', default: 20, label: 'Width' },
    depth: { type: 'mm', default: 20, label: 'Depth' },
    height: { type: 'mm', default: 20, label: 'Height' },
  },
  size: { x: 'width', y: 'depth', z: 'height' },
  build: ({ width, depth, height }, cad) => cad.box(width, depth, height),
})
