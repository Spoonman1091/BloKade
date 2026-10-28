import { beforeAll, describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { createModifier } from '../document/modifiers'
import { addNode, groupNodes } from '../document/ops'
import type { BloKadeDocument, Modifier, Vec3 } from '../document/types'
import { createCadToolkit } from '../plugins/cad'
import { registry } from '../plugins/index'
import { defaultParams } from '../plugins/params'
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
    expect(result.overhang).toBeNull()
  })

  it('does not call touching parts floating', () => {
    expect(checked(docOf(box('a', 20, 20, 20), box('b', 10, 10, 10, [0, 0, 20]))).floating).toBeNull()
  })

  it('finds the overhang of a T shape', () => {
    const result = checked(docOf(box('stem', 10, 10, 20), box('bar', 40, 10, 5, [0, 0, 20])))
    expect(result.overhang?.amount).toBeGreaterThan(100)
    expect(result.overhang?.mesh.positions.length).toBeGreaterThan(0)
  })

  const fillet = { ...createModifier('fillet', 'aaaaaaaa') } as Modifier
  const builtins = registry.list().filter((plugin) => plugin.id !== 'imported')
  const defaults: Array<[string, BloKadeDocument]> = [
    ...builtins.map((plugin): [string, BloKadeDocument] => [plugin.id, docOf(part('p', plugin.id, defaultParams(plugin) as Record<string, number | string>))]),
    ...builtins.filter((plugin) => plugin.mode === 'hole').map((plugin): [string, BloKadeDocument] => {
      const hole = { ...part('h', plugin.id, defaultParams(plugin) as Record<string, number | string>), mode: 'hole' as const }
      return [`${plugin.id} cut into a block`, groupNodes(docOf(box('host', 30, 30, 20), hole), ['host', 'h'], 'g').doc]
    }),
    ['20 mm text', docOf(part('t', 'text', { text: 'Kade', size: 20, depth: 3 }))],
    ['M20 threaded rod', docOf(part('r', 'threaded-rod', { size: 'M20', length: 20 }))],
    ['rounded box', docOf({ ...box('b', 20, 20, 20), modifiers: [fillet] })],
  ]
  it.each(defaults)('finds no thin walls on a default %s lying on the plate', (_name, doc) => {
    expect(checked(doc).thin).toBeNull()
  })

  const smooth = new Set(['sphere', 'cone', 'torus', 'text', 'rounded box'])
  it.each(defaults.filter(([name]) => smooth.has(name)))('has no overhang on a default %s lying on the plate', (_name, doc) => {
    expect(checked(doc).overhang).toBeNull()
  })

  it('calls a 30 mm, 0.5 mm plate thin but not very thin', () => {
    const result = checked(docOf(box('a', 30, 30, 0.5)))
    expect(result.thin?.veryThin).toBe(false)
    expect(result.thin?.mesh.positions.length).toBeGreaterThan(0)
  })

  it('calls a 30 mm, 0.3 mm plate very thin', () => {
    expect(checked(docOf(box('a', 30, 30, 0.3))).thin?.veryThin).toBe(true)
  })

  it('calls a 5 mm, 0.6 mm tile thin', () => {
    expect(checked(docOf(box('a', 5, 5, 0.6))).thin).not.toBeNull()
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
