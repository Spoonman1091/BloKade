import { describe, expect, it } from 'vitest'
import { fitsPlate, planGrid } from './grid'

const A1MINI = { width: 180, depth: 180 }

describe('fitsPlate', () => {
  it('allows a margin on each side', () => {
    expect(fitsPlate(170, 170, A1MINI)).toBe(true)
    expect(fitsPlate(170.5, 100, A1MINI)).toBe(false)
  })
  it('accepts a piece turned 90 degrees', () => {
    const mk4s = { width: 250, depth: 210 }
    expect(fitsPlate(200, 240, mk4s)).toBe(true)
    expect(fitsPlate(241, 100, mk4s)).toBe(false)
  })
})

describe('planGrid', () => {
  it('plans a 2 x 2 grid with windows for the chest', () => {
    const plan = planGrid(254, 305, A1MINI, 10)!
    expect([plan.cols, plan.rows]).toEqual([2, 2])
    const x = plan.cuts.find((c) => c.axis === 'x')!
    const y = plan.cuts.find((c) => c.axis === 'y')!
    expect(plan.cuts).toHaveLength(2)
    expect(x.min).toBeCloseTo(-33); expect(x.max).toBeCloseTo(33); expect(x.at).toBeCloseTo(0)
    expect(y.min).toBeCloseTo(-7.5); expect(y.max).toBeCloseTo(7.5); expect(y.at).toBeCloseTo(0)
  })
  it('makes one piece and no cuts when it already fits', () => {
    expect(planGrid(150, 120, A1MINI, 10)).toEqual({ cols: 1, rows: 1, cuts: [] })
  })
  it('splits a long strip in two', () => {
    const plan = planGrid(300, 150, A1MINI, 10)!
    expect([plan.cols, plan.rows]).toEqual([2, 1])
  })
  it('turns a piece to fit', () => {
    expect(planGrid(200, 240, { width: 250, depth: 210 }, 10)).toEqual({ cols: 1, rows: 1, cuts: [] })
  })
  it('follows another printer', () => {
    const plan = planGrid(240, 305, { width: 256, depth: 256 }, 10)!
    expect([plan.cols, plan.rows]).toEqual([1, 2])
    expect(plan.cuts).toHaveLength(1)
    expect(plan.cuts[0]!.axis).toBe('y')
    expect(plan.cuts[0]!.min).toBeCloseTo(-83.5); expect(plan.cuts[0]!.max).toBeCloseTo(83.5)
  })
  it('returns null when too many pieces are needed', () => {
    expect(planGrid(2000, 2000, A1MINI, 10)).toBeNull()
  })
  it('counts joint room', () => {
    const none = planGrid(330, 100, A1MINI, 0)!
    expect([none.cols, none.rows]).toEqual([2, 1])
    expect(none.cuts[0]!.min).toBeCloseTo(-5); expect(none.cuts[0]!.max).toBeCloseTo(5)
    const tabs = planGrid(330, 100, A1MINI, 10)!
    expect([tabs.cols, tabs.rows]).toEqual([3, 1])
  })
})
