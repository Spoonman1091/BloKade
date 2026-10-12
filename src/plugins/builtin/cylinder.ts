import { definePlugin } from '../types'

export default definePlugin({
  id: 'cylinder',
  name: 'Cylinder',
  icon: '🥫',
  version: 1,
  params: {
    diameter: { type: 'mm', default: 20, label: 'Diameter' },
    height: { type: 'mm', default: 20, label: 'Height' },
  },
  size: { x: 'diameter', y: 'diameter', z: 'height' },
  build: ({ diameter, height }, cad) => cad.cylinder(diameter, height),
})
