import { definePlugin } from '../types'
import { fmt } from './screw-profile'

/** A pipe: a cylinder with a smaller cylinder taken out of the middle. */
export default definePlugin({
  id: 'tube',
  name: 'Tube',
  icon: '🧻',
  version: 1,
  palette: 'more',
  params: {
    diameter: { type: 'mm', default: 20, label: 'Diameter' },
    height: { type: 'mm', default: 20, label: 'Height' },
    wall: { type: 'mm', default: 2, min: 0.4, label: 'Wall thickness' },
  },
  size: { x: 'diameter', y: 'diameter', z: 'height' },
  build: ({ diameter, height, wall }, cad) => {
    if (wall >= diameter / 2) {
      throw new Error(`The wall is too thick for this tube. Make it less than ${fmt(diameter / 2)} mm.`)
    }
    const outer = cad.cylinder(diameter, height)
    const hole = cad.cylinder(diameter - 2 * wall, height + 2)
    const lowered = hole.translate([0, 0, -1])
    try {
      return outer.cut(lowered)
    } finally {
      outer.delete()
      hole.delete()
      lowered.delete()
    }
  },
})
