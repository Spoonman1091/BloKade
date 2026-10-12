import { definePlugin } from '../types'

export default definePlugin<'bottomDiameter' | 'topDiameter' | 'height'>({
  id: 'cone',
  name: 'Cone',
  icon: '🔺',
  version: 1,
  params: {
    bottomDiameter: { type: 'mm', default: 20, label: 'Bottom diameter' },
    topDiameter: { type: 'mm', default: 0, min: 0, label: 'Top diameter' },
    height: { type: 'mm', default: 20, label: 'Height' },
  },
  size: { x: 'bottomDiameter', y: 'bottomDiameter', z: 'height' },
  build: ({ bottomDiameter, topDiameter, height }, cad) =>
    cad.revolve([[0, 0], [bottomDiameter / 2, 0], [topDiameter / 2, height], [0, height]]),
})
