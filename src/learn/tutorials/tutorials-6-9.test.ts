import { describe, expect, it } from 'vitest'
import { modifierField } from '../../document/fields'
import { addModifier } from '../../document/modifiers'
import { setFit } from '../../document/variable-ops'
import { lessonHarness } from '../testing/harness'
import { perfectFit } from './perfect-fit'
import { readyToPrint } from './ready-to-print'
import { roundRepeat } from './round-repeat'
import { workplaneTutorial } from './workplane'

describe('Build on a face', () => {
  it('ticks off each step', () => {
    const h = lessonHarness(workplaneTutorial)
    h.actions.addShape('box')
    expect(h.done('add-box')).toBe(true)
    expect(h.done('workplane-button')).toBe(false)
    h.actions.toggleWorkplanePicking()
    expect(h.done('workplane-button')).toBe(true)
    expect(h.done('pick-face')).toBe(false)
    h.store.getState().setWorkplane({ origin: [0, 0, 20], rotation: [0, 0, 0] })
    expect(h.done('pick-face')).toBe(true)
    h.actions.addShape('cone')
    expect(h.done('add-cone')).toBe(true)
    expect(h.done('ground')).toBe(false)
    h.actions.resetWorkplane()
    expect(h.done('ground')).toBe(true)
  })
})

describe('Round and repeat', () => {
  it('ticks off each step', () => {
    const h = lessonHarness(roundRepeat)
    h.actions.addShape('box')
    const id = h.firstShape('box')
    let filletId = ''
    h.apply((d) => { const r = addModifier(d, id, 'fillet'); filletId = r.modifierId; return r.doc })
    expect(h.done('round')).toBe(true)
    expect(h.done('roundness')).toBe(false)
    h.setField(id, modifierField(filletId, 'radius'), '3')
    expect(h.done('roundness')).toBe(true)
    let rowId = ''
    h.apply((d) => { const r = addModifier(d, id, 'linearPattern'); rowId = r.modifierId; return r.doc })
    expect(h.done('repeat')).toBe(true)
    expect(h.done('count')).toBe(false)
    h.setField(id, modifierField(rowId, 'count'), '4')
    expect(h.done('count')).toBe(true)
    h.apply((d) => addModifier(d, id, 'mirror').doc)
    expect(h.done('mirror')).toBe(true)
  })
})

describe('Perfect fit', () => {
  it('ticks off each step', () => {
    const h = lessonHarness(perfectFit)
    h.actions.addKit('peg-socket')
    expect(h.done('kit')).toBe(true)
    expect(h.done('fit')).toBe(false)
    h.apply((d) => setFit(d, 0.3, h.normalize))
    expect(h.done('fit')).toBe(true)
    h.actions.cancel() // addKit selects the new parts; Kade starts this step with nothing selected
    expect(h.done('select-pair')).toBe(false)
    h.actions.selectNode(h.firstShape('peg'), false)
    h.actions.selectNode(h.firstShape('socket'), true)
    expect(h.done('select-pair')).toBe(true)
    expect(h.done('check')).toBe(false)
    const s = h.store.getState()
    s.setOverlap({ doc: s.history.present, selection: s.selection, result: { status: 'none' } })
    expect(h.done('check')).toBe(true)
  })
})

describe('Ready to print', () => {
  it('needs a part, then reads through the export steps', () => {
    const h = lessonHarness(readyToPrint)
    expect(h.done('add-box')).toBe(false)
    h.actions.addShape('box')
    expect(h.done('add-box')).toBe(true)
    expect(readyToPrint.steps.slice(1).every((s) => s.check === undefined)).toBe(true)
  })
})
