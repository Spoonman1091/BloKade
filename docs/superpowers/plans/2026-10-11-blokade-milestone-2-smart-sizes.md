# BloKade Milestone 2 ("Smart Sizes") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kade can drive sizes with named variables and formulas (including the `fit` gap), add 3D text, line parts up, snap parts against each other while dragging, see live measurements, and build on any face of a part.

**Architecture:** Every field still stores a plain number (the last value that worked), so geometry, export and the viewport don't change. Formulas live next to the numbers in an optional `node.formulas` record keyed by field (`param.width`, `position.0` …), and design variables live in `doc.variables`. A small recursive-descent parser evaluates formulas, and pure document ops re-run them whenever a variable or `fit` changes. The Text shape is a normal plugin that uses a bundled font, loaded into replicad in the worker. Align, object snap and measurements are pure box math on the meshes the viewport already has.

**Tech Stack:** Same as Milestone 1 (TypeScript 5.9, React 19, Vite 8, three.js 0.186 + R3F 9 + drei 10, replicad 1.1, Zustand 5, zod 4, Vitest 5, Playwright). No new npm dependencies. One new asset: the Atkinson Hyperlegible Bold font (SIL OFL 1.1).

**Spec:** `docs/superpowers/specs/2026-10-11-blokade-design.md`: the Milestone 2 row of section 9, plus section 3 ("Variables and formulas"), section 4 ("Placement and sizing"), section 5 (param types and the `text` toolkit entry) and section 6 ("Formula errors").

## Global Constraints

- Everything in the Milestone 1 plan's Global Constraints still applies:
  - Z-up, millimetres, degrees with Euler XYZ.
  - Plain HTTP on the LAN, so no `crypto.randomUUID`.
  - Immutable document and store state.
  - No `eval` or `new Function`.
  - The replicad ownership rule.
  - Files under 400 lines, functions under 50, nesting at most 4 levels.
  - No `console.log`.
  - Plain-English messages an 11-year-old understands.
  - Coverage of at least 80% lines on non-UI logic.
  - Conventional commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. An implementer names their own model instead.
- Node lookups by id use `Object.hasOwn` (never `in` or truthiness on `doc.nodes[id]`).
- **Formulas** (spec §3) allow arithmetic `+ - * / ^`, parentheses, unary minus, numbers (including `1.5e3`), variable names, the built-in `fit` and `pi`, and the functions `min max round floor ceil sqrt sin cos tan`. Nothing else is allowed.
  - Trig functions take **degrees**, like the rotation fields.
  - A formula is at most **200** characters and at most **40** levels of nesting.
  - A result that is not a finite number is an error.
- **Formula errors** (spec §6), such as an unknown variable, a syntax error or a loop, are shown inline on the field. The field keeps its **last good number**.
- **Ruling: formula storage.** The spec says `Value = number | formula string`. BloKade stores the number in the field and the text in `node.formulas[fieldKey]`. This is how "the last valid value is used" is kept, and it leaves geometry, export and viewport code unchanged.
  - Typing a plain number into a field removes that field's formula.
  - Dragging a handle, aligning, or snapping changes a field directly, and that also removes the field's formula. Undo brings the formula back.
- **Ruling: no expression library.** The spec suggests `expr-eval` as an example. BloKade uses its own ~150-line parser instead (Task 1). It needs no dependency, its error messages are friendly, and it cannot reach JavaScript objects (`expr-eval` has had prototype-pollution advisories).
- **Variables:**
  - A name is letters, digits and `_`, starting with a letter or `_`, at most **30** characters.
  - Names must be unique.
  - Names must not be `fit`, `pi` or a function name.
  - Variables may use other variables. A loop is an error on every variable in the loop.
- **`fit`** lives in `doc.settings.fit`. It defaults to **0.2** mm and is clamped to **0–2** mm.
- **Document schema version 2.** Version 1 designs and files upgrade automatically, gaining `variables: []` and `settings.fit: 0.2`.
- **Text params** (a new param type `text`) hold one line of up to **40** characters (counted as code points). They never hold formulas.
- **Font:** `src/assets/fonts/AtkinsonHyperlegible-Bold.ttf` from `google/fonts` at commit `1b22086d13bdbbf5ec63d01a39a49246e4ac355f` (55 256 bytes). It ships with its `OFL.txt`.
- **Object snap** distance is **2 mm**. Holding Shift turns off both grid snap and object snap.
- **Live measurements** appear only while dragging.

## Review Focus

1. **A formula whose variable is renamed or deleted, or variables that use each other in a loop.**
   - Expected for a rename: every formula and variable is rewritten, so nothing breaks.
   - Expected for a delete or a loop: an inline error, the part keeps its last size, and export still works.
   - Pinned in Task 2 (loops), Task 5 (missing variable keeps the number), Task 6 (rename rewrites, delete keeps the number) and Task 7 (error shown on the field).
2. **Hostile or silly formula text**, such as `9^9^9`, hundreds of nested brackets, a 10 000-character paste, `constructor`, `__proto__` or `alert(1)`.
   - Expected: a friendly message, no hang, no stack overflow, and nothing ever runs as JavaScript.
   - Pinned in Task 1.
3. **Designs saved by Milestone 1** (schema version 1, in IndexedDB or in `.blokade` files).
   - Expected: they open, upgrade to version 2, keep every part, and are never reported as damaged.
   - Pinned in Task 3.
4. **Text the font can't draw**: blank text, only spaces, emoji, 100+ characters, or the font failing to load.
   - Expected: a friendly message on the part, or valid letters. The worker keeps running.
   - Pinned in Task 4 (length limit) and Task 9 (blank, emoji, font not loaded).
5. **Dragging a handle on a field that holds a formula.**
   - Expected: the drag wins and that field's formula is removed. Other formulas stay. Undo brings the formula back.
   - Pinned in Task 6.

---

## File Map

```
src/
├─ formulas/
│  ├─ formula.ts            # NEW tokenizer, parser, evaluator, variablesUsed, renameVariableIn
│  └─ variables.ts          # NEW variableNameProblem, resolveVariables (order + loops)
├─ assets/fonts/            # NEW AtkinsonHyperlegible-Bold.ttf + OFL.txt
├─ document/
│  ├─ types.ts              # v2: ParamValue, FieldKey, formulas, Variable, settings.fit
│  ├─ schema.ts             # v2 schema + variable-name checks
│  ├─ factory.ts            # v2 empty doc; createShapeNode takes rotation
│  ├─ fields.ts             # NEW readField/writeField/formulaOf/withFormula/dropStaleFormulas
│  ├─ formula-ops.ts        # NEW setFieldInput, recomputeFormulas, formulaErrors, variableValues
│  ├─ variable-ops.ts       # NEW add/set/rename/remove variable, setFit, nextVariableName
│  ├─ ops.ts                # updateNode/ungroup/duplicate drop stale formulas
│  ├─ box.ts                # NEW Box math: size, center, edge, union, gap, translate
│  └─ align.ts              # NEW alignNodes
├─ persistence/migrate.ts   # MIGRATIONS[1] → v2
├─ plugins/
│  ├─ types.ts              # ParamSpec union (number | text), typed definePlugin
│  ├─ params.ts             # normalizeTextParam, resolveParams handles text
│  ├─ registry.ts           # accepts text params; size handles must target numbers
│  ├─ font.ts               # NEW TEXT_FONT, registerFont
│  ├─ cad-types.ts, cad.ts  # cad.text(...)
│  ├─ index.ts              # builtin order + 'text'
│  └─ builtin/text.ts       # NEW Text shape
├─ geometry/
│  ├─ geometry.worker.ts    # loads the bundled font
│  ├─ evaluate.ts           # params may be strings
│  └─ testing/font-node.ts  # NEW loads the font in Node tests
├─ app/
│  ├─ field-normalizer.ts   # NEW clamps typed/formula numbers per field
│  ├─ align-selection.ts    # NEW align the current selection using mesh boxes
│  ├─ actions.ts            # addShape uses the workplane; workplane actions
│  └─ testing/meshes.ts     # NEW boxMesh() test helper
├─ store/store.ts           # workplane + pickingWorkplane
├─ viewport/
│  ├─ sizing.ts             # params may be strings
│  ├─ bounds.ts             # NEW meshBox, topLevelBoxes
│  ├─ measure.ts            # NEW measure, formatMeasurement
│  ├─ object-snap.ts        # NEW snapToObjects, axesOf
│  ├─ workplane.ts          # NEW workplaneFromHit
│  ├─ WorkplaneMarker.tsx   # NEW
│  ├─ TransformHandles.tsx  # snapping + measurements while dragging
│  ├─ NodeMesh.tsx          # face picking for the workplane
│  └─ Viewport.tsx          # overlay, workplane picking, Shift-safe deselect
└─ ui/
   ├─ ValueField.tsx        # NEW number-or-formula field with inline result/error
   ├─ PropertiesPanel.tsx   # formulas in every field, text params, align tools
   ├─ AlignTools.tsx        # NEW
   ├─ VariablesPanel.tsx    # NEW fit + variables
   ├─ Toolbar.tsx           # Workplane / Ground buttons
   ├─ Workspace.tsx         # adds VariablesPanel
   └─ App.css
e2e/smart-sizes.spec.ts     # NEW
```

---

### Task 1: Formula engine

**Files:**
- Create: `src/formulas/formula.ts`
- Test: `src/formulas/formula.test.ts`

**Interfaces:**
- Consumes: `Result`, `ok` and `fail` from `src/shared/result.ts`.
- Produces:
  - `MAX_FORMULA_LENGTH = 200`
  - `type Expr`
  - `RESERVED_NAMES: ReadonlySet<string>`
  - `parseFormula(text): Result<Expr>`
  - `evaluateFormula(expr, scope: ReadonlyMap<string, number>): Result<number>`
  - `computeFormula(text, scope): Result<number>`
  - `variablesUsed(expr): readonly string[]`
  - `renameVariableIn(text, from, to): string`

- [ ] **Step 1: Write the failing test `src/formulas/formula.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { computeFormula, MAX_FORMULA_LENGTH, parseFormula, renameVariableIn, variablesUsed } from './formula'

const scope = new Map([['wall', 2], ['fit', 0.2], ['pi', Math.PI]])

function value(text: string): number {
  const result = computeFormula(text, scope)
  if (!result.ok) throw new Error(result.error)
  return result.value
}

function errorOf(text: string): string {
  const result = computeFormula(text, scope)
  if (result.ok) throw new Error(`expected "${text}" to fail`)
  return result.error
}

describe('formulas', () => {
  it('does arithmetic in the usual order', () => {
    expect(value('1 + 2 * 3')).toBe(7)
    expect(value('(1 + 2) * 3')).toBe(9)
    expect(value('10 / 4')).toBe(2.5)
    expect(value('2 ^ 3 ^ 2')).toBe(512)
    expect(value('-2 ^ 2')).toBe(-4)
    expect(value('--3')).toBe(3)
    expect(value('1.5e1')).toBe(15)
    expect(value('.5 + 1')).toBe(1.5)
  })

  it('uses variables, fit and pi', () => {
    expect(value('wall * 2 + fit')).toBeCloseTo(4.2)
    expect(value('2 * pi')).toBeCloseTo(6.283185)
  })

  it('calls the allowed functions, with angles in degrees', () => {
    expect(value('min(3, 1, 2)')).toBe(1)
    expect(value('max(3, wall)')).toBe(3)
    expect(value('round(2.5) + floor(2.9) + ceil(2.1)')).toBe(8)
    expect(value('sqrt(16)')).toBe(4)
    expect(value('sin(90)')).toBeCloseTo(1)
    expect(value('cos(180)')).toBeCloseTo(-1)
    expect(value('tan(45)')).toBeCloseTo(1)
  })

  it('explains mistakes in plain words', () => {
    expect(errorOf('wal * 2')).toContain(`"wal" isn't a variable`)
    expect(errorOf('1 +')).toContain('stops too early')
    expect(errorOf('(1 + 2')).toContain('")" is missing')
    expect(errorOf('2 wall')).toContain(`Something's off near "wall"`)
    expect(errorOf('5 / 0')).toContain('divide by zero')
    expect(errorOf('sqrt(-1)')).toContain("doesn't make a number")
    expect(errorOf('hypot(3, 4)')).toContain(`"hypot" isn't a function`)
    expect(errorOf('round(1, 2)')).toContain('round() needs exactly 1 number')
    expect(errorOf('min()')).toContain('min() needs at least 1 number')
    expect(errorOf('3 # 4')).toContain('"#"')
    expect(errorOf('')).toContain('empty')
  })

  it('refuses formulas that would hang or overflow', () => {
    expect(errorOf('9 ^ 9 ^ 9')).toContain('too big')
    expect(errorOf('1'.repeat(MAX_FORMULA_LENGTH + 1))).toContain(`${MAX_FORMULA_LENGTH} characters`)
    expect(errorOf(`${'('.repeat(41)}1${')'.repeat(41)}`)).toContain('nested too deeply')
    expect(errorOf(`${'-'.repeat(60)}1`)).toContain('nested too deeply')
    expect(value(`${'('.repeat(30)}1${')'.repeat(30)}`)).toBe(1)
  })

  it('never reaches JavaScript', () => {
    expect(errorOf('constructor')).toContain(`isn't a variable`)
    expect(errorOf('__proto__')).toContain(`isn't a variable`)
    expect(errorOf('alert(1)')).toContain(`isn't a function`)
    expect(errorOf('"x"')).toContain("doesn't understand")
  })

  it('lists the variables a formula uses, once each', () => {
    const parsed = parseFormula('max(wall, gap) * wall + 2')
    expect(parsed.ok && variablesUsed(parsed.value)).toEqual(['wall', 'gap'])
  })

  it('renames a variable without touching longer names or broken text', () => {
    expect(renameVariableIn('wall*2 + walls + min(wall, 1)', 'wall', 'side')).toBe('side*2 + walls + min(side, 1)')
    expect(renameVariableIn('3 # wall', 'wall', 'side')).toBe('3 # wall')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/formulas/formula.test.ts`
Expected: FAIL, "Failed to resolve import "./formula"".

- [ ] **Step 3: Write `src/formulas/formula.ts`**

```ts
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
```

The tokenizer and parser keep local cursor state (`at`, `pos`, `depth`). That state never leaves the function or class instance, so it doesn't break the immutability rule.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/formulas/formula.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/formulas
git commit -m "feat: add a safe formula parser and evaluator"
```

---

### Task 2: Variables and loops

**Files:**
- Create: `src/formulas/variables.ts`
- Modify: `src/document/types.ts` (add `Variable` only)
- Test: `src/formulas/variables.test.ts`

**Interfaces:**
- Consumes: `parseFormula`, `evaluateFormula`, `variablesUsed` and `RESERVED_NAMES` (Task 1).
- Produces:
  - `interface Variable { name; expr }` in `src/document/types.ts`
  - `VARIABLE_NAME_PATTERN`
  - `MAX_VARIABLE_NAME_LENGTH = 30`
  - `variableNameProblem(name, taken): string | null`
  - `interface VariableValues { scope: ReadonlyMap<string, number>; errors: Readonly<Record<string, string>> }`
  - `resolveVariables(variables, fit): VariableValues`

- [ ] **Step 1: Add the `Variable` type to `src/document/types.ts`**

Add this below the `SceneNode` type:

```ts
/** A named number for formulas. `expr` is a number or a formula, such as "wall * 2". */
export interface Variable {
  readonly name: string
  readonly expr: string
}
```

- [ ] **Step 2: Write the failing test `src/formulas/variables.test.ts`**

```ts
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/formulas/variables.test.ts`
Expected: FAIL, "Failed to resolve import "./variables"".

- [ ] **Step 4: Write `src/formulas/variables.ts`**

```ts
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
```

`resolveVariables` keeps working state (`results`, `loops`, `visiting`) in local maps. They are scratch space for one call and never escape it.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/formulas/variables.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/formulas src/document/types.ts
git commit -m "feat: resolve design variables in order and report loops"
```

---

### Task 3: Document version 2 (variables, fit, formulas, text-ready params)

**Files:**
- Modify:
  - `src/document/types.ts`
  - `src/document/schema.ts`
  - `src/document/factory.ts`
  - `src/persistence/migrate.ts`
  - `src/geometry/evaluate.ts`
  - `src/viewport/sizing.ts`
  - `src/ui/PropertiesPanel.tsx`
- Test:
  - `src/document/schema.test.ts`
  - `src/document/factory.test.ts`
  - `src/persistence/migrate.test.ts`
  - `src/persistence/design-file.test.ts`

**Interfaces:**
- Consumes: `MAX_FORMULA_LENGTH` (Task 1), `variableNameProblem` (Task 2).
- Produces:
  - `type ParamValue = number | string`
  - `type FieldKey`
  - `NodeBase.formulas?: Readonly<Record<string, string>>`
  - `ShapeNode.params: Readonly<Record<string, ParamValue>>`
  - `DocumentSettings.fit`
  - `BloKadeDocument.schemaVersion: 2` and `BloKadeDocument.variables`
  - `CURRENT_SCHEMA_VERSION = 2`, `DEFAULT_FIT = 0.2`, `MAX_FIT = 2`, `MAX_TEXT_PARAM_LENGTH = 40`

- [ ] **Step 1: Update the tests first**

In `src/document/factory.test.ts`, change the expected empty document to:

```ts
    expect(doc).toEqual({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      name: 'Phone Stand',
      units: 'mm',
      settings: { gridSnap: 1, fit: 0.2 },
      variables: [],
      root: [],
      nodes: {},
    })
```

In `src/document/schema.test.ts`, change the "unknown schema version" test to use version 3:

```ts
  it('rejects an unknown schema version', () => {
    expect(errorOf({ ...createEmptyDocument(), schemaVersion: 3 })).toContain('damaged')
  })
```

Then add these tests inside the same `describe`:

```ts
  it('accepts variables, field formulas and text params', () => {
    const shape = { ...box('a'), params: { width: 10, text: 'Kade' }, formulas: { 'param.width': 'wall * 2', 'position.0': 'wall' } }
    const doc = { ...docWith([shape], ['a']), variables: [{ name: 'wall', expr: '5' }] }
    expect(validateDocument(doc).ok).toBe(true)
  })

  it('rejects formulas on unknown fields', () => {
    const shape = { ...box('a'), formulas: { colour: 'red' } }
    expect(errorOf(docWith([shape], ['a']))).toContain('damaged')
  })

  it('rejects duplicate or reserved variable names', () => {
    const base = docWith([], [])
    expect(errorOf({ ...base, variables: [{ name: 'wall', expr: '1' }, { name: 'wall', expr: '2' }] }))
      .toContain('already a variable called "wall"')
    expect(errorOf({ ...base, variables: [{ name: 'fit', expr: '1' }] })).toContain('BloKade already uses "fit"')
  })

  it('rejects an impossible fit gap', () => {
    const doc = docWith([], [])
    expect(errorOf({ ...doc, settings: { ...doc.settings, fit: 5 } })).toContain('damaged')
  })
```

In `src/persistence/migrate.test.ts`, replace the first test and add an upgrade test:

```ts
  it('passes current documents through', () => {
    expect(migrateDocument({ schemaVersion: 2, name: 'x' })).toEqual({ ok: true, value: { schemaVersion: 2, name: 'x' } })
  })

  it('upgrades version 1 designs with no variables and the default fit gap', () => {
    expect(migrateDocument({ schemaVersion: 1, name: 'x', settings: { gridSnap: 0.5 } })).toEqual({
      ok: true,
      value: { schemaVersion: 2, name: 'x', settings: { gridSnap: 0.5, fit: 0.2 }, variables: [] },
    })
  })
```

In `src/persistence/design-file.test.ts`, add this test (Review Focus 3). Import `parseDesignFile` there if it isn't imported already:

```ts
  it('opens a design saved by Milestone 1 and keeps every part', () => {
    const v1 = JSON.stringify({
      schemaVersion: 1, name: 'Old robot', units: 'mm', settings: { gridSnap: 0.5 }, root: ['a'],
      nodes: {
        a: {
          id: 'a', kind: 'shape', name: 'Box', shapeType: 'box', params: { width: 30, depth: 20, height: 10 },
          mode: 'solid', transform: { position: [1, 2, 0], rotation: [0, 0, 45] }, hidden: false, color: '#ff6b6b',
        },
      },
    })
    const result = parseDesignFile(v1)
    if (!result.ok) throw new Error(result.error)
    expect(result.value.schemaVersion).toBe(2)
    expect(result.value.settings).toEqual({ gridSnap: 0.5, fit: 0.2 })
    expect(result.value.variables).toEqual([])
    expect(result.value.nodes.a).toMatchObject({
      params: { width: 30, depth: 20, height: 10 },
      transform: { position: [1, 2, 0], rotation: [0, 0, 45] },
    })
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/document src/persistence`
Expected: FAIL. The empty doc lacks `fit` and `variables`, version 1 isn't migrated, and the schema rejects `variables`.

- [ ] **Step 3: Update `src/document/types.ts`**

Replace the file with the following. It keeps the `Variable` type from Task 2.

```ts
export type NodeId = string
export type Vec3 = readonly [number, number, number]
export type Mode = 'solid' | 'hole'
/** A shape parameter: a number, or a line of text for the Text shape. */
export type ParamValue = number | string

/** Position in mm; rotation in degrees, Euler XYZ (three.js convention: matrix = Rx·Ry·Rz). */
export interface Transform {
  readonly position: Vec3
  readonly rotation: Vec3
}

/**
 * A field that can hold a formula: `param.<name>`, `position.<0|1|2>` or `rotation.<0|1|2>`.
 * The field itself always keeps a plain number: the last value its formula worked out.
 */
export type FieldKey = `param.${string}` | `position.${0 | 1 | 2}` | `rotation.${0 | 1 | 2}`

interface NodeBase {
  readonly id: NodeId
  readonly name: string
  readonly mode: Mode
  readonly transform: Transform
  readonly hidden: boolean
  readonly color: string
  /** Formula text for fields that use one, keyed by FieldKey. Missing when no field has a formula. */
  readonly formulas?: Readonly<Record<string, string>>
}

export interface ShapeNode extends NodeBase {
  readonly kind: 'shape'
  readonly shapeType: string
  readonly params: Readonly<Record<string, ParamValue>>
}

export interface GroupNode extends NodeBase {
  readonly kind: 'group'
  readonly children: readonly NodeId[]
}

export type SceneNode = ShapeNode | GroupNode

/** A named number for formulas. `expr` is a number or a formula, such as "wall * 2". */
export interface Variable {
  readonly name: string
  readonly expr: string
}

export interface DocumentSettings {
  /** Grid snap in mm; 0 means snapping is off. */
  readonly gridSnap: number
  /** Extra gap in mm for parts that slot together; formulas read it as `fit`. */
  readonly fit: number
}

export interface BloKadeDocument {
  readonly schemaVersion: 2
  readonly name: string
  readonly units: 'mm'
  readonly settings: DocumentSettings
  readonly variables: readonly Variable[]
  readonly root: readonly NodeId[]
  readonly nodes: Readonly<Record<NodeId, SceneNode>>
}

export const CURRENT_SCHEMA_VERSION = 2
export const DEFAULT_GRID_SNAP = 1
export const DEFAULT_FIT = 0.2
export const MAX_FIT = 2
/** Longest text a text parameter may hold, in characters. */
export const MAX_TEXT_PARAM_LENGTH = 40
export const IDENTITY_TRANSFORM: Transform = { position: [0, 0, 0], rotation: [0, 0, 0] }
```

- [ ] **Step 4: Update `src/document/schema.ts`**

Replace the imports and schema pieces above `checkTree`:

```ts
import { z } from 'zod'
import { MAX_FORMULA_LENGTH } from '../formulas/formula'
import { variableNameProblem } from '../formulas/variables'
import { fail, ok, type Result } from '../shared/result'
import { MAX_FIT, MAX_TEXT_PARAM_LENGTH, type BloKadeDocument } from './types'

const FIELD_KEY = /^(?:param\.[A-Za-z0-9_]+|position\.[0-2]|rotation\.[0-2])$/

const vec3 = z.tuple([z.number(), z.number(), z.number()])
const transform = z.object({ position: vec3, rotation: vec3 })
const base = {
  id: z.string().min(1),
  name: z.string(),
  mode: z.enum(['solid', 'hole']),
  transform,
  hidden: z.boolean(),
  color: z.string(),
  formulas: z.record(z.string().regex(FIELD_KEY), z.string().max(MAX_FORMULA_LENGTH)).optional(),
}
const shapeNode = z.object({
  ...base,
  kind: z.literal('shape'),
  shapeType: z.string().min(1),
  params: z.record(z.string(), z.union([z.number(), z.string().max(MAX_TEXT_PARAM_LENGTH * 2)])),
})
const groupNode = z.object({ ...base, kind: z.literal('group'), children: z.array(z.string()) })
const sceneNode = z.discriminatedUnion('kind', [shapeNode, groupNode])
const variable = z.object({ name: z.string(), expr: z.string().max(MAX_FORMULA_LENGTH) })

const documentShape = z.object({
  schemaVersion: z.literal(2),
  name: z.string(),
  units: z.literal('mm'),
  settings: z.object({ gridSnap: z.number().min(0), fit: z.number().min(0).max(MAX_FIT) }),
  variables: z.array(variable).max(200),
  root: z.array(z.string()),
  nodes: z.record(z.string(), sceneNode),
})
```

The `MAX_TEXT_PARAM_LENGTH * 2` bound allows room for multi-unit characters such as emoji. `normalizeTextParam` (Task 4) enforces the real 40-character limit.

Below `checkTree`, add `checkVariables` and change `documentSchema` to run both checks:

```ts
/** Variable names are valid, unreserved, and unique. */
function checkVariables(doc: DocShape, ctx: z.RefinementCtx): void {
  doc.variables.forEach((v, index) => {
    const problem = variableNameProblem(v.name, doc.variables.slice(0, index).map((earlier) => earlier.name))
    if (problem) ctx.addIssue({ code: 'custom', message: problem, path: ['variables', index, 'name'] })
  })
}

export const documentSchema = documentShape.superRefine((doc, ctx) => {
  checkTree(doc, ctx)
  checkVariables(doc, ctx)
})
```

- [ ] **Step 5: Update `src/document/factory.ts`**

Change the imports and `createEmptyDocument`, and widen `params` in `createShapeNode`:

```ts
import {
  CURRENT_SCHEMA_VERSION, DEFAULT_FIT, DEFAULT_GRID_SNAP, IDENTITY_TRANSFORM,
  type BloKadeDocument, type GroupNode, type NodeId, type ParamValue, type ShapeNode, type Vec3,
} from './types'
```

```ts
export function createEmptyDocument(name = 'Untitled design'): BloKadeDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name,
    units: 'mm',
    settings: { gridSnap: DEFAULT_GRID_SNAP, fit: DEFAULT_FIT },
    variables: [],
    root: [],
    nodes: {},
  }
}
```

In `createShapeNode`'s input type, change `params: Readonly<Record<string, number>>` to `params: Readonly<Record<string, ParamValue>>`.

- [ ] **Step 6: Add the 1 → 2 migration in `src/persistence/migrate.ts`**

```ts
import { CURRENT_SCHEMA_VERSION, DEFAULT_FIT } from '../document/types'
import { fail, ok, type Result } from '../shared/result'

export type Migration = (doc: Readonly<Record<string, unknown>>) => Record<string, unknown>

const asRecord = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : {}

/** MIGRATIONS[n] upgrades a version-n document to version n + 1. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // Version 2 (Milestone 2) adds design variables and the `fit` gap.
  1: (doc) => ({ ...doc, variables: [], settings: { ...asRecord(doc.settings), fit: DEFAULT_FIT } }),
}
```

The rest of the file (`NOT_A_DESIGN` and `migrateDocument`) stays as it is.

- [ ] **Step 7: Make the code that reads `params` accept strings**

`src/geometry/evaluate.ts`: widen `stableKey`:

```ts
const stableKey = (values: Readonly<Record<string, unknown>>): string =>
  JSON.stringify(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)))
```

`src/viewport/sizing.ts`: accept string params and only scale numbers:

```ts
import type { ParamValue, Vec3 } from '../document/types'
```

```ts
export function paramsFromScale(plugin: ShapePlugin, params: Readonly<Record<string, ParamValue>>, scale: Vec3): ParamValues {
```

```ts
  const scaled = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, typeof value === 'number' ? round2(value * (factors[key] ?? 1)) : value]),
  )
```

`src/ui/PropertiesPanel.tsx`: in `ShapeParams`, read the raw value before passing it to `NumberField`. Task 7 rewrites this component.

```tsx
      {Object.entries<NumberParamSpec>(plugin.params).map(([key, spec]) => {
        const raw = node.params[key]
        return (
          <NumberField
            key={key}
            label={`${spec.label}${UNIT[spec.type]}`}
            value={typeof raw === 'number' ? raw : spec.default}
            testId={`param-${key}`}
            onCommit={(value) => apply((d) => updateNode(d, node.id, (n) => (
              n.kind === 'shape' ? { ...n, params: resolveParams(plugin, { ...n.params, [key]: value }) } : n
            )))}
          />
        )
      })}
```

- [ ] **Step 8: Run the tests and typecheck**

Run: `npx vitest run src/document src/persistence && npm run typecheck`
Expected: PASS, and typecheck clean. If another test builds a document literal without `fit` or `variables`, add the two fields to that literal and report it.

- [ ] **Step 9: Run the full suite**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add src
git commit -m "feat: upgrade designs to schema v2 with variables, fit gap and formulas"
```

---

### Task 4: Text parameters and typed plugin params

**Files:**
- Modify:
  - `src/plugins/types.ts`
  - `src/plugins/params.ts`
  - `src/plugins/registry.ts`
  - `src/ui/PropertiesPanel.tsx`
- Test:
  - `src/plugins/params.test.ts`
  - `src/plugins/registry.test.ts`
  - `src/plugins/types.test.ts`

**Interfaces:**
- Consumes: `ParamValue` and `MAX_TEXT_PARAM_LENGTH` (Task 3).
- Produces:
  - `TextParamSpec`
  - `ParamSpec = NumberParamSpec | TextParamSpec`
  - `ParamSpecs`
  - `ParamValues = Readonly<Record<string, ParamValue>>`
  - `ParamValuesOf<P>`
  - `ShapePlugin<P extends ParamSpecs = ParamSpecs>`
  - `definePlugin<const P>`, where text params arrive in `build` as `string` and size handles may only target number params
  - `normalizeTextParam(spec, raw): string`
  - `resolveParams`, which now returns numbers and strings

- [ ] **Step 1: Write the failing tests**

Add to `src/plugins/params.test.ts`. Import `normalizeTextParam` and `resolveParams` from `./params` and `TextParamSpec` from `./types`.

```ts
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
```

Add `definePlugin` to that file's imports from `./types`.

Add to `src/plugins/registry.test.ts`:

```ts
  it('accepts text params', () => {
    const { problems } = createRegistry([{ ...good('t'), params: { ...good('t').params, label: { type: 'text', default: 'Hi', label: 'Label' } } }])
    expect(problems).toEqual([])
  })

  it('reports a size handle pointing at a text param', () => {
    const plugin = { ...good('u'), params: { label: { type: 'text', default: 'Hi', label: 'Label' } }, size: { x: 'label' } }
    expect(createRegistry([plugin]).problems[0]).toContain('text')
  })
```

Add to `src/plugins/types.test.ts`:

```ts
  it('hands text params to build as strings', () => {
    const plugin = definePlugin({
      id: 'label',
      name: 'Label',
      icon: 'x',
      version: 1,
      params: {
        text: { type: 'text', default: 'Kade', label: 'Text' },
        size: { type: 'mm', default: 4, label: 'Size' },
      },
      size: {
        // @ts-expect-error size handles can only change number params
        x: 'text',
        y: 'size',
      },
      build: ({ text, size }, cad) => {
        const letters: string = text
        return cad.box(size * letters.length, size, size)
      },
    })
    expect(defaultParams(plugin)).toEqual({ text: 'Kade', size: 4 })
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/plugins && npm run typecheck`
Expected: FAIL. `normalizeTextParam` is missing, and the registry rejects the `text` type.

- [ ] **Step 3: Replace `src/plugins/types.ts`**

```ts
import type { Shape3D } from 'replicad'
import type { ParamValue } from '../document/types'
import type { CadToolkit } from './cad-types'

export type NumberParamType = 'mm' | 'whole' | 'number' | 'angle'

export interface NumberParamSpec {
  readonly type: NumberParamType
  readonly default: number
  readonly min?: number
  readonly max?: number
  readonly label: string
}

/** A line of text, such as the letters of the Text shape. Text params never hold formulas. */
export interface TextParamSpec {
  readonly type: 'text'
  readonly default: string
  /** At most this many characters (never more than MAX_TEXT_PARAM_LENGTH). */
  readonly maxLength?: number
  readonly label: string
}

export type ParamSpec = NumberParamSpec | TextParamSpec
export type ParamSpecs = Readonly<Record<string, ParamSpec>>
export type ParamValues = Readonly<Record<string, ParamValue>>

/** Distributes over a union, so a general ParamSpec gives number | string. */
type ValueOf<S> = S extends TextParamSpec ? string : number

/** What build() receives: numbers for number params, strings for text params. */
export type ParamValuesOf<P extends ParamSpecs> = { readonly [K in keyof P]: ValueOf<P[K]> }

type NumberParamKey<P extends ParamSpecs> = { [K in keyof P]: P[K] extends TextParamSpec ? never : K }[keyof P] & string
/** Size handles may only point at number params. A plugin whose params aren't known yet allows any name. */
type SizeKey<P extends ParamSpecs> = string extends keyof P ? string : NumberParamKey<P>

export interface ShapePlugin<P extends ParamSpecs = ParamSpecs> {
  readonly id: string
  readonly name: string
  readonly icon: string
  readonly version: number
  readonly params: P
  /** Which number parameter each size handle (x/y/z) changes. */
  readonly size?: NoInfer<{ readonly x?: SizeKey<P>; readonly y?: SizeKey<P>; readonly z?: SizeKey<P> }>
  build(params: ParamValuesOf<P>, cad: CadToolkit): Shape3D
}

/** Identity helper so plugin authors get type checking and inferred parameter names and types. */
export function definePlugin<const P extends ParamSpecs>(plugin: ShapePlugin<P>): ShapePlugin<P> {
  return plugin
}
```

- [ ] **Step 4: Update `src/plugins/params.ts`**

```ts
import { MAX_TEXT_PARAM_LENGTH, type ParamValue } from '../document/types'
import type { NumberParamSpec, ParamSpec, ParamValues, ShapePlugin, TextParamSpec } from './types'
```

Keep `MIN_MM`, `MAX_MM`, `boundsOf` and `normalizeParam` unchanged. Then replace `resolveParams` and `defaultParams` with the following:

```ts
/** Text keeps to one line and to its length limit (counted in characters, so emoji aren't split). */
export function normalizeTextParam(spec: TextParamSpec, raw: unknown): string {
  if (typeof raw !== 'string') return spec.default
  const limit = Math.min(spec.maxLength ?? MAX_TEXT_PARAM_LENGTH, MAX_TEXT_PARAM_LENGTH)
  return Array.from(raw.replace(/[\r\n\t]+/g, ' ')).slice(0, limit).join('')
}

const normalizeAny = (spec: ParamSpec, raw: unknown): ParamValue =>
  spec.type === 'text' ? normalizeTextParam(spec, raw) : normalizeParam(spec, raw)

export function resolveParams(plugin: ShapePlugin, raw: Readonly<Record<string, unknown>>): ParamValues {
  return Object.fromEntries(
    Object.entries<ParamSpec>(plugin.params).map(([key, spec]) => [key, normalizeAny(spec, raw[key])]),
  )
}

export const defaultParams = (plugin: ShapePlugin): ParamValues => resolveParams(plugin, {})
```

- [ ] **Step 5: Update `src/plugins/registry.ts`**

```ts
import { z } from 'zod'
import { MAX_TEXT_PARAM_LENGTH } from '../document/types'
import type { ShapePlugin } from './types'
```

Replace `paramSpec` and the size check with the following:

```ts
const numberSpec = z.object({
  type: z.enum(['mm', 'whole', 'number', 'angle']),
  default: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
  label: z.string().min(1),
})
const textSpec = z.object({
  type: z.literal('text'),
  default: z.string().max(MAX_TEXT_PARAM_LENGTH),
  maxLength: z.number().int().min(1).max(MAX_TEXT_PARAM_LENGTH).optional(),
  label: z.string().min(1),
})
const paramSpec = z.union([numberSpec, textSpec])
```

```ts
  .superRefine((p, ctx) => {
    for (const target of Object.values(p.size ?? {})) {
      if (!target) continue
      const spec = Object.hasOwn(p.params, target) ? p.params[target] : undefined
      if (!spec) ctx.addIssue({ code: 'custom', message: `size handle points at missing parameter "${target}"` })
      else if (spec.type === 'text') ctx.addIssue({ code: 'custom', message: `size handle can't change the text parameter "${target}"` })
    }
  })
```

- [ ] **Step 6: Keep `src/ui/PropertiesPanel.tsx` compiling**

Replace the `NumberParamSpec` type import with `NumberParamType` and `ParamSpec`, and type `UNIT` by `NumberParamType`:

```tsx
import type { NumberParamType, ParamSpec } from '../plugins/types'
```

```tsx
const UNIT: Record<NumberParamType, string> = { mm: ' (mm)', angle: ' (°)', whole: '', number: '' }
```

Inside `ShapeParams`, skip text params for now. Task 7 adds the text field.

```tsx
      {Object.entries<ParamSpec>(plugin.params).flatMap(([key, spec]) => {
        if (spec.type === 'text') return []
        const raw = node.params[key]
        return [
          <NumberField
            key={key}
            label={`${spec.label}${UNIT[spec.type]}`}
            value={typeof raw === 'number' ? raw : spec.default}
            testId={`param-${key}`}
            onCommit={(value) => apply((d) => updateNode(d, node.id, (n) => (
              n.kind === 'shape' ? { ...n, params: resolveParams(plugin, { ...n.params, [key]: value }) } : n
            )))}
          />,
        ]
      })}
```

- [ ] **Step 7: Run the tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS, and typecheck clean. The `@ts-expect-error` line must be used, which proves that size handles can't target text. If TypeScript reports the error on a different line, move the comment to the line just above the reported one and note the move.

- [ ] **Step 8: Commit**

```bash
git add src/plugins src/ui/PropertiesPanel.tsx
git commit -m "feat: let plugins declare text parameters"
```

---

### Task 5: Field access and formula operations

**Files:**
- Create: `src/document/fields.ts`, `src/document/formula-ops.ts`
- Test: `src/document/fields.test.ts`, `src/document/formula-ops.test.ts`

**Interfaces:**
- Consumes: `computeFormula` and `MAX_FORMULA_LENGTH` (Task 1), `resolveVariables` and `VariableValues` (Task 2), `updateNode` and `DocumentOpError` (Milestone 1 `ops.ts`).
- Produces:
  - In `fields.ts`:
    - `paramField(name)`, `positionField(axis)`, `rotationField(axis)` and `isFieldKey(key)`
    - `readField(node, key): number | undefined`
    - `writeField(node, key, value): SceneNode`
    - `formulaOf(node, key): string | undefined`
    - `formulaEntries(node)`
    - `withFormula(node, key, formula | null)`
    - `dropStaleFormulas(before, after)`
  - In `formula-ops.ts`:
    - `type NormalizeField = (node, key, value) => number`
    - `variableValues(doc)`
    - `setFieldInput(doc, id, key, text, normalize)`
    - `recomputeFormulas(doc, normalize)`
    - `type FormulaErrors` and `formulaErrors(doc)`

- [ ] **Step 1: Write the failing test `src/document/fields.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { createGroupNode, createShapeNode } from './factory'
import {
  dropStaleFormulas, formulaEntries, formulaOf, isFieldKey, paramField, positionField, readField, rotationField,
  withFormula, writeField,
} from './fields'

const box = createShapeNode({ id: 'b', shapeType: 'text', name: 'Sign', params: { size: 10, text: 'Hi' }, color: '#f00', position: [1, 2, 3] })

describe('fields', () => {
  it('reads numbers from params, position and rotation', () => {
    expect(readField(box, paramField('size'))).toBe(10)
    expect(readField(box, positionField(2))).toBe(3)
    expect(readField(box, rotationField(0))).toBe(0)
    expect(readField(box, paramField('text'))).toBeUndefined()
    expect(readField(box, paramField('missing'))).toBeUndefined()
    expect(readField(createGroupNode({ id: 'g', children: [] }), paramField('size'))).toBeUndefined()
  })

  it('writes a field into a copy and leaves the original alone', () => {
    const moved = writeField(box, positionField(0), 9)
    expect(moved.transform.position).toEqual([9, 2, 3])
    expect(box.transform.position).toEqual([1, 2, 3])
    expect(writeField(box, paramField('size'), 10)).toBe(box)
    expect(writeField(box, paramField('text'), 5)).toBe(box)
  })

  it('adds and removes formulas', () => {
    const withOne = withFormula(box, paramField('size'), 'wall * 2')
    expect(formulaOf(withOne, paramField('size'))).toBe('wall * 2')
    expect(formulaEntries(withOne)).toEqual([['param.size', 'wall * 2']])
    const none = withFormula(withOne, paramField('size'), null)
    expect(formulaOf(none, paramField('size'))).toBeUndefined()
    expect(none.formulas).toBeUndefined()
  })

  it('recognises field keys', () => {
    expect(isFieldKey('param.width')).toBe(true)
    expect(isFieldKey('rotation.2')).toBe(true)
    expect(isFieldKey('rotation.3')).toBe(false)
    expect(isFieldKey('colour')).toBe(false)
  })

  it('forgets formulas whose value an edit changed directly, and keeps the rest', () => {
    const before = withFormula(withFormula(box, positionField(0), 'wall'), paramField('size'), 'wall * 2')
    const dragged = { ...before, transform: { ...before.transform, position: [12, 2, 3] as const } }
    const after = dropStaleFormulas(before, dragged)
    expect(formulaOf(after, positionField(0))).toBeUndefined()
    expect(formulaOf(after, paramField('size'))).toBe('wall * 2')
  })

  it('trusts edits that set formulas themselves', () => {
    const before = withFormula(box, positionField(0), 'wall')
    const after = withFormula(writeField(before, positionField(0), 7), positionField(0), 'wall + 4')
    expect(dropStaleFormulas(before, after)).toBe(after)
  })
})
```

- [ ] **Step 2: Write the failing test `src/document/formula-ops.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from './factory'
import { formulaErrors, recomputeFormulas, setFieldInput, type NormalizeField } from './formula-ops'
import { addNode, DocumentOpError } from './ops'
import type { BloKadeDocument, Variable } from './types'

const clampSizes: NormalizeField = (_node, key, value) => (key.startsWith('param.') ? Math.min(2000, Math.max(0.01, value)) : value)

function setup(variables: readonly Variable[] = [{ name: 'wall', expr: '3' }]): BloKadeDocument {
  const box = createShapeNode({ id: 'b', shapeType: 'box', name: 'Box', params: { width: 20, depth: 20, height: 20 }, color: '#f00' })
  return addNode({ ...createEmptyDocument(), variables }, box)
}
const nodeOf = (doc: BloKadeDocument) => doc.nodes.b

describe('setFieldInput', () => {
  it('works out a formula and remembers its text', () => {
    const doc = setFieldInput(setup(), 'b', 'param.width', 'wall * 10', clampSizes)
    expect(nodeOf(doc)).toMatchObject({ params: { width: 30 }, formulas: { 'param.width': 'wall * 10' } })
  })

  it('replaces a formula with a plain number', () => {
    const withFormula = setFieldInput(setup(), 'b', 'param.width', 'wall * 10', clampSizes)
    const doc = setFieldInput(withFormula, 'b', 'param.width', ' 12 ', clampSizes)
    expect(nodeOf(doc)?.formulas).toBeUndefined()
    expect(nodeOf(doc)).toMatchObject({ params: { width: 12 } })
  })

  it('keeps a broken formula and the last good number', () => {
    const doc = setFieldInput(setup(), 'b', 'param.width', 'wal * 10', clampSizes)
    expect(nodeOf(doc)).toMatchObject({ params: { width: 20 }, formulas: { 'param.width': 'wal * 10' } })
    expect(formulaErrors(doc).b?.['param.width']).toContain(`"wal" isn't a variable`)
  })

  it('clamps numbers and formula results the same way', () => {
    expect(nodeOf(setFieldInput(setup(), 'b', 'param.width', '-5', clampSizes))).toMatchObject({ params: { width: 0.01 } })
    expect(nodeOf(setFieldInput(setup(), 'b', 'param.width', 'wall - 100', clampSizes))).toMatchObject({ params: { width: 0.01 } })
  })

  it('works for position and rotation', () => {
    const doc = setFieldInput(setFieldInput(setup(), 'b', 'position.0', 'wall + 1', clampSizes), 'b', 'rotation.2', '90 / wall', clampSizes)
    expect(nodeOf(doc)?.transform).toEqual({ position: [4, 0, 0], rotation: [0, 0, 30] })
  })

  it('leaves the design alone when a typed number changes nothing', () => {
    const doc = setup()
    expect(setFieldInput(doc, 'b', 'param.width', '20', clampSizes)).toBe(doc)
  })

  it('refuses empty input, giant formulas, and fields a part does not have', () => {
    expect(() => setFieldInput(setup(), 'b', 'param.width', '  ', clampSizes)).toThrow(DocumentOpError)
    expect(() => setFieldInput(setup(), 'b', 'param.width', '1+'.repeat(150), clampSizes)).toThrow(DocumentOpError)
    expect(() => setFieldInput(setup(), 'b', 'param.colour', '3', clampSizes)).toThrow(DocumentOpError)
  })
})

describe('recomputeFormulas', () => {
  it('re-runs formulas after a variable changes', () => {
    const doc = setFieldInput(setup(), 'b', 'param.width', 'wall * 10', clampSizes)
    const changed = recomputeFormulas({ ...doc, variables: [{ name: 'wall', expr: '5' }] }, clampSizes)
    expect(nodeOf(changed)).toMatchObject({ params: { width: 50 } })
  })

  it('keeps the last good number when a variable disappears (Review Focus 1)', () => {
    const doc = setFieldInput(setup(), 'b', 'param.width', 'wall * 10', clampSizes)
    const gone = recomputeFormulas({ ...doc, variables: [] }, clampSizes)
    expect(nodeOf(gone)).toMatchObject({ params: { width: 30 }, formulas: { 'param.width': 'wall * 10' } })
    expect(formulaErrors(gone).b?.['param.width']).toContain(`"wall" isn't a variable`)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/document/fields.test.ts src/document/formula-ops.test.ts`
Expected: FAIL, "Failed to resolve import "./fields"".

- [ ] **Step 4: Write `src/document/fields.ts`**

```ts
import type { FieldKey, SceneNode, Vec3 } from './types'

const FIELD_KEY = /^(?:param\.([A-Za-z0-9_]+)|(position|rotation)\.([0-2]))$/

type Axis = 0 | 1 | 2
type ParsedKey = { readonly param: string } | { readonly part: 'position' | 'rotation'; readonly axis: Axis }

export const paramField = (name: string): FieldKey => `param.${name}`
export const positionField = (axis: Axis): FieldKey => `position.${axis}`
export const rotationField = (axis: Axis): FieldKey => `rotation.${axis}`
export const isFieldKey = (key: string): key is FieldKey => FIELD_KEY.test(key)

function parseKey(key: FieldKey): ParsedKey | null {
  const match = FIELD_KEY.exec(key)
  if (!match) return null
  if (match[1]) return { param: match[1] }
  return { part: match[2] as 'position' | 'rotation', axis: Number(match[3]) as Axis }
}

const withAxis = (v: Vec3, axis: Axis, value: number): Vec3 =>
  [axis === 0 ? value : v[0], axis === 1 ? value : v[1], axis === 2 ? value : v[2]]

/** The number a field holds, or undefined if this part has no such number field. */
export function readField(node: SceneNode, key: FieldKey): number | undefined {
  const parsed = parseKey(key)
  if (!parsed) return undefined
  if ('part' in parsed) return node.transform[parsed.part][parsed.axis]
  if (node.kind !== 'shape' || !Object.hasOwn(node.params, parsed.param)) return undefined
  const value = node.params[parsed.param]
  return typeof value === 'number' ? value : undefined
}

/** A copy of the part with the field set; the same part when the field is unknown or already equal. */
export function writeField(node: SceneNode, key: FieldKey, value: number): SceneNode {
  const parsed = parseKey(key)
  const current = readField(node, key)
  if (!parsed || current === undefined || current === value) return node
  if ('part' in parsed) {
    const vector = withAxis(node.transform[parsed.part], parsed.axis, value)
    return { ...node, transform: { ...node.transform, [parsed.part]: vector } }
  }
  return node.kind === 'shape' ? { ...node, params: { ...node.params, [parsed.param]: value } } : node
}

export function formulaOf(node: SceneNode, key: FieldKey): string | undefined {
  const formulas = node.formulas
  return formulas && Object.hasOwn(formulas, key) ? formulas[key] : undefined
}

/** The part's formulas as [field, text] pairs, skipping keys BloKade doesn't recognise. */
export function formulaEntries(node: SceneNode): readonly (readonly [FieldKey, string])[] {
  return Object.entries(node.formulas ?? {}).flatMap(([key, text]) => (isFieldKey(key) ? [[key, text] as const] : []))
}

/** Sets a field's formula, or removes it with null. A part left with no formulas has `formulas: undefined`. */
export function withFormula(node: SceneNode, key: FieldKey, formula: string | null): SceneNode {
  const others = Object.fromEntries(Object.entries(node.formulas ?? {}).filter(([k]) => k !== key))
  const formulas = formula === null ? others : { ...others, [key]: formula }
  return { ...node, formulas: Object.keys(formulas).length > 0 ? formulas : undefined }
}

/**
 * After an edit that set fields directly (a drag, align, snap or typed number), forget the formulas
 * whose value it changed: the edit wins. Edits that set formulas themselves are left alone.
 */
export function dropStaleFormulas(before: SceneNode, after: SceneNode): SceneNode {
  if (after.formulas !== before.formulas) return after
  return formulaEntries(after).reduce(
    (node, [key]) => (readField(before, key) === readField(after, key) ? node : withFormula(node, key, null)),
    after,
  )
}
```

- [ ] **Step 5: Write `src/document/formula-ops.ts`**

```ts
import { computeFormula, MAX_FORMULA_LENGTH } from '../formulas/formula'
import { resolveVariables, type VariableValues } from '../formulas/variables'
import { formulaEntries, formulaOf, readField, withFormula, writeField } from './fields'
import { DocumentOpError, updateNode } from './ops'
import type { BloKadeDocument, FieldKey, NodeId, SceneNode } from './types'

/** Clamps a number for one field (for example sizes to 0.01–2000 mm). The app supplies it; it knows the plugins. */
export type NormalizeField = (node: SceneNode, key: FieldKey, value: number) => number

export type FormulaErrors = Readonly<Record<NodeId, Readonly<Record<string, string>>>>

export const variableValues = (doc: BloKadeDocument): VariableValues =>
  resolveVariables(doc.variables, doc.settings.fit)

function applyInput(node: SceneNode, key: FieldKey, input: string, scope: ReadonlyMap<string, number>, normalize: NormalizeField): SceneNode {
  if (readField(node, key) === undefined) throw new DocumentOpError("That value can't hold a number.")
  const literal = Number(input)
  if (Number.isFinite(literal)) {
    const next = writeField(node, key, normalize(node, key, literal))
    return formulaOf(node, key) === undefined ? next : withFormula(next, key, null)
  }
  const result = computeFormula(input, scope)
  const withText = withFormula(node, key, input)
  // A broken formula is kept so Kade can fix it; meanwhile the field keeps its last good number.
  return result.ok ? writeField(withText, key, normalize(node, key, result.value)) : withText
}

/** Typing into a field: a plain number replaces any formula; anything else is kept as a formula. */
export function setFieldInput(
  doc: BloKadeDocument, id: NodeId, key: FieldKey, text: string, normalize: NormalizeField,
): BloKadeDocument {
  const input = text.trim()
  if (input === '') throw new DocumentOpError('Type a number or a formula.')
  if (input.length > MAX_FORMULA_LENGTH) {
    throw new DocumentOpError(`Formulas can be up to ${MAX_FORMULA_LENGTH} characters long.`)
  }
  const { scope } = variableValues(doc)
  return updateNode(doc, id, (node) => applyInput(node, key, input, scope, normalize))
}

function recomputeNode(node: SceneNode, scope: ReadonlyMap<string, number>, normalize: NormalizeField): SceneNode {
  return formulaEntries(node).reduce((acc, [key, text]) => {
    const result = computeFormula(text, scope)
    return result.ok ? writeField(acc, key, normalize(acc, key, result.value)) : acc
  }, node)
}

/** Re-runs every field formula after a variable or `fit` changed. Broken formulas keep their last number. */
export function recomputeFormulas(doc: BloKadeDocument, normalize: NormalizeField): BloKadeDocument {
  const { scope } = variableValues(doc)
  const nodes = Object.fromEntries(
    Object.entries(doc.nodes).map(([id, node]) => [id, recomputeNode(node, scope, normalize)] as const),
  )
  return { ...doc, nodes }
}

/** Every field formula that doesn't work right now, by part and field. */
export function formulaErrors(doc: BloKadeDocument): FormulaErrors {
  const { scope } = variableValues(doc)
  return Object.fromEntries(Object.values(doc.nodes).flatMap((node) => {
    const problems = formulaEntries(node).flatMap(([key, text]) => {
      const result = computeFormula(text, scope)
      return result.ok ? [] : [[key, result.error] as const]
    })
    return problems.length > 0 ? [[node.id, Object.fromEntries(problems)] as const] : []
  }))
}
```

- [ ] **Step 6: Make `updateNode` return the same document when nothing changed**

The test "leaves the design alone when a typed number changes nothing" needs this. In `src/document/ops.ts`, update `updateNode`:

```ts
export function updateNode(
  doc: BloKadeDocument, id: NodeId, fn: (node: SceneNode) => SceneNode,
): BloKadeDocument {
  const node = requireNode(doc, id)
  const next = fn(node)
  if (next.id !== id || next.kind !== node.kind) throw new DocumentOpError("A part's id and kind can't change.")
  if (next === node) return doc
  return { ...doc, nodes: { ...doc.nodes, [id]: next } }
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/document && npm run typecheck`
Expected: PASS, and typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add src/document
git commit -m "feat: let any number field hold a formula"
```

---

### Task 6: Variable operations and formula-safe edits

**Files:**
- Create: `src/document/variable-ops.ts`
- Modify: `src/document/ops.ts`
- Test: `src/document/variable-ops.test.ts`, `src/document/ops.test.ts`, `src/store/store.test.ts`

**Interfaces:**
- Consumes:
  - `renameVariableIn` and `MAX_FORMULA_LENGTH` (Task 1)
  - `variableNameProblem` (Task 2)
  - `formulaEntries`, `withFormula` and `dropStaleFormulas` (Task 5)
  - `recomputeFormulas` and `NormalizeField` (Task 5)
- Produces:
  - `nextVariableName(doc): string`
  - `addVariable(doc, name, expr, normalize)`
  - `setVariableExpr(doc, name, expr, normalize)`
  - `renameVariable(doc, from, to, normalize)`
  - `removeVariable(doc, name, normalize)`
  - `setFit(doc, fit, normalize)`
  - `updateNode`, `ungroupNode` and `duplicateNodes` drop formulas whose value an edit changed directly

- [ ] **Step 1: Write the failing test `src/document/variable-ops.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from './factory'
import { formulaErrors, setFieldInput, type NormalizeField } from './formula-ops'
import { addNode, DocumentOpError } from './ops'
import type { BloKadeDocument } from './types'
import { addVariable, nextVariableName, removeVariable, renameVariable, setFit, setVariableExpr } from './variable-ops'

const same: NormalizeField = (_node, _key, value) => value

function setup(): BloKadeDocument {
  const box = createShapeNode({ id: 'b', shapeType: 'box', name: 'Box', params: { width: 20, depth: 20, height: 20 }, color: '#f00' })
  const doc = addNode({ ...createEmptyDocument(), variables: [{ name: 'wall', expr: '3' }, { name: 'thick', expr: 'wall + 1' }] }, box)
  return setFieldInput(doc, 'b', 'param.width', 'wall * 10', same)
}
const width = (doc: BloKadeDocument) => {
  const node = doc.nodes.b
  return node?.kind === 'shape' ? node.params.width : undefined
}

describe('variable operations', () => {
  it('adds a variable, refusing bad names', () => {
    const doc = addVariable(setup(), 'gap', '1 + fit', same)
    expect(doc.variables.at(-1)).toEqual({ name: 'gap', expr: '1 + fit' })
    expect(() => addVariable(setup(), 'fit', '1', same)).toThrow(DocumentOpError)
    expect(() => addVariable(setup(), 'wall', '1', same)).toThrow('already a variable called "wall"')
  })

  it('changes a variable and resizes the parts that use it', () => {
    expect(width(setVariableExpr(setup(), 'wall', '5', same))).toBe(50)
    expect(() => setVariableExpr(setup(), 'nope', '5', same)).toThrow(`no variable called "nope"`)
    expect(() => setVariableExpr(setup(), 'wall', ' ', same)).toThrow(DocumentOpError)
  })

  it('renames a variable everywhere it is used (Review Focus 1)', () => {
    const doc = renameVariable(setup(), 'wall', 'side', same)
    expect(doc.variables).toEqual([{ name: 'side', expr: '3' }, { name: 'thick', expr: 'side + 1' }])
    expect(doc.nodes.b?.formulas).toEqual({ 'param.width': 'side * 10' })
    expect(width(doc)).toBe(30)
    expect(formulaErrors(doc)).toEqual({})
    expect(() => renameVariable(setup(), 'wall', 'thick', same)).toThrow('already a variable called "thick"')
    expect(renameVariable(setup(), 'wall', 'wall', same)).toEqual(setup())
  })

  it('removing a variable keeps the last size and shows a problem (Review Focus 1)', () => {
    const doc = removeVariable(setup(), 'wall', same)
    expect(width(doc)).toBe(30)
    expect(formulaErrors(doc).b?.['param.width']).toContain(`"wall" isn't a variable`)
  })

  it('sets the fit gap within 0–2 mm and re-runs formulas that use it', () => {
    const doc = setFieldInput(setup(), 'b', 'param.width', '10 + fit', same)
    expect(width(setFit(doc, 0.5, same))).toBe(10.5)
    expect(setFit(doc, 9, same).settings.fit).toBe(2)
    expect(setFit(doc, -1, same).settings.fit).toBe(0)
    expect(() => setFit(doc, Number.NaN, same)).toThrow(DocumentOpError)
  })

  it('suggests the first free name for a new variable', () => {
    const empty = createEmptyDocument()
    expect(nextVariableName(empty)).toBe('var1')
    expect(nextVariableName({ ...empty, variables: [{ name: 'var1', expr: '1' }] })).toBe('var2')
    expect(nextVariableName({ ...empty, variables: [{ name: 'var2', expr: '1' }] })).toBe('var1')
  })
})
```

- [ ] **Step 2: Add the failing ops and store tests (Review Focus 5)**

Add to `src/document/ops.test.ts`, extending its imports as needed (`createShapeNode`, `createGroupNode`, `createEmptyDocument`, `addNode`, `updateNode`, `ungroupNode`, `duplicateNodes`, `renameNode`):

```ts
describe('formulas survive only the edits that keep their value', () => {
  const withFormulas = {
    ...createShapeNode({ id: 'b', shapeType: 'box', name: 'Box', params: { width: 30 }, color: '#f00', position: [3, 0, 0] }),
    formulas: { 'position.0': 'wall', 'param.width': 'wall * 10' },
  }

  it('a drag that moves a part drops its position formula only', () => {
    const doc = addNode(createEmptyDocument(), withFormulas)
    const moved = updateNode(doc, 'b', (n) => ({ ...n, transform: { ...n.transform, position: [12, 0, 0] } }))
    expect(moved.nodes.b?.formulas).toEqual({ 'param.width': 'wall * 10' })
  })

  it('renaming keeps every formula', () => {
    const doc = renameNode(addNode(createEmptyDocument(), withFormulas), 'b', 'Wall')
    expect(doc.nodes.b?.formulas).toEqual(withFormulas.formulas)
  })

  it('ungrouping a moved group drops the position formulas it changed', () => {
    const group = { ...createGroupNode({ id: 'g', children: ['b'] }), transform: { position: [10, 0, 0] as const, rotation: [0, 0, 0] as const } }
    const doc = { ...createEmptyDocument(), root: ['g'], nodes: { g: group, b: withFormulas } }
    const { doc: flat } = ungroupNode(doc, 'g')
    expect(flat.nodes.b?.formulas).toEqual({ 'param.width': 'wall * 10' })
  })

  it("a duplicate's offset drops its position formula and leaves the original alone", () => {
    const doc = addNode(createEmptyDocument(), withFormulas)
    const { doc: copied, newIds } = duplicateNodes(doc, ['b'])
    expect(copied.nodes[newIds[0] ?? '']?.formulas).toEqual({ 'param.width': 'wall * 10' })
    expect(copied.nodes.b?.formulas).toEqual(withFormulas.formulas)
  })
})
```

Add to `src/store/store.test.ts`, importing `addNode`, `updateNode`, `createShapeNode` and `createEmptyDocument` as needed:

```ts
  it('undo brings back a formula that a drag replaced (Review Focus 5)', () => {
    const box = { ...createShapeNode({ id: 'b', shapeType: 'box', name: 'Box', params: { width: 30 }, color: '#f00' }), formulas: { 'position.0': 'wall' } }
    const store = createBloKadeStore({ designId: 'd', doc: addNode(createEmptyDocument(), box) })
    store.getState().apply((d) => updateNode(d, 'b', (n) => ({ ...n, transform: { ...n.transform, position: [12, 0, 0] } })))
    expect(store.getState().history.present.nodes.b?.formulas).toBeUndefined()
    store.getState().undo()
    expect(store.getState().history.present.nodes.b?.formulas).toEqual({ 'position.0': 'wall' })
  })
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/document src/store`
Expected: FAIL. `./variable-ops` is missing, and the drag, ungroup and duplicate tests still see the old formulas.

- [ ] **Step 4: Write `src/document/variable-ops.ts`**

```ts
import { MAX_FORMULA_LENGTH, renameVariableIn } from '../formulas/formula'
import { variableNameProblem } from '../formulas/variables'
import { formulaEntries, withFormula } from './fields'
import { recomputeFormulas, type NormalizeField } from './formula-ops'
import { DocumentOpError } from './ops'
import { MAX_FIT, type BloKadeDocument, type SceneNode, type Variable } from './types'

const namesOf = (doc: BloKadeDocument): string[] => doc.variables.map((v) => v.name)

function requireVariable(doc: BloKadeDocument, name: string): Variable {
  const found = doc.variables.find((v) => v.name === name)
  if (!found) throw new DocumentOpError(`There's no variable called "${name}".`)
  return found
}

function cleanExpr(expr: string): string {
  const text = expr.trim()
  if (text === '') throw new DocumentOpError('Type a number or a formula.')
  if (text.length > MAX_FORMULA_LENGTH) throw new DocumentOpError(`Formulas can be up to ${MAX_FORMULA_LENGTH} characters long.`)
  return text
}

/** The first free name like var1, var2… for a brand-new variable. */
export function nextVariableName(doc: BloKadeDocument): string {
  const taken = new Set(namesOf(doc))
  const free = Array.from({ length: taken.size + 1 }, (_, i) => `var${i + 1}`).find((name) => !taken.has(name))
  return free ?? `var${taken.size + 1}`
}

export function addVariable(doc: BloKadeDocument, name: string, expr: string, normalize: NormalizeField): BloKadeDocument {
  const problem = variableNameProblem(name, namesOf(doc))
  if (problem) throw new DocumentOpError(problem)
  return recomputeFormulas({ ...doc, variables: [...doc.variables, { name, expr: cleanExpr(expr) }] }, normalize)
}

export function setVariableExpr(doc: BloKadeDocument, name: string, expr: string, normalize: NormalizeField): BloKadeDocument {
  requireVariable(doc, name)
  const text = cleanExpr(expr)
  const variables = doc.variables.map((v) => (v.name === name ? { ...v, expr: text } : v))
  return recomputeFormulas({ ...doc, variables }, normalize)
}

const renameInNode = (node: SceneNode, from: string, to: string): SceneNode =>
  formulaEntries(node).reduce((acc, [key, text]) => {
    const renamed = renameVariableIn(text, from, to)
    return renamed === text ? acc : withFormula(acc, key, renamed)
  }, node)

/** Renames a variable and rewrites every formula that uses it, so nothing breaks. */
export function renameVariable(doc: BloKadeDocument, from: string, to: string, normalize: NormalizeField): BloKadeDocument {
  requireVariable(doc, from)
  const name = to.trim()
  if (name === from) return doc
  const problem = variableNameProblem(name, namesOf(doc).filter((n) => n !== from))
  if (problem) throw new DocumentOpError(problem)
  const variables = doc.variables.map((v) => ({ name: v.name === from ? name : v.name, expr: renameVariableIn(v.expr, from, name) }))
  const nodes = Object.fromEntries(Object.entries(doc.nodes).map(([id, node]) => [id, renameInNode(node, from, name)] as const))
  return recomputeFormulas({ ...doc, variables, nodes }, normalize)
}

/** Deletes a variable. Formulas that used it show a problem and keep their last number. */
export function removeVariable(doc: BloKadeDocument, name: string, normalize: NormalizeField): BloKadeDocument {
  requireVariable(doc, name)
  return recomputeFormulas({ ...doc, variables: doc.variables.filter((v) => v.name !== name) }, normalize)
}

/** Sets the `fit` gap (clamped to 0–2 mm) and re-runs formulas that use it. */
export function setFit(doc: BloKadeDocument, fit: number, normalize: NormalizeField): BloKadeDocument {
  if (!Number.isFinite(fit)) throw new DocumentOpError('The fit gap must be a number.')
  const clamped = Math.min(MAX_FIT, Math.max(0, fit))
  return recomputeFormulas({ ...doc, settings: { ...doc.settings, fit: clamped } }, normalize)
}
```

- [ ] **Step 5: Make the transform-changing ops formula-safe in `src/document/ops.ts`**

Add the import `import { dropStaleFormulas } from './fields'`. `fields.ts` doesn't import `ops.ts`, so this creates no cycle.

`updateNode` becomes:

```ts
export function updateNode(
  doc: BloKadeDocument, id: NodeId, fn: (node: SceneNode) => SceneNode,
): BloKadeDocument {
  const node = requireNode(doc, id)
  const edited = fn(node)
  if (edited.id !== id || edited.kind !== node.kind) throw new DocumentOpError("A part's id and kind can't change.")
  const next = dropStaleFormulas(node, edited)
  if (next === node) return doc
  return { ...doc, nodes: { ...doc.nodes, [id]: next } }
}
```

In `ungroupNode`, wrap the lifted child:

```ts
      return [cid, dropStaleFormulas(child, { ...child, transform: matrixToTransform(m) })] as const
```

In `duplicateNodes`, wrap the offset copy:

```ts
      const offsetNodes = nodes.map((n): SceneNode => (n.id === topId
        ? dropStaleFormulas(n, { ...n, transform: { ...n.transform, position: addVec(n.transform.position, DUPLICATE_OFFSET) } })
        : n))
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS, and typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src/document src/store
git commit -m "feat: add variable operations and keep formulas honest after direct edits"
```

---

### Task 7: Formula fields in the Properties panel

**Files:**
- Create: `src/app/field-normalizer.ts`, `src/ui/ValueField.tsx`
- Modify: `src/ui/PropertiesPanel.tsx`, `src/ui/App.css`
- Test: `src/app/field-normalizer.test.ts`, `src/ui/ValueField.test.tsx`, `src/ui/PropertiesPanel.test.tsx`

**Interfaces:**
- Consumes:
  - `normalizeParam` and `MAX_MM` (Milestone 1)
  - `NormalizeField`, `setFieldInput` and `formulaErrors` (Task 5)
  - `formulaOf`, `paramField`, `positionField` and `rotationField` (Task 5)
  - `ParamSpec` and `NumberParamType` (Task 4)
- Produces:
  - `createFieldNormalizer(registry): NormalizeField`
  - `ValueField({ label, value, formula?, error?, testId, onCommit(text) })`, with test ids `<testId>`, `<testId>-value` and `<testId>-error`
  - Properties-panel fields `param-<key>`, `pos-x|y|z` and `rot-x|y|z` accept formulas; text params show as `TextField` (`param-<key>`)

- [ ] **Step 1: Write the failing tests**

`src/app/field-normalizer.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createGroupNode, createShapeNode } from '../document/factory'
import { registry } from '../plugins/index'
import { MAX_MM, MIN_MM } from '../plugins/params'
import { createFieldNormalizer } from './field-normalizer'

const normalize = createFieldNormalizer(registry)
const box = createShapeNode({ shapeType: 'box', name: 'Box', params: { width: 20 }, color: '#f00' })

describe('createFieldNormalizer', () => {
  it('clamps sizes like the plugin does', () => {
    expect(normalize(box, 'param.width', -3)).toBe(MIN_MM)
    expect(normalize(box, 'param.width', 9999)).toBe(MAX_MM)
  })

  it('keeps positions inside the build area', () => {
    expect(normalize(box, 'position.0', 1e9)).toBe(MAX_MM)
    expect(normalize(box, 'position.1', -1e9)).toBe(-MAX_MM)
  })

  it('leaves rotations, unknown params and groups alone', () => {
    expect(normalize(box, 'rotation.2', 725)).toBe(725)
    expect(normalize(box, 'param.mystery', -3)).toBe(-3)
    expect(normalize(createGroupNode({ children: [] }), 'param.width', -3)).toBe(-3)
  })
})
```

`src/ui/ValueField.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ValueField } from './ValueField'

describe('ValueField', () => {
  it('shows a formula, its result, and commits typed text on Enter', async () => {
    const onCommit = vi.fn()
    render(<ValueField label="Width" value={30} formula="wall * 10" testId="w" onCommit={onCommit} />)
    expect(screen.getByTestId('w')).toHaveValue('wall * 10')
    expect(screen.getByTestId('w-value')).toHaveTextContent('= 30')
    await userEvent.clear(screen.getByTestId('w'))
    await userEvent.type(screen.getByTestId('w'), 'wall * 2{Enter}')
    expect(onCommit).toHaveBeenCalledWith('wall * 2')
  })

  it('shows a problem instead of a result', () => {
    render(<ValueField label="Width" value={30} formula="wal" error={`"wal" isn't a variable.`} testId="w" onCommit={vi.fn()} />)
    expect(screen.getByTestId('w-error')).toHaveTextContent(`"wal" isn't a variable.`)
    expect(screen.getByTestId('w')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByTestId('w-value')).toBeNull()
  })

  it('does not commit an untouched field, an empty field, or after Escape', async () => {
    const onCommit = vi.fn()
    render(<><ValueField label="Width" value={1 / 3} testId="w" onCommit={onCommit} /><button type="button">elsewhere</button></>)
    await userEvent.click(screen.getByTestId('w'))
    await userEvent.click(screen.getByText('elsewhere'))
    await userEvent.clear(screen.getByTestId('w'))
    await userEvent.click(screen.getByText('elsewhere'))
    await userEvent.type(screen.getByTestId('w'), '9{Escape}')
    await userEvent.click(screen.getByText('elsewhere'))
    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByTestId('w')).toHaveValue('0.333')
  })
})
```

Add these tests to `src/ui/PropertiesPanel.test.tsx`, reusing that file's `setup` and `setField` helpers:

```tsx
  it('takes a formula, shows its result, and keeps the formula text', async () => {
    const { store, actions, selected } = setup()
    act(() => store.getState().apply((d) => ({ ...d, variables: [{ name: 'wall', expr: '3' }] })))
    act(() => actions.addShape('box'))
    await setField('param-width', 'wall * 10')
    expect(selected()).toMatchObject({ params: { width: 30 }, formulas: { 'param.width': 'wall * 10' } })
    expect(screen.getByTestId('param-width')).toHaveValue('wall * 10')
    expect(screen.getByTestId('param-width-value')).toHaveTextContent('= 30')
  })

  it("shows a broken formula's problem and keeps the old size (Review Focus 1)", async () => {
    const { actions, selected } = setup()
    act(() => actions.addShape('box'))
    await setField('param-width', 'wal * 10')
    expect(selected()).toMatchObject({ params: { width: 20 } })
    expect(screen.getByTestId('param-width-error')).toHaveTextContent(`"wal" isn't a variable`)
  })

  it('takes formulas for position and rotation', async () => {
    const { store, actions, selected } = setup()
    act(() => store.getState().apply((d) => ({ ...d, variables: [{ name: 'wall', expr: '3' }] })))
    act(() => actions.addShape('box'))
    await setField('pos-x', 'wall + 1')
    await setField('rot-z', '90 / wall')
    expect(selected()?.transform).toEqual({ position: [4, 0, 0], rotation: [0, 0, 30] })
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/field-normalizer.test.ts src/ui/ValueField.test.tsx src/ui/PropertiesPanel.test.tsx`
Expected: FAIL. The modules are missing, and `param-width-value` is not found.

- [ ] **Step 3: Write `src/app/field-normalizer.ts`**

```ts
import type { NormalizeField } from '../document/formula-ops'
import { MAX_MM, normalizeParam } from '../plugins/params'
import type { PluginRegistry } from '../plugins/registry'

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

/** Clamps numbers the same way whether Kade typed them or a formula worked them out. */
export function createFieldNormalizer(registry: PluginRegistry): NormalizeField {
  return (node, key, value) => {
    if (key.startsWith('position.')) return clamp(value, -MAX_MM, MAX_MM)
    if (!key.startsWith('param.') || node.kind !== 'shape') return value
    const name = key.slice('param.'.length)
    const plugin = registry.get(node.shapeType)
    const spec = plugin && Object.hasOwn(plugin.params, name) ? plugin.params[name] : undefined
    return spec && spec.type !== 'text' ? normalizeParam(spec, value) : value
  }
}
```

- [ ] **Step 4: Write `src/ui/ValueField.tsx`**

```tsx
import { useEffect, useState, type KeyboardEvent } from 'react'
import { formatNumber } from './number-input'

interface ValueFieldProps {
  label: string
  /** The number the field holds: what was typed, or a formula's last good result. */
  value: number
  /** Formula text, when the field uses one. */
  formula?: string
  /** Why the formula doesn't work right now. */
  error?: string
  testId: string
  onCommit(text: string): void
}

/** Takes a number or a formula. Commits on Enter or leaving the field; Escape throws the typing away. */
export function ValueField({ label, value, formula, error, testId, onCommit }: ValueFieldProps) {
  const shown = formula ?? formatNumber(value)
  const [draft, setDraft] = useState(shown)
  useEffect(() => setDraft(shown), [shown])

  const commit = (): void => {
    const text = draft.trim()
    // Always show the model's value afterwards; a real change refreshes it through the effect above.
    setDraft(shown)
    if (text !== '' && text !== shown) onCommit(text)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') commit()
    if (event.key === 'Escape') setDraft(shown)
  }

  return (
    <div className="value-field">
      <label className="field">
        <span>{label}</span>
        <input
          type="text"
          spellCheck={false}
          data-testid={testId}
          value={draft}
          aria-invalid={error ? true : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
        />
      </label>
      {error && <p className="field-error" data-testid={`${testId}-error`}>⚠ {error}</p>}
      {!error && formula !== undefined && <p className="field-note" data-testid={`${testId}-value`}>= {formatNumber(value)}</p>}
    </div>
  )
}
```

- [ ] **Step 5: Replace `src/ui/PropertiesPanel.tsx`**

```tsx
import { useMemo } from 'react'
import { createFieldNormalizer } from '../app/field-normalizer'
import { formulaOf, paramField, positionField, rotationField } from '../document/fields'
import { formulaErrors, setFieldInput } from '../document/formula-ops'
import { renameNode, setMode, updateNode } from '../document/ops'
import type { FieldKey, SceneNode, ShapeNode } from '../document/types'
import { resolveParams } from '../plugins/params'
import type { PluginRegistry } from '../plugins/registry'
import type { NumberParamType, ParamSpec } from '../plugins/types'
import { useBloKade } from '../store/context'
import { TextField } from './NumberField'
import { ValueField } from './ValueField'

const AXES = [['x', 0], ['y', 1], ['z', 2]] as const
const UNIT: Record<NumberParamType, string> = { mm: ' (mm)', angle: ' (°)', whole: '', number: '' }

interface FieldsProps {
  node: SceneNode
  errors: Readonly<Record<string, string>>
  setField(key: FieldKey, text: string): void
}

function ShapeParams({ node, errors, setField, registry }: FieldsProps & { node: ShapeNode; registry: PluginRegistry }) {
  const apply = useBloKade((s) => s.apply)
  const plugin = registry.get(node.shapeType)
  if (!plugin) return <p className="error-text">This shape's plugin is missing, so its size can't be changed.</p>
  const setText = (key: string, text: string): void => apply((d) => updateNode(d, node.id, (n) => (
    n.kind === 'shape' ? { ...n, params: resolveParams(plugin, { ...n.params, [key]: text }) } : n
  )))
  return (
    <>
      <h3>Size</h3>
      {Object.entries<ParamSpec>(plugin.params).map(([key, spec]) => {
        const raw = node.params[key]
        if (spec.type === 'text') {
          return <TextField key={key} label={spec.label} value={typeof raw === 'string' ? raw : spec.default}
            testId={`param-${key}`} onCommit={(text) => setText(key, text)} />
        }
        const field = paramField(key)
        return <ValueField key={key} label={`${spec.label}${UNIT[spec.type]}`} value={typeof raw === 'number' ? raw : spec.default}
          formula={formulaOf(node, field)} error={errors[field]} testId={`param-${key}`} onCommit={(text) => setField(field, text)} />
      })}
    </>
  )
}

function Placement({ node, errors, setField }: FieldsProps) {
  const row = (part: 'position' | 'rotation', prefix: string) => (
    <div className="field-row">
      {AXES.map(([axis, index]) => {
        const field = part === 'position' ? positionField(index) : rotationField(index)
        return <ValueField key={axis} label={axis} value={node.transform[part][index]} formula={formulaOf(node, field)}
          error={errors[field]} testId={`${prefix}-${axis}`} onCommit={(text) => setField(field, text)} />
      })}
    </div>
  )
  return (
    <>
      <h3>Position (mm)</h3>
      {row('position', 'pos')}
      <h3>Rotation (°)</h3>
      {row('rotation', 'rot')}
    </>
  )
}

export function PropertiesPanel({ registry }: { registry: PluginRegistry }) {
  const doc = useBloKade((s) => s.history.present)
  const selection = useBloKade((s) => s.selection)
  const errors = useBloKade((s) => s.errors)
  const apply = useBloKade((s) => s.apply)
  const normalize = useMemo(() => createFieldNormalizer(registry), [registry])
  const fieldErrors = useMemo(() => formulaErrors(doc), [doc])
  const node = selection.length === 1 && selection[0] ? doc.nodes[selection[0]] : undefined

  if (selection.length > 1) {
    return (
      <section className="panel" aria-label="Properties">
        <h2>Properties</h2>
        <p className="hint">{selection.length} parts selected. Group them, or pick one to change it.</p>
      </section>
    )
  }
  if (!node) {
    return (
      <section className="panel" aria-label="Properties">
        <h2>Properties</h2>
        <p className="hint">Click a shape to change it. Add shapes from the left.</p>
      </section>
    )
  }
  const error = errors[node.id]
  const setField = (key: FieldKey, text: string): void => apply((d) => setFieldInput(d, node.id, key, text, normalize))
  const nodeErrors = fieldErrors[node.id] ?? {}
  return (
    <section className="panel" aria-label="Properties">
      <h2>Properties</h2>
      <TextField key={`name-${node.id}`} label="Name" value={node.name} testId="prop-name" onCommit={(name) => apply((d) => renameNode(d, node.id, name))} />
      <div className="mode-toggle" role="group" aria-label="Solid or hole">
        <button type="button" className="tool-button" data-testid="mode-solid" aria-pressed={node.mode === 'solid'}
          onClick={() => apply((d) => setMode(d, [node.id], 'solid'))}>Solid</button>
        <button type="button" className="tool-button" data-testid="mode-hole" aria-pressed={node.mode === 'hole'}
          onClick={() => apply((d) => setMode(d, [node.id], 'hole'))}>Hole</button>
      </div>
      {error && <p className="error-text" role="alert">⚠ {error}</p>}
      {node.kind === 'shape' && <ShapeParams key={`params-${node.id}`} node={node} errors={nodeErrors} setField={setField} registry={registry} />}
      <Placement key={`place-${node.id}`} node={node} errors={nodeErrors} setField={setField} />
    </section>
  )
}
```

- [ ] **Step 6: Add field styles to `src/ui/App.css`**

```css
.value-field { margin-bottom: 2px; }
.field-note { margin: -4px 0 6px; color: var(--muted); font-size: 0.8rem; text-align: right; }
.field-error { margin: -4px 0 6px; color: var(--danger); font-size: 0.8rem; }
.field input[aria-invalid='true'] { border-color: var(--danger); }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS. If an existing PropertiesPanel test relied on `NumberField` behaviour that `ValueField` intentionally changes, fix the test to match the brief's behaviour and report it as a deviation. The behaviours `ValueField` keeps are: no commit on an untouched blur, showing the model's value after a clamp, and Escape reverting the typing.

- [ ] **Step 8: Commit**

```bash
git add src/app src/ui
git commit -m "feat: accept formulas in every size, position and rotation field"
```

---

### Task 8: Variables panel

**Files:**
- Create: `src/ui/VariablesPanel.tsx`
- Modify: `src/ui/Workspace.tsx`, `src/ui/App.css`
- Test: `src/ui/VariablesPanel.test.tsx`

**Interfaces:**
- Consumes:
  - `variableValues` (Task 5)
  - `addVariable`, `nextVariableName`, `removeVariable`, `renameVariable`, `setFit` and `setVariableExpr` (Task 6)
  - `createFieldNormalizer` and `ValueField` (Task 7)
  - `NumberField` and `TextField` (Milestone 1)
- Produces:
  - `VariablesPanel({ registry })`, rendered in the right panel under Properties
  - Test ids: `fit`, `add-variable`, `var-name-<name>`, `var-expr-<name>` (plus `-value` / `-error`), and `var-delete-<name>`

- [ ] **Step 1: Write the failing test `src/ui/VariablesPanel.test.tsx`**

```tsx
// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode } from '../document/ops'
import { registry } from '../plugins/index'
import { createBloKadeStore } from '../store/store'
import { VariablesPanel } from './VariablesPanel'

function setup() {
  const box = { ...createShapeNode({ id: 'b', shapeType: 'box', name: 'Box', params: { width: 30, depth: 20, height: 20 }, color: '#f00' }), formulas: { 'param.width': 'wall * 10' } }
  const doc = addNode({ ...createEmptyDocument(), variables: [{ name: 'wall', expr: '3' }, { name: 'thick', expr: 'wall + 1' }] }, box)
  const store = createBloKadeStore({ designId: 'd', doc })
  renderWithStore(<VariablesPanel registry={registry} />, store)
  const present = () => store.getState().history.present
  return { store, present }
}

async function setField(testId: string, text: string) {
  await userEvent.clear(screen.getByTestId(testId))
  await userEvent.type(screen.getByTestId(testId), `${text}{Enter}`)
}

describe('VariablesPanel', () => {
  it("lists variables with their values", () => {
    setup()
    expect(screen.getByTestId('var-expr-wall')).toHaveValue('3')
    expect(screen.getByTestId('var-expr-thick-value')).toHaveTextContent('= 4')
  })

  it('adds a variable with the next free name', async () => {
    const { present } = setup()
    await userEvent.click(screen.getByTestId('add-variable'))
    expect(present().variables.at(-1)).toEqual({ name: 'var1', expr: '10' })
  })

  it('changing a variable resizes the parts that use it', async () => {
    const { present } = setup()
    await setField('var-expr-wall', '5')
    expect(present().nodes.b).toMatchObject({ params: { width: 50 } })
    expect(screen.getByTestId('var-expr-thick-value')).toHaveTextContent('= 6')
  })

  it('renaming a variable rewrites the formulas that use it', async () => {
    const { present } = setup()
    await setField('var-name-wall', 'side')
    expect(present().nodes.b?.formulas).toEqual({ 'param.width': 'side * 10' })
    expect(present().variables[1]).toEqual({ name: 'thick', expr: 'side + 1' })
  })

  it('explains a bad name instead of renaming', async () => {
    const { store, present } = setup()
    await setField('var-name-wall', 'fit')
    expect(store.getState().notice).toContain('BloKade already uses "fit"')
    expect(present().variables[0]?.name).toBe('wall')
  })

  it('deleting a variable shows the problem on variables that used it', async () => {
    const { present } = setup()
    await userEvent.click(screen.getByTestId('var-delete-wall'))
    expect(present().variables.map((v) => v.name)).toEqual(['thick'])
    expect(screen.getByTestId('var-expr-thick-error')).toHaveTextContent(`"wall" isn't a variable`)
  })

  it('sets the fit gap, clamped to 2 mm', async () => {
    const { present } = setup()
    await setField('fit', '0.4')
    expect(present().settings.fit).toBe(0.4)
    await setField('fit', '7')
    expect(present().settings.fit).toBe(2)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/VariablesPanel.test.tsx`
Expected: FAIL, "Failed to resolve import "./VariablesPanel"".

- [ ] **Step 3: Write `src/ui/VariablesPanel.tsx`**

```tsx
import { useMemo } from 'react'
import { createFieldNormalizer } from '../app/field-normalizer'
import { variableValues } from '../document/formula-ops'
import { addVariable, nextVariableName, removeVariable, renameVariable, setFit, setVariableExpr } from '../document/variable-ops'
import type { PluginRegistry } from '../plugins/registry'
import { useBloKade } from '../store/context'
import { NumberField, TextField } from './NumberField'
import { ValueField } from './ValueField'

/** Design-wide numbers: the `fit` gap and Kade's named variables. */
export function VariablesPanel({ registry }: { registry: PluginRegistry }) {
  const doc = useBloKade((s) => s.history.present)
  const apply = useBloKade((s) => s.apply)
  const normalize = useMemo(() => createFieldNormalizer(registry), [registry])
  const { scope, errors } = useMemo(() => variableValues(doc), [doc])

  return (
    <section className="panel" aria-label="Variables">
      <h2>Variables</h2>
      <NumberField label="Fit gap (mm)" value={doc.settings.fit} testId="fit" onCommit={(fit) => apply((d) => setFit(d, fit, normalize))} />
      <p className="hint">Extra room for parts that slot together. Formulas can use it as <code>fit</code>.</p>
      <ul className="variable-list">
        {doc.variables.map((v) => (
          <li key={v.name} className="variable-row">
            <TextField label="Name" value={v.name} testId={`var-name-${v.name}`}
              onCommit={(name) => apply((d) => renameVariable(d, v.name, name, normalize))} />
            <ValueField label="=" value={scope.get(v.name) ?? 0} formula={v.expr} error={errors[v.name]} testId={`var-expr-${v.name}`}
              onCommit={(expr) => apply((d) => setVariableExpr(d, v.name, expr, normalize))} />
            <button type="button" className="icon-button" data-testid={`var-delete-${v.name}`} aria-label={`Delete ${v.name}`}
              onClick={() => apply((d) => removeVariable(d, v.name, normalize))}>🗑</button>
          </li>
        ))}
      </ul>
      <button type="button" className="tool-button" data-testid="add-variable"
        onClick={() => apply((d) => addVariable(d, nextVariableName(d), '10', normalize))}>+ Add variable</button>
    </section>
  )
}
```

- [ ] **Step 4: Show it in the workspace**

In `src/ui/Workspace.tsx`, import `VariablesPanel` and render it under the Properties panel:

```tsx
      <aside className="right-panel">
        <PropertiesPanel registry={deps.registry} />
        <VariablesPanel registry={deps.registry} />
      </aside>
```

Add to `src/ui/App.css`:

```css
.variable-list { list-style: none; margin: 8px 0; padding: 0; }
.variable-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 4px; align-items: start; }
.variable-row .field { grid-template-columns: auto 1fr; }
.hint code { background: var(--bg); padding: 0 4px; border-radius: 4px; }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS. If `App.test.tsx` counts panels or regions, update its expectation and report it.

- [ ] **Step 6: Commit**

```bash
git add src/ui
git commit -m "feat: add the variables panel with the fit gap"
```

---

### Task 9: Text shape

**Files:**
- Create:
  - `src/assets/fonts/AtkinsonHyperlegible-Bold.ttf` and `src/assets/fonts/OFL.txt` (downloaded)
  - `src/plugins/font.ts`
  - `src/geometry/testing/font-node.ts`
  - `src/plugins/builtin/text.ts`
- Modify:
  - `src/plugins/cad-types.ts`
  - `src/plugins/cad.ts`
  - `src/plugins/index.ts`
  - `src/geometry/geometry.worker.ts`
- Test:
  - `src/plugins/builtin/text.test.ts`
  - `src/plugins/builtin/builtin.test.ts`
  - `src/ui/ShapePalette.test.tsx`
  - `src/ui/PropertiesPanel.test.tsx`

**Interfaces:**
- Consumes: text params (Task 4), and replicad's `loadFont(ArrayBuffer, family)` and `drawText(text, { fontSize, fontFamily })`.
- Produces:
  - `TEXT_FONT = 'blokade'`
  - `registerFont(data: ArrayBuffer): Promise<void>`
  - `CadToolkit.text(text, size, depth): Shape3D`, which is centered on X/Y and sits on z = 0
  - `loadTestFont(): Promise<void>`
  - A Text plugin with id `text` (🔤), params `text` (text, default `Kade`, max 40), `size` (mm, default 10, 2–200) and `depth` (mm, default 3, 0.4–100), and size handles `{ x: 'size', y: 'size', z: 'depth' }`

- [ ] **Step 1: Download the font and its licence (pinned commit)**

```bash
mkdir -p src/assets/fonts
curl -fsSL -o src/assets/fonts/AtkinsonHyperlegible-Bold.ttf https://raw.githubusercontent.com/google/fonts/1b22086d13bdbbf5ec63d01a39a49246e4ac355f/ofl/atkinsonhyperlegible/AtkinsonHyperlegible-Bold.ttf
curl -fsSL -o src/assets/fonts/OFL.txt https://raw.githubusercontent.com/google/fonts/1b22086d13bdbbf5ec63d01a39a49246e4ac355f/ofl/atkinsonhyperlegible/OFL.txt
wc -c src/assets/fonts/AtkinsonHyperlegible-Bold.ttf
xxd -l 4 -p src/assets/fonts/AtkinsonHyperlegible-Bold.ttf
shasum -a 256 src/assets/fonts/AtkinsonHyperlegible-Bold.ttf
```

Expected:
- The size is `55256`.
- The first four bytes are `00010000`, the TrueType signature.
- The SHA-256 is recorded in your report.

If the pinned `OFL.txt` URL returns 404, fetch it from the same folder on `main` and note that you did. Never continue with a font file that fails the size or signature check.

- [ ] **Step 2: Write the failing test `src/plugins/builtin/text.test.ts`**

```ts
import { measureVolume } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadTestFont } from '../../geometry/testing/font-node'
import { initTestOC } from '../../geometry/testing/oc-node'
import { createCadToolkit } from '../cad'
import { registry } from '../index'
import { resolveParams } from '../params'

beforeAll(async () => {
  await initTestOC()
  await loadTestFont()
})

function textPlugin() {
  const plugin = registry.get('text')
  if (!plugin) throw new Error('missing text plugin')
  return plugin
}
const build = (raw: Readonly<Record<string, unknown>>) => textPlugin().build(resolveParams(textPlugin(), raw), createCadToolkit())

describe('Text shape', () => {
  it('builds raised letters centered on X/Y and sitting on the ground', () => {
    const shape = build({})
    const [[x0, y0, z0], [x1, y1, z1]] = shape.boundingBox.bounds
    expect(measureVolume(shape)).toBeGreaterThan(10)
    expect(z0).toBeCloseTo(0, 5)
    expect(z1).toBeCloseTo(3, 5)
    expect(x0 + x1).toBeCloseTo(0, 4)
    expect(y0 + y1).toBeCloseTo(0, 4)
    expect(x1 - x0).toBeGreaterThan(y1 - y0)
  })

  it('asks for letters when the text is blank (Review Focus 4)', () => {
    expect(() => build({ text: '   ' })).toThrow('Type some letters first.')
  })

  it('copes with letters the font does not have (Review Focus 4)', () => {
    try {
      expect(measureVolume(build({ text: '🙂' }))).toBeGreaterThan(0)
    } catch (error) {
      expect((error as Error).message).toContain("can't make 3D letters")
    }
  })

  it('explains when the font is not loaded yet', () => {
    const cad = createCadToolkit()
    expect(() => cad.text('Hi', 10, 2, 'not-a-font')).toThrow("The letter shapes aren't ready yet")
  })
})
```

`cad.text` takes an optional fourth argument, `fontFamily`, defaulting to `TEXT_FONT`. It exists so this test can name a font that was never loaded.

Update `src/plugins/builtin/builtin.test.ts` so the registry list ends with `'text'`:

```ts
    expect(registry.list().map((p) => p.id)).toEqual(['box', 'cylinder', 'sphere', 'cone', 'wedge', 'torus', 'text'])
```

Rename that test from "registers all six built-ins…" to "registers all seven built-ins…". In `src/ui/ShapePalette.test.tsx`, change `toHaveLength(6)` to `toHaveLength(7)`.

Add to `src/ui/PropertiesPanel.test.tsx`:

```tsx
  it("edits a Text shape's letters", async () => {
    const { actions, selected } = setup()
    act(() => actions.addShape('text'))
    await setField('param-text', 'Hi Kade')
    expect(selected()).toMatchObject({ params: { text: 'Hi Kade' } })
  })
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/plugins src/ui/ShapePalette.test.tsx`
Expected: FAIL. `font-node` is missing and there is no `text` plugin.

- [ ] **Step 4: Write `src/plugins/font.ts`**

```ts
import { loadFont } from 'replicad'

/** The font family Text shapes use. */
export const TEXT_FONT = 'blokade'

/** Registers BloKade's bundled font with replicad. Call once per worker before building Text shapes. */
export async function registerFont(data: ArrayBuffer): Promise<void> {
  await loadFont(data, TEXT_FONT)
}
```

- [ ] **Step 5: Write `src/geometry/testing/font-node.ts`**

```ts
import { readFile } from 'node:fs/promises'
import { registerFont } from '../../plugins/font'

let ready: Promise<void> | null = null

/** Loads the bundled font into replicad for Node-based tests (once per test worker). */
export function loadTestFont(): Promise<void> {
  ready ??= readFile(new URL('../../assets/fonts/AtkinsonHyperlegible-Bold.ttf', import.meta.url)).then((bytes) =>
    registerFont(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer))
  return ready
}
```

- [ ] **Step 6: Add `text` to the CAD toolkit**

In `src/plugins/cad-types.ts`, add to `CadToolkit`:

```ts
  /** Raised letters, centered on X/Y and sitting on z = 0. `size` is the font size in mm. */
  text(text: string, size: number, depth: number, fontFamily?: string): Shape3D
```

In `src/plugins/cad.ts`, add `drawText` and `type Drawing` to the replicad import and `import { TEXT_FONT } from './font'`. Then add these helpers above `createCadToolkit`:

```ts
function letters(text: string, size: number, fontFamily: string): Drawing {
  try {
    return drawText(text, { fontSize: size, fontFamily })
  } catch {
    throw new Error("The letter shapes aren't ready yet. Try again in a moment.")
  }
}

function raise(drawing: Drawing, depth: number): Shape3D {
  try {
    return asSolid(drawing.sketchOnPlane('XY').extrude(depth) as Shape3D)
  } catch {
    throw new Error("BloKade can't make 3D letters from that text. Try plain letters and numbers.")
  }
}
```

Then add this entry to the object that `createCadToolkit` returns:

```ts
    text: (text, size, depth, fontFamily = TEXT_FONT) => {
      const clean = text.trim()
      if (!clean) throw new Error('Type some letters first.')
      const solid = raise(letters(clean, size, fontFamily), depth)
      const [[x0, y0], [x1, y1]] = solid.boundingBox.bounds
      return solid.translate([-(x0 + x1) / 2, -(y0 + y1) / 2, 0])
    },
```

If `sketchOnPlane(...).extrude` already returns a `Shape3D` type, drop the cast. Keep the try/catch, because a sketch with no closed outlines throws from OpenCascade.

- [ ] **Step 7: Write the plugin `src/plugins/builtin/text.ts`**

```ts
import { definePlugin } from '../types'

/** Raised letters in BloKade's chunky, easy-to-read font. */
export default definePlugin({
  id: 'text',
  name: 'Text',
  icon: '🔤',
  version: 1,
  params: {
    text: { type: 'text', default: 'Kade', maxLength: 40, label: 'Text' },
    size: { type: 'mm', default: 10, min: 2, max: 200, label: 'Letter size' },
    depth: { type: 'mm', default: 3, min: 0.4, max: 100, label: 'Thickness' },
  },
  size: { x: 'size', y: 'size', z: 'depth' },
  build: ({ text, size, depth }, cad) => cad.text(text, size, depth),
})
```

In `src/plugins/index.ts`, change the order list to:

```ts
const BUILTIN_ORDER = ['box', 'cylinder', 'sphere', 'cone', 'wedge', 'torus', 'text']
```

- [ ] **Step 8: Load the font in the worker (`src/geometry/geometry.worker.ts`)**

```ts
import * as Comlink from 'comlink'
import fontUrl from '../assets/fonts/AtkinsonHyperlegible-Bold.ttf?url'
import { createCadToolkit } from '../plugins/cad'
import { registerFont } from '../plugins/font'
import { registry } from '../plugins/index'
import { createGeometryApi } from './api'
import { Evaluator } from './evaluate'
import { initBrowserOC } from './oc-browser'
import type { GeometryApi } from './types'

/** A missing font only breaks Text shapes (they show a warning); every other shape still builds. */
async function loadLetters(): Promise<void> {
  try {
    const response = await fetch(fontUrl)
    await registerFont(await response.arrayBuffer())
  } catch (error) {
    console.error('Could not load the letter font; Text shapes will show a warning.', error)
  }
}

const apiReady = Promise.all([initBrowserOC(), loadLetters()])
  .then(() => createGeometryApi(new Evaluator(registry, createCadToolkit())))
```

Keep the `api` object and `Comlink.expose(api)` as they are.

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: all PASS, typecheck clean, and the build emits a hashed `.ttf` under `dist/assets/`.

- [ ] **Step 10: Commit**

```bash
git add src
git commit -m "feat: add the Text shape with a bundled open-licence font"
```

---

### Task 10: Boxes, bounds and measurements

**Files:**
- Create: `src/document/box.ts`, `src/viewport/bounds.ts`, `src/viewport/measure.ts`, `src/app/testing/meshes.ts`
- Test: `src/document/box.test.ts`, `src/viewport/bounds.test.ts`, `src/viewport/measure.test.ts`

**Interfaces:**
- Consumes: `transformToMatrix` (Milestone 1), `DisplayedMesh` and `MeshData` (Milestone 1).
- Produces:
  - In `box.ts`:
    - `type Box = { min: Vec3; max: Vec3 }`
    - `type Axis = 0 | 1 | 2` and `type BoxEdge = 'min' | 'center' | 'max'`
    - `boxSize`, `boxCenter`, `boxEdge(box, axis, edge)`, `unionBox(boxes): Box | null`, `translateBox(box, offset)` and `boxGap(a, b)`
  - In `bounds.ts`:
    - `meshBox(positions, matrix): Box | null`
    - `interface NamedBox { id; name; box }`
    - `topLevelBoxes(doc, meshes): readonly NamedBox[]`
  - In `measure.ts`:
    - `interface Measurement`
    - `measure(target, others): Measurement`
    - `formatMeasurement(m): string`
  - In `testing/meshes.ts`: `boxMesh(width, depth, height): MeshData`

- [ ] **Step 1: Write the failing tests**

`src/app/testing/meshes.ts`. This helper is test support, so write it first:

```ts
import type { MeshData } from '../../geometry/types'

/** A mesh holding just the 8 corners of a box centered on X/Y and sitting on z = 0. Enough for bounds math. */
export function boxMesh(width: number, depth: number, height: number): MeshData {
  const xs = [-width / 2, width / 2]
  const ys = [-depth / 2, depth / 2]
  const zs = [0, height]
  const corners = xs.flatMap((x) => ys.flatMap((y) => zs.flatMap((z) => [x, y, z])))
  return {
    positions: new Float32Array(corners),
    normals: new Float32Array(corners.length),
    indices: new Uint32Array(0),
    edges: new Float32Array(0),
  }
}
```

`src/document/box.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { boxCenter, boxEdge, boxGap, boxSize, translateBox, unionBox, type Box } from './box'

const a: Box = { min: [-10, -10, 0], max: [10, 10, 20] }
const b: Box = { min: [15, -10, 0], max: [35, 10, 20] }

describe('box math', () => {
  it('measures size, center and edges', () => {
    expect(boxSize(a)).toEqual([20, 20, 20])
    expect(boxCenter(b)).toEqual([25, 0, 10])
    expect(boxEdge(b, 0, 'min')).toBe(15)
    expect(boxEdge(b, 0, 'center')).toBe(25)
    expect(boxEdge(b, 2, 'max')).toBe(20)
  })

  it('joins boxes', () => {
    expect(unionBox([a, b])).toEqual({ min: [-10, -10, 0], max: [35, 10, 20] })
    expect(unionBox([])).toBeNull()
  })

  it('moves a box', () => {
    expect(translateBox(a, [1, 2, 3])).toEqual({ min: [-9, -8, 3], max: [11, 12, 23] })
  })

  it('finds the gap between boxes, and zero when they touch or overlap', () => {
    expect(boxGap(a, b)).toBe(5)
    expect(boxGap(a, { min: [13, 14, 0], max: [20, 20, 1] })).toBe(5)
    expect(boxGap(a, translateBox(a, [5, 0, 0]))).toBe(0)
  })
})
```

`src/viewport/bounds.test.ts`:

```ts
import { Matrix4 } from 'three'
import { describe, expect, it } from 'vitest'
import { boxMesh } from '../app/testing/meshes'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode } from '../document/ops'
import { transformToMatrix } from '../document/transform-math'
import { meshBox, topLevelBoxes } from './bounds'

const close = (v: readonly number[]) => v.map((n) => Math.round(n * 1000) / 1000)

describe('bounds', () => {
  it('places a mesh box with the part transform', () => {
    const box = meshBox(boxMesh(20, 10, 4).positions, transformToMatrix({ position: [5, 0, 1], rotation: [0, 0, 90] }))
    expect(close(box?.min ?? [])).toEqual([0, -10, 1])
    expect(close(box?.max ?? [])).toEqual([10, 10, 5])
  })

  it('has no box for an empty mesh', () => {
    expect(meshBox(new Float32Array(0), new Matrix4())).toBeNull()
  })

  it('collects boxes for visible top-level parts that have a mesh', () => {
    const shape = (id: string, x: number, hidden = false) =>
      ({ ...createShapeNode({ id, shapeType: 'box', name: id.toUpperCase(), params: {}, color: '#f00', position: [x, 0, 0] }), hidden })
    const doc = [shape('a', 0), shape('b', 30), shape('h', 60, true), shape('m', 90)].reduce((d, n) => addNode(d, n), createEmptyDocument())
    const mesh = { mesh: boxMesh(20, 20, 20), stale: false }
    const boxes = topLevelBoxes(doc, { a: mesh, b: mesh, h: mesh })
    expect(boxes.map((b) => [b.id, b.name, b.box.min[0]])).toEqual([['a', 'A', -10], ['b', 'B', 20]])
  })
})
```

`src/viewport/measure.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Box } from '../document/box'
import { formatMeasurement, measure } from './measure'

const target: Box = { min: [-10, -10, 0], max: [10, 10, 20] }
const named = (name: string, minX: number) => ({ id: name, name, box: { min: [minX, -10, 0], max: [minX + 20, 10, 20] } as Box })

describe('measurements', () => {
  it('reports size and the nearest part', () => {
    const m = measure(target, [named('Far', 100), named('Cylinder', 15.5)])
    expect(m).toEqual({ size: [20, 20, 20], nearest: { name: 'Cylinder', distance: 5.5 } })
    expect(formatMeasurement(m)).toBe('20 × 20 × 20 mm · 5.5 mm from Cylinder')
  })

  it('says touching when parts meet, and just the size when alone', () => {
    expect(formatMeasurement(measure(target, [named('Box', 10)]))).toBe('20 × 20 × 20 mm · touching Box')
    expect(formatMeasurement(measure(target, []))).toBe('20 × 20 × 20 mm')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/document/box.test.ts src/viewport/bounds.test.ts src/viewport/measure.test.ts`
Expected: FAIL, because the modules are missing.

- [ ] **Step 3: Write `src/document/box.ts`**

```ts
import type { Vec3 } from './types'

/** An axis-aligned box in world millimetres. */
export interface Box {
  readonly min: Vec3
  readonly max: Vec3
}

export type Axis = 0 | 1 | 2
export type BoxEdge = 'min' | 'center' | 'max'

const AXES = [0, 1, 2] as const
const each = (fn: (axis: Axis) => number): Vec3 => [fn(0), fn(1), fn(2)]

export const boxSize = (b: Box): Vec3 => each((i) => b.max[i] - b.min[i])
export const boxCenter = (b: Box): Vec3 => each((i) => (b.min[i] + b.max[i]) / 2)

export function boxEdge(b: Box, axis: Axis, edge: BoxEdge): number {
  if (edge === 'min') return b.min[axis]
  if (edge === 'max') return b.max[axis]
  return (b.min[axis] + b.max[axis]) / 2
}

export function unionBox(boxes: readonly Box[]): Box | null {
  const [first, ...rest] = boxes
  if (!first) return null
  return rest.reduce<Box>((acc, b) => ({
    min: each((i) => Math.min(acc.min[i], b.min[i])),
    max: each((i) => Math.max(acc.max[i], b.max[i])),
  }), first)
}

export const translateBox = (b: Box, offset: Vec3): Box =>
  ({ min: each((i) => b.min[i] + offset[i]), max: each((i) => b.max[i] + offset[i]) })

/** Shortest distance between two boxes; 0 when they touch or overlap. */
export function boxGap(a: Box, b: Box): number {
  return Math.hypot(...AXES.map((i) => Math.max(0, a.min[i] - b.max[i], b.min[i] - a.max[i])))
}
```

- [ ] **Step 4: Write `src/viewport/bounds.ts`**

```ts
import { Box3, Vector3, type Matrix4 } from 'three'
import type { Box } from '../document/box'
import { transformToMatrix } from '../document/transform-math'
import type { BloKadeDocument, NodeId } from '../document/types'
import type { DisplayedMesh } from '../store/merge-build'

/** The world box of a mesh's points after a placement matrix, or null for an empty mesh. */
export function meshBox(positions: ArrayLike<number>, matrix: Matrix4): Box | null {
  if (positions.length < 3) return null
  const box = new Box3()
  const point = new Vector3()
  for (let i = 0; i + 2 < positions.length; i += 3) {
    box.expandByPoint(point.set(positions[i] ?? 0, positions[i + 1] ?? 0, positions[i + 2] ?? 0).applyMatrix4(matrix))
  }
  return { min: [box.min.x, box.min.y, box.min.z], max: [box.max.x, box.max.y, box.max.z] }
}

export interface NamedBox {
  readonly id: NodeId
  readonly name: string
  readonly box: Box
}

/** World boxes of the visible top-level parts that already have a mesh. */
export function topLevelBoxes(doc: BloKadeDocument, meshes: Readonly<Record<NodeId, DisplayedMesh>>): readonly NamedBox[] {
  return doc.root.flatMap((id) => {
    const node = Object.hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined
    const displayed = Object.hasOwn(meshes, id) ? meshes[id] : undefined
    if (!node || !displayed || node.hidden) return []
    const box = meshBox(displayed.mesh.positions, transformToMatrix(node.transform))
    return box ? [{ id, name: node.name, box }] : []
  })
}
```

`Box3`, `Vector3` and the loop index are temporary three.js scratch values inside one function, which the Global Constraints allow.

- [ ] **Step 5: Write `src/viewport/measure.ts`**

```ts
import { boxGap, boxSize, type Box } from '../document/box'
import type { Vec3 } from '../document/types'
import type { NamedBox } from './bounds'

export interface Measurement {
  readonly size: Vec3
  readonly nearest: { readonly name: string; readonly distance: number } | null
}

const TOUCHING = 0.05

export function measure(target: Box, others: readonly NamedBox[]): Measurement {
  const nearest = others.reduce<Measurement['nearest']>((best, other) => {
    const distance = boxGap(target, other.box)
    return best === null || distance < best.distance ? { name: other.name, distance } : best
  }, null)
  return { size: boxSize(target), nearest }
}

const mm = (value: number): string => {
  const rounded = Math.round(value * 10) / 10
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

/** "20 × 20 × 40 mm · 5.5 mm from Cylinder", "… · touching Cylinder", or just the size. */
export function formatMeasurement(m: Measurement): string {
  const size = `${m.size.map(mm).join(' × ')} mm`
  if (!m.nearest) return size
  return m.nearest.distance < TOUCHING
    ? `${size} · touching ${m.nearest.name}`
    : `${size} · ${mm(m.nearest.distance)} mm from ${m.nearest.name}`
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/document src/viewport && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/document/box.ts src/document/box.test.ts src/viewport src/app/testing/meshes.ts
git commit -m "feat: add box math, part bounds and measurement text"
```

---

### Task 11: Align tool

**Files:**
- Create: `src/document/align.ts`, `src/app/align-selection.ts`, `src/ui/AlignTools.tsx`
- Modify: `src/ui/PropertiesPanel.tsx` (multi-selection branch), `src/ui/App.css`
- Test: `src/document/align.test.ts`, `src/app/align-selection.test.ts`, `src/ui/PropertiesPanel.test.tsx`

**Interfaces:**
- Consumes: `Box`, `Axis`, `BoxEdge`, `boxEdge` and `unionBox` (Task 10), `topLevelBoxes` (Task 10), `boxMesh` (Task 10), `updateNode` (Task 6).
- Produces:
  - `alignNodes(doc, boxes, ids, axis, edge): BloKadeDocument`
  - `alignSelection(store, axis, edge): void`
  - `AlignTools()`, with test ids `align-<x|y|z>-<min|center|max>`

- [ ] **Step 1: Write the failing tests**

`src/document/align.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { alignNodes } from './align'
import type { Box } from './box'
import { createEmptyDocument, createGroupNode, createShapeNode } from './factory'
import { addNode, DocumentOpError } from './ops'

const at = (id: string, x: number) => createShapeNode({ id, shapeType: 'box', name: id, params: {}, color: '#f00', position: [x, 0, 0] })
const boxAt = (x: number, width: number): Box => ({ min: [x - width / 2, -10, 0], max: [x + width / 2, 10, 20] })

function setup() {
  const doc = [at('a', 0), at('b', 30)].reduce((d, n) => addNode(d, n), createEmptyDocument())
  return { doc, boxes: { a: boxAt(0, 20), b: boxAt(30, 10) } }
}
const x = (doc: ReturnType<typeof setup>['doc'], id: string) => doc.nodes[id]?.transform.position[0]

describe('alignNodes', () => {
  it('lines up left edges', () => {
    const { doc, boxes } = setup()
    const aligned = alignNodes(doc, boxes, ['a', 'b'], 0, 'min')
    expect([x(aligned, 'a'), x(aligned, 'b')]).toEqual([0, -5])
  })

  it('lines up centers and right edges', () => {
    const { doc, boxes } = setup()
    expect(x(alignNodes(doc, boxes, ['a', 'b'], 0, 'center'), 'a')).toBe(12.5)
    expect(x(alignNodes(doc, boxes, ['a', 'b'], 0, 'max'), 'a')).toBe(25)
  })

  it('needs two top-level parts with a shape', () => {
    const { doc, boxes } = setup()
    expect(() => alignNodes(doc, boxes, ['a'], 0, 'min')).toThrow(DocumentOpError)
    expect(() => alignNodes(doc, { a: boxes.a }, ['a', 'b'], 0, 'min')).toThrow('Pick two or more parts')
    const grouped = addNode(createEmptyDocument(), createGroupNode({ id: 'g', children: [] }))
    expect(() => alignNodes(grouped, {}, ['g', 'child'], 0, 'min')).toThrow(DocumentOpError)
  })
})
```

`src/app/align-selection.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode } from '../document/ops'
import { createBloKadeStore } from '../store/store'
import { alignSelection } from './align-selection'
import { boxMesh } from './testing/meshes'

describe('alignSelection', () => {
  it('lines up the selected parts using their meshes', () => {
    const doc = [
      createShapeNode({ id: 'a', shapeType: 'box', name: 'A', params: {}, color: '#f00' }),
      createShapeNode({ id: 'b', shapeType: 'box', name: 'B', params: {}, color: '#f00', position: [0, 0, 7] }),
    ].reduce((d, n) => addNode(d, n), createEmptyDocument())
    const store = createBloKadeStore({ designId: 'd', doc })
    const mesh = boxMesh(20, 20, 20)
    store.getState().applyBuild('d', { nodes: { a: { status: 'ok', mesh }, b: { status: 'ok', mesh } } })
    store.getState().select(['a', 'b'])
    alignSelection(store, 2, 'min')
    expect(store.getState().history.present.nodes.b?.transform.position).toEqual([0, 0, 0])
  })

  it('explains when there is nothing to line up', () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    alignSelection(store, 0, 'min')
    expect(store.getState().notice).toContain('Pick two or more parts')
  })
})
```

Add to `src/ui/PropertiesPanel.test.tsx`. Import `boxMesh` from `../app/testing/meshes` and `updateNode` from `../document/ops`.

```tsx
  it('shows line-up buttons for two or more parts and uses them', async () => {
    const { store, actions } = setup()
    act(() => actions.addShape('box'))
    act(() => actions.addShape('box'))
    const [a, b] = store.getState().history.present.root
    if (!a || !b) throw new Error('missing parts')
    act(() => {
      store.getState().apply((d) => updateNode(d, b, (n) => ({ ...n, transform: { ...n.transform, position: [30, 0, 0] } })))
      store.getState().applyBuild('d', { nodes: { [a]: { status: 'ok', mesh: boxMesh(20, 20, 20) }, [b]: { status: 'ok', mesh: boxMesh(20, 20, 20) } } })
      store.getState().select([a, b])
    })
    await userEvent.click(screen.getByTestId('align-x-min'))
    expect(store.getState().history.present.nodes[b]?.transform.position[0]).toBe(0)
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/document/align.test.ts src/app/align-selection.test.ts src/ui/PropertiesPanel.test.tsx`
Expected: FAIL, because the modules and buttons are missing.

- [ ] **Step 3: Write `src/document/align.ts`**

```ts
import { boxEdge, unionBox, type Axis, type Box, type BoxEdge } from './box'
import { DocumentOpError, updateNode } from './ops'
import type { BloKadeDocument, NodeId, Vec3 } from './types'

const tidy = (v: number): number => {
  const r = Math.round(v * 1e6) / 1e6
  return Object.is(r, -0) ? 0 : r
}

const shift = (v: Vec3, axis: Axis, delta: number): Vec3 =>
  [axis === 0 ? tidy(v[0] + delta) : v[0], axis === 1 ? tidy(v[1] + delta) : v[1], axis === 2 ? tidy(v[2] + delta) : v[2]]

/** Moves top-level parts so their chosen edge (or center) matches the whole selection's. */
export function alignNodes(
  doc: BloKadeDocument, boxes: Readonly<Record<NodeId, Box>>, ids: readonly NodeId[], axis: Axis, edge: BoxEdge,
): BloKadeDocument {
  const targets = [...new Set(ids)].flatMap((id) => {
    const box = doc.root.includes(id) && Object.hasOwn(boxes, id) ? boxes[id] : undefined
    return box ? [{ id, box }] : []
  })
  const all = unionBox(targets.map((t) => t.box))
  if (targets.length < 2 || !all) throw new DocumentOpError('Pick two or more parts (not inside a group) to line them up.')
  const goal = boxEdge(all, axis, edge)
  return targets.reduce((d, { id, box }) => {
    const delta = goal - boxEdge(box, axis, edge)
    return delta === 0 ? d : updateNode(d, id, (n) => ({ ...n, transform: { ...n.transform, position: shift(n.transform.position, axis, delta) } }))
  }, doc)
}
```

- [ ] **Step 4: Write `src/app/align-selection.ts`**

```ts
import { alignNodes } from '../document/align'
import type { Axis, BoxEdge } from '../document/box'
import type { BloKadeStore } from '../store/store'
import { topLevelBoxes } from '../viewport/bounds'

/** Lines up the current selection using the boxes of the meshes on screen. Problems become notices. */
export function alignSelection(store: BloKadeStore, axis: Axis, edge: BoxEdge): void {
  const { history, meshes, selection, apply } = store.getState()
  const boxes = Object.fromEntries(topLevelBoxes(history.present, meshes).map((b) => [b.id, b.box] as const))
  apply((doc) => alignNodes(doc, boxes, selection, axis, edge))
}
```

- [ ] **Step 5: Write `src/ui/AlignTools.tsx`**

```tsx
import { alignSelection } from '../app/align-selection'
import type { Axis, BoxEdge } from '../document/box'
import { useBloKadeStore } from '../store/context'

const AXIS_NAMES = ['x', 'y', 'z'] as const
const EDGES: readonly BoxEdge[] = ['min', 'center', 'max']
const ROWS: readonly { axis: Axis; title: string; labels: Readonly<Record<BoxEdge, string>> }[] = [
  { axis: 0, title: 'Left to right', labels: { min: '⇤ Left', center: '↔ Center', max: 'Right ⇥' } },
  { axis: 1, title: 'Front to back', labels: { min: 'Front', center: 'Center', max: 'Back' } },
  { axis: 2, title: 'Bottom to top', labels: { min: 'Bottom', center: 'Middle', max: 'Top' } },
]

/** Buttons that line up the selected parts' edges or centers. */
export function AlignTools() {
  const store = useBloKadeStore()
  return (
    <div className="align-tools" role="group" aria-label="Line up">
      <h3>Line up</h3>
      {ROWS.map((row) => (
        <div key={row.axis} className="align-row" role="group" aria-label={row.title}>
          {EDGES.map((edge) => (
            <button key={edge} type="button" className="tool-button" data-testid={`align-${AXIS_NAMES[row.axis]}-${edge}`}
              onClick={() => alignSelection(store, row.axis, edge)}>{row.labels[edge]}</button>
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Show it for multi-selections**

In `src/ui/PropertiesPanel.tsx`, import `AlignTools` and render it inside the `selection.length > 1` branch, after the hint paragraph:

```tsx
        <p className="hint">{selection.length} parts selected. Group them, or pick one to change it.</p>
        <AlignTools />
```

Add to `src/ui/App.css`:

```css
.align-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-bottom: 4px; }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "feat: add the line-up (align) tool"
```

---

### Task 12: Object snapping and live measurements while dragging

**Files:**
- Create: `src/viewport/object-snap.ts`
- Modify: `src/viewport/TransformHandles.tsx`, `src/viewport/Viewport.tsx`, `src/ui/App.css`
- Test: `src/viewport/object-snap.test.ts`

**Interfaces:**
- Consumes: `Box`, `Axis`, `BoxEdge`, `boxEdge` and `translateBox` (Task 10), `meshBox`, `topLevelBoxes` and `NamedBox` (Task 10), `measure` and `formatMeasurement` (Task 10).
- Produces:
  - `SNAP_DISTANCE = 2`
  - `interface SnapResult { offset: Vec3; snappedTo: string | null }`
  - `snapToObjects(target, others, axes, threshold?)`
  - `axesOf(handle): Axis[]`
  - `TransformHandles({ registry, onMeasure(text | null) })`
  - A viewport overlay with `data-testid="measurement"`

- [ ] **Step 1: Write the failing test `src/viewport/object-snap.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import type { Box } from '../document/box'
import { axesOf, snapToObjects } from './object-snap'

const wall = { id: 'w', name: 'Box', box: { min: [-10, -10, 0], max: [10, 10, 20] } as Box }
const spanX = (min: number, max: number): Box => ({ min: [min, -10, 0], max: [max, 10, 20] })

describe('snapToObjects', () => {
  it('pulls a face flush against a nearby part on the dragged axis', () => {
    expect(snapToObjects(spanX(11, 31), [wall], [0])).toEqual({ offset: [-1, 0, 0], snappedTo: 'Box' })
  })

  it('lines up centers', () => {
    expect(snapToObjects(spanX(-1.5, 4.5), [wall], [0])).toEqual({ offset: [-1.5, 0, 0], snappedTo: 'Box' })
  })

  it('leaves parts alone when nothing is within 2 mm', () => {
    expect(snapToObjects(spanX(13, 33), [wall], [0])).toEqual({ offset: [0, 0, 0], snappedTo: null })
  })

  it('only snaps on the axes being dragged', () => {
    const offY: Box = { min: [11, 11, 0], max: [31, 31, 20] }
    expect(snapToObjects(offY, [wall], [0]).offset).toEqual([-1, 0, 0])
    expect(snapToObjects(offY, [wall], []).offset).toEqual([0, 0, 0])
  })
})

describe('axesOf', () => {
  it('reads the dragged handle', () => {
    expect(axesOf('X')).toEqual([0])
    expect(axesOf('XY')).toEqual([0, 1])
    expect(axesOf('XYZ')).toEqual([0, 1, 2])
    expect(axesOf('XYZE')).toEqual([])
    expect(axesOf(null)).toEqual([])
    expect(axesOf(undefined)).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/viewport/object-snap.test.ts`
Expected: FAIL, because the module is missing.

- [ ] **Step 3: Write `src/viewport/object-snap.ts`**

```ts
import { boxEdge, type Axis, type Box, type BoxEdge } from '../document/box'
import type { Vec3 } from '../document/types'
import type { NamedBox } from './bounds'

/** How close (mm) an edge or center must come to another part's before it snaps. */
export const SNAP_DISTANCE = 2

export interface SnapResult {
  readonly offset: Vec3
  readonly snappedTo: string | null
}

interface Candidate {
  readonly delta: number
  readonly name: string
}

const PAIRS: readonly (readonly [BoxEdge, BoxEdge])[] = [
  ['min', 'min'], ['min', 'max'], ['max', 'min'], ['max', 'max'], ['center', 'center'],
]

const closer = (a: Candidate | null, b: Candidate | null): Candidate | null =>
  a === null || (b !== null && Math.abs(b.delta) < Math.abs(a.delta)) ? b : a

function bestOnAxis(target: Box, others: readonly NamedBox[], axis: Axis, threshold: number): Candidate | null {
  const candidates = others.flatMap((other) => PAIRS.map(([mine, theirs]) => ({
    delta: boxEdge(other.box, axis, theirs) - boxEdge(target, axis, mine),
    name: other.name,
  })))
  return candidates.filter((c) => Math.abs(c.delta) <= threshold).reduce<Candidate | null>(closer, null)
}

/** Nudges a dragged part so a face or its center lines up with a nearby part's, on the axes being dragged. */
export function snapToObjects(
  target: Box, others: readonly NamedBox[], axes: readonly Axis[], threshold: number = SNAP_DISTANCE,
): SnapResult {
  const picks = new Map(axes.map((axis) => [axis, bestOnAxis(target, others, axis, threshold)] as const))
  const deltaOn = (axis: Axis): number => picks.get(axis)?.delta ?? 0
  const nearest = [...picks.values()].reduce<Candidate | null>(closer, null)
  return { offset: [deltaOn(0), deltaOn(1), deltaOn(2)], snappedTo: nearest?.name ?? null }
}

/** Which world axes a move handle drags ("X", "XY", "XYZ"…). Rotation handles ("E", "XYZE") move none. */
export function axesOf(handle: string | null | undefined): Axis[] {
  if (!handle || handle.includes('E')) return []
  return ([0, 1, 2] as const).filter((axis) => handle.includes('XYZ'.charAt(axis)))
}
```

- [ ] **Step 4: Snap and measure in `src/viewport/TransformHandles.tsx`**

Replace the file with the following. It keeps `edited`, `sameTransform` and the commit logic from Milestone 1.

```tsx
import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { MathUtils, Vector3, type Object3D } from 'three'
import { translateBox } from '../document/box'
import { updateNode } from '../document/ops'
import { transformFromParts } from '../document/transform-math'
import type { SceneNode, Transform, Vec3 } from '../document/types'
import type { PluginRegistry } from '../plugins/registry'
import { useBloKade, useBloKadeStore } from '../store/context'
import type { ToolMode } from '../store/store'
import { meshBox, topLevelBoxes } from './bounds'
import { formatMeasurement, measure } from './measure'
import { axesOf, snapToObjects } from './object-snap'
import { paramsFromScale } from './sizing'
import { useShiftHeld } from './useShiftHeld'

const ROTATION_SNAP = MathUtils.degToRad(15)
const CONTROL_MODES = { move: 'translate', rotate: 'rotate', size: 'scale' } as const

const sameTransform = (a: Transform, b: Transform): boolean =>
  a.position.every((v, i) => v === b.position[i]) && a.rotation.every((v, i) => v === b.rotation[i])

function edited(node: SceneNode, tool: ToolMode, transform: Transform, scale: Vec3, registry: PluginRegistry): SceneNode {
  if (node.kind !== 'shape' || tool !== 'size') return { ...node, transform }
  const plugin = registry.get(node.shapeType)
  return plugin ? { ...node, transform, params: paramsFromScale(plugin, node.params, scale) } : { ...node, transform }
}

interface TransformHandlesProps {
  registry: PluginRegistry
  /** Live size/distance text while dragging; null when the drag ends. */
  onMeasure(text: string | null): void
}

export function TransformHandles({ registry, onMeasure }: TransformHandlesProps) {
  const store = useBloKadeStore()
  const doc = useBloKade((s) => s.history.present)
  const selection = useBloKade((s) => s.selection)
  const tool = useBloKade((s) => s.tool)
  const meshes = useBloKade((s) => s.meshes)
  const scene = useThree((s) => s.scene)
  const shiftHeld = useShiftHeld()
  const [target, setTarget] = useState<Object3D | null>(null)
  const controls = useRef<ComponentRef<typeof TransformControls>>(null)

  const selectedId = selection.length === 1 ? selection[0] : undefined
  const id = selectedId && doc.root.includes(selectedId) ? selectedId : null
  const node = id && Object.hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined
  const others = useMemo(() => topLevelBoxes(doc, meshes).filter((b) => b.id !== id), [doc, meshes, id])

  useEffect(() => {
    setTarget(id ? scene.getObjectByName(id) ?? null : null)
  }, [id, scene, meshes])

  if (!node || !target || (tool === 'size' && node.kind !== 'shape')) return null
  const displayed = Object.hasOwn(meshes, node.id) ? meshes[node.id] : undefined

  const onObjectChange = (): void => {
    target.updateMatrixWorld()
    const box = displayed ? meshBox(displayed.mesh.positions, target.matrixWorld) : null
    if (!box) return
    // Shift means "free": no grid snap and no object snap.
    const snap = tool === 'move' && !shiftHeld ? snapToObjects(box, others, axesOf(controls.current?.axis)) : null
    if (snap && snap.offset.some((v) => v !== 0)) target.position.add(new Vector3(...snap.offset))
    const text = formatMeasurement(measure(snap ? translateBox(box, snap.offset) : box, others))
    onMeasure(snap?.snappedTo ? `${text} · lined up with ${snap.snappedTo}` : text)
  }

  const commit = (): void => {
    onMeasure(null)
    const transform = transformFromParts(
      [target.position.x, target.position.y, target.position.z],
      [target.rotation.x, target.rotation.y, target.rotation.z],
    )
    const scale: Vec3 = [target.scale.x, target.scale.y, target.scale.z]
    // TransformControls scales the three.js object directly; BloKade stores size in parameters instead.
    target.scale.set(1, 1, 1)
    if (scale.every((s) => s === 1) && sameTransform(transform, node.transform)) return
    store.getState().apply((d) => updateNode(d, node.id, (n) => edited(n, tool, transform, scale, registry)))
  }

  const gridSnap = doc.settings.gridSnap
  return (
    <TransformControls
      ref={controls}
      object={target}
      mode={CONTROL_MODES[tool]}
      translationSnap={gridSnap > 0 && !shiftHeld ? gridSnap : null}
      rotationSnap={shiftHeld ? null : ROTATION_SNAP}
      onObjectChange={onObjectChange}
      onMouseUp={commit}
    />
  )
}
```

`target` is a three.js object owned by the viewport, not document state, so moving it during a drag is allowed. The document changes only on mouse-up, through `apply`.

- [ ] **Step 5: Show the measurement in `src/viewport/Viewport.tsx`**

Add `import { useState } from 'react'`, then this inside the component:

```tsx
  const [measurement, setMeasurement] = useState<string | null>(null)
```

Change the handles line to:

```tsx
        <TransformHandles registry={registry} onMeasure={setMeasurement} />
```

After `</Canvas>`, add:

```tsx
      {measurement && <div className="measure-overlay" data-testid="measurement">{measurement}</div>}
```

Add to `src/ui/App.css`:

```css
.measure-overlay {
  position: absolute; left: 12px; top: 12px; padding: 6px 10px; border-radius: 8px; pointer-events: none;
  background: rgba(29, 36, 51, 0.85); color: #fff; font-size: 0.85rem; font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 6: Run the tests, typecheck and build**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: all PASS, and typecheck and build clean.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: snap dragged parts to nearby parts and show live measurements"
```

The controller checks this in a browser:
- Drag a box toward another along X. It snaps flush within 2 mm, and the overlay shows the size, the distance, and "lined up with".
- Holding Shift moves the box freely.
- The overlay disappears when the mouse is released.

---

### Task 13: Workplane on a face

**Files:**
- Create: `src/viewport/workplane.ts`, `src/viewport/WorkplaneMarker.tsx`
- Modify:
  - `src/store/store.ts`
  - `src/document/factory.ts`
  - `src/app/actions.ts`
  - `src/viewport/NodeMesh.tsx`
  - `src/viewport/Viewport.tsx`
  - `src/ui/Toolbar.tsx`
  - `src/ui/App.css`
- Test:
  - `src/viewport/workplane.test.ts`
  - `src/store/store.test.ts`
  - `src/app/actions.test.ts`
  - `src/document/factory.test.ts`
  - `src/ui/Toolbar.test.tsx`

**Interfaces:**
- Consumes: `transformToMatrix` (Milestone 1).
- Produces:
  - `interface Workplane { origin: Vec3; rotation: Vec3 }`, exported from `store.ts`
  - Store fields: `workplane`, `pickingWorkplane`, `setWorkplane(wp | null)` (which also stops picking) and `setPickingWorkplane(on)`
  - `workplaneFromHit(point, normal): Workplane`
  - `createShapeNode({ …, rotation? })`
  - Actions: `toggleWorkplanePicking()` and `resetWorkplane()`
  - `addShape` places new shapes on the workplane
  - Toolbar test ids: `workplane` and `workplane-reset`

- [ ] **Step 1: Write the failing tests**

`src/viewport/workplane.test.ts`:

```ts
import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { transformToMatrix } from '../document/transform-math'
import { workplaneFromHit } from './workplane'

describe('workplaneFromHit', () => {
  it('keeps an upward face flat and rounds the point to 0.01 mm', () => {
    expect(workplaneFromHit([1.234, 5, 20], [0, 0, 1])).toEqual({ origin: [1.23, 5, 20], rotation: [0, 0, 0] })
  })

  it.each([[1, 0, 0], [0, -1, 0], [0, 0, -1], [1, 1, 0], [0, 3, 4]])('stands new shapes on a face facing %d %d %d', (x, y, z) => {
    const { rotation } = workplaneFromHit([0, 0, 0], [x, y, z])
    const up = new Vector3(0, 0, 1).transformDirection(transformToMatrix({ position: [0, 0, 0], rotation }))
    expect(up.distanceTo(new Vector3(x, y, z).normalize())).toBeLessThan(1e-3)
  })

  it('falls back to flat for a broken normal', () => {
    expect(workplaneFromHit([0, 0, 0], [0, 0, 0]).rotation).toEqual([0, 0, 0])
  })
})
```

Add to `src/store/store.test.ts`:

```ts
  it('remembers a workplane, stops picking when one is chosen, and forgets it for another design', () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    store.getState().setPickingWorkplane(true)
    expect(store.getState().pickingWorkplane).toBe(true)
    store.getState().setWorkplane({ origin: [1, 2, 3], rotation: [0, 90, 0] })
    expect(store.getState()).toMatchObject({ workplane: { origin: [1, 2, 3], rotation: [0, 90, 0] }, pickingWorkplane: false })
    store.getState().openDesign('other', createEmptyDocument())
    expect(store.getState().workplane).toBeNull()
  })
```

Add to `src/app/actions.test.ts`:

```ts
  it('puts new shapes on the workplane', () => {
    const { store, actions, doc } = setup()
    store.getState().setWorkplane({ origin: [1, 2, 3], rotation: [0, 90, 0] })
    actions.addShape('box')
    const [id] = doc().root
    expect(doc().nodes[id as string]?.transform).toEqual({ position: [1, 2, 3], rotation: [0, 90, 0] })
  })

  it('toggles workplane picking and goes back to the ground', () => {
    const { store, actions } = setup()
    actions.toggleWorkplanePicking()
    expect(store.getState().pickingWorkplane).toBe(true)
    actions.toggleWorkplanePicking()
    expect(store.getState().pickingWorkplane).toBe(false)
    store.getState().setWorkplane({ origin: [0, 0, 5], rotation: [0, 0, 0] })
    actions.resetWorkplane()
    expect(store.getState().workplane).toBeNull()
  })
```

Add to `src/document/factory.test.ts`:

```ts
  it('can place a new shape with a rotation', () => {
    const node = createShapeNode({ shapeType: 'box', name: 'Box', params: {}, color: '#f00', position: [1, 2, 3], rotation: [0, 90, 0] })
    expect(node.transform).toEqual({ position: [1, 2, 3], rotation: [0, 90, 0] })
  })
```

Add to `src/ui/Toolbar.test.tsx`, reusing its setup that renders the toolbar with a store and actions:

```tsx
  it('picks a workplane and goes back to the ground', async () => {
    const { store } = setup()
    await userEvent.click(screen.getByTestId('workplane'))
    expect(store.getState().pickingWorkplane).toBe(true)
    expect(screen.queryByTestId('workplane-reset')).toBeNull()
    act(() => store.getState().setWorkplane({ origin: [0, 0, 5], rotation: [0, 0, 0] }))
    await userEvent.click(screen.getByTestId('workplane-reset'))
    expect(store.getState().workplane).toBeNull()
  })
```


- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/viewport/workplane.test.ts src/store src/app/actions.test.ts src/document/factory.test.ts src/ui/Toolbar.test.tsx`
Expected: FAIL. `workplane.ts` is missing, the store has no `setWorkplane`, and the toolbar has no `workplane` button.

- [ ] **Step 3: Add the workplane to `src/store/store.ts`**

```ts
import type { BloKadeDocument, NodeId, Vec3 } from '../document/types'
```

```ts
/** Where new shapes land: a point on a face, turned so a new shape's bottom sits flat on it. */
export interface Workplane {
  readonly origin: Vec3
  readonly rotation: Vec3
}
```

Add to `BloKadeState`:

```ts
  /** Null means the ground grid. */
  readonly workplane: Workplane | null
  /** True while the next click on a face chooses the workplane. */
  readonly pickingWorkplane: boolean
  setWorkplane(workplane: Workplane | null): void
  setPickingWorkplane(picking: boolean): void
```

In `createBloKadeStore`, add the initial values `workplane: null` and `pickingWorkplane: false`, plus these two setters:

```ts
    setWorkplane: (workplane) => set({ workplane, pickingWorkplane: false }),
    setPickingWorkplane: (pickingWorkplane) => set({ pickingWorkplane }),
```

Change `openDesign` so it also clears the workplane:

```ts
    openDesign: (designId, doc) =>
      set({ designId, history: createHistory(doc), selection: [], meshes: {}, errors: {}, workplane: null, pickingWorkplane: false }),
```

- [ ] **Step 4: Write `src/viewport/workplane.ts`**

```ts
import { Euler, Quaternion, Vector3 } from 'three'
import type { Vec3 } from '../document/types'
import type { Workplane } from '../store/store'

const tidy = (value: number, step: number): number => {
  const rounded = Number((Math.round(value / step) * step).toFixed(6))
  return Object.is(rounded, -0) ? 0 : rounded
}

/** A workplane from a clicked point and that face's outward normal (both in world space). */
export function workplaneFromHit(point: Vec3, normal: Vec3): Workplane {
  const origin: Vec3 = [tidy(point[0], 0.01), tidy(point[1], 0.01), tidy(point[2], 0.01)]
  const n = new Vector3(...normal)
  if (n.lengthSq() === 0) return { origin, rotation: [0, 0, 0] }
  const turn = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), n.normalize())
  const e = new Euler().setFromQuaternion(turn, 'XYZ')
  const deg = (radians: number): number => tidy((radians * 180) / Math.PI, 0.001)
  return { origin, rotation: [deg(e.x), deg(e.y), deg(e.z)] }
}
```

- [ ] **Step 5: Let `createShapeNode` take a rotation (`src/document/factory.ts`)**

Add `rotation?: Vec3` to the input type, and build the transform from both:

```ts
    transform: { position: input.position ?? IDENTITY_TRANSFORM.position, rotation: input.rotation ?? IDENTITY_TRANSFORM.rotation },
```

- [ ] **Step 6: Update the actions (`src/app/actions.ts`)**

Add to the `Actions` interface:

```ts
  toggleWorkplanePicking(): void
  resetWorkplane(): void
```

In `addShape`, place the node on the workplane:

```ts
      const workplane = state().workplane
      const node = createShapeNode({
        shapeType: plugin.id, name: plugin.name, params: defaultParams(plugin), color,
        position: workplane?.origin, rotation: workplane?.rotation,
      })
```

Add the two actions:

```ts
    toggleWorkplanePicking: () => state().setPickingWorkplane(!state().pickingWorkplane),
    resetWorkplane: () => state().setWorkplane(null),
```

- [ ] **Step 7: Pick faces in `src/viewport/NodeMesh.tsx`**

Add `Vec3` to the type import. Add this prop:

```ts
  /** Set while choosing a workplane: clicking a face reports it instead of selecting the part. */
  onPickFace?(point: Vec3, normal: Vec3): void
```

Destructure `onPickFace` and replace `handleClick`:

```tsx
  const handleClick = (event: ThreeEvent<MouseEvent>): void => {
    event.stopPropagation()
    if (onPickFace) {
      if (event.face) {
        const normal = event.face.normal.clone().transformDirection(event.object.matrixWorld)
        onPickFace([event.point.x, event.point.y, event.point.z], [normal.x, normal.y, normal.z])
      }
      return
    }
    onSelect(node.id, event.shiftKey || event.metaKey || event.ctrlKey)
  }
```

- [ ] **Step 8: Write `src/viewport/WorkplaneMarker.tsx`**

```tsx
import { Grid } from '@react-three/drei'
import { MathUtils } from 'three'
import type { Workplane } from '../store/store'

/** An orange grid showing where new shapes will land. */
export function WorkplaneMarker({ workplane }: { workplane: Workplane }) {
  const [x, y, z] = workplane.origin
  const [rx, ry, rz] = workplane.rotation
  return (
    <group position={[x, y, z]} rotation={[MathUtils.degToRad(rx), MathUtils.degToRad(ry), MathUtils.degToRad(rz)]}>
      <Grid position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]} args={[60, 60]} cellSize={1} sectionSize={10}
        cellColor="#ffb766" sectionColor="#ff8a00" fadeDistance={250} />
    </group>
  )
}
```

- [ ] **Step 9: Wire picking into `src/viewport/Viewport.tsx`**

Replace the file with the following. It keeps the Task 12 measurement overlay, and clicking empty space no longer clears the selection while Shift, Cmd or Ctrl is held (a Milestone 1 backlog item).

```tsx
import { GizmoHelper, GizmoViewport, Grid, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import { Object3D } from 'three'
import { nextSelection } from '../app/selection'
import type { NodeId, Vec3 } from '../document/types'
import type { PluginRegistry } from '../plugins/registry'
import { useBloKade } from '../store/context'
import { NodeMesh } from './NodeMesh'
import { TransformHandles } from './TransformHandles'
import { WorkplaneMarker } from './WorkplaneMarker'
import { workplaneFromHit } from './workplane'

// BloKade is Z-up like slicers. This must run before the camera is created.
Object3D.DEFAULT_UP.set(0, 0, 1)

export function Viewport({ registry }: { registry: PluginRegistry }) {
  const doc = useBloKade((s) => s.history.present)
  const meshes = useBloKade((s) => s.meshes)
  const selection = useBloKade((s) => s.selection)
  const engineReady = useBloKade((s) => s.engineReady)
  const select = useBloKade((s) => s.select)
  const picking = useBloKade((s) => s.pickingWorkplane)
  const workplane = useBloKade((s) => s.workplane)
  const setWorkplane = useBloKade((s) => s.setWorkplane)
  const [measurement, setMeasurement] = useState<string | null>(null)

  const onSelect = (id: NodeId, additive: boolean): void => select(nextSelection(selection, id, additive))
  const onPickFace = picking ? (point: Vec3, normal: Vec3): void => setWorkplane(workplaneFromHit(point, normal)) : undefined
  const onPointerMissed = (event: MouseEvent): void => {
    if (picking) setWorkplane(null)
    else if (!(event.shiftKey || event.metaKey || event.ctrlKey)) select([])
  }

  return (
    <>
      <Canvas camera={{ position: [120, -160, 120], fov: 45, near: 0.5, far: 5000 }} onPointerMissed={onPointerMissed}>
        <color attach="background" args={['#e9eef7']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[150, -100, 250]} intensity={1.6} />
        <directionalLight position={[-150, 100, 80]} intensity={0.5} />
        <Grid rotation={[Math.PI / 2, 0, 0]} cellSize={1} sectionSize={10} infiniteGrid fadeDistance={600} cellColor="#c9d3e3" sectionColor="#8fa3c2" />
        {doc.root.map((id) => {
          const node = doc.nodes[id]
          const displayed = meshes[id]
          return node && displayed && !node.hidden ? (
            <NodeMesh key={id} node={node} displayed={displayed} selected={selection.includes(id)} onSelect={onSelect} onPickFace={onPickFace} />
          ) : null
        })}
        {workplane && <WorkplaneMarker workplane={workplane} />}
        <TransformHandles registry={registry} onMeasure={setMeasurement} />
        <OrbitControls makeDefault />
        <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
          <GizmoViewport />
        </GizmoHelper>
      </Canvas>
      {measurement && <div className="measure-overlay" data-testid="measurement">{measurement}</div>}
      {picking && <div className="viewport-hint" role="status">Click a face to build on it. Click empty space to build on the ground again.</div>}
      {!engineReady && <div className="viewport-overlay">Warming up the geometry engine…</div>}
    </>
  )
}
```

- [ ] **Step 10: Add the toolbar buttons (`src/ui/Toolbar.tsx`)**

Read the state:

```tsx
  const picking = useBloKade((s) => s.pickingWorkplane)
  const onFace = useBloKade((s) => s.workplane !== null)
```

Add this group after the "Handle mode" group:

```tsx
      <div className="toolbar-group" role="group" aria-label="Workplane">
        <button type="button" className="tool-button" data-testid="workplane" aria-pressed={picking}
          title="Build on a face: click this, then click a face" onClick={actions.toggleWorkplanePicking}>📐 Workplane</button>
        {onFace && <button type="button" className="tool-button" data-testid="workplane-reset"
          title="Build on the ground again" onClick={actions.resetWorkplane}>Ground</button>}
      </div>
```

Add to `src/ui/App.css`:

```css
.viewport-hint {
  position: absolute; left: 50%; top: 12px; transform: translateX(-50%); padding: 6px 12px; border-radius: 8px;
  background: #ff8a00; color: #fff; font-size: 0.9rem; pointer-events: none;
}
```

- [ ] **Step 11: Run the tests, typecheck and build**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: all PASS, and typecheck and build clean.

- [ ] **Step 12: Commit**

```bash
git add src
git commit -m "feat: build on any face with the workplane tool"
```

The controller checks this in a browser:
- Click 📐 Workplane, then the side of a box. An orange grid appears on that face.
- Add a cylinder. It stands out from the face.
- Click Ground. The grid goes away, and new shapes land on the floor again.

---

### Task 14: End-to-end tests for Smart Sizes

**Files:**
- Create: `e2e/smart-sizes.spec.ts`

**Interfaces:**
- Consumes these test ids from Tasks 7–13: `add-variable`, `var-name-*`, `var-expr-*`, `param-width(-value)`, `add-text`, `export-stl`, `align-x-min`, `pos-x` and the `treeitem` names.

- [ ] **Step 1: Write `e2e/smart-sizes.spec.ts`**

```ts
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('a variable drives a size, and changing it resizes the part', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('add-box').click()
  await page.getByTestId('add-variable').click()
  await page.getByTestId('var-name-var1').fill('wall')
  await page.getByTestId('var-name-var1').press('Enter')
  await page.getByTestId('var-expr-wall').fill('3')
  await page.getByTestId('var-expr-wall').press('Enter')

  await page.getByRole('treeitem', { name: 'Box' }).click()
  await page.getByTestId('param-width').fill('wall * 10')
  await page.getByTestId('param-width').press('Enter')
  await expect(page.getByTestId('param-width-value')).toHaveText('= 30')

  await page.getByTestId('var-expr-wall').fill('4')
  await page.getByTestId('var-expr-wall').press('Enter')
  await expect(page.getByTestId('param-width-value')).toHaveText('= 40')

  await page.waitForTimeout(1500) // autosave runs 1 s after the last change
  await page.reload()
  await page.getByRole('treeitem', { name: 'Box' }).click()
  await expect(page.getByTestId('param-width')).toHaveValue('wall * 10')
})

test('Kade adds his name in 3D letters and exports them', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('add-text').click()
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()

  const downloading = page.waitForEvent('download')
  await page.getByTestId('export-stl').click()
  const bytes = await readFile(await (await downloading).path())
  const triangles = bytes.readUInt32LE(80)
  expect(triangles).toBeGreaterThan(100)
  expect(bytes.length).toBe(84 + triangles * 50)
})

test('line up two parts by their left edges', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('add-box').click()
  await page.getByTestId('add-cylinder').click()
  await page.getByTestId('pos-x').fill('30')
  await page.getByTestId('pos-x').press('Enter')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()

  // Meshes arrive asynchronously, so retry until both parts can be lined up.
  await expect(async () => {
    await page.getByRole('treeitem', { name: 'Box' }).click()
    await page.getByRole('treeitem', { name: 'Cylinder' }).click({ modifiers: ['Shift'] })
    await page.getByTestId('align-x-min').click()
    await page.getByRole('treeitem', { name: 'Cylinder' }).click()
    await expect(page.getByTestId('pos-x')).toHaveValue('0', { timeout: 1000 })
  }).toPass({ timeout: 20_000 })
})
```

- [ ] **Step 2: Run the end-to-end suite**

Run: `npm run e2e`
Expected: 5 passed (2 from Milestone 1 and 3 new).

If a selector differs from the real UI, check the component source and make the smallest change to the test. Never change app code to fit a test without reporting it. If the app itself is broken, report DONE_WITH_CONCERNS with the details.

- [ ] **Step 3: Commit**

```bash
git add e2e/smart-sizes.spec.ts
git commit -m "test: add end-to-end Smart Sizes flows"
```

---

### Task 15: Docs and final verification

**Files:**
- Modify: `README.md`, `plugins/README.md`

- [ ] **Step 1: Add a "Smart sizes" section to `README.md`**

Put it under "Using BloKade":

```markdown
### Smart sizes

- **Formulas:** any size, position or rotation box takes a formula, such as `wall * 2 + fit`. The box shows
  the answer underneath. If a formula has a problem, the box turns red and the part keeps its last good size.
- **Variables:** in the Variables panel (right side), press **+ Add variable**, give it a name like `wall`, and
  type a number. Change it later and every part that uses it updates. Renaming a variable updates every formula that uses it.
- **Fit gap:** the `fit` number (0.2 mm to start) is extra room for parts that slot together. Use it in formulas,
  for example a hole of `peg + 2 * fit`.
- **Text:** the 🔤 Text shape makes raised letters. Change the words in Properties.
- **Line up:** select two or more parts (Shift-click) and use the Line up buttons.
- **Snapping:** while dragging, a part snaps flush against parts within 2 mm. Hold **Shift** to move freely.
- **Workplane:** press 📐 Workplane, then click any face. New shapes are built on that face. **Ground** goes back to the floor.
```

Add `M2 Smart Sizes ✓` wherever the README lists milestones. If it has no such list, skip this.

- [ ] **Step 2: Mention text params in `plugins/README.md`**

Append:

```markdown
Parameters can be numbers (`mm`, `whole`, `number`, `angle`) or one line of text (`type: 'text'`,
up to 40 characters). `src/plugins/builtin/text.ts` shows a text parameter in use.
```

- [ ] **Step 3: Run every check**

```bash
npm run typecheck
npx vitest run
npm run coverage
npm run build
npm run e2e
```

Expected:
- Typecheck is clean.
- All unit tests pass.
- Coverage meets the 80/80/80/75 thresholds. If it falls short, report the numbers and the files that pull it down. Do not lower the thresholds or add filler tests.
- The build succeeds.
- All 5 end-to-end tests pass.

- [ ] **Step 4: Commit**

```bash
git add README.md plugins/README.md
git commit -m "docs: explain formulas, variables, text, line up, snapping and workplanes"
```

---

## Milestone 2 Done When

- Every size, position and rotation field accepts a number or a formula. It shows the result, or a plain-English problem, and keeps the last good number while a formula is broken.
- The Variables panel can add, rename (rewriting formulas), change and delete variables, and edit the `fit` gap. Loops and broken variables show inline.
- Milestone 1 designs and files open and upgrade to schema version 2 unchanged.
- The Text shape builds raised letters from the bundled OFL font in the worker, and has friendly messages for blank text or a missing font.
- Line up aligns two or more top-level parts by min, center or max on X, Y or Z.
- Dragging snaps faces and centers to parts within 2 mm (Shift turns it off) and shows live size and distance.
- The workplane tool puts new shapes on any clicked face, and Ground resets it.
- Typecheck, unit tests, coverage thresholds, the build, and all 5 end-to-end tests pass.
