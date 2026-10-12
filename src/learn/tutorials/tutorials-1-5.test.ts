import { describe, expect, it } from 'vitest'
import { paramField, positionField, rotationField } from '../../document/fields'
import { renameDocument } from '../../document/ops'
import { addVariable, renameVariable, setVariableExpr } from '../../document/variable-ops'
import { lessonHarness } from '../testing/harness'
import { firstShape } from './first-shape'
import { holesGroups } from './holes-groups'
import { moveTurnSize } from './move-turn-size'
import { smartSizes } from './smart-sizes'
import { undoSave } from './undo-save'

describe('Your first shape', () => {
  it('ticks off each step as Kade does it', () => {
    const h = lessonHarness(firstShape)
    expect(h.done('add-box')).toBe(false)
    h.actions.addShape('box')
    expect(h.done('add-box')).toBe(true)
    expect(h.done('width')).toBe(false)
    h.setField(h.firstShape('box'), paramField('width'), '40')
    expect(h.done('width')).toBe(true)
    expect(h.done('look')).toBe(false)
    expect(h.done('deselect')).toBe(false)
    h.actions.cancel()
    expect(h.done('deselect')).toBe(true)
    expect(h.done('reselect')).toBe(false)
    h.actions.selectNode(h.firstShape('box'), false)
    expect(h.done('reselect')).toBe(true)
  })

  it('is not fooled by an empty design (Review Focus 1)', () => {
    const h = lessonHarness(firstShape)
    h.actions.cancel()
    expect(h.done('deselect')).toBe(false)
  })
})

describe('Move, turn and size', () => {
  it('ticks off each step', () => {
    const h = lessonHarness(moveTurnSize)
    h.actions.addShape('cylinder')
    expect(h.done('add-cylinder')).toBe(true)
    const id = h.firstShape('cylinder')
    expect(h.done('slide')).toBe(false)
    h.setField(id, positionField(1), '10')
    expect(h.done('slide')).toBe(true)
    h.setField(id, positionField(0), '30')
    expect(h.done('exact')).toBe(true)
    h.actions.setTool('rotate')
    expect(h.done('rotate-tool')).toBe(true)
    h.setField(id, rotationField(1), '45')
    expect(h.done('tip-over')).toBe(true)
    h.actions.setTool('size')
    expect(h.done('size-tool')).toBe(true)
    expect(h.done('taller')).toBe(false)
    h.setField(id, paramField('height'), '40')
    expect(h.done('taller')).toBe(true)
    h.actions.setTool('move')
    expect(h.done('move-tool')).toBe(true)
  })
})

describe('Holes and groups', () => {
  it('ticks off each step', () => {
    const h = lessonHarness(holesGroups)
    h.actions.addShape('box')
    h.actions.addShape('cylinder')
    expect(h.done('add-box') && h.done('add-cylinder')).toBe(true)
    expect(h.done('make-hole')).toBe(false)
    h.actions.toggleHole()
    expect(h.done('make-hole')).toBe(true)
    expect(h.done('select-both')).toBe(false)
    h.actions.selectNode(h.firstShape('box'), false)
    h.actions.selectNode(h.firstShape('cylinder'), true)
    expect(h.done('select-both')).toBe(true)
    expect(h.done('group')).toBe(false)
    h.actions.groupSelection()
    expect(h.done('group')).toBe(true)
  })
})

describe('Undo, names and saving', () => {
  it('ticks off each step', () => {
    const h = lessonHarness(undoSave)
    h.actions.addShape('sphere')
    expect(h.done('add-sphere')).toBe(true)
    expect(h.done('delete')).toBe(false)
    h.actions.deleteSelection()
    expect(h.done('delete')).toBe(true)
    expect(h.done('undo')).toBe(false)
    h.actions.undo()
    expect(h.done('undo')).toBe(true)
    h.actions.redo()
    expect(h.done('redo')).toBe(true)
    h.actions.undo()
    expect(h.done('undo-again')).toBe(true)
    expect(h.done('rename')).toBe(false)
    h.apply((d) => renameDocument(d, 'My robot'))
    expect(h.done('rename')).toBe(true)
  })
})

describe('Smart sizes', () => {
  it('ticks off each step', () => {
    const h = lessonHarness(smartSizes)
    h.actions.addShape('box')
    expect(h.done('add-variable')).toBe(false)
    h.apply((d) => addVariable(d, 'var1', '10', h.normalize))
    expect(h.done('add-variable')).toBe(true)
    h.apply((d) => renameVariable(d, 'var1', 'wall', h.normalize))
    expect(h.done('name-it')).toBe(true)
    h.apply((d) => setVariableExpr(d, 'wall', '3', h.normalize))
    expect(h.done('set-it')).toBe(true)
    h.setField(h.firstShape('box'), paramField('width'), 'wall * 10')
    expect(h.done('use-it')).toBe(true)
    h.actions.addShape('cylinder')
    expect(h.done('add-cylinder')).toBe(true)
    h.setField(h.firstShape('cylinder'), paramField('diameter'), 'wall * 5')
    expect(h.done('diameter')).toBe(true)
    expect(h.done('change')).toBe(false)
    h.apply((d) => setVariableExpr(d, 'wall', '4', h.normalize))
    expect(h.done('change')).toBe(true)
  })
})
