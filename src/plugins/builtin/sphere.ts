import { definePlugin } from '../types'

export default definePlugin({
  id: 'sphere',
  name: 'Sphere',
  icon: '⚪',
  version: 1,
  params: { diameter: { type: 'mm', default: 20, label: 'Diameter' } },
  size: { x: 'diameter', y: 'diameter', z: 'diameter' },
  build: ({ diameter }, cad) => cad.sphere(diameter),
})
