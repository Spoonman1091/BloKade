import { definePlugin } from '../types'
import { icosahedronOnFace } from './shape-profile'

/** A twenty-sided die shape, resting on one of its faces. */
export default definePlugin({
  id: 'icosahedron',
  name: 'Icosahedron',
  icon: '🎲',
  version: 1,
  palette: 'more',
  params: {
    diameter: { type: 'mm', default: 20, label: 'Diameter' },
  },
  size: { x: 'diameter', y: 'diameter', z: 'diameter' },
  build: ({ diameter }, cad) => {
    const { points, triangles } = icosahedronOnFace(diameter)
    return cad.polyhedron(points, triangles)
  },
})
