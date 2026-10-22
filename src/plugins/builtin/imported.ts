import { definePlugin } from '../types'

/** A shape imported from an STL file. BloKade builds it from the model stored in the design. */
export default definePlugin({
  id: 'imported',
  name: 'Imported model',
  icon: '📥',
  palette: 'hidden',
  version: 1,
  params: {
    model: { type: 'text', default: '', hidden: true, label: 'Model' },
    width: { type: 'mm', default: 20, label: 'Width' },
    depth: { type: 'mm', default: 20, label: 'Depth' },
    height: { type: 'mm', default: 20, label: 'Height' },
  },
  size: { x: 'width', y: 'depth', z: 'height' },
  build: () => {
    throw new Error('Imported models are built by BloKade itself.')
  },
})
