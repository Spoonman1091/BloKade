import { describe, expect, it } from 'vitest'
import { resolveVariables, variableNameProblem } from './variables'

const v = (name: string, expr: string) => ({ name, expr })

describe('resolveVariables', () => {
  it('works out variables that use each other, in any order', () => {
    const { scope, errors } = resolveVariables([v('outer', 'inner + 2 * wall'), v('wall', '2'), v('inner', '10 + fit')], 0.2)
    expect(errors).toEqual({})
    expect(scope.get('outer')).toBeCloseTo(14.2)
    expect(scope.get('fit')).toBe(0.2)
    expect(scope.get('pi')).toBeCloseTo(Math.PI)
  })

  it('reports a loop on every variable in it, and still works out the others', () => {
    const { scope, errors } = resolveVariables([v('a', 'b + 1'), v('b', 'a + 1'), v('c', '5')], 0)
    expect(errors.a).toBe('These variables use each other in a loop: a → b → a.')
    expect(errors.b).toBe(errors.a)
    expect(scope.get('c')).toBe(5)
    expect(scope.has('a')).toBe(false)
  })

  it('says when a variable uses itself', () => {
    expect(resolveVariables([v('x', 'x + 1')], 0).errors.x).toBe('"x" uses itself.')
  })

  it('blames the broken variable, not the ones that use it', () => {
    const { errors } = resolveVariables([v('bad', '1 +'), v('user', 'bad * 2'), v('loopUser', 'a'), v('a', 'b'), v('b', 'a')], 0)
    expect(errors.bad).toContain('stops too early')
    expect(errors.user).toBe('Uses "bad", which has a problem.')
    expect(errors.loopUser).toBe('Uses "a", which has a problem.')
  })

  it('reports names that are not variables', () => {
    expect(resolveVariables([v('x', 'nope * 2')], 0).errors.x).toContain(`"nope" isn't a variable`)
  })
})

describe('variableNameProblem', () => {
  it('accepts sensible names', () => {
    expect(variableNameProblem('wall_2', ['wall'])).toBeNull()
  })

  it('explains bad names', () => {
    expect(variableNameProblem('2wall', [])).toContain('start with a letter')
    expect(variableNameProblem('my wall', [])).toContain('letters, numbers and _')
    expect(variableNameProblem('a'.repeat(31), [])).toContain('30')
    expect(variableNameProblem('fit', [])).toContain('BloKade already uses "fit"')
    expect(variableNameProblem('sqrt', [])).toContain('BloKade already uses "sqrt"')
    expect(variableNameProblem('wall', ['wall'])).toContain(`already a variable called "wall"`)
  })
})
