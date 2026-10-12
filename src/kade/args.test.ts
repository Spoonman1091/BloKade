import { describe, expect, it } from 'vitest'
import { axisArg, distanceArg, needArgs, numberArg, sizeArg, sizeOrZeroArg, wholeArg } from './args'

describe('cad input checks', () => {
  it('says how to call a command with missing numbers', () => {
    expect(() => needArgs([20, 10], 3, { command: 'cad.box', what: '3 sizes', example: 'cad.box(20, 10, 5)' }))
      .toThrow('cad.box needs 3 sizes, like cad.box(20, 10, 5)')
    expect(() => needArgs([20, undefined, 5], 3, { command: 'cad.box', what: '3 sizes', example: 'cad.box(20, 10, 5)' })).toThrow()
    expect(() => needArgs([20, 10, 5], 3, { command: 'cad.box', what: '3 sizes', example: 'cad.box(20, 10, 5)' })).not.toThrow()
  })
  it('wants real numbers', () => {
    expect(numberArg('cad.box', 'width', 4)).toBe(4)
    expect(() => numberArg('cad.box', 'width', '4')).toThrow('cad.box: the width must be a number — it was "4"')
    expect(() => numberArg('cad.box', 'width', Number.NaN)).toThrow('must be a number')
    expect(() => numberArg('cad.box', 'width', undefined)).toThrow('it was missing')
  })
  it('keeps sizes above 0 and up to 2000 mm', () => {
    expect(() => sizeArg('cad.box', 'width', -3)).toThrow('Sizes must be bigger than 0 — width was -3')
    expect(() => sizeArg('cad.box', 'width', 0)).toThrow('bigger than 0')
    expect(() => sizeArg('cad.box', 'width', 2001)).toThrow('Sizes can be up to 2000 mm — width was 2001')
    expect(sizeArg('cad.box', 'width', 2000)).toBe(2000)
  })
  it('lets some sizes be 0', () => {
    expect(sizeOrZeroArg('cad.cone', 'top', 0)).toBe(0)
    expect(() => sizeOrZeroArg('cad.cone', 'top', -1)).toThrow("Sizes can't be less than 0 — top was -1")
  })
  it('limits moves to 2000 mm either way', () => {
    expect(distanceArg('.move', 'x', -2000)).toBe(-2000)
    expect(() => distanceArg('.move', 'x', 2500)).toThrow('Moves can be up to 2000 mm — x was 2500')
  })
  it('wants whole numbers in range', () => {
    expect(wholeArg('cad.repeat', 'count', 12, 1, 200)).toBe(12)
    expect(() => wholeArg('cad.repeat', 'count', 2.5, 1, 200)).toThrow('cad.repeat: the count must be a whole number from 1 to 200 — it was 2.5')
    expect(() => wholeArg('cad.repeat', 'count', 201, 1, 200)).toThrow('from 1 to 200')
  })
  it('wants an axis letter', () => {
    expect(axisArg('.rotate', 'z')).toBe('z')
    expect(() => axisArg('.rotate', 'up')).toThrow(".rotate needs 'x', 'y' or 'z' — it was \"up\"")
  })
})
