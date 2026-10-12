import { definePlugin } from '../types'

/**
 * A bendy arm with a barbed hook on its tip. Push it through its catch: the sloped tip bends the arm,
 * then it springs back and the flat underside of the hook holds.
 */
export default definePlugin({
  id: 'snap-clip',
  name: 'Snap clip',
  icon: '🪝',
  version: 1,
  palette: 'hidden',
  params: {
    width: { type: 'mm', default: 6, min: 1, max: 50, label: 'Width' },
    thickness: { type: 'mm', default: 1.5, min: 0.8, max: 10, label: 'Arm thickness' },
    length: { type: 'mm', default: 12, min: 4, max: 100, label: 'Arm length' },
    hook: { type: 'mm', default: 1, min: 0.3, max: 5, label: 'Hook size' },
  },
  size: { y: 'width', z: 'length' },
  build: ({ width, thickness, length, hook }, cad) => {
    const ramp = 2 * hook
    if (length <= ramp + 1) throw new Error(`Make the arm longer than ${Math.round((ramp + 1) * 100) / 100} mm for that hook.`)
    const half = thickness / 2
    return cad.extrudeSide([
      [-half, 0], [half, 0], [half, length - ramp], [half + hook, length - ramp], [half, length], [-half, length],
    ], width)
  },
})
