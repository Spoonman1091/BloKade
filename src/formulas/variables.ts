import type { Variable } from '../document/types'
import { fail, type Result } from '../shared/result'
import { evaluateFormula, parseFormula, RESERVED_NAMES, variablesUsed } from './formula'

export const VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
export const MAX_VARIABLE_NAME_LENGTH = 30

export interface VariableValues {
  /** `fit`, `pi`, and every variable that worked, ready to hand to a formula. */
  readonly scope: ReadonlyMap<string, number>
  /** A plain-English problem for each variable that didn't work. */
  readonly errors: Readonly<Record<string, string>>
}

/** Why `name` can't be a variable name (given the names already taken), or null if it's fine. */
export function variableNameProblem(name: string, taken: readonly string[]): string | null {
  if (!VARIABLE_NAME_PATTERN.test(name)) return 'Variable names use letters, numbers and _, and start with a letter.'
  if (name.length > MAX_VARIABLE_NAME_LENGTH) return `Keep variable names to ${MAX_VARIABLE_NAME_LENGTH} characters or fewer.`
  if (RESERVED_NAMES.has(name)) return `BloKade already uses "${name}". Pick another name.`
  if (taken.includes(name)) return `There's already a variable called "${name}".`
  return null
}

const loopMessage = (loop: readonly string[]): string =>
  loop.length === 2 ? `"${loop[0] ?? ''}" uses itself.` : `These variables use each other in a loop: ${loop.join(' → ')}.`

/** Works out every variable in dependency order. Loops and broken formulas become errors, never exceptions. */
export function resolveVariables(variables: readonly Variable[], fit: number): VariableValues {
  const base = new Map<string, number>([['fit', fit], ['pi', Math.PI]])
  const byName = new Map(variables.map((variable) => [variable.name, variable] as const))
  const results = new Map<string, Result<number>>()
  const loops = new Map<string, string>()
  const visiting: string[] = []

  const resolve = (name: string): Result<number> => {
    const done = results.get(name)
    if (done) return done
    const start = visiting.indexOf(name)
    if (start !== -1) {
      const loop = [...visiting.slice(start), name]
      loop.slice(0, -1).forEach((member) => loops.set(member, loopMessage(loop)))
      return fail(loopMessage(loop))
    }
    visiting.push(name)
    const result = compute(name, byName.get(name)?.expr ?? '')
    visiting.pop()
    results.set(name, result)
    return result
  }

  const compute = (name: string, expr: string): Result<number> => {
    const parsed = parseFormula(expr)
    if (!parsed.ok) return parsed
    const scope = new Map(base)
    for (const dep of variablesUsed(parsed.value).filter((used) => byName.has(used))) {
      const value = resolve(dep)
      if (!value.ok) return fail(loops.get(name) ?? `Uses "${dep}", which has a problem.`)
      scope.set(dep, value.value)
    }
    return evaluateFormula(parsed.value, scope)
  }

  const entries = variables.map((variable) => [variable.name, resolve(variable.name)] as const)
  return {
    scope: new Map([...base, ...entries.flatMap(([name, r]) => (r.ok ? [[name, r.value] as const] : []))]),
    errors: Object.fromEntries(entries.flatMap(([name, r]) => (r.ok ? [] : [[name, r.error] as const]))),
  }
}
