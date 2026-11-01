import { definePlugin } from '../types'
import { quarterEllipse } from './shape-profile'

/** A dome: a quarter of an ellipse spun round the middle. */
export default definePlugin({
  id: 'half-sphere',
  name: 'Half sphere',
  icon: '🌗',
  version: 1,
  palette: 'more',
  params: {
    diameter: { type: 'mm', default: 20, label: 'Diameter' },
    height: { type: 'mm', default: 10, label: 'Height' },
  },
  size: { x: 'diameter', y: 'diameter', z: 'height' },
  build: ({ diameter, height }, cad) => {
    const radius = diameter / 2
    return cad.revolve([[0, 0], [radius, 0], quarterEllipse(0, 0, radius, height)])
  },
})
