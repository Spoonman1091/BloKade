import { describe, expect, it } from 'vitest'
import { modifierField, paramField, positionField, rotationField } from '../../document/fields'
import { addModifier } from '../../document/modifiers'
import { setFit } from '../../document/variable-ops'
import { lessonHarness } from '../testing/harness'
import { perfectFit } from './perfect-fit'
import { readyToPrint } from './ready-to-print'
import { roundRepeat } from './round-repeat'
import { snapTogether } from './snap-together'
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
    expect(h.done('check')).toBe(false)
    const s = h.store.getState()
    s.setOverlap({ doc: s.history.present, selection: s.selection, result: { status: 'none' } })
    expect(h.done('check')).toBe(true)
  })
})

describe('Snap together', () => {
  it('ticks off each step', () => {
    const h = lessonHarness(snapTogether)
    expect(h.done('kit')).toBe(false)
    h.actions.addKit('snap-fit')
    expect(h.done('kit')).toBe(true)
    expect(h.done('thickness')).toBe(false)
    h.apply((d) => ({ ...d, variables: d.variables.map((v) => v.name === 'clip_thickness' ? { ...v, expr: '2' } : v) }))
    expect(h.done('thickness')).toBe(true)
    const clip = h.firstShape('snap-clip')
    const slot = h.firstShape('snap-catch')
    expect(h.done('select-catch')).toBe(false)
    h.store.getState().select([slot])
    expect(h.done('select-catch')).toBe(true)
    expect(h.done('wall')).toBe(false)
    h.setField(slot, paramField('wall'), '4')
    expect(h.done('wall')).toBe(true)
    expect(h.done('select-clip')).toBe(false)
    h.store.getState().select([clip])
    expect(h.done('select-clip')).toBe(true)
    expect(h.done('lay-flat')).toBe(false)
    h.setField(clip, rotationField(0), '90')
    expect(h.done('lay-flat')).toBe(true)
    expect(h.done('put-down')).toBe(false)
    h.setField(clip, positionField(2), '3')
    expect(h.done('put-down')).toBe(true)
  })

  it('accepts laying the clip down the other way', () => {
    const h = lessonHarness(snapTogether)
    h.actions.addKit('snap-fit')
    h.setField(h.firstShape('snap-clip'), rotationField(0), '-90')
    expect(h.done('lay-flat')).toBe(true)
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
