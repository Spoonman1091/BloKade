import { describe, expect, it } from 'vitest'
import type { Box } from '../document/box'
import { axesOf, snapToObjects } from './object-snap'

const wall = { id: 'w', name: 'Box', box: { min: [-10, -10, 0], max: [10, 10, 20] } as Box }
const spanX = (min: number, max: number): Box => ({ min: [min, -10, 0], max: [max, 10, 20] })

describe('snapToObjects', () => {
  it('pulls a face flush against a nearby part on the dragged axis', () => {
    expect(snapToObjects(spanX(11, 31), [wall], [0])).toEqual({ offset: [-1, 0, 0], snappedTo: 'Box' })
  })

  it('lines up centers', () => {
    expect(snapToObjects(spanX(-1.5, 4.5), [wall], [0])).toEqual({ offset: [-1.5, 0, 0], snappedTo: 'Box' })
  })

  it('leaves parts alone when nothing is within 2 mm', () => {
    expect(snapToObjects(spanX(13, 33), [wall], [0])).toEqual({ offset: [0, 0, 0], snappedTo: null })
  })

  it('only snaps on the axes being dragged', () => {
    const offY: Box = { min: [11, 11, 0], max: [31, 31, 20] }
    expect(snapToObjects(offY, [wall], [0]).offset).toEqual([-1, 0, 0])
    expect(snapToObjects(offY, [wall], []).offset).toEqual([0, 0, 0])
  })
})

describe('axesOf', () => {
  it('reads the dragged handle', () => {
    expect(axesOf('X')).toEqual([0])
    expect(axesOf('XY')).toEqual([0, 1])
    expect(axesOf('XYZ')).toEqual([0, 1, 2])
    expect(axesOf('XYZE')).toEqual([])
    expect(axesOf(null)).toEqual([])
    expect(axesOf(undefined)).toEqual([])
  })
})
