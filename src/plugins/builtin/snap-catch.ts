import { definePlugin } from '../types'

/** The slot a snap clip pushes through. It fits the arm, not the hook, so the hook catches the far side. */
export default definePlugin({
  id: 'snap-catch',
  name: 'Snap catch',
  icon: '🔲',
  version: 1,
  mode: 'hole',
  palette: 'hidden',
  params: {
    width: { type: 'mm', default: 6, min: 1, max: 50, label: 'Clip width' },
    thickness: { type: 'mm', default: 1.5, min: 0.8, max: 10, label: 'Arm thickness' },
    wall: { type: 'mm', default: 3, min: 0.5, max: 50, label: 'Wall thickness' },
    clearance: { type: 'mm', default: 0.2, min: 0, max: 2, label: 'Extra room', formula: 'fit' },
  },
  size: { z: 'wall' },
  // 1 mm extra above and below the wall, so the slot always goes right through it.
  build: ({ width, thickness, wall, clearance }, cad) => cad.box(thickness + 2 * clearance, width + 2 * clearance, wall + 2),
})
