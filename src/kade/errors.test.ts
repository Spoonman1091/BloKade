import { describe, expect, it } from 'vitest'
import { friendlyError, lineOf, problemLine } from './errors'

const SOURCE = 'blob:http://localhost:5199/1234-abcd'
const withStack = (error: Error, line: number): Error => {
  error.stack = `${error.name}: ${error.message}\n    at build (${SOURCE}:${line}:12)\n    at runKadeBuild (http://localhost/src/kade/run-build.ts:20:5)`
  return error
}

describe('friendlyError', () => {
  it('explains a misspelt name, with its line', () => {
    expect(friendlyError(withStack(new ReferenceError('widht is not defined'), 4), SOURCE))
      .toBe('Line 4: there\'s nothing called "widht" — check the spelling.')
  })
  it('explains a command that does not exist', () => {
    expect(friendlyError(new TypeError('cad.bx is not a function'), null))
      .toBe('"bx" isn\'t a command — check the spelling, or look in ❓ Commands.')
  })
  it('explains reading from something missing (Chrome and Firefox wording)', () => {
    const expected = 'something is missing before ".width" — check that it has a value.'
    expect(friendlyError(new TypeError("Cannot read properties of undefined (reading 'width')"), null)).toBe(expected)
    expect(friendlyError(new TypeError('can\'t access property "width", s is undefined'), null)).toBe(expected)
  })
  it('explains endless recursion', () => {
    expect(friendlyError(new RangeError('Maximum call stack size exceeded'), null)).toContain('keeps calling itself')
    expect(friendlyError(new Error('too much recursion'), null)).toContain('keeps calling itself')
  })
  it('passes other messages through', () => {
    expect(friendlyError(new Error('Sizes must be bigger than 0 — width was -3'), null)).toBe('Sizes must be bigger than 0 — width was -3')
  })
  it('handles things that are not errors', () => {
    expect(friendlyError('oops', null)).toBe('oops')
  })
  it('leaves out the line when the stack does not mention the source', () => {
    expect(friendlyError(withStack(new Error('x'), 3), 'blob:other')).toBe('x')
  })
})

describe('lineOf and problemLine', () => {
  it('reads the first line of the source from the stack', () => {
    expect(lineOf(withStack(new Error('x'), 7), SOURCE)).toBe(7)
  })
  it('works with Firefox stacks', () => {
    const error = new Error('x')
    error.stack = `build@${SOURCE}:9:3\nrunKadeBuild@http://localhost/src/kade/run-build.ts:20:5`
    expect(lineOf(error, SOURCE)).toBe(9)
  })
  it('reads the line back out of a message', () => {
    expect(problemLine("Box couldn't be built: Line 12: there's nothing called \"a\"")).toBe(12)
    expect(problemLine('No line here')).toBeNull()
  })
})
