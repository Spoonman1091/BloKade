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

  it("accepts the fields Kade's shapes carry", () => {
    const { problems } = createRegistry([{ ...good('mine'), revision: 'abc-1', toolkit: 'kade', source: 'blob:x' }])
    expect(problems).toEqual([])
    expect(createRegistry([{ ...good('x'), toolkit: 'other' }]).problems).toHaveLength(1)
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

describe('fit tool plugin fields', () => {
  const valid = good('thing')
  const choice = { type: 'choice', default: 'a', label: 'Kind', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }

  it('accepts choice params, starting formulas that use fit, holes and palette sections', () => {
    const plugin = {
      ...valid, mode: 'hole', palette: 'fit',
      params: { kind: choice, gap: { type: 'mm', default: 0.2, min: 0, max: 2, label: 'Extra room', formula: 'fit' } },
      size: undefined,
    }
    expect(createRegistry([plugin]).problems).toEqual([])
  })

  it('rejects broken choice params and starting formulas', () => {
    const problemOf = (params: object) => createRegistry([{ ...valid, params, size: undefined }]).problems[0] ?? ''
    expect(problemOf({ kind: { ...choice, default: 'z' } })).toContain('one of its options')
    expect(problemOf({ kind: { ...choice, options: [{ value: 'a', label: 'A' }] } })).toContain('has a problem')
    expect(problemOf({ gap: { type: 'mm', default: 1, label: 'Gap', formula: 'wall * 2' } })).toContain('only use fit')
  })

  it("won't point a size handle at a choice", () => {
    const plugin = { ...valid, params: { kind: choice }, size: { x: 'kind' } }
    expect(createRegistry([plugin]).problems[0]).toContain("can't change")
  })
})

describe('yes/no settings', () => {
  const plugin = (params: Record<string, unknown>) => ({ id: 'tick', name: 'Tick', icon: 'x', version: 1, params, build: () => null })
  it('accepts a yes/no setting', () => {
    const { problems } = createRegistry([plugin({ round: { type: 'yesno', default: false, label: 'Round' } })])
    expect(problems).toEqual([])
  })
  it('rejects a yes/no default that is not true or false', () => {
    const { problems } = createRegistry([plugin({ round: { type: 'yesno', default: 'no', label: 'Round' } })])
    expect(problems).toHaveLength(1)
  })
  it('refuses a size handle on a yes/no setting', () => {
    const { problems } = createRegistry([{ ...plugin({ round: { type: 'yesno', default: false, label: 'Round' } }), size: { x: 'round' } }])
    expect(problems[0]).toContain("can't change the yesno parameter")
  })
})
