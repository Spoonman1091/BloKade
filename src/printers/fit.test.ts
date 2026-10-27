import { describe, expect, it } from 'vitest'
import type { Box } from '../document/box'
import { fitWarning, misfits, type PartBox } from './fit'
import { printerById, type Printer } from './printers'

const A1_MINI = printerById('bambu-a1-mini') as Printer
const box = (min: [number, number, number], max: [number, number, number]): Box => ({ min, max })
const part = (name: string, b: Box, mode: 'solid' | 'hole' = 'solid'): PartBox => ({ id: name, name, mode, box: b })

describe('misfits', () => {
  it('lets a part on the plate through', () => {
    expect(misfits([part('Box', box([-10, -10, 0], [10, 10, 20]))], A1_MINI)).toEqual([])
  })

  it('lets a part that just touches the edge through', () => {
    expect(misfits([part('Edge', box([70, -90, 0], [90, 90, 180]))], A1_MINI)).toEqual([])
  })

  it('finds a part hanging off the plate', () => {
    expect(misfits([part('Box', box([80, -10, 0], [100, 10, 20]))], A1_MINI))
      .toEqual([{ id: 'Box', name: 'Box', offPlate: true, tooTall: false }])
  })

  it('finds a part taller than the printer, measured from its own bottom', () => {
    expect(misfits([part('Tower', box([-5, -5, 50], [5, 5, 240]))], A1_MINI))
      .toEqual([{ id: 'Tower', name: 'Tower', offPlate: false, tooTall: true }])
    expect(misfits([part('Raised', box([-5, -5, 50], [5, 5, 220]))], A1_MINI)).toEqual([])
  })

  it('ignores holes', () => {
    expect(misfits([part('Hole', box([200, 200, 0], [210, 210, 10]), 'hole')], A1_MINI)).toEqual([])
  })

  it('checks nothing without a printer', () => {
    expect(misfits([part('Far', box([500, 500, 0], [510, 510, 10]))], null)).toEqual([])
  })
})

describe('fitWarning', () => {
  it('names one part that is off the plate', () => {
    expect(fitWarning([{ id: 'a', name: 'Box', offPlate: true, tooTall: false }], A1_MINI))
      .toBe("**Box** doesn't fit on the Bambu Lab A1 mini. Move it onto the plate or make it smaller.")
  })

  it('says when a part is too tall', () => {
    expect(fitWarning([{ id: 'a', name: 'Tower', offPlate: false, tooTall: true }], A1_MINI))
      .toBe("**Tower** doesn't fit on the Bambu Lab A1 mini. Move it onto the plate or make it smaller. It's taller than 180 mm.")
  })

  it('counts several parts', () => {
    const three = ['A', 'B', 'C'].map((name) => ({ id: name, name, offPlate: true, tooTall: false }))
    expect(fitWarning(three, A1_MINI))
      .toBe("3 parts don't fit on the Bambu Lab A1 mini. Move them onto the plate or make them smaller.")
  })

  it('says nothing when everything fits', () => {
    expect(fitWarning([], A1_MINI)).toBeNull()
  })
})
