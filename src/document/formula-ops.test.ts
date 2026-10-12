import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from './factory'
import { formulaErrors, recomputeFormulas, setFieldInput, type NormalizeField } from './formula-ops'
import { addNode, DocumentOpError } from './ops'
import type { BloKadeDocument, Variable } from './types'

const clampSizes: NormalizeField = (_node, key, value) => (key.startsWith('param.') ? Math.min(2000, Math.max(0.01, value)) : value)

function setup(variables: readonly Variable[] = [{ name: 'wall', expr: '3' }]): BloKadeDocument {
  const box = createShapeNode({ id: 'b', shapeType: 'box', name: 'Box', params: { width: 20, depth: 20, height: 20 }, color: '#f00' })
  return addNode({ ...createEmptyDocument(), variables }, box)
}
const nodeOf = (doc: BloKadeDocument) => doc.nodes.b

describe('setFieldInput', () => {
  it('works out a formula and remembers its text', () => {
    const doc = setFieldInput(setup(), 'b', 'param.width', 'wall * 10', clampSizes)
    expect(nodeOf(doc)).toMatchObject({ params: { width: 30 }, formulas: { 'param.width': 'wall * 10' } })
  })

  it('replaces a formula with a plain number', () => {
    const withFormula = setFieldInput(setup(), 'b', 'param.width', 'wall * 10', clampSizes)
    const doc = setFieldInput(withFormula, 'b', 'param.width', ' 12 ', clampSizes)
    expect(nodeOf(doc)?.formulas).toBeUndefined()
    expect(nodeOf(doc)).toMatchObject({ params: { width: 12 } })
  })

  it('keeps a broken formula and the last good number', () => {
    const doc = setFieldInput(setup(), 'b', 'param.width', 'wal * 10', clampSizes)
    expect(nodeOf(doc)).toMatchObject({ params: { width: 20 }, formulas: { 'param.width': 'wal * 10' } })
    expect(formulaErrors(doc).b?.['param.width']).toContain(`"wal" isn't a variable`)
  })

  it('clamps numbers and formula results the same way', () => {
    expect(nodeOf(setFieldInput(setup(), 'b', 'param.width', '-5', clampSizes))).toMatchObject({ params: { width: 0.01 } })
    expect(nodeOf(setFieldInput(setup(), 'b', 'param.width', 'wall - 100', clampSizes))).toMatchObject({ params: { width: 0.01 } })
  })

  it('works for position and rotation', () => {
    const doc = setFieldInput(setFieldInput(setup(), 'b', 'position.0', 'wall + 1', clampSizes), 'b', 'rotation.2', '90 / wall', clampSizes)
    expect(nodeOf(doc)?.transform).toEqual({ position: [4, 0, 0], rotation: [0, 0, 30] })
  })

  it('leaves the design alone when a typed number changes nothing', () => {
    const doc = setup()
    expect(setFieldInput(doc, 'b', 'param.width', '20', clampSizes)).toBe(doc)
  })

  it('refuses empty input, giant formulas, and fields a part does not have', () => {
    expect(() => setFieldInput(setup(), 'b', 'param.width', '  ', clampSizes)).toThrow(DocumentOpError)
    expect(() => setFieldInput(setup(), 'b', 'param.width', '1+'.repeat(150), clampSizes)).toThrow(DocumentOpError)
    expect(() => setFieldInput(setup(), 'b', 'param.colour', '3', clampSizes)).toThrow(DocumentOpError)
  })
})

describe('recomputeFormulas', () => {
  it('re-runs formulas after a variable changes', () => {
    const doc = setFieldInput(setup(), 'b', 'param.width', 'wall * 10', clampSizes)
    const changed = recomputeFormulas({ ...doc, variables: [{ name: 'wall', expr: '5' }] }, clampSizes)
    expect(nodeOf(changed)).toMatchObject({ params: { width: 50 } })
  })

  it('keeps the last good number when a variable disappears (Review Focus 1)', () => {
    const doc = setFieldInput(setup(), 'b', 'param.width', 'wall * 10', clampSizes)
    const gone = recomputeFormulas({ ...doc, variables: [] }, clampSizes)
    expect(nodeOf(gone)).toMatchObject({ params: { width: 30 }, formulas: { 'param.width': 'wall * 10' } })
    expect(formulaErrors(gone).b?.['param.width']).toContain(`"wall" isn't a variable`)
  })
})
