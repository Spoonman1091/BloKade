import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { addVariable, setFit, setVariableExpr } from '../document/variable-ops'
import type { BloKadeDocument } from '../document/types'
import { registry } from '../plugins/index'
import { KITS } from '../plugins/kits'
import { addKit, kitVariableNames } from './add-kit'
import { createFieldNormalizer } from './field-normalizer'

const normalize = createFieldNormalizer(registry)
const pegKit = KITS.find((k) => k.id === 'peg-socket')
if (!pegKit) throw new Error('missing kit')
const add = (doc: BloKadeDocument, workplane: { origin: [number, number, number]; rotation: [number, number, number] } | null = null) =>
  addKit(doc, pegKit, registry, normalize, workplane, 0)

describe('addKit', () => {
  it('adds the shared sizes and a matched peg and socket', () => {
    const { doc, ids } = add(createEmptyDocument())
    expect(doc.variables).toEqual([{ name: 'peg_size', expr: '8' }, { name: 'peg_length', expr: '10' }])
    const [peg, socket] = ids.map((id) => doc.nodes[id])
    expect(peg).toMatchObject({ shapeType: 'peg', mode: 'solid', params: { size: 8, length: 10 }, formulas: { 'param.size': 'peg_size' } })
    expect(socket).toMatchObject({
      shapeType: 'socket', mode: 'hole', params: { size: 8, depth: 11, clearance: 0.2 },
      formulas: { 'param.size': 'peg_size', 'param.depth': 'peg_length + 1', 'param.clearance': 'fit' },
      transform: { position: [25, 0, 0] },
    })
  })

  it('keeps the pair matched when the peg size or fit changes (Review Focus 1)', () => {
    const { doc, ids } = add(createEmptyDocument())
    const resized = setFit(setVariableExpr(doc, 'peg_size', '12', normalize), 0.4, normalize)
    expect(resized.nodes[ids[0] ?? '']).toMatchObject({ params: { size: 12 } })
    expect(resized.nodes[ids[1] ?? '']).toMatchObject({ params: { size: 12, clearance: 0.4 } })
  })

  it('numbers the variables of a second kit and points its formulas at them (Review Focus 2)', () => {
    const first = add(createEmptyDocument())
    const second = add(first.doc)
    expect(second.doc.variables.map((v) => v.name)).toEqual(['peg_size', 'peg_length', 'peg_size2', 'peg_length2'])
    expect(second.doc.nodes[second.ids[1] ?? '']?.formulas).toMatchObject({ 'param.size': 'peg_size2', 'param.depth': 'peg_length2 + 1' })
    expect(second.doc.nodes[first.ids[0] ?? '']).toEqual(first.doc.nodes[first.ids[0] ?? ''])
  })

  it('skips a suffix when any one of the names is taken', () => {
    const taken = addVariable(createEmptyDocument(), 'peg_length', '3', normalize)
    expect([...kitVariableNames(taken, pegKit).values()]).toEqual(['peg_size2', 'peg_length2'])
  })

  it('places the parts on the workplane, turned with it', () => {
    const { doc, ids } = add(createEmptyDocument(), { origin: [0, 0, 10], rotation: [0, 0, 90] })
    const position = doc.nodes[ids[1] ?? '']?.transform.position ?? [0, 0, 0]
    expect(position[0]).toBeCloseTo(0, 6)
    expect(position[1]).toBeCloseTo(25, 6)
    expect(position[2]).toBeCloseTo(10, 6)
  })
})
