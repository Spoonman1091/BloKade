import { definePlugin } from '../types'
import { starOutline } from './shape-profile'

/** A star with a point at the back. */
export default definePlugin({
  id: 'star',
  name: 'Star',
  icon: '⭐',
  version: 1,
  palette: 'more',
  params: {
    points: { type: 'whole', default: 5, min: 3, max: 12, label: 'Points' },
    diameter: { type: 'mm', default: 20, label: 'Diameter' },
    inner: { type: 'mm', default: 10, label: 'Inner diameter' },
    height: { type: 'mm', default: 5, label: 'Height' },
  },
  size: { x: 'diameter', y: 'diameter', z: 'height' },
  alsoScales: { inner: 'x' },
  build: ({ points, diameter, inner, height }, cad) => {
    if (inner >= diameter) throw new Error('The inner diameter must be smaller than the diameter.')
    return cad.prism(starOutline(points, diameter, inner), height)
  },
})
