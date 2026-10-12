import { describe, expect, it } from 'vitest'
import { defaultParams, MAX_MM, MIN_MM, normalizeParam, resolveParams } from './params'
import { definePlugin } from './types'

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
