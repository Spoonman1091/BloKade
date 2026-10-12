import { describe, expect, it } from 'vitest'
import { createGroupNode, createShapeNode } from './factory'
import {
  dropStaleFormulas, formulaEntries, formulaOf, isFieldKey, paramField, positionField, readField, rotationField,
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
})
