import { definePlugin } from '../types'
import { polygonOutline } from './shape-profile'

/** A flat-sided shape with equal sides: triangle, square, hexagon and so on. */
export default definePlugin({
  id: 'polygon',
  name: 'Polygon',
  icon: '🛑',
  version: 1,
  palette: 'more',
  params: {
    sides: { type: 'whole', default: 6, min: 3, max: 12, label: 'Sides' },
    diameter: { type: 'mm', default: 20, label: 'Diameter' },
    height: { type: 'mm', default: 10, label: 'Height' },
  },
  size: { x: 'diameter', y: 'diameter', z: 'height' },
  build: ({ sides, diameter, height }, cad) => cad.prism(polygonOutline(sides, diameter), height),
})
