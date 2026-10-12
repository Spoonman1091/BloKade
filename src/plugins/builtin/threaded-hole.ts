import { THREAD_SIZE_OPTIONS, THREADS } from '../fit-sizes'
import { definePlugin } from '../types'

/** The hole a threaded rod screws into: the same thread, pushed outward by the extra room. */
export default definePlugin({
  id: 'threaded-hole',
  name: 'Threaded hole',
  icon: '🌀',
  version: 1,
  mode: 'hole',
  palette: 'fit',
  params: {
    size: { type: 'choice', default: 'M8', label: 'Thread size', options: THREAD_SIZE_OPTIONS },
    depth: { type: 'mm', default: 15, min: 2, max: 100, label: 'Depth' },
    clearance: { type: 'mm', default: 0.2, min: 0, max: 2, label: 'Extra room', formula: 'fit' },
  },
  size: { z: 'depth' },
  build: ({ size, depth, clearance }, cad) => {
    const { diameter, pitch } = THREADS[size as keyof typeof THREADS]
    return cad.thread(diameter + 2 * clearance, pitch, depth)
  },
})
