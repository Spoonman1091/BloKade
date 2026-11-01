import { definePlugin } from '../types'

/** A pyramid: where a roof across X and a roof across Y overlap. */
export default definePlugin({
  id: 'pyramid',
  name: 'Pyramid',
  icon: '🗻',
  version: 1,
  palette: 'more',
  params: {
    width: { type: 'mm', default: 20, label: 'Width' },
    depth: { type: 'mm', default: 20, label: 'Depth' },
    height: { type: 'mm', default: 20, label: 'Height' },
  },
  size: { x: 'width', y: 'depth', z: 'height' },
  build: ({ width, depth, height }, cad) => {
    const across = cad.extrudeSide([[-width / 2, 0], [width / 2, 0], [0, height]], depth)
    const along = cad.extrudeSide([[-depth / 2, 0], [depth / 2, 0], [0, height]], width)
    const turned = along.rotate(90, [0, 0, 0], [0, 0, 1])
    try {
      return across.intersect(turned)
    } finally {
      across.delete()
      along.delete()
      turned.delete()
    }
  },
})
