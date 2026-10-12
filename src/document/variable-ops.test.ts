import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from './factory'
import { formulaErrors, setFieldInput, type NormalizeField } from './formula-ops'
import { addNode, DocumentOpError } from './ops'
import type { BloKadeDocument } from './types'
import { addVariable, nextVariableName, removeVariable, renameVariable, setFit, setVariableExpr } from './variable-ops'

const same: NormalizeField = (_node, _key, value) => value

function setup(): BloKadeDocument {
  const box = createShapeNode({ id: 'b', shapeType: 'box', name: 'Box', params: { width: 20, depth: 20, height: 20 }, color: '#f00' })
  const doc = addNode({ ...createEmptyDocument(), variables: [{ name: 'wall', expr: '3' }, { name: 'thick', expr: 'wall + 1' }] }, box)
  return setFieldInput(doc, 'b', 'param.width', 'wall * 10', same)
}
const width = (doc: BloKadeDocument) => {
  const node = doc.nodes.b
  return node?.kind === 'shape' ? node.params.width : undefined
}

describe('variable operations', () => {
  it('adds a variable, refusing bad names', () => {
    const doc = addVariable(setup(), 'gap', '1 + fit', same)
    expect(doc.variables.at(-1)).toEqual({ name: 'gap', expr: '1 + fit' })
    expect(() => addVariable(setup(), 'fit', '1', same)).toThrow(DocumentOpError)
    expect(() => addVariable(setup(), 'wall', '1', same)).toThrow('already a variable called "wall"')
  })

  it('changes a variable and resizes the parts that use it', () => {
    expect(width(setVariableExpr(setup(), 'wall', '5', same))).toBe(50)
    expect(() => setVariableExpr(setup(), 'nope', '5', same)).toThrow(`no variable called "nope"`)
    expect(() => setVariableExpr(setup(), 'wall', ' ', same)).toThrow(DocumentOpError)
  })

  it('renames a variable everywhere it is used (Review Focus 1)', () => {
    const doc = renameVariable(setup(), 'wall', 'side', same)
    expect(doc.variables).toEqual([{ name: 'side', expr: '3' }, { name: 'thick', expr: 'side + 1' }])
    expect(doc.nodes.b?.formulas).toEqual({ 'param.width': 'side * 10' })
    expect(width(doc)).toBe(30)
    expect(formulaErrors(doc)).toEqual({})
    expect(() => renameVariable(setup(), 'wall', 'thick', same)).toThrow('already a variable called "thick"')
    expect(renameVariable(setup(), 'wall', 'wall', same)).toEqual(setup())
  })

  it('refuses a rename that would push a formula past the length limit', () => {
    const long = Array.from({ length: 64 }, () => 'w').join('+')
    const base = { ...setup(), variables: [{ name: 'w', expr: '1' }] }
    const doc = setFieldInput(base, 'b', 'param.width', long, same)
    expect(long.length).toBeGreaterThan(120)
    const longName = 'a'.repeat(30)
    expect(() => renameVariable(doc, 'w', longName, same)).toThrow(
      'That name would make a formula longer than 200 characters. Pick a shorter name.',
    )
    expect(doc.nodes.b?.formulas?.['param.width']).toBe(long)
    expect(doc.variables).toEqual([{ name: 'w', expr: '1' }])
  })

  it('removing a variable keeps the last size and shows a problem (Review Focus 1)', () => {
    const doc = removeVariable(setup(), 'wall', same)
    expect(width(doc)).toBe(30)
    expect(formulaErrors(doc).b?.['param.width']).toContain(`"wall" isn't a variable`)
  })

  it('sets the fit gap within 0-2 mm and re-runs formulas that use it', () => {
    const doc = setFieldInput(setup(), 'b', 'param.width', '10 + fit', same)
    expect(width(setFit(doc, 0.5, same))).toBe(10.5)
    expect(setFit(doc, 9, same).settings.fit).toBe(2)
    expect(setFit(doc, -1, same).settings.fit).toBe(0)
    expect(() => setFit(doc, Number.NaN, same)).toThrow(DocumentOpError)
  })

  it('suggests the first free name for a new variable', () => {
    const empty = createEmptyDocument()
    expect(nextVariableName(empty)).toBe('var1')
    expect(nextVariableName({ ...empty, variables: [{ name: 'var1', expr: '1' }] })).toBe('var2')
    expect(nextVariableName({ ...empty, variables: [{ name: 'var2', expr: '1' }] })).toBe('var1')
  })
})
