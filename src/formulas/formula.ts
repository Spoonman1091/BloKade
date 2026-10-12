import { fail, ok, type Result } from '../shared/result'

/** Longest formula BloKade accepts, so a stray paste can't fill a field with a novel. */
export const MAX_FORMULA_LENGTH = 200
const MAX_DEPTH = 40
const DEG = Math.PI / 180

type BinaryOp = '+' | '-' | '*' | '/' | '^'

export type Expr =
  | { readonly kind: 'num'; readonly value: number }
  | { readonly kind: 'var'; readonly name: string }
  | { readonly kind: 'neg'; readonly arg: Expr }
  | { readonly kind: 'bin'; readonly op: BinaryOp; readonly left: Expr; readonly right: Expr }
  | { readonly kind: 'call'; readonly fn: string; readonly args: readonly Expr[] }

interface FunctionSpec {
  readonly minArgs: number
  readonly maxArgs: number
  apply(args: readonly number[]): number
}

const one = (apply: (x: number) => number): FunctionSpec =>
  ({ minArgs: 1, maxArgs: 1, apply: ([x]) => apply(x ?? Number.NaN) })

/** The only functions a formula may call. Angles are degrees, like the rotation fields. */
const FUNCTIONS: ReadonlyMap<string, FunctionSpec> = new Map([
  ['min', { minArgs: 1, maxArgs: 20, apply: (args: readonly number[]) => Math.min(...args) }],
  ['max', { minArgs: 1, maxArgs: 20, apply: (args: readonly number[]) => Math.max(...args) }],
  ['round', one(Math.round)],
  ['floor', one(Math.floor)],
  ['ceil', one(Math.ceil)],
  ['sqrt', one(Math.sqrt)],
  ['sin', one((d) => Math.sin(d * DEG))],
  ['cos', one((d) => Math.cos(d * DEG))],
  ['tan', one((d) => Math.tan(d * DEG))],
])

/** Names a variable can't take: the functions, `pi`, and the built-in `fit`. */
export const RESERVED_NAMES: ReadonlySet<string> = new Set([...FUNCTIONS.keys(), 'pi', 'fit'])

class FormulaError extends Error {}

interface Token {
  readonly type: 'num' | 'name' | 'op'
  readonly text: string
  readonly at: number
}

const NUMBER = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i
const NAME = /^[a-z_][a-z0-9_]*/i
const SPACE = /^\s+/
const OPERATORS = '+-*/^(),'

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let at = 0
  while (at < text.length) {
    const rest = text.slice(at)
    const match = SPACE.exec(rest) ?? NUMBER.exec(rest) ?? NAME.exec(rest)
    const ch = rest[0] ?? ''
    if (match && !SPACE.test(match[0])) {
      tokens.push({ type: NUMBER.test(match[0]) ? 'num' : 'name', text: match[0], at })
    } else if (!match && OPERATORS.includes(ch)) {
      tokens.push({ type: 'op', text: ch, at })
    } else if (!match) {
      throw new FormulaError(`BloKade doesn't understand "${ch}" in a formula.`)
    }
    at += match ? match[0].length : 1
  }
  return tokens
}

class Parser {
  private pos = 0
  private depth = 0

  constructor(private readonly tokens: readonly Token[]) {}

  parse(): Expr {
    if (this.tokens.length === 0) throw new FormulaError('The formula is empty.')
    const expr = this.sum()
    const extra = this.peek()
    if (extra) throw new FormulaError(`Something's off near "${extra.text}". Check for a missing + - * or /.`)
    return expr
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }

  private next(): Token | undefined {
    const token = this.tokens[this.pos]
    this.pos += 1
    return token
  }

  private isOp(text: string): boolean {
    const token = this.peek()
    return token?.type === 'op' && token.text === text
  }

  private sum(): Expr {
    let left = this.product()
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.next()?.text as '+' | '-'
      left = { kind: 'bin', op, left, right: this.product() }
    }
    return left
  }

  private product(): Expr {
    let left = this.unary()
    while (this.isOp('*') || this.isOp('/')) {
      const op = this.next()?.text as '*' | '/'
      left = { kind: 'bin', op, left, right: this.unary() }
    }
    return left
  }

  private unary(): Expr {
    if (this.isOp('-')) {
      this.next()
      return this.nested(() => ({ kind: 'neg', arg: this.unary() }))
    }
    if (this.isOp('+')) {
      this.next()
      return this.nested(() => this.unary())
    }
    return this.power()
  }

  private power(): Expr {
    const base = this.atom()
    if (!this.isOp('^')) return base
    this.next()
    return this.nested(() => ({ kind: 'bin', op: '^', left: base, right: this.unary() }))
  }

  private atom(): Expr {
    const token = this.next()
    if (!token) throw new FormulaError('The formula stops too early. Is something missing at the end?')
    if (token.type === 'num') return { kind: 'num', value: Number(token.text) }
    if (token.type === 'name') return this.isOp('(') ? this.call(token.text) : { kind: 'var', name: token.text }
    if (token.text === '(') {
      const inner = this.nested(() => this.sum())
      this.expect(')')
      return inner
    }
    throw new FormulaError(`Something's off near "${token.text}".`)
  }

  private call(name: string): Expr {
    const spec = FUNCTIONS.get(name)
    if (!spec) throw new FormulaError(`"${name}" isn't a function BloKade knows.`)
    this.next()
    const args = this.isOp(')') ? [] : this.argumentList()
    this.expect(')')
    if (args.length < spec.minArgs || args.length > spec.maxArgs) {
      const need = spec.minArgs === spec.maxArgs ? `exactly ${spec.minArgs}` : `at least ${spec.minArgs}`
      throw new FormulaError(`${name}() needs ${need} number${spec.minArgs === 1 ? '' : 's'}.`)
    }
    return { kind: 'call', fn: name, args }
  }

  private argumentList(): Expr[] {
    const args = [this.nested(() => this.sum())]
    while (this.isOp(',')) {
      this.next()
      args.push(this.nested(() => this.sum()))
    }
    return args
  }

  private expect(text: string): void {
    if (!this.isOp(text)) throw new FormulaError(`A "${text}" is missing.`)
    this.next()
  }

  private nested<T>(parse: () => T): T {
    this.depth += 1
    try {
      if (this.depth > MAX_DEPTH) {
        throw new FormulaError('This formula is nested too deeply. Use fewer brackets or minus signs in a row.')
      }
      return parse()
    } finally {
      this.depth -= 1
    }
  }
}

function attempt<T>(run: () => T): Result<T> {
  try {
    return ok(run())
  } catch (error) {
    if (error instanceof FormulaError) return fail(error.message)
    throw error
  }
}

export function parseFormula(text: string): Result<Expr> {
  if (text.length > MAX_FORMULA_LENGTH) return fail(`Formulas can be up to ${MAX_FORMULA_LENGTH} characters long.`)
  return attempt(() => new Parser(tokenize(text)).parse())
}

function binary(op: BinaryOp, a: number, b: number): number {
  switch (op) {
    case '+': return a + b
    case '-': return a - b
    case '*': return a * b
    case '/':
      if (b === 0) throw new FormulaError("A formula can't divide by zero.")
      return a / b
    case '^': return a ** b
  }
}

function evaluate(expr: Expr, scope: ReadonlyMap<string, number>): number {
  switch (expr.kind) {
    case 'num': return expr.value
    case 'neg': return -evaluate(expr.arg, scope)
    case 'bin': return binary(expr.op, evaluate(expr.left, scope), evaluate(expr.right, scope))
    case 'var': {
      const found = scope.get(expr.name)
      if (found === undefined) {
        throw new FormulaError(`"${expr.name}" isn't a variable. Check the spelling, or add it under Variables.`)
      }
      return found
    }
    case 'call': {
      const spec = FUNCTIONS.get(expr.fn)
      if (!spec) throw new FormulaError(`"${expr.fn}" isn't a function BloKade knows.`)
      return spec.apply(expr.args.map((arg) => evaluate(arg, scope)))
    }
  }
}

export function evaluateFormula(expr: Expr, scope: ReadonlyMap<string, number>): Result<number> {
  const result = attempt(() => evaluate(expr, scope))
  if (!result.ok) return result
  if (Number.isNaN(result.value)) return fail("That formula doesn't make a number (like the square root of a negative).")
  if (!Number.isFinite(result.value)) return fail('That formula makes a number too big to use.')
  return ok(result.value === 0 ? 0 : result.value)
}

export function computeFormula(text: string, scope: ReadonlyMap<string, number>): Result<number> {
  const parsed = parseFormula(text)
  return parsed.ok ? evaluateFormula(parsed.value, scope) : parsed
}

export function variablesUsed(expr: Expr): readonly string[] {
  switch (expr.kind) {
    case 'num': return []
    case 'var': return [expr.name]
    case 'neg': return variablesUsed(expr.arg)
    case 'bin': return [...new Set([...variablesUsed(expr.left), ...variablesUsed(expr.right)])]
    case 'call': return [...new Set(expr.args.flatMap(variablesUsed))]
  }
}

/** Renames a variable wherever it appears in a formula and leaves the rest of the text alone. */
export function renameVariableIn(text: string, from: string, to: string): string {
  const tokens = attempt(() => tokenize(text))
  if (!tokens.ok) return text
  return tokens.value
    .filter((token) => token.type === 'name' && token.text === from)
    .reduceRight((acc, token) => acc.slice(0, token.at) + to + acc.slice(token.at + token.text.length), text)
}
