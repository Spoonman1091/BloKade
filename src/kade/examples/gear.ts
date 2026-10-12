/** The ⚙️ Gear example from ❓ Commands. Built only from commands Kade can see in the list. */
export const GEAR_CODE = `export default {
  name: 'Gear',
  icon: '⚙️',
  settings: {
    teeth: { type: 'whole', default: 12, min: 6, max: 60, label: 'Teeth' },
    size: { type: 'mm', default: 40, label: 'Size' },
    thickness: { type: 'mm', default: 6, label: 'Thickness' },
    hole: { type: 'mm', default: 5, label: 'Hole' },
  },
  size: { x: 'size', y: 'size', z: 'thickness' },
  build({ teeth, size, thickness, hole }, cad) {
    const toothLength = size / 10
    const body = cad.cylinder(size - toothLength * 2, thickness)
    const tooth = cad.box(toothLength * 2, (Math.PI * size) / teeth / 2, thickness).move(size / 2 - toothLength, 0, 0)
    const ring = cad.repeat(teeth, (i) => tooth.rotate('z', cad.angle(i, teeth)))
    return body.add(ring).cut(cad.cylinder(hole, thickness + 2).move(0, 0, -1))
  },
}
`
