import { describe, expect, it } from 'vitest'
import { createGroupNode, createShapeNode } from './factory'
import {
  dropStaleFormulas, formulaEntries, formulaOf, isFieldKey, modifierField, modifierFieldOf, paramField, positionField, readField, rotationField,
  withFormula, writeField,
} from './fields'

const box = createShapeNode({ id: 'b', shapeType: 'text', name: 'Sign', params: { size: 10, text: 'Hi' }, color: '#f00', position: [1, 2, 3] })

describe('fields', () => {
  it('reads numbers from params, position and rotation', () => {
    expect(readField(box, paramField('size'))).toBe(10)
    expect(readField(box, positionField(2))).toBe(3)
    expect(readField(box, rotationField(0))).toBe(0)
    expect(readField(box, paramField('text'))).toBeUndefined()
    expect(readField(box, paramField('missing'))).toBeUndefined()
    expect(readField(createGroupNode({ id: 'g', children: [] }), paramField('size'))).toBeUndefined()
  })

  it('writes a field into a copy and leaves the original alone', () => {
    const moved = writeField(box, positionField(0), 9)
    expect(moved.transform.position).toEqual([9, 2, 3])
    expect(box.transform.position).toEqual([1, 2, 3])
    expect(writeField(box, paramField('size'), 10)).toBe(box)
    expect(writeField(box, paramField('text'), 5)).toBe(box)
  })

  it('adds and removes formulas', () => {
    const withOne = withFormula(box, paramField('size'), 'wall * 2')
    expect(formulaOf(withOne, paramField('size'))).toBe('wall * 2')
    expect(formulaEntries(withOne)).toEqual([['param.size', 'wall * 2']])
    const none = withFormula(withOne, paramField('size'), null)
    expect(formulaOf(none, paramField('size'))).toBeUndefined()
    expect(none.formulas).toBeUndefined()
  })

  it('recognises field keys', () => {
    expect(isFieldKey('param.width')).toBe(true)
    expect(isFieldKey('rotation.2')).toBe(true)
    expect(isFieldKey('rotation.3')).toBe(false)
    expect(isFieldKey('colour')).toBe(false)
  })

  it('forgets formulas whose value an edit changed directly, and keeps the rest', () => {
    const before = withFormula(withFormula(box, positionField(0), 'wall'), paramField('size'), 'wall * 2')
    const dragged = { ...before, transform: { ...before.transform, position: [12, 2, 3] as const } }
    const after = dropStaleFormulas(before, dragged)
    expect(formulaOf(after, positionField(0))).toBeUndefined()
    expect(formulaOf(after, paramField('size'))).toBe('wall * 2')
  })

  it('trusts edits that set formulas themselves', () => {
    const before = withFormula(box, positionField(0), 'wall')
    const after = withFormula(writeField(before, positionField(0), 7), positionField(0), 'wall + 4')
    expect(dropStaleFormulas(before, after)).toBe(after)
  })

  it('keeps a formula when an edit only moved its value by rounding noise (< 1e-6)', () => {
    const before = withFormula(writeField(box, positionField(1), 10 / 3), positionField(1), '10/3')
    const rounded = writeField(before, positionField(1), 3.333333)
    expect(formulaOf(dropStaleFormulas(before, rounded), positionField(1))).toBe('10/3')
    expect(readField(dropStaleFormulas(before, rounded), positionField(1))).toBe(3.333333)
  })
})

describe('modifier fields', () => {
  const withMods = {
    ...box,
    modifiers: [
      { id: 'aaaaaaaa', type: 'fillet', enabled: true, radius: 2, edges: { by: 'description', which: 'top' } },
      { id: 'bbbbbbbb', type: 'linearPattern', enabled: true, count: 3, spacing: [25, 0, 0] },
    ] as const,
  }

  it('builds and recognises modifier field keys', () => {
    expect(modifierField('aaaaaaaa', 'radius')).toBe('mod.aaaaaaaa.radius')
    expect(modifierField('bbbbbbbb', 'spacing', 2)).toBe('mod.bbbbbbbb.spacing.2')
    expect(isFieldKey('mod.aaaaaaaa.radius')).toBe(true)
    expect(isFieldKey('mod.aaaaaaaa.spacing')).toBe(false)
    expect(isFieldKey('mod.aaaaaaaa.radius.1')).toBe(false)
    expect(modifierFieldOf('mod.bbbbbbbb.spacing.0')).toBe('spacing')
    expect(modifierFieldOf('param.width')).toBeNull()
  })

  it('reads and writes modifier numbers immutably', () => {
    expect(readField(withMods, 'mod.aaaaaaaa.radius')).toBe(2)
    expect(readField(withMods, 'mod.bbbbbbbb.spacing.0')).toBe(25)
    expect(readField(withMods, 'mod.aaaaaaaa.count')).toBeUndefined()
    expect(readField(withMods, 'mod.cccccccc.radius')).toBeUndefined()
    const next = writeField(withMods, 'mod.bbbbbbbb.spacing.1', 7)
    expect(next.modifiers?.[1]).toMatchObject({ spacing: [25, 7, 0] })
    expect(withMods.modifiers[1].spacing).toEqual([25, 0, 0])
    expect(writeField(withMods, 'mod.aaaaaaaa.radius', 2)).toBe(withMods)
  })

  it('forgets formulas of a removed modifier (Review Focus 5)', () => {
    const before = withFormula(withMods, 'mod.aaaaaaaa.radius', 'wall')
    const after = { ...before, modifiers: before.modifiers?.filter((m) => m.id !== 'aaaaaaaa') }
    expect(dropStaleFormulas(before, after).formulas).toBeUndefined()
  })
})
