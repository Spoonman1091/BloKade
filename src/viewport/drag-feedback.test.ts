import { describe, expect, it } from 'vitest'
import type { Box } from '../document/box'
import { dragFeedback } from './drag-feedback'

const wall = { id: 'w', name: 'Wall', box: { min: [-10, -10, 0], max: [10, 10, 20] } as Box }
const spanX = (min: number, max: number): Box => ({ min: [min, -10, 0], max: [max, 10, 20] })

describe('dragFeedback', () => {
  it('snaps on the dragged axes and measures the snapped box', () => {
    expect(dragFeedback(spanX(11, 31), [wall], [0]))
      .toEqual({ offset: [-1, 0, 0], text: '20 × 20 × 20 mm · touching Wall · lined up with Wall' })
  })

  it('measures without snapping when snapping is off', () => {
    expect(dragFeedback(spanX(11, 31), [wall], null))
      .toEqual({ offset: [0, 0, 0], text: '20 × 20 × 20 mm · 1 mm from Wall' })
  })

  it('leaves the box alone when nothing is close enough to snap', () => {
    expect(dragFeedback(spanX(20, 40), [wall], [0]))
      .toEqual({ offset: [0, 0, 0], text: '20 × 20 × 20 mm · 10 mm from Wall' })
  })
})
