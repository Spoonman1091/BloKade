import { describe, expect, it } from 'vitest'
import type { PrintCheckResult } from '../geometry/types'
import { printerById } from './printers'
import { printMessages } from './print-messages'

const mesh = {} as never
const checked = (over: Partial<Extract<PrintCheckResult, { status: 'checked' }>> = {}): PrintCheckResult =>
  ({ status: 'checked', floating: null, thin: null, overhang: null, thinFinished: true, ...over })
const mini = printerById('bambu-a1-mini')
const FLOAT_TAIL = ' above the plate. It would print in mid-air and fall over. Move it down so it touches the plate or another part.'

describe('printMessages', () => {
  it('says there is nothing to check', () => {
    expect(printMessages({ status: 'nothing' }, mini)).toEqual([{ kind: 'nothing', text: "There's nothing to check. Add a solid shape." }])
  })

  it('says all clear, naming the printer when there is one', () => {
    expect(printMessages(checked(), mini)).toEqual([{ kind: 'clear', text: '✅ Looks ready to print on the Bambu Lab A1 mini.' }])
    expect(printMessages(checked(), null)).toEqual([{ kind: 'clear', text: '✅ Looks ready to print.' }])
  })

  it('counts floating pieces', () => {
    expect(printMessages(checked({ floating: { amount: 1, mesh } }), mini)[0]).toEqual({ kind: 'floating', text: `**1 piece is floating**${FLOAT_TAIL}` })
    expect(printMessages(checked({ floating: { amount: 3, mesh } }), mini)[0]).toEqual({ kind: 'floating', text: `**3 pieces are floating**${FLOAT_TAIL}` })
  })

  it('warns about thin walls, and about walls too thin to print', () => {
    expect(printMessages(checked({ thin: { veryThin: false, mesh } }), mini)[0]).toEqual({
      kind: 'thin',
      text: '**Some walls are very thin** (less than 0.8 mm). They may print broken or not at all. Make them thicker.',
    })
    expect(printMessages(checked({ thin: { veryThin: true, mesh } }), mini)[0]).toEqual({
      kind: 'thin',
      text: '**Some walls are very thin** (less than 0.8 mm, and some less than 0.4 mm, too thin to print). They may print broken or not at all. Make them thicker.',
    })
  })

  it('explains overhangs', () => {
    expect(printMessages(checked({ overhang: { amount: 10, mesh } }), mini)[0]).toEqual({
      kind: 'overhang',
      text: '**Some parts hang over empty space** (shown in orange). They need supports: turn on **Supports** in Bambu Studio, or turn the part so it rests on a flat side, or give the underside a slope.',
    })
  })

  it('admits when the thin-wall check ran out of time, and never calls that clear', () => {
    expect(printMessages(checked({ thinFinished: false }), mini)).toEqual([
      { kind: 'unfinished', text: "Couldn't finish the thin-wall check; the design is very detailed." },
    ])
  })

  it('lists floating, thin, overhang, then unfinished', () => {
    const all = checked({ floating: { amount: 2, mesh }, thin: { veryThin: false, mesh }, overhang: { amount: 5, mesh }, thinFinished: false })
    expect(printMessages(all, mini).map((m) => m.kind)).toEqual(['floating', 'thin', 'overhang', 'unfinished'])
  })
})
