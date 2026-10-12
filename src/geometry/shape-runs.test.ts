import { describe, expect, it } from 'vitest'
import { isShapeRunMessage, RunningShapes, shapeRunMessage } from './shape-runs'

describe('RunningShapes', () => {
  it('lists the code that started and has not stopped', () => {
    const running = new RunningShapes()
    running.note(shapeRunMessage('a', true))
    running.note(shapeRunMessage('b', true))
    running.note(shapeRunMessage('a', false))
    expect(running.list()).toEqual(['b'])
    running.note(shapeRunMessage('b', false))
    expect(running.list()).toEqual([])
  })
  it('counts the same code running twice', () => {
    const running = new RunningShapes()
    running.note(shapeRunMessage('a', true))
    running.note(shapeRunMessage('a', true))
    running.note(shapeRunMessage('a', false))
    expect(running.list()).toEqual(['a'])
  })
  it("tells its own notes from Comlink's", () => {
    expect(isShapeRunMessage(shapeRunMessage('a', true))).toBe(true)
    expect(isShapeRunMessage({ id: 'x', type: 'RETURN' })).toBe(false)
    expect(isShapeRunMessage(null)).toBe(false)
    expect(isShapeRunMessage({ kadeShape: 'a', running: 'yes' })).toBe(false)
  })
})
