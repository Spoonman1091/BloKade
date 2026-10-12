import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { setFit, addVariable } from '../document/variable-ops'
import { createRegistry } from '../plugins/registry'
import { definePlugin } from '../plugins/types'
import { addPart, startingFormulas } from './add-part'
import { createFieldNormalizer } from './field-normalizer'

const gapBox = definePlugin({
  id: 'gap-box', name: 'Gap box', icon: '🧪', version: 1, mode: 'hole',
  params: {
    width: { type: 'mm', default: 10, label: 'Width' },
    gap: { type: 'mm', default: 0, min: 0, max: 2, label: 'Extra room', formula: 'fit' },
  },
  build: () => { throw new Error('unused') },
})
const { registry } = createRegistry([gapBox])
const normalize = createFieldNormalizer(registry)

describe('addPart', () => {
  it('lists starting formulas', () => {
    expect(startingFormulas(gapBox)).toEqual({ gap: 'fit' })
  })

  it('starts a part with its default sizes, mode and formulas', () => {
    const { doc, id } = addPart(createEmptyDocument(), gapBox, { color: '#f00', position: [5, 0, 0] }, normalize)
    expect(doc.nodes[id]).toMatchObject({
      name: 'Gap box', mode: 'hole', params: { width: 10, gap: 0.2 }, formulas: { 'param.gap': 'fit' },
      transform: { position: [5, 0, 0] },
    })
  })

  it('follows the fit gap until Kade types a number (Review Focus 1)', () => {
    const { doc, id } = addPart(createEmptyDocument(), gapBox, { color: '#f00' }, normalize)
    expect(setFit(doc, 0.5, normalize).nodes[id]).toMatchObject({ params: { gap: 0.5 } })
  })

  it('takes extra formulas from a kit', () => {
    const withVar = addVariable(createEmptyDocument(), 'peg_size', '8', normalize)
    const { doc, id } = addPart(withVar, gapBox, { color: '#f00', name: 'Socket', formulas: { width: 'peg_size + 2' } }, normalize)
    expect(doc.nodes[id]).toMatchObject({ name: 'Socket', params: { width: 10, gap: 0.2 }, formulas: { 'param.width': 'peg_size + 2' } })
  })
})
