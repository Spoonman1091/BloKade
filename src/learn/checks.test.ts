import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { paramField } from '../document/fields'
import { addModifier } from '../document/modifiers'
import { addNode, groupNodes } from '../document/ops'
import type { BloKadeDocument } from '../document/types'
import { groupsOf, modifiersOfType, nodeById, paramFormula, shapesOf, variableExpr } from './checks'
import type { LessonView } from './types'

const viewOf = (doc: BloKadeDocument, selection: string[] = []): LessonView => ({
  doc, selection, tool: 'move', workplane: null, pickingWorkplane: false, designId: 'd', overlapShown: false, canUndo: false,
})
const box = createShapeNode({ id: 'b', shapeType: 'box', name: 'Box', params: { width: 20 }, color: '#fff' })
const cyl = createShapeNode({ id: 'c', shapeType: 'cylinder', name: 'Cylinder', params: { diameter: 20 }, color: '#fff' })
const twoParts = addNode(addNode(createEmptyDocument(), box), cyl)

describe('lesson checks', () => {
  it('finds shapes by type and groups', () => {
    expect(shapesOf(viewOf(twoParts)).map((s) => s.id)).toEqual(['b', 'c'])
    expect(shapesOf(viewOf(twoParts), 'cylinder').map((s) => s.id)).toEqual(['c'])
    const grouped = groupNodes(twoParts, ['b', 'c'], 'g').doc
    expect(groupsOf(viewOf(grouped)).map((g) => g.id)).toEqual(['g'])
  })

  it('looks nodes up safely', () => {
    expect(nodeById(viewOf(twoParts), 'b')?.name).toBe('Box')
    expect(nodeById(viewOf(twoParts), 'toString')).toBeUndefined()
  })

  it('reads modifiers, variables and formulas', () => {
    const rounded = addModifier(twoParts, 'b', 'fillet').doc
    expect(modifiersOfType(viewOf(rounded), 'fillet')).toHaveLength(1)
    expect(modifiersOfType(viewOf(rounded), 'mirror')).toEqual([])
    const withVar = { ...twoParts, variables: [{ name: 'wall', expr: '3' }] }
    expect(variableExpr(viewOf(withVar), 'wall')).toBe('3')
    expect(variableExpr(viewOf(withVar), 'gap')).toBeUndefined()
    const formula = { ...box, formulas: { [paramField('width')]: 'wall * 10' } }
    expect(paramFormula(formula, 'width')).toBe('wall * 10')
    expect(paramFormula(box, 'width')).toBeUndefined()
  })
})
