import { definePlugin } from '../types'
import { heartOutline } from './shape-profile'

/** A heart with its point at the front. */
export default definePlugin({
  id: 'heart',
  name: 'Heart',
  icon: '❤️',
  version: 1,
  palette: 'more',
  params: {
    width: { type: 'mm', default: 20, label: 'Width' },
    length: { type: 'mm', default: 18, label: 'Length' },
    height: { type: 'mm', default: 5, label: 'Height' },
  },
  size: { x: 'width', y: 'length', z: 'height' },
  build: ({ width, length, height }, cad) => cad.prism(heartOutline(width, length), height),
})
