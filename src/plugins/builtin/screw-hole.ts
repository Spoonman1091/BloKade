import { SCREW_SIZE_OPTIONS, SCREWS } from '../fit-sizes'
import { definePlugin } from '../types'
import { hexOutline, screwHoleProfile } from './screw-profile'

/** A ready-made hole for M2–M5 screws, with a countersink, counterbore, nut trap or heat-set insert pocket. */
export default definePlugin({
  id: 'screw-hole',
  name: 'Screw hole',
  icon: '🔩',
  version: 1,
  mode: 'hole',
  palette: 'fit',
  params: {
    size: { type: 'choice', default: 'M3', label: 'Screw size', options: SCREW_SIZE_OPTIONS },
    style: {
      type: 'choice', default: 'plain', label: 'Style', options: [
        { value: 'plain', label: 'Plain hole' },
        { value: 'countersunk', label: 'Countersunk (flat head)' },
        { value: 'counterbored', label: 'Counterbored (cap head)' },
        { value: 'nut', label: 'Nut trap' },
        { value: 'insert', label: 'Heat-set insert' },
      ],
    },
    depth: { type: 'mm', default: 10, min: 2, max: 200, label: 'Depth' },
    clearance: { type: 'mm', default: 0.2, min: 0, max: 2, label: 'Extra room', formula: 'fit' },
  },
  size: { z: 'depth' },
  build: ({ size, style, depth, clearance }, cad) => {
    const screw = SCREWS[size]
    const hole = cad.revolve(screwHoleProfile(screw, style, depth, clearance))
    if (style !== 'nut') return hole
    const nut = cad.prism(hexOutline(screw.nutFlats + 2 * clearance), screw.nutHeight + clearance)
    try {
      return hole.fuse(nut)
    } finally {
      hole.delete()
      nut.delete()
    }
  },
})
