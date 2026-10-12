import { describe, expect, it } from 'vitest'
import { defaultParams, MAX_MM, MIN_MM, normalizeChoiceParam, normalizeParam, normalizeTextParam, resolveParams } from './params'
import { definePlugin, type ChoiceParamSpec, type ShapePlugin, type TextParamSpec } from './types'

const plugin = definePlugin({
  id: 'thing', name: 'Thing', icon: '⭐', version: 1,
  params: {
    width: { type: 'mm', default: 20, label: 'Width' },
    teeth: { type: 'whole', default: 12, min: 6, max: 100, label: 'Teeth' },
    tilt: { type: 'angle', default: 0, label: 'Tilt' },
  },
  build: () => { throw new Error('not used') },
})

describe('normalizeParam', () => {
  const mm = { type: 'mm', default: 20, label: 'Width' } as const

  it('keeps good values', () => expect(normalizeParam(mm, 12.5)).toBe(12.5))
  it('replaces junk with the default', () => {
    expect(normalizeParam(mm, 'abc')).toBe(20)
    expect(normalizeParam(mm, Number.NaN)).toBe(20)
    expect(normalizeParam(mm, Infinity)).toBe(20)
    expect(normalizeParam(mm, undefined)).toBe(20)
  })
  it('clamps mm to a printable range', () => {
    expect(normalizeParam(mm, -5)).toBe(MIN_MM)
    expect(normalizeParam(mm, 0)).toBe(MIN_MM)
    expect(normalizeParam(mm, 1e9)).toBe(MAX_MM)
  })
  it('rounds whole numbers and honors min/max', () => {
    const whole = { type: 'whole', default: 12, min: 6, max: 100, label: 'Teeth' } as const
    expect(normalizeParam(whole, 7.6)).toBe(8)
    expect(normalizeParam(whole, 2)).toBe(6)
  })
  it('lets angles go negative', () => {
    expect(normalizeParam({ type: 'angle', default: 0, label: 'Tilt' }, -45)).toBe(-45)
  })
})

describe('resolveParams', () => {
  it('fills in defaults and drops unknown keys', () => {
    expect(resolveParams(plugin, { width: 5, extra: 9 })).toEqual({ width: 5, teeth: 12, tilt: 0 })
  })
  it('gives all defaults', () => {
    expect(defaultParams(plugin)).toEqual({ width: 20, teeth: 12, tilt: 0 })
  })
})

describe('text params', () => {
  const spec: TextParamSpec = { type: 'text', default: 'Hi', label: 'Text' }

  it('falls back to the default for things that are not text', () => {
    expect(normalizeTextParam(spec, 42)).toBe('Hi')
    expect(normalizeTextParam(spec, undefined)).toBe('Hi')
  })

  it('keeps text on one line and within its limit (Review Focus 4)', () => {
    expect(normalizeTextParam(spec, 'a\nb\tc')).toBe('a b c')
    expect(normalizeTextParam(spec, 'x'.repeat(100))).toHaveLength(40)
    expect(normalizeTextParam({ ...spec, maxLength: 3 }, 'abcdef')).toBe('abc')
    expect(normalizeTextParam({ ...spec, maxLength: 1 }, '🙂🙂')).toBe('🙂')
  })

  it('resolves a mix of number and text params', () => {
    const plugin = definePlugin({
      id: 'sign', name: 'Sign', icon: 's', version: 1,
      params: { label: { type: 'text', default: 'Kade', label: 'Label' }, size: { type: 'mm', default: 10, label: 'Size' } },
      build: ({ size }, cad) => cad.box(size, size, size),
    })
    expect(resolveParams(plugin, { label: 'Hey', size: -1 })).toEqual({ label: 'Hey', size: 0.01 })
  })
})

describe('choice params', () => {
  const sizeChoice: ChoiceParamSpec = {
    type: 'choice', default: 'M3', label: 'Size',
    options: [{ value: 'M2', label: 'M2' }, { value: 'M3', label: 'M3' }],
  }

  it('keeps known options and falls back to the default for anything else', () => {
    expect(normalizeChoiceParam(sizeChoice, 'M2')).toBe('M2')
    expect(normalizeChoiceParam(sizeChoice, 'M99')).toBe('M3')
    expect(normalizeChoiceParam(sizeChoice, 3)).toBe('M3')
    expect(normalizeChoiceParam(sizeChoice, undefined)).toBe('M3')
  })

  it('resolves choice params alongside numbers', () => {
    const mixed = { params: { size: sizeChoice, depth: { type: 'mm', default: 10, label: 'Depth' } } } as unknown as ShapePlugin
    expect(resolveParams(mixed, { size: 'nope', depth: 4 })).toEqual({ size: 'M3', depth: 4 })
  })
})
