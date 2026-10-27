import { beforeAll, describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { createModifier } from '../document/modifiers'
import { addNode } from '../document/ops'
import type { BloKadeDocument, Modifier, Vec3 } from '../document/types'
import { createCadToolkit } from '../plugins/cad'
import { registry } from '../plugins/index'
import { Evaluator } from './evaluate'
import { findPrintProblems, PrintCheckError } from './print-check'
import { loadTestFont } from './testing/font-node'
import { initTestOC } from './testing/oc-node'
import type { PrintCheckResult } from './types'

beforeAll(async () => {
  await initTestOC()
  await loadTestFont()
})

const part = (id: string, shapeType: string, params: Record<string, number | string>, position: Vec3 = [0, 0, 0], extra: object = {}) =>
  ({ ...createShapeNode({ id, shapeType, name: id, params, color: '#fff', position }), ...extra })
const box = (id: string, w: number, d: number, h: number, position: Vec3 = [0, 0, 0]) =>
  part(id, 'box', { width: w, depth: d, height: h }, position)
const docOf = (...nodes: ReturnType<typeof part>[]): BloKadeDocument =>
  nodes.reduce((d, n) => addNode(d, n), createEmptyDocument())
const check = (doc: BloKadeDocument): PrintCheckResult => findPrintProblems(new Evaluator(registry, createCadToolkit()), doc)
const checked = (doc: BloKadeDocument) => {
  const result = check(doc)
  if (result.status !== 'checked') throw new Error('expected a checked result')
  return result
}

describe('findPrintProblems', () => {
  it('says a box on the plate is all clear', () => {
    expect(checked(docOf(box('a', 20, 20, 20)))).toEqual({
      status: 'checked', floating: null, thin: null, overhang: null, thinFinished: true,
    })
  })

  it('finds a box floating 5 mm above another as one floating piece', () => {
    const result = checked(docOf(box('a', 20, 20, 20), box('b', 10, 10, 10, [0, 0, 25])))
    expect(result.floating?.amount).toBe(1)
    expect(result.floating?.mesh.positions.length).toBeGreaterThan(0)
  })

  it('does not call touching parts floating', () => {
    expect(checked(docOf(box('a', 20, 20, 20), box('b', 10, 10, 10, [0, 0, 20]))).floating).toBeNull()
  })

  it('finds the overhang of a T shape', () => {
    const result = checked(docOf(box('stem', 10, 10, 30), box('bar', 60, 30, 6, [0, 0, 30])))
    expect(result.overhang?.amount).toBeGreaterThan(1000)
    expect(result.overhang?.mesh.positions.length).toBeGreaterThan(0)
  })

  const fillet = { ...createModifier('fillet', 'aaaaaaaa') } as Modifier
  const defaults: Array<[string, ReturnType<typeof part>]> = [
    ['sphere', part('s', 'sphere', { diameter: 20 })],
    ['cone', part('c', 'cone', { bottomDiameter: 20, topDiameter: 0, height: 20 })],
    ['ring', part('r', 'torus', { diameter: 40, thickness: 10 })],
    ['text', part('t', 'text', { text: 'Kade', size: 10, depth: 3 })],
    ['rounded box', box('b', 20, 20, 20)],
  ]
  it.each(defaults)('has no overhang on a default %s lying on the plate', (name, node) => {
    const withRound = name === 'rounded box' ? { ...node, modifiers: [fillet] } : node
    const result = checked(docOf(withRound))
    expect(result.overhang).toBeNull()
  })

  it('calls a 0.5 mm plate thin', () => {
    const result = checked(docOf(box('a', 30, 30, 0.5)))
    expect(result.thin).not.toBeNull()
    expect(result.thin?.mesh.positions.length).toBeGreaterThan(0)
  })

  it('gives nothing when there is no solid part', () => {
    expect(check(createEmptyDocument())).toEqual({ status: 'nothing' })
    const hole = { ...box('h', 10, 10, 10), mode: 'hole' as const }
    expect(check(docOf(hole))).toEqual({ status: 'nothing' })
  })

  it("explains a part that can't build", () => {
    const broken = createShapeNode({ id: 'x', shapeType: 'nope', name: 'Mystery', params: {}, color: '#fff' })
    expect(() => check(addNode(createEmptyDocument(), broken))).toThrow(PrintCheckError)
    expect(() => check(addNode(createEmptyDocument(), broken))).toThrow("Fix the part that can't build first, then check again.")
  })
})
