import { describe, expect, it } from 'vitest'
import { createGroupNode, createShapeNode } from '../document/factory'
import { registry } from '../plugins/index'
import { MAX_MM, MIN_MM } from '../plugins/params'
import { createRegistry } from '../plugins/registry'
import { createFieldNormalizer } from './field-normalizer'

const normalize = createFieldNormalizer(registry)
const box = createShapeNode({ shapeType: 'box', name: 'Box', params: { width: 20 }, color: '#f00' })

describe('createFieldNormalizer', () => {
  it('clamps sizes like the plugin does', () => {
    expect(normalize(box, 'param.width', -3)).toBe(MIN_MM)
    expect(normalize(box, 'param.width', 9999)).toBe(MAX_MM)
  })

  it('keeps positions inside the build area', () => {
    expect(normalize(box, 'position.0', 1e9)).toBe(MAX_MM)
    expect(normalize(box, 'position.1', -1e9)).toBe(-MAX_MM)
  })

  it('leaves rotations, unknown params and groups alone', () => {
    expect(normalize(box, 'rotation.2', 725)).toBe(725)
    expect(normalize(box, 'param.mystery', -3)).toBe(-3)
    expect(normalize(createGroupNode({ children: [] }), 'param.width', -3)).toBe(-3)
  })

  it('clamps modifier numbers', () => {
    const withMod = { ...box, modifiers: [{ id: 'aaaaaaaa', type: 'linearPattern', enabled: true, count: 3, spacing: [25, 0, 0] }] as const }
    expect(normalize(withMod, 'mod.aaaaaaaa.count', 9999)).toBe(50)
    expect(normalize(withMod, 'mod.aaaaaaaa.spacing.0', -1e9)).toBe(-2000)
  })
})

describe('choice params', () => {
  it('leaves choice params alone', () => {
    const node = createShapeNode({ shapeType: 'picker', name: 'P', params: { kind: 'a', gap: 0 }, color: '#fff' })
    const pickerNormalize = createFieldNormalizer(createRegistry([{
      id: 'picker', name: 'Picker', icon: '🧪', version: 1, build: () => { throw new Error('unused') },
      params: {
        kind: { type: 'choice', default: 'a', label: 'Kind', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
        gap: { type: 'mm', default: 0, min: 0, max: 2, label: 'Gap' },
      },
    }]).registry)
    expect(pickerNormalize(node, 'param.gap', 9)).toBe(2)
    expect(pickerNormalize(node, 'param.kind', 9)).toBe(9)
  })
})
