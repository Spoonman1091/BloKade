import { definePlugin } from '../types'

export default definePlugin({
  id: 'torus',
  name: 'Ring',
  icon: '🍩',
  version: 1,
  params: {
    diameter: { type: 'mm', default: 40, label: 'Outside diameter' },
    thickness: { type: 'mm', default: 10, label: 'Thickness' },
  },
  size: { x: 'diameter', y: 'diameter', z: 'thickness' },
  build: ({ diameter, thickness }, cad) => cad.torus(diameter, thickness),
})
