import { definePlugin } from '../types'

/** A bullet-shaped dome: a parabola spun round the middle. */
export default definePlugin({
  id: 'paraboloid',
  name: 'Paraboloid',
  icon: '🥚',
  version: 1,
  palette: 'more',
  params: {
    diameter: { type: 'mm', default: 20, label: 'Diameter' },
    height: { type: 'mm', default: 20, label: 'Height' },
  },
  size: { x: 'diameter', y: 'diameter', z: 'height' },
  build: ({ diameter, height }, cad) => {
    const r = diameter / 2
    // A quadratic Bézier from the rim to the tip, written as a cubic.
    return cad.revolve([
      [0, 0],
      [r, 0],
      { curve: [[r - r / 3, (2 * height) / 3], [r / 3, height], [0, height]] },
    ])
  },
})
