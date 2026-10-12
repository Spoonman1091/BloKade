import { describe, expect, it } from 'vitest'
import { createRegistry } from './registry'

const good = (id: string) => ({
  id, name: 'Good', icon: '✅', version: 1,
  params: { size: { type: 'mm', default: 10, label: 'Size' } },
  size: { x: 'size' },
  build: () => null,
})

describe('createRegistry', () => {
  it('registers valid plugins in order', () => {
    const { registry, problems } = createRegistry([good('a'), good('b')])
    expect(problems).toEqual([])
    expect(registry.list().map((p) => p.id)).toEqual(['a', 'b'])
    expect(registry.get('b')?.name).toBe('Good')
    expect(registry.get('nope')).toBeUndefined()
  })

  it('reports broken plugins instead of crashing', () => {
    const { registry, problems } = createRegistry([{ name: 'No id' }, { ...good('c'), build: 'nope' }, 42])
    expect(registry.list()).toEqual([])
    expect(problems).toHaveLength(3)
  })

  it('reports a size mapping to a missing parameter', () => {
    const { problems } = createRegistry([{ ...good('d'), size: { x: 'width' } }])
    expect(problems[0]).toContain('width')
  })

  it('keeps the first of two plugins with the same id', () => {
    const { registry, problems } = createRegistry([good('a'), { ...good('a'), name: 'Second' }])
    expect(registry.get('a')?.name).toBe('Good')
    expect(problems[0]).toContain('"a"')
  })

  it('accepts text params', () => {
    const { problems } = createRegistry([{ ...good('t'), params: { ...good('t').params, label: { type: 'text', default: 'Hi', label: 'Label' } } }])
    expect(problems).toEqual([])
  })

  it('reports a size handle pointing at a text param', () => {
    const plugin = { ...good('u'), params: { label: { type: 'text', default: 'Hi', label: 'Label' } }, size: { x: 'label' } }
    expect(createRegistry([plugin]).problems[0]).toContain('text')
  })
})
