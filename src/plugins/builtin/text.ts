import { definePlugin } from '../types'

/** Raised letters in BloKade's chunky, easy-to-read font. */
export default definePlugin({
  id: 'text',
  name: 'Text',
  icon: '🔤',
  version: 1,
  params: {
    text: { type: 'text', default: 'Kade', maxLength: 40, label: 'Text' },
    size: { type: 'mm', default: 10, min: 2, max: 200, label: 'Letter size' },
    depth: { type: 'mm', default: 3, min: 0.4, max: 100, label: 'Thickness' },
  },
  size: { x: 'size', y: 'size', z: 'depth' },
  build: ({ text, size, depth }, cad) => cad.text(text, size, depth),
})
