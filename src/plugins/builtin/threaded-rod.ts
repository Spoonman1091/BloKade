import { THREAD_SIZE_OPTIONS, THREADS } from '../fit-sizes'
import { definePlugin } from '../types'

/** A printable metric-style threaded rod. Big sizes (M8 and up) print best. */
export default definePlugin({
  id: 'threaded-rod',
  name: 'Threaded rod',
  icon: '🪛',
  version: 1,
  palette: 'fit',
  params: {
    size: { type: 'choice', default: 'M8', label: 'Thread size', options: THREAD_SIZE_OPTIONS },
    length: { type: 'mm', default: 20, min: 2, max: 100, label: 'Length' },
  },
  size: { z: 'length' },
  build: ({ size, length }, cad) => {
    const { diameter, pitch } = THREADS[size as keyof typeof THREADS]
    return cad.thread(diameter, pitch, length)
  },
})
