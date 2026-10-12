# BloKade Milestone 4 ("Perfect Fit") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fit tools for parts that go together, all sized from the design's `fit` gap:
- a **Peg & socket** pair;
- **screw holes** (M2–M5: plain, countersunk, counterbored, nut trap, heat-set insert);
- a **threaded rod** and a **threaded hole**;
- a **snap-fit clip** and its **catch**;
- an **overlap check** that shows, in red, where two selected parts collide.

**Architecture:**
- **Fit tools are ordinary shape plugins.** The plugin model grows in three ways:
  - **choice parameters:** pick one option from a list, such as the screw size;
  - **starting formulas:** a clearance parameter starts as the formula `fit`, so changing the fit gap resizes every socket and hole;
  - **a starting mode:** sockets and screw holes are added as holes.
- **Matched pairs are "kits".** A kit adds a few parts at once and links their sizes through new design variables (`peg_size`, `peg_length`…). Linking through variables means the existing formula machinery keeps the pair matched, with no new mechanism.
- **Threads** are built as one closed mesh of flat triangles, which OpenCascade turns into a solid. Sweeping a profile along a helix crashed OpenCascade in a spike; the mesh approach builds an M8×20 rod in about 0.8 s.
- **The overlap check** intersects two top-level parts in the worker and returns the overlap's volume and mesh. The viewport draws that mesh in red.

**Tech Stack:** The same as Milestone 3: TypeScript 5.9 strict, React 19, Vite 8, three.js 0.186 with R3F 9 and drei 10, replicad 1.1 with OpenCascade WASM, Zustand 5, zod 4, Vitest 5 and Playwright. No new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-10-11-blokade-design.md`. This plan covers:
- the Milestone 4 row of §9;
- the §4 "Fit tools (C)" table;
- §5's param types (`choice`) and the rule that every built-in tool is a plugin;
- §6's per-object failure behaviour for the new plugins.

## Global Constraints

- **Earlier rules still apply.** Everything in the Milestone 1–3 plans' Global Constraints still applies:
  - Z-up, millimetres, degrees with Euler XYZ;
  - no `crypto.randomUUID`;
  - immutable document and store;
  - no `eval` or `new Function`;
  - files under 400 lines, functions under 50, nesting at most 4 levels;
  - no `console.log`;
  - plain-English messages an 11-year-old understands;
  - 80%+ line coverage on non-UI logic;
  - `Object.hasOwn` for node lookups;
  - the replicad ownership rule: `translate`, `rotate` and `mirror` consume their receiver, while `fuse`, `cut`, `intersect`, `fillet` and `chamfer` keep their inputs. Shapes in the Evaluator cache are cache-owned, so never delete or consume them;
  - conventional commits ending with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Every fit tool uses `fit`.** Each fit tool's clearance parameter is declared with `formula: 'fit'`, so it starts as that formula. Kade can overwrite it with a number or another formula.
  - Holes are enlarged by the clearance on every side. The cavity is `size + 2 × clearance`.
  - Pegs, rods and clips are never enlarged.
  - Exception: **heat-set inserts use their exact hole size**, because they melt in.
- **Screw sizes** (mm). The table lives in `src/plugins/fit-sizes.ts` and must be used verbatim:

  | Size | Screw ⌀ | Countersunk head ⌀ (90°) | Cap head ⌀ | Cap head height | Nut across flats | Nut height | Insert hole ⌀ | Insert length |
  |---|---|---|---|---|---|---|---|---|
  | M2 | 2 | 4.4 | 3.8 | 2 | 4 | 1.6 | 3.2 | 4 |
  | M3 | 3 | 6.72 | 5.5 | 3 | 5.5 | 2.4 | 4 | 5.7 |
  | M4 | 4 | 8.96 | 7 | 4 | 7 | 3.2 | 5.6 | 8.1 |
  | M5 | 5 | 11.2 | 8.5 | 5 | 8 | 4.7 | 6.4 | 9.5 |

- **Screw hole layout:** the hole runs from z = 0 to z = depth. The screw goes in from the top.
  - Countersink, counterbore and heat-set insert pockets sit at the **top**.
  - The nut-trap pocket sits at the **bottom**.
  - If the depth isn't more than the feature's own depth plus 1 mm, the error is "Make the hole deeper than X mm so the screw head fits." (X is formatted with at most 2 decimals; for nut traps and inserts, "the nut" or "the insert" replaces "the screw head".)
- **Thread sizes:** metric coarse pitch.

  | Size | M6 | M8 | M10 | M12 | M16 | M20 |
  |---|---|---|---|---|---|---|
  | Pitch (mm) | 1 | 1.25 | 1.5 | 1.75 | 2 | 2.5 |

- **Thread shape:**
  - Thread depth is 0.6 × pitch.
  - The profile over one pitch is: root flat 10%, rising flank 35%, crest flat 10%, falling flank 35%, root flat 10%.
  - The mesh uses 24 segments per turn and 6 rows per pitch.
  - At most **40 turns**. Longer threads fail with: "Threads can be up to 40 turns long — that's X mm for this size. Make it shorter."
- **Threaded holes are enlarged** by the clearance: the whole profile moves outward, so the hole is built as `thread(diameter + 2 × clearance, pitch, depth)`.
- **Choice parameters** are stored as their option's `value` string.
  - Unknown values become the default.
  - Choice parameters never hold formulas and never drive size handles.
- **Starting formulas** may only use `fit`, because `fit` is the one variable every design has. The registry rejects anything else.
- **Kits:**
  - A kit adds its variables and parts as a **single undo step**, and selects the new parts.
  - If a kit variable name is taken, every variable of that kit gets the same smallest free number suffix (`peg_size2`, `peg_length2`). The kit's formulas are renamed to match.
  - Parts are offset by the kit's offsets, turned with the workplane when a workplane is set.
- **Overlap check:**
  - Works on exactly two different **top-level** parts. A selected child counts as its top-level group.
  - Hidden parts and holes can be checked too.
  - Any overlap of 0.001 mm³ or less counts as "no overlap", so faces that merely touch don't count.
  - The result shows only while the design and the selection are unchanged since the check ran. Esc clears it.
- **Kid-facing names:** "Fit tools" (palette section), "Peg & socket", "Snap-fit clip", "Screw hole", "Threaded rod", "Threaded hole", "Extra room" (the clearance label), "🔍 Check overlap".
- **No schema change.** Choice values are strings, which schema v3 already allows, and kit links are ordinary variables and formulas.

## Review Focus

1. **Changing the `fit` gap after adding fit tools.** Expected:
   - Every socket, screw hole, threaded hole and catch resizes.
   - Pegs and rods don't.
   - Typing a number into "Extra room" stops that part following `fit`.

   Pinned in Task 2 (starting formulas follow `setFit`) and Task 8 (a kit's socket follows `fit` and the peg's size).
2. **Adding a kit twice, or when a variable name is taken.** Expected:
   - The second kit gets `peg_size2`/`peg_length2`, and its formulas point at those names.
   - The first pair is untouched.
   - One undo removes the whole kit.

   Pinned in Task 8.
3. **A screw hole too shallow for its head, nut or insert.** Expected: a plain-English problem on that part only, never a broken or inside-out shape. Pinned in Task 5.
4. **Threads at the edges.** Covers the finest size at the longest length, more than 40 turns, and a huge clearance on a small hole. Expected:
   - Too-long threads are refused instantly with the friendly message.
   - Allowed sizes build in a few seconds.
   - A rod fits inside its matching hole.

   Pinned in Task 3 (turn cap and timing) and Task 6 (the rod fits its hole).
5. **Overlap check with awkward picks:**
   - two parts of the same group;
   - a part with a build problem;
   - parts that only touch;
   - one part selected;
   - the design changing while the check runs.

   Expected: a clear message or "no overlap", never a crash or a stale red shape. Pinned in Task 9 (worker) and Task 10 (app).

---

## File Map

```
src/
├─ plugins/
│  ├─ types.ts                # ChoiceParamSpec, NumberParamSpec.formula, ShapePlugin.mode/.palette, isNumberSpec
│  ├─ params.ts               # normalizeChoiceParam; resolveParams handles choice
│  ├─ registry.ts             # validates choice specs, starting formulas, mode, palette
│  ├─ cad-types.ts            # CadToolkit.prism, CadToolkit.thread
│  ├─ cad.ts                  # prism + thread wiring
│  ├─ cad-thread.ts           # NEW threaded rod as a closed polyhedron; threadRadius; MAX_THREAD_TURNS
│  ├─ fit-sizes.ts            # NEW SCREWS, THREADS tables + choice option lists
│  ├─ kits.ts                 # NEW ShapeKit type, KITS, kitProblems
│  ├─ index.ts                # BUILTIN_ORDER grows
│  └─ builtin/
│     ├─ peg.ts, socket.ts                 # NEW
│     ├─ screw-hole.ts, screw-profile.ts   # NEW (profile math is pure + tested)
│     ├─ threaded-rod.ts, threaded-hole.ts # NEW
│     └─ snap-clip.ts, snap-catch.ts       # NEW
├─ document/factory.ts        # createShapeNode accepts mode
├─ geometry/
│  ├─ api.ts                  # overlap()
│  ├─ overlap.ts              # NEW intersect two top-level parts
│  ├─ client.ts, spawn.ts, geometry.worker.ts, types.ts   # overlap plumbing
├─ store/store.ts             # overlap view state
├─ store/overlap.ts           # NEW visibleOverlap()
├─ app/
│  ├─ add-part.ts             # NEW addPart(): defaults, mode, starting formulas
│  ├─ add-kit.ts              # NEW addKit(): variables + parts in one step
│  ├─ check-overlap.ts        # NEW runs the check, stores the result
│  ├─ actions.ts              # addShape via addPart; addKit; Esc clears overlap
│  ├─ field-normalizer.ts     # only number params are clamped as numbers
│  └─ testing/fakes.ts        # fake overlap
├─ viewport/OverlapMesh.tsx   # NEW red overlap
├─ viewport/Viewport.tsx      # renders OverlapMesh
└─ ui/
   ├─ ParamField.tsx          # NEW one control per parameter type (number / text / choice)
   ├─ PropertiesPanel.tsx     # uses ParamField; OverlapCheck in multi-select view
   ├─ OverlapCheck.tsx        # NEW button + result
   ├─ ShapePalette.tsx        # Shapes + Fit tools sections, kits first
   └─ Workspace.tsx           # passes KITS, onAddKit, onCheckOverlap
e2e/perfect-fit.spec.ts       # NEW
```

---

### Task 1: Choice parameters, starting formulas, hole-by-default and palette sections in the plugin model

**Files:**
- Modify: `src/plugins/types.ts`, `src/plugins/params.ts`, `src/plugins/registry.ts`, `src/app/field-normalizer.ts`, `src/ui/PropertiesPanel.tsx`, `src/ui/ShapePalette.tsx`
- Create: `src/ui/ParamField.tsx`
- Test: `src/plugins/params.test.ts`, `src/plugins/registry.test.ts`, `src/app/field-normalizer.test.ts`, `src/ui/ParamField.test.tsx`, `src/ui/ShapePalette.test.tsx`

**Interfaces:**
- Produces in `src/plugins/types.ts`:
  - `ChoiceOption { value: string; label: string }`
  - `ChoiceParamSpec { type: 'choice'; default: string; options: readonly ChoiceOption[]; label: string }`
  - `NumberParamSpec.formula?: string`
  - `ParamSpec = NumberParamSpec | TextParamSpec | ChoiceParamSpec`
  - `ShapePlugin.mode?: 'hole'`
  - `ShapePlugin.palette?: 'shapes' | 'fit' | 'hidden'`
  - `isNumberSpec(spec): spec is NumberParamSpec`
  - `ParamValuesOf` gives a choice param the union of its option values.
- Produces in `src/plugins/params.ts`: `normalizeChoiceParam(spec, raw): string`.
- Produces in `src/ui/ParamField.tsx`: `ParamField({ node, name, spec, errors, setField, setRaw })`, with test ids `param-<name>` (a `<select>` for choices).
- `ShapePalette` lists only plugins whose `palette` is missing or `'shapes'`, so fit plugins added in Tasks 4–7 stay out of the Shapes grid until Task 8 adds their section.

- [ ] **Step 1: Write the failing tests**

Add to `src/plugins/params.test.ts`:

```ts
import { normalizeChoiceParam, resolveParams } from './params'
import type { ChoiceParamSpec, ShapePlugin } from './types'

const sizeChoice: ChoiceParamSpec = {
  type: 'choice', default: 'M3', label: 'Size',
  options: [{ value: 'M2', label: 'M2' }, { value: 'M3', label: 'M3' }],
}

describe('choice params', () => {
  it('keeps known options and falls back to the default for anything else', () => {
    expect(normalizeChoiceParam(sizeChoice, 'M2')).toBe('M2')
    expect(normalizeChoiceParam(sizeChoice, 'M99')).toBe('M3')
    expect(normalizeChoiceParam(sizeChoice, 3)).toBe('M3')
    expect(normalizeChoiceParam(sizeChoice, undefined)).toBe('M3')
  })

  it('resolves choice params alongside numbers', () => {
    const plugin = { params: { size: sizeChoice, depth: { type: 'mm', default: 10, label: 'Depth' } } } as unknown as ShapePlugin
    expect(resolveParams(plugin, { size: 'nope', depth: 4 })).toEqual({ size: 'M3', depth: 4 })
  })
})
```

Add to `src/plugins/registry.test.ts`. Reuse that file's valid-plugin helper; if it has none, define `const valid = { id: 'thing', name: 'Thing', icon: '🧪', version: 1, params: {}, build: () => { throw new Error('unused') } }`.

```ts
describe('fit tool plugin fields', () => {
  const choice = { type: 'choice', default: 'a', label: 'Kind', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }

  it('accepts choice params, starting formulas that use fit, holes and palette sections', () => {
    const plugin = {
      ...valid, mode: 'hole', palette: 'fit',
      params: { kind: choice, gap: { type: 'mm', default: 0.2, min: 0, max: 2, label: 'Extra room', formula: 'fit' } },
    }
    expect(createRegistry([plugin]).problems).toEqual([])
  })

  it('rejects broken choice params and starting formulas', () => {
    const problemOf = (params: object) => createRegistry([{ ...valid, params }]).problems[0] ?? ''
    expect(problemOf({ kind: { ...choice, default: 'z' } })).toContain('one of its options')
    expect(problemOf({ kind: { ...choice, options: [{ value: 'a', label: 'A' }] } })).toContain('has a problem')
    expect(problemOf({ gap: { type: 'mm', default: 1, label: 'Gap', formula: 'wall * 2' } })).toContain('only use fit')
  })

  it("won't point a size handle at a choice", () => {
    const plugin = { ...valid, params: { kind: choice }, size: { x: 'kind' } }
    expect(createRegistry([plugin]).problems[0]).toContain("can't change")
  })
})
```

Add to `src/app/field-normalizer.test.ts`. Use that file's `normalize` setup, built with a registry that includes a test plugin whose `kind` param is a choice. If the existing setup only uses the real `registry`, build `createFieldNormalizer(createRegistry([testPlugin]).registry)` locally.

```ts
  it('leaves choice params alone', () => {
    const node = createShapeNode({ shapeType: 'picker', name: 'P', params: { kind: 'a', gap: 0 }, color: '#fff' })
    const pickerNormalize = createFieldNormalizer(createRegistry([{
      id: 'picker', name: 'Picker', icon: '🧪', version: 1, build: () => { throw new Error('unused') },
      params: {
        kind: { type: 'choice', default: 'a', label: 'Kind', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
        gap: { type: 'mm', default: 0, min: 0, max: 2, label: 'Gap' },
      },
    }]).registry)
    expect(pickerNormalize(node, 'param.gap', 9)).toBe(2)
    expect(pickerNormalize(node, 'param.kind', 9)).toBe(9)
  })
```

Create `src/ui/ParamField.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode } from '../document/ops'
import { createRegistry } from '../plugins/registry'
import { definePlugin } from '../plugins/types'
import { createBloKadeStore } from '../store/store'
import { PropertiesPanel } from './PropertiesPanel'

const picker = definePlugin({
  id: 'picker', name: 'Picker', icon: '🧪', version: 1,
  params: {
    kind: { type: 'choice', default: 'round', label: 'Shape', options: [{ value: 'round', label: 'Round' }, { value: 'square', label: 'Square' }] },
    size: { type: 'mm', default: 8, label: 'Size' },
  },
  build: () => { throw new Error('unused') },
})
const { registry } = createRegistry([picker])

function setup() {
  const node = createShapeNode({ id: 'p', shapeType: 'picker', name: 'Picker', params: { kind: 'round', size: 8 }, color: '#fff' })
  const store = createBloKadeStore({ designId: 'd', doc: addNode(createEmptyDocument(), node) })
  renderWithStore(<PropertiesPanel registry={registry} />, store)
  act(() => store.getState().select(['p']))
  return store
}

describe('ParamField', () => {
  it('shows a choice as a list and saves the picked option', async () => {
    const store = setup()
    const select = screen.getByTestId('param-kind')
    expect(select).toHaveValue('round')
    expect(screen.getByRole('option', { name: 'Square' })).toBeInTheDocument()
    await userEvent.selectOptions(select, 'square')
    expect(store.getState().history.present.nodes.p).toMatchObject({ params: { kind: 'square', size: 8 } })
  })

  it('still shows number params as value fields', () => {
    setup()
    expect(screen.getByTestId('param-size')).toHaveValue('8')
  })
})
```

Add to `src/ui/ShapePalette.test.tsx`. Add `createRegistry` and `definePlugin` imports if they're missing.

```tsx
  it('leaves fit and kit-only plugins out of the Shapes grid', () => {
    const plugin = (id: string, palette?: 'shapes' | 'fit' | 'hidden') => definePlugin({
      id, name: id, icon: '🧪', version: 1, palette, params: {}, build: () => { throw new Error('unused') },
    })
    const { registry: mixed } = createRegistry([plugin('plain'), plugin('listed', 'shapes'), plugin('fitty', 'fit'), plugin('secret', 'hidden')])
    render(<ShapePalette registry={mixed} onAdd={vi.fn()} />)
    expect(screen.getAllByRole('button').map((b) => b.dataset.testid)).toEqual(['add-plain', 'add-listed'])
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/plugins src/app/field-normalizer.test.ts src/ui/ParamField.test.tsx src/ui/ShapePalette.test.tsx`
Expected: FAIL. `normalizeChoiceParam` is missing, the choice spec is rejected, and `param-kind` is not found.

- [ ] **Step 3: Extend `src/plugins/types.ts`**

Add `formula` to `NumberParamSpec`:

```ts
  /** Starts as this formula instead of a plain number, e.g. 'fit' for a clearance. May only use `fit`. */
  readonly formula?: string
```

Below `TextParamSpec`, add:

```ts
export interface ChoiceOption {
  readonly value: string
  readonly label: string
}

/** Pick one from a list, like a screw size. Stored as the option's value; never holds a formula. */
export interface ChoiceParamSpec {
  readonly type: 'choice'
  readonly default: string
  readonly options: readonly ChoiceOption[]
  readonly label: string
}
```

Then make these changes:

```ts
export type ParamSpec = NumberParamSpec | TextParamSpec | ChoiceParamSpec

export const isNumberSpec = (spec: ParamSpec): spec is NumberParamSpec => spec.type !== 'text' && spec.type !== 'choice'

/** Distributes over a union, so a general ParamSpec gives number | string. Choices give the union of their option values. */
type ValueOf<S> = S extends ChoiceParamSpec ? S['options'][number]['value'] : S extends TextParamSpec ? string : number

type NumberParamKey<P extends ParamSpecs> = { [K in keyof P]: P[K] extends NumberParamSpec ? K : never }[keyof P] & string
```

Add to `ShapePlugin`:

```ts
  /** New parts of this kind start as holes (sockets, screw holes). Missing means solid. */
  readonly mode?: 'hole'
  /** Which palette section lists it. 'hidden' parts are only added by a kit. Missing means 'shapes'. */
  readonly palette?: 'shapes' | 'fit' | 'hidden'
```

- [ ] **Step 4: Normalise choices in `src/plugins/params.ts`**

```ts
import type { ChoiceParamSpec, NumberParamSpec, ParamSpec, ParamValues, ShapePlugin, TextParamSpec } from './types'
```

```ts
/** A known option's value, or the default. */
export function normalizeChoiceParam(spec: ChoiceParamSpec, raw: unknown): string {
  return typeof raw === 'string' && spec.options.some((o) => o.value === raw) ? raw : spec.default
}

function normalizeAny(spec: ParamSpec, raw: unknown): ParamValue {
  switch (spec.type) {
    case 'text': return normalizeTextParam(spec, raw)
    case 'choice': return normalizeChoiceParam(spec, raw)
    default: return normalizeParam(spec, raw)
  }
}
```

This replaces the old `normalizeAny` arrow function.

- [ ] **Step 5: Validate in `src/plugins/registry.ts`**

```ts
import { computeFormula, MAX_FORMULA_LENGTH } from '../formulas/formula'
import { isNumberSpec, type ShapePlugin } from './types'
```

```ts
const numberSpec = z.object({
  type: z.enum(['mm', 'whole', 'number', 'angle']),
  default: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
  label: z.string().min(1),
  formula: z.string().min(1).max(MAX_FORMULA_LENGTH).optional(),
})
const choiceSpec = z.object({
  type: z.literal('choice'),
  default: z.string(),
  options: z.array(z.object({ value: z.string().min(1).max(40), label: z.string().min(1) })).min(2),
  label: z.string().min(1),
}).refine((s) => s.options.some((o) => o.value === s.default), 'a choice default must be one of its options')
const paramSpec = z.union([numberSpec, textSpec, choiceSpec])

/** Starting formulas may only use `fit`: it's the one variable every design has. */
const FIT_ONLY = new Map([['fit', 0.2]])
```

Add to `pluginSchema`'s object: `mode: z.literal('hole').optional(), palette: z.enum(['shapes', 'fit', 'hidden']).optional(),`. In `superRefine`, replace the size-handle loop and add a formula check:

```ts
  .superRefine((p, ctx) => {
    for (const target of Object.values(p.size ?? {})) {
      if (!target) continue
      const spec = Object.hasOwn(p.params, target) ? p.params[target] : undefined
      if (!spec) ctx.addIssue({ code: 'custom', message: `size handle points at missing parameter "${target}"` })
      else if (!isNumberSpec(spec)) ctx.addIssue({ code: 'custom', message: `size handle can't change the ${spec.type} parameter "${target}"` })
    }
    for (const [name, spec] of Object.entries(p.params)) {
      if (!isNumberSpec(spec) || spec.formula === undefined) continue
      if (!computeFormula(spec.formula, FIT_ONLY).ok) {
        ctx.addIssue({ code: 'custom', message: `the starting formula of "${name}" may only use fit` })
      }
    }
  })
```

zod's inferred type for `params` now includes the choice shape. `isNumberSpec` takes a `ParamSpec`. If the inferred type isn't assignable, cast with `spec as ParamSpec` (import the type) and mention it in your report.

- [ ] **Step 6: Only clamp number params in `src/app/field-normalizer.ts`**

```ts
import { isNumberSpec } from '../plugins/types'
```

```ts
    return spec && isNumberSpec(spec) ? normalizeParam(spec, value) : value
```

- [ ] **Step 7: Write `src/ui/ParamField.tsx` and use it in `PropertiesPanel`**

```tsx
import { formulaOf, paramField } from '../document/fields'
import type { FieldKey, ShapeNode } from '../document/types'
import type { NumberParamType, ParamSpec } from '../plugins/types'
import { TextField } from './NumberField'
import { ValueField } from './ValueField'

const UNIT: Record<NumberParamType, string> = { mm: ' (mm)', angle: ' (°)', whole: '', number: '' }

interface ParamFieldProps {
  node: ShapeNode
  name: string
  spec: ParamSpec
  errors: Readonly<Record<string, string>>
  setField(key: FieldKey, text: string): void
  /** Saves a text or choice parameter as-is. */
  setRaw(name: string, value: string): void
}

/** The right control for one shape parameter: a number/formula box, a line of text, or a list of options. */
export function ParamField({ node, name, spec, errors, setField, setRaw }: ParamFieldProps) {
  const raw = node.params[name]
  if (spec.type === 'text') {
    return <TextField label={spec.label} value={typeof raw === 'string' ? raw : spec.default} testId={`param-${name}`}
      onCommit={(text) => setRaw(name, text)} />
  }
  if (spec.type === 'choice') {
    return (
      <label className="field">
        <span>{spec.label}</span>
        <select data-testid={`param-${name}`} value={typeof raw === 'string' ? raw : spec.default}
          onChange={(e) => setRaw(name, e.target.value)}>
          {spec.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
    )
  }
  const field = paramField(name)
  return <ValueField label={`${spec.label}${UNIT[spec.type]}`} value={typeof raw === 'number' ? raw : spec.default}
    formula={formulaOf(node, field)} error={errors[field]} testId={`param-${name}`} onCommit={(text) => setField(field, text)} />
}
```

In `PropertiesPanel.tsx`, replace the body of `ShapeParams`'s map with `ParamField`, and delete the now-unused `UNIT` constant, `TextField` import, `formulaOf`/`paramField` imports (if unused) and `NumberParamType` import:

```tsx
function ShapeParams({ node, errors, setField, registry }: FieldsProps & { node: ShapeNode; registry: PluginRegistry }) {
  const apply = useBloKade((s) => s.apply)
  const plugin = registry.get(node.shapeType)
  if (!plugin) return <p className="error-text">This shape's plugin is missing, so its size can't be changed.</p>
  const setRaw = (key: string, value: string): void => apply((d) => updateNode(d, node.id, (n) => (
    n.kind === 'shape' ? { ...n, params: resolveParams(plugin, { ...n.params, [key]: value }) } : n
  )))
  return (
    <>
      <h3>Size</h3>
      {Object.entries<ParamSpec>(plugin.params).map(([key, spec]) => (
        <ParamField key={key} node={node} name={key} spec={spec} errors={errors} setField={setField} setRaw={setRaw} />
      ))}
    </>
  )
}
```

- [ ] **Step 8: Keep fit plugins out of the Shapes grid**

In `src/ui/ShapePalette.tsx`, change `registry.list().map(` to:

```tsx
        {registry.list().filter((plugin) => (plugin.palette ?? 'shapes') === 'shapes').map((plugin) => (
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS, typecheck clean. If code that switches over `spec.type` stops compiling (for example the size handles' `scaleParam`), narrow it with `isNumberSpec` and list the file in your report.

- [ ] **Step 10: Commit**

```bash
git add src
git commit -m "feat: let plugins have choice params, starting formulas and hole defaults"
```

---

### Task 2: New parts start from their plugin's defaults

**Files:**
- Create: `src/app/add-part.ts`
- Modify: `src/document/factory.ts`, `src/app/actions.ts`
- Test: `src/app/add-part.test.ts`, `src/document/factory.test.ts`

**Interfaces:**
- Consumes:
  - from Task 1: `isNumberSpec`, `NumberParamSpec.formula` and `ShapePlugin.mode`;
  - `setFieldInput`, `paramField`, `defaultParams`, `createShapeNode` and `addNode`.
- Produces:
  - `createShapeNode({ …, mode?: Mode })`
  - `startingFormulas(plugin): Record<string, string>`
  - `addPart(doc, plugin, input: { color; name?; position?; rotation?; formulas? }, normalize): { doc; id }`
  - `Actions.addShape` now goes through `addPart`.

- [ ] **Step 1: Write the failing tests**

In `src/document/factory.test.ts`, add:

```ts
  it('makes hole parts when asked', () => {
    expect(createShapeNode({ shapeType: 'box', name: 'B', params: {}, color: '#fff', mode: 'hole' }).mode).toBe('hole')
    expect(createShapeNode({ shapeType: 'box', name: 'B', params: {}, color: '#fff' }).mode).toBe('solid')
  })
```

Create `src/app/add-part.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { setFit, addVariable } from '../document/variable-ops'
import { createRegistry } from '../plugins/registry'
import { definePlugin } from '../plugins/types'
import { addPart, startingFormulas } from './add-part'
import { createFieldNormalizer } from './field-normalizer'

const gapBox = definePlugin({
  id: 'gap-box', name: 'Gap box', icon: '🧪', version: 1, mode: 'hole',
  params: {
    width: { type: 'mm', default: 10, label: 'Width' },
    gap: { type: 'mm', default: 0, min: 0, max: 2, label: 'Extra room', formula: 'fit' },
  },
  build: () => { throw new Error('unused') },
})
const { registry } = createRegistry([gapBox])
const normalize = createFieldNormalizer(registry)

describe('addPart', () => {
  it('lists starting formulas', () => {
    expect(startingFormulas(gapBox)).toEqual({ gap: 'fit' })
  })

  it('starts a part with its default sizes, mode and formulas', () => {
    const { doc, id } = addPart(createEmptyDocument(), gapBox, { color: '#f00', position: [5, 0, 0] }, normalize)
    expect(doc.nodes[id]).toMatchObject({
      name: 'Gap box', mode: 'hole', params: { width: 10, gap: 0.2 }, formulas: { 'param.gap': 'fit' },
      transform: { position: [5, 0, 0] },
    })
  })

  it('follows the fit gap until Kade types a number (Review Focus 1)', () => {
    const { doc, id } = addPart(createEmptyDocument(), gapBox, { color: '#f00' }, normalize)
    expect(setFit(doc, 0.5, normalize).nodes[id]?.params).toMatchObject({ gap: 0.5 })
  })

  it('takes extra formulas from a kit', () => {
    const withVar = addVariable(createEmptyDocument(), 'peg_size', '8', normalize)
    const { doc, id } = addPart(withVar, gapBox, { color: '#f00', name: 'Socket', formulas: { width: 'peg_size + 2' } }, normalize)
    expect(doc.nodes[id]).toMatchObject({ name: 'Socket', params: { width: 10, gap: 0.2 }, formulas: { 'param.width': 'peg_size + 2' } })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/add-part.test.ts src/document/factory.test.ts`
Expected: FAIL. The module is missing and `mode` is ignored.

- [ ] **Step 3: Implement**

`src/document/factory.ts`: add `mode?: Mode` to `createShapeNode`'s input type (import `Mode` from `./types` if it isn't already imported) and set `mode: input.mode ?? 'solid'`.

`src/app/add-part.ts`:

```ts
import { paramField } from '../document/fields'
import { setFieldInput, type NormalizeField } from '../document/formula-ops'
import { createShapeNode } from '../document/factory'
import { addNode } from '../document/ops'
import type { BloKadeDocument, NodeId, Vec3 } from '../document/types'
import { defaultParams } from '../plugins/params'
import { isNumberSpec, type ParamSpec, type ShapePlugin } from '../plugins/types'

export interface NewPart {
  readonly color: string
  readonly name?: string
  readonly position?: Vec3
  readonly rotation?: Vec3
  /** Extra formulas by parameter name, for example a kit's `{ size: 'peg_size' }`. */
  readonly formulas?: Readonly<Record<string, string>>
}

/** Parameters that start as a formula, like a clearance of `fit`. */
export function startingFormulas(plugin: ShapePlugin): Record<string, string> {
  return Object.fromEntries(Object.entries<ParamSpec>(plugin.params).flatMap(([name, spec]) =>
    isNumberSpec(spec) && spec.formula !== undefined ? [[name, spec.formula] as const] : []))
}

/** Adds a new part with its plugin's default sizes, its starting mode and its starting formulas. */
export function addPart(
  doc: BloKadeDocument, plugin: ShapePlugin, input: NewPart, normalize: NormalizeField,
): { doc: BloKadeDocument; id: NodeId } {
  const node = createShapeNode({
    shapeType: plugin.id, name: input.name ?? plugin.name, params: defaultParams(plugin), color: input.color,
    position: input.position, rotation: input.rotation, mode: plugin.mode ?? 'solid',
  })
  const formulas = { ...startingFormulas(plugin), ...input.formulas }
  const withFormulas = Object.entries(formulas).reduce(
    (d, [name, text]) => setFieldInput(d, node.id, paramField(name), text, normalize), addNode(doc, node))
  return { doc: withFormulas, id: node.id }
}
```

`src/app/actions.ts`: import `addPart` and `createFieldNormalizer`, and create `const normalize = createFieldNormalizer(registry)` at the top of `createActions`. Replace the body of `addShape` after the plugin check:

```ts
      const color = pickColor(Object.keys(state().history.present.nodes).length)
      const workplane = state().workplane
      selectIf(run(store, (doc) => {
        const { doc: next, id } = addPart(doc, plugin, { color, position: workplane?.origin, rotation: workplane?.rotation }, normalize)
        return { doc: next, value: [id] }
      }))
```

Remove the now-unused `createShapeNode`, `defaultParams` and `addNode` imports from `actions.ts` if nothing else uses them.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: start new parts with their plugin's formulas and mode"
```

---

### Task 3: Prisms and threads in the `cad` toolkit

**Files:**
- Create: `src/plugins/cad-thread.ts`
- Modify: `src/plugins/cad-types.ts`, `src/plugins/cad.ts`
- Test: `src/plugins/cad-thread.test.ts`, `src/plugins/cad.test.ts`

**Interfaces:**
- Produces:
  - `CadToolkit.prism(outline: readonly Point2[], height: number): Shape3D`
  - `CadToolkit.thread(diameter: number, pitch: number, length: number): Shape3D`
  - `threadRadius(u: number, outer: number, depth: number): number`
  - `makeThread(diameter, pitch, length): Shape3D`
  - Constants: `MAX_THREAD_TURNS = 40`, `THREAD_SEGMENTS = 24`, `THREAD_ROWS_PER_PITCH = 6`, `THREAD_DEPTH_RATIO = 0.6`

- [ ] **Step 1: Write the failing tests**

`src/plugins/cad-thread.test.ts`:

```ts
import { measureVolume, type Shape3D } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { initTestOC } from '../geometry/testing/oc-node'
import { createCadToolkit } from './cad'
import { makeThread, MAX_THREAD_TURNS, threadRadius } from './cad-thread'

beforeAll(initTestOC)

function boundsOf(shape: Shape3D): number[][] {
  const box = shape.boundingBox
  try {
    return box.bounds.map((p) => p.map((v) => Math.round(v * 100) / 100))
  } finally {
    box.delete()
  }
}

describe('threadRadius', () => {
  it('follows root, flank, crest, flank, root over one pitch', () => {
    expect(threadRadius(0.05, 4, 0.75)).toBe(3.25)
    expect(threadRadius(0.275, 4, 0.75)).toBeCloseTo(3.625, 6)
    expect(threadRadius(0.5, 4, 0.75)).toBe(4)
    expect(threadRadius(0.725, 4, 0.75)).toBeCloseTo(3.625, 6)
    expect(threadRadius(0.95, 4, 0.75)).toBe(3.25)
    expect(threadRadius(1.5, 4, 0.75)).toBe(4)
    expect(threadRadius(-0.5, 4, 0.75)).toBe(4)
  })
})

describe('makeThread', () => {
  it('builds an M8 rod sitting on the ground', () => {
    const started = Date.now()
    const rod = makeThread(8, 1.25, 20)
    const elapsed = Date.now() - started
    const [[x0, , z0], [x1, , z1]] = boundsOf(rod)
    expect([x0, x1, z0, z1]).toEqual([-4, 4, 0, 20])
    const volume = measureVolume(rod)
    expect(volume).toBeGreaterThan(Math.PI * 3.25 ** 2 * 20)
    expect(volume).toBeLessThan(Math.PI * 4 ** 2 * 20)
    expect(elapsed).toBeLessThan(5000)
    rod.delete()
  })

  it('can be cut out of a block (Review Focus 4)', () => {
    const rod = makeThread(8, 1.25, 20)
    const block = createCadToolkit().box(20, 20, 15)
    const cut = block.cut(rod)
    try {
      const removed = 20 * 20 * 15 - measureVolume(cut)
      expect(removed).toBeGreaterThan(Math.PI * 3.25 ** 2 * 15)
      expect(removed).toBeLessThan(Math.PI * 4 ** 2 * 15)
    } finally {
      rod.delete()
      block.delete()
      cut.delete()
    }
  })

  it('refuses threads longer than the turn limit before building anything (Review Focus 4)', () => {
    const started = Date.now()
    expect(() => makeThread(6, 1, MAX_THREAD_TURNS + 1))
      .toThrow("Threads can be up to 40 turns long — that's 40 mm for this size. Make it shorter.")
    expect(Date.now() - started).toBeLessThan(100)
  })

  it('builds the longest allowed fine thread in a few seconds (Review Focus 4)', () => {
    const started = Date.now()
    const rod = makeThread(6, 1, 40)
    expect(Date.now() - started).toBeLessThan(8000)
    rod.delete()
  })

  it('explains sizes that make no thread', () => {
    expect(() => makeThread(1, 2, 10)).toThrow('That thread is too fine for its size.')
    expect(() => makeThread(8, 0, 10)).toThrow('That thread is too fine for its size.')
  })
})
```

Add to `src/plugins/cad.test.ts`. Follow that file's style: it already calls `initTestOC` and builds a toolkit.

```ts
  it('pushes a flat outline straight up', () => {
    const cad = createCadToolkit()
    const hex = cad.prism([[2, 0], [1, 1.7320508], [-1, 1.7320508], [-2, 0], [-1, -1.7320508], [1, -1.7320508]], 3)
    expect(measureVolume(hex)).toBeCloseTo(((3 * Math.sqrt(3)) / 2) * 4 * 3, 3)
    hex.delete()
  })

  it('makes threads through the toolkit', () => {
    const rod = createCadToolkit().thread(8, 1.25, 10)
    expect(measureVolume(rod)).toBeGreaterThan(0)
    rod.delete()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/plugins/cad-thread.test.ts src/plugins/cad.test.ts`
Expected: FAIL. The module and toolkit methods are missing.

- [ ] **Step 3: Write `src/plugins/cad-thread.ts`**

```ts
import { makePolygon, makeSolid, type Face, type Shape3D } from 'replicad'

export const THREAD_SEGMENTS = 24
export const THREAD_ROWS_PER_PITCH = 6
export const THREAD_DEPTH_RATIO = 0.6
/** About 2 s to build at the limit (M6 × 40 mm). Longer threads would freeze the geometry engine. */
export const MAX_THREAD_TURNS = 40

type Point3 = [number, number, number]

const fmt = (n: number): string => String(Math.round(n * 100) / 100)

/** Distance from the axis at `u` pitches along the thread: root flat, rising flank, crest flat, falling flank, root flat. */
export function threadRadius(u: number, outer: number, depth: number): number {
  const t = ((u % 1) + 1) % 1
  const inner = outer - depth
  if (t < 0.1 || t >= 0.9) return inner
  if (t < 0.45) return inner + ((t - 0.1) / 0.35) * depth
  if (t < 0.55) return outer
  return outer - ((t - 0.55) / 0.35) * depth
}

function checkThread(diameter: number, pitch: number, length: number): void {
  const depth = pitch * THREAD_DEPTH_RATIO
  if (!(pitch > 0) || diameter / 2 - depth < 0.25) throw new Error('That thread is too fine for its size.')
  if (length / pitch > MAX_THREAD_TURNS) {
    throw new Error(`Threads can be up to ${MAX_THREAD_TURNS} turns long — that's ${fmt(MAX_THREAD_TURNS * pitch)} mm for this size. Make it shorter.`)
  }
}

/** Points of the rod's surface on a grid of angle steps (i) and height rows (j). */
function surfacePoint(diameter: number, pitch: number, length: number, rows: number) {
  const outer = diameter / 2
  const depth = pitch * THREAD_DEPTH_RATIO
  return (i: number, j: number): Point3 => {
    const angle = (2 * Math.PI * i) / THREAD_SEGMENTS
    const z = (length * j) / rows
    const r = threadRadius(z / pitch - i / THREAD_SEGMENTS, outer, depth)
    return [r * Math.cos(angle), r * Math.sin(angle), z]
  }
}

function threadFaces(diameter: number, pitch: number, length: number): Face[] {
  const rows = Math.max(1, Math.round((length / pitch) * THREAD_ROWS_PER_PITCH))
  const at = surfacePoint(diameter, pitch, length, rows)
  const sides = Array.from({ length: rows * THREAD_SEGMENTS }, (_, k) => {
    const i = k % THREAD_SEGMENTS
    const j = Math.floor(k / THREAD_SEGMENTS)
    const [a, b, c, d] = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]
    return [makePolygon([a, b, c]), makePolygon([a, c, d])]
  }).flat()
  const ring = (j: number): Point3[] => Array.from({ length: THREAD_SEGMENTS }, (_, i) => at(i, j))
  return [...sides, makePolygon(ring(0).reverse()), makePolygon(ring(rows))]
}

/** A metric-style threaded rod, centered on X/Y and sitting on z = 0, as one closed solid. */
export function makeThread(diameter: number, pitch: number, length: number): Shape3D {
  checkThread(diameter, pitch, length)
  const faces = threadFaces(diameter, pitch, length)
  try {
    return makeSolid(faces)
  } finally {
    for (const face of faces) face.delete()
  }
}
```

If `makeSolid` turns out to take ownership of the faces (a double free shows up as a WASM error in the tests), drop the `finally` cleanup and say so in your report. If the solid comes out inside-out (negative volume), reverse the bottom/top cap order and the triangle winding together, and report that too.

- [ ] **Step 4: Add both methods to the toolkit**

`src/plugins/cad-types.ts`, inside `CadToolkit`:

```ts
  /** Push a flat [x, y] outline straight up from z = 0 (hexagons, slots…). */
  prism(outline: readonly Point2[], height: number): Shape3D
  /** Metric-style threaded rod, centered on X/Y, sitting on z = 0. Up to 40 turns long. */
  thread(diameter: number, pitch: number, length: number): Shape3D
```

`src/plugins/cad.ts`: import `makeThread` from `./cad-thread`, and add to the returned object:

```ts
    prism: (outline, height) => asSolid(profileDrawing(outline).sketchOnPlane('XY').extrude(height) as Shape3D),
    thread: (diameter, pitch, length) => makeThread(diameter, pitch, length),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/plugins && npm run typecheck`
Expected: PASS, typecheck clean. Report the measured build times for M8×20 and M6×40.

- [ ] **Step 6: Commit**

```bash
git add src/plugins
git commit -m "feat: add prisms and printable threads to the cad toolkit"
```

---

### Task 4: Peg and socket plugins

**Files:**
- Create: `src/plugins/builtin/peg.ts`, `src/plugins/builtin/socket.ts`
- Modify: `src/plugins/index.ts`
- Test: `src/plugins/builtin/fit-tools.test.ts`, `src/plugins/builtin/builtin.test.ts`

**Interfaces:**
- Consumes: Task 1's choice params, starting formula, `mode` and `palette`.
- Produces plugin `peg`:
  - params `shape: 'round' | 'square'`, `size` (default 8), `length` (default 10)
  - solid, `palette: 'hidden'`
- Produces plugin `socket`:
  - params `shape`, `size` (default 8), `depth` (default 11), `clearance` (formula `fit`)
  - hole, `palette: 'hidden'`
- `BUILTIN_ORDER` grows to the shapes, then `'peg', 'socket', 'screw-hole', 'threaded-rod', 'threaded-hole', 'snap-clip', 'snap-catch'`.

- [ ] **Step 1: Write the failing test `src/plugins/builtin/fit-tools.test.ts`**

```ts
import { measureVolume, type Shape3D } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { initTestOC } from '../../geometry/testing/oc-node'
import { createCadToolkit } from '../cad'
import { registry } from '../index'
import { defaultParams, resolveParams } from '../params'

beforeAll(initTestOC)

export function build(id: string, overrides: Record<string, number | string> = {}): Shape3D {
  const plugin = registry.get(id)
  if (!plugin) throw new Error(`missing plugin ${id}`)
  return plugin.build(resolveParams(plugin, { ...defaultParams(plugin), ...overrides }), createCadToolkit())
}

export function volumeOf(shape: Shape3D): number {
  try {
    return measureVolume(shape)
  } finally {
    shape.delete()
  }
}

describe('peg and socket', () => {
  it('builds round and square pegs', () => {
    expect(volumeOf(build('peg'))).toBeCloseTo(Math.PI * 16 * 10, 1)
    expect(volumeOf(build('peg', { shape: 'square' }))).toBeCloseTo(640, 3)
  })

  it('makes the socket bigger than the peg by the extra room on every side', () => {
    expect(volumeOf(build('socket', { clearance: 0.2 }))).toBeCloseTo(Math.PI * 4.2 ** 2 * 11, 1)
    expect(volumeOf(build('socket', { shape: 'square', clearance: 0.5 }))).toBeCloseTo(9 * 9 * 11, 3)
  })

  it('starts sockets as holes that follow fit', () => {
    const socket = registry.get('socket')
    expect(socket?.mode).toBe('hole')
    expect(socket?.params.clearance).toMatchObject({ formula: 'fit' })
    expect(registry.get('peg')?.mode).toBeUndefined()
  })
})
```

In `src/plugins/builtin/builtin.test.ts`, change the registered-list expectation to the ids that exist after this task:

```ts
    expect(registry.list().map((p) => p.id)).toEqual(['box', 'cylinder', 'sphere', 'cone', 'wedge', 'torus', 'text', 'peg', 'socket'])
```

Rename the test to "registers every built-in in palette order with no problems". Later tasks extend this list.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/plugins/builtin`
Expected: FAIL with "missing plugin peg".

- [ ] **Step 3: Write the plugins**

`src/plugins/builtin/peg.ts`:

```ts
import { definePlugin } from '../types'

/** A round or square pin. Its socket (added with it by the Peg & socket kit) is a little bigger by `fit`. */
export default definePlugin({
  id: 'peg',
  name: 'Peg',
  icon: '📌',
  version: 1,
  palette: 'hidden',
  params: {
    shape: { type: 'choice', default: 'round', label: 'Shape', options: [{ value: 'round', label: 'Round' }, { value: 'square', label: 'Square' }] },
    size: { type: 'mm', default: 8, min: 1, max: 100, label: 'Size across' },
    length: { type: 'mm', default: 10, min: 1, max: 200, label: 'Length' },
  },
  size: { x: 'size', y: 'size', z: 'length' },
  build: ({ shape, size, length }, cad) => (shape === 'square' ? cad.box(size, size, length) : cad.cylinder(size, length)),
})
```

`src/plugins/builtin/socket.ts`:

```ts
import { definePlugin } from '../types'

/** The hole a peg slides into: the peg's size plus extra room on every side. */
export default definePlugin({
  id: 'socket',
  name: 'Socket',
  icon: '⭕',
  version: 1,
  mode: 'hole',
  palette: 'hidden',
  params: {
    shape: { type: 'choice', default: 'round', label: 'Shape', options: [{ value: 'round', label: 'Round' }, { value: 'square', label: 'Square' }] },
    size: { type: 'mm', default: 8, min: 1, max: 100, label: 'Peg size' },
    depth: { type: 'mm', default: 11, min: 1, max: 200, label: 'Depth' },
    clearance: { type: 'mm', default: 0.2, min: 0, max: 2, label: 'Extra room', formula: 'fit' },
  },
  size: { z: 'depth' },
  build: ({ shape, size, depth, clearance }, cad) => {
    const across = size + 2 * clearance
    return shape === 'square' ? cad.box(across, across, depth) : cad.cylinder(across, depth)
  },
})
```

`src/plugins/index.ts`:

```ts
const BUILTIN_ORDER = [
  'box', 'cylinder', 'sphere', 'cone', 'wedge', 'torus', 'text',
  'peg', 'socket', 'screw-hole', 'threaded-rod', 'threaded-hole', 'snap-clip', 'snap-catch',
]
```

`orderOf` matches `/${name}.ts` at the end of the path, so `screw-hole.ts` sorts correctly.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/plugins && npm run typecheck`
Expected: PASS. `ShapePalette.test.tsx` still sees 7 shape buttons, because Task 1 keeps `palette: 'hidden'` plugins out of the Shapes grid.

- [ ] **Step 5: Commit**

```bash
git add src/plugins
git commit -m "feat: add peg and socket fit plugins"
```

---

### Task 5: Screw hole plugin

**Files:**
- Create: `src/plugins/fit-sizes.ts`, `src/plugins/builtin/screw-profile.ts`, `src/plugins/builtin/screw-hole.ts`
- Test: `src/plugins/builtin/screw-profile.test.ts`, `src/plugins/builtin/fit-tools.test.ts`, `src/plugins/builtin/builtin.test.ts`

**Interfaces:**
- Produces:
  - `SCREWS: Record<ScrewSize, ScrewSpec>` and `SCREW_SIZE_OPTIONS`
  - `THREADS: Record<ThreadSize, { diameter; pitch }>` and `THREAD_SIZE_OPTIONS` (used in Task 6)
  - `screwHoleProfile(screw, style, depth, clearance): Point2[]` (a pure [radius, z] outline for `cad.revolve`)
  - `hexOutline(acrossFlats): Point2[]`
- Produces plugin `screw-hole`:
  - params `size` (M2–M5, default M3), `style` (plain | countersunk | counterbored | nut | insert, default plain), `depth` (default 10), `clearance` (formula `fit`)
  - hole, `palette: 'fit'`

- [ ] **Step 1: Write the failing tests**

`src/plugins/builtin/screw-profile.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { SCREWS } from '../fit-sizes'
import { hexOutline, screwHoleProfile } from './screw-profile'

const m3 = SCREWS.M3

describe('screwHoleProfile', () => {
  it('makes a plain hole enlarged by the extra room', () => {
    expect(screwHoleProfile(m3, 'plain', 10, 0.2)).toEqual([[0, 0], [1.7, 0], [1.7, 10], [0, 10]])
  })

  it('cuts a 90° countersink at the top', () => {
    const profile = screwHoleProfile(m3, 'countersunk', 10, 0.2)
    expect(profile).toHaveLength(5)
    expect(profile[2]?.[0]).toBeCloseTo(1.7, 6)
    expect(profile[2]?.[1]).toBeCloseTo(10 - (3.56 - 1.7), 6)
    expect(profile[3]?.[0]).toBeCloseTo(3.56, 6)
  })

  it('cuts a counterbore for the cap head at the top', () => {
    expect(screwHoleProfile(m3, 'counterbored', 10, 0.2)).toEqual([[0, 0], [1.7, 0], [1.7, 6.8], [2.95, 6.8], [2.95, 10], [0, 10]])
  })

  it('uses the exact insert size, without extra room', () => {
    expect(screwHoleProfile(m3, 'insert', 10, 0.2)).toEqual([[0, 0], [1.7, 0], [1.7, 4.3], [2, 4.3], [2, 10], [0, 10]])
  })

  it('refuses holes too shallow for the head, nut or insert (Review Focus 3)', () => {
    expect(() => screwHoleProfile(m3, 'countersunk', 2, 0.2)).toThrow('Make the hole deeper than 2.86 mm so the screw head fits.')
    expect(() => screwHoleProfile(m3, 'counterbored', 4, 0.2)).toThrow('Make the hole deeper than 4.2 mm so the screw head fits.')
    expect(() => screwHoleProfile(m3, 'insert', 6, 0.2)).toThrow('Make the hole deeper than 6.7 mm so the insert fits.')
    expect(() => screwHoleProfile(m3, 'nut', 3, 0.2)).toThrow('Make the hole deeper than 3.6 mm so the nut fits.')
  })
})

describe('hexOutline', () => {
  it('makes a hexagon with the given size across its flats', () => {
    const points = hexOutline(5.5)
    expect(points).toHaveLength(6)
    const ys = points.map(([, y]) => y)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(5.5, 6)
  })
})
```

Add to `src/plugins/builtin/fit-tools.test.ts`. It already exports `build` and `volumeOf`; add `import type { Shape3D } from 'replicad'` if needed.

```ts
describe('screw hole', () => {
  const radiusAtTop = (shape: Shape3D): number => {
    const box = shape.boundingBox
    try {
      return box.bounds[1][0]
    } finally {
      box.delete()
      shape.delete()
    }
  }

  it('builds a plain M3 hole enlarged by the extra room', () => {
    expect(volumeOf(build('screw-hole', { clearance: 0.2 }))).toBeCloseTo(Math.PI * 1.7 ** 2 * 10, 1)
  })

  it('builds every style for every size', () => {
    for (const size of ['M2', 'M3', 'M4', 'M5']) {
      for (const style of ['plain', 'countersunk', 'counterbored', 'nut', 'insert']) {
        expect(volumeOf(build('screw-hole', { size, style, depth: 15 }))).toBeGreaterThan(0)
      }
    }
  })

  it('makes the countersink wide enough for the head', () => {
    expect(radiusAtTop(build('screw-hole', { style: 'countersunk', clearance: 0.2 }))).toBeCloseTo(3.56, 3)
  })

  it('fits an M3 nut in the trap', () => {
    const hole = build('screw-hole', { style: 'nut', clearance: 0.2 })
    expect(radiusAtTop(hole)).toBeCloseTo(5.9 / Math.sqrt(3), 3)
  })

  it('reports a hole too shallow for its head (Review Focus 3)', () => {
    expect(() => build('screw-hole', { style: 'counterbored', depth: 3 })).toThrow('so the screw head fits')
  })

  it('starts as a hole that follows fit', () => {
    const plugin = registry.get('screw-hole')
    expect(plugin).toMatchObject({ mode: 'hole', palette: 'fit' })
    expect(plugin?.params.clearance).toMatchObject({ formula: 'fit' })
  })
})
```

The nut test reads the bounding box's largest x. The hexagon's corners point along ±X, so the largest x is the corner radius `(5.5 + 0.4) / √3`, which beats the plain hole's 1.7.

In `builtin.test.ts`, append `'screw-hole'` to the expected id list.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/plugins/builtin`
Expected: FAIL. The modules are missing.

- [ ] **Step 3: Write `src/plugins/fit-sizes.ts`**

```ts
import type { ChoiceOption } from './types'

/** ISO sizes in mm. Countersunk heads are ISO 10642 (M2 scaled to match); cap heads ISO 4762; nuts ISO 4032. */
export interface ScrewSpec {
  readonly diameter: number
  readonly countersunkHead: number
  readonly capHead: number
  readonly capHeight: number
  readonly nutFlats: number
  readonly nutHeight: number
  /** Heat-set insert hole (exact, no extra room) and insert length. */
  readonly insertHole: number
  readonly insertLength: number
}

export type ScrewSize = 'M2' | 'M3' | 'M4' | 'M5'

export const SCREWS: Readonly<Record<ScrewSize, ScrewSpec>> = {
  M2: { diameter: 2, countersunkHead: 4.4, capHead: 3.8, capHeight: 2, nutFlats: 4, nutHeight: 1.6, insertHole: 3.2, insertLength: 4 },
  M3: { diameter: 3, countersunkHead: 6.72, capHead: 5.5, capHeight: 3, nutFlats: 5.5, nutHeight: 2.4, insertHole: 4, insertLength: 5.7 },
  M4: { diameter: 4, countersunkHead: 8.96, capHead: 7, capHeight: 4, nutFlats: 7, nutHeight: 3.2, insertHole: 5.6, insertLength: 8.1 },
  M5: { diameter: 5, countersunkHead: 11.2, capHead: 8.5, capHeight: 5, nutFlats: 8, nutHeight: 4.7, insertHole: 6.4, insertLength: 9.5 },
}

export const SCREW_SIZE_OPTIONS = [
  { value: 'M2', label: 'M2' }, { value: 'M3', label: 'M3' }, { value: 'M4', label: 'M4' }, { value: 'M5', label: 'M5' },
] as const satisfies readonly ChoiceOption[]

export type ThreadSize = 'M6' | 'M8' | 'M10' | 'M12' | 'M16' | 'M20'

/** Metric coarse threads. */
export const THREADS: Readonly<Record<ThreadSize, { readonly diameter: number; readonly pitch: number }>> = {
  M6: { diameter: 6, pitch: 1 },
  M8: { diameter: 8, pitch: 1.25 },
  M10: { diameter: 10, pitch: 1.5 },
  M12: { diameter: 12, pitch: 1.75 },
  M16: { diameter: 16, pitch: 2 },
  M20: { diameter: 20, pitch: 2.5 },
}

export const THREAD_SIZE_OPTIONS = (Object.keys(THREADS) as ThreadSize[]).map((value) => ({ value, label: value }))
```

`THREAD_SIZE_OPTIONS` is built at runtime, so its values type as `ThreadSize`. That is fine for Task 6.

- [ ] **Step 4: Write `src/plugins/builtin/screw-profile.ts`**

```ts
import type { Point2 } from '../cad-types'
import type { ScrewSpec } from '../fit-sizes'

export type ScrewStyle = 'plain' | 'countersunk' | 'counterbored' | 'nut' | 'insert'

const fmt = (n: number): string => String(Math.round(n * 100) / 100)

function needDepth(depth: number, feature: number, what: string): void {
  if (depth <= feature + 1) throw new Error(`Make the hole deeper than ${fmt(feature + 1)} mm so ${what} fits.`)
}

/** [radius, z] outline of a screw hole for cad.revolve. The screw goes in from the top (z = depth). */
export function screwHoleProfile(screw: ScrewSpec, style: ScrewStyle, depth: number, clearance: number): Point2[] {
  const r = screw.diameter / 2 + clearance
  switch (style) {
    case 'countersunk': {
      const head = screw.countersunkHead / 2 + clearance
      const cone = head - r
      needDepth(depth, cone, 'the screw head')
      return [[0, 0], [r, 0], [r, depth - cone], [head, depth], [0, depth]]
    }
    case 'counterbored': {
      const head = screw.capHead / 2 + clearance
      const pocket = screw.capHeight + clearance
      needDepth(depth, pocket, 'the screw head')
      return [[0, 0], [r, 0], [r, depth - pocket], [head, depth - pocket], [head, depth], [0, depth]]
    }
    case 'insert': {
      const hole = screw.insertHole / 2
      needDepth(depth, screw.insertLength, 'the insert')
      return [[0, 0], [r, 0], [r, depth - screw.insertLength], [hole, depth - screw.insertLength], [hole, depth], [0, depth]]
    }
    case 'nut':
      needDepth(depth, screw.nutHeight + clearance, 'the nut')
      return [[0, 0], [r, 0], [r, depth], [0, depth]]
    case 'plain':
      return [[0, 0], [r, 0], [r, depth], [0, depth]]
  }
}

/** A hexagon centered on 0,0 with flat top and bottom (corners on ±X). */
export function hexOutline(acrossFlats: number): Point2[] {
  const corner = acrossFlats / Math.sqrt(3)
  return Array.from({ length: 6 }, (_, i): Point2 => {
    const angle = (Math.PI / 3) * i
    return [corner * Math.cos(angle), corner * Math.sin(angle)]
  })
}
```

Check the test values against this code:
- Plain: r = 1.5 + 0.2 = 1.7.
- Counterbore: head 2.75 + 0.2 = 2.95; pocket 3.2; 10 − 3.2 = 6.8; the minimum depth is 4.2.
- Insert: 10 − 5.7 = 4.3; hole 2; the minimum depth is 6.7.
- Countersink: cone = 3.56 − 1.7 = 1.86; the minimum depth is 2.86.
- Nut: 2.4 + 0.2 = 2.6; the minimum depth is 3.6.

Floating point makes `10 - 3.2` equal `6.8` exactly in JS, and `toEqual` compares exactly. If a value comes out as `6.799999…`, round the profile coordinates to 6 decimals and report it.

- [ ] **Step 5: Write `src/plugins/builtin/screw-hole.ts`**

```ts
import { SCREW_SIZE_OPTIONS, SCREWS } from '../fit-sizes'
import { definePlugin } from '../types'
import { hexOutline, screwHoleProfile } from './screw-profile'

/** A ready-made hole for M2–M5 screws, with a countersink, counterbore, nut trap or heat-set insert pocket. */
export default definePlugin({
  id: 'screw-hole',
  name: 'Screw hole',
  icon: '🔩',
  version: 1,
  mode: 'hole',
  palette: 'fit',
  params: {
    size: { type: 'choice', default: 'M3', label: 'Screw size', options: SCREW_SIZE_OPTIONS },
    style: {
      type: 'choice', default: 'plain', label: 'Style', options: [
        { value: 'plain', label: 'Plain hole' },
        { value: 'countersunk', label: 'Countersunk (flat head)' },
        { value: 'counterbored', label: 'Counterbored (cap head)' },
        { value: 'nut', label: 'Nut trap' },
        { value: 'insert', label: 'Heat-set insert' },
      ],
    },
    depth: { type: 'mm', default: 10, min: 2, max: 200, label: 'Depth' },
    clearance: { type: 'mm', default: 0.2, min: 0, max: 2, label: 'Extra room', formula: 'fit' },
  },
  size: { z: 'depth' },
  build: ({ size, style, depth, clearance }, cad) => {
    const screw = SCREWS[size]
    const hole = cad.revolve(screwHoleProfile(screw, style, depth, clearance))
    if (style !== 'nut') return hole
    const nut = cad.prism(hexOutline(screw.nutFlats + 2 * clearance), screw.nutHeight + clearance)
    try {
      return hole.fuse(nut)
    } finally {
      hole.delete()
      nut.delete()
    }
  },
})
```

`size` types as `'M2' | 'M3' | 'M4' | 'M5'` because of the `as const` options, so `SCREWS[size]` type-checks. If TypeScript widens it to `string`, index with `SCREWS[size as ScrewSize]` and report it.

In `builtin.test.ts`, the expected list now ends `…'peg', 'socket', 'screw-hole'`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/plugins && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src/plugins
git commit -m "feat: add a screw hole fit tool for M2–M5 screws"
```

---

### Task 6: Threaded rod and threaded hole plugins

**Files:**
- Create: `src/plugins/builtin/threaded-rod.ts`, `src/plugins/builtin/threaded-hole.ts`
- Test: `src/plugins/builtin/fit-tools.test.ts`, `src/plugins/builtin/builtin.test.ts`

**Interfaces:**
- Consumes: `cad.thread` (Task 3), plus `THREADS` and `THREAD_SIZE_OPTIONS` (Task 5).
- Produces plugin `threaded-rod`: params `size` (M6–M20, default M8) and `length` (default 20, 2–100); solid; `palette: 'fit'`.
- Produces plugin `threaded-hole`: params `size`, `depth` (default 15, 2–100) and `clearance` (formula `fit`); hole; `palette: 'fit'`.

- [ ] **Step 1: Write the failing tests**

Add to `src/plugins/builtin/fit-tools.test.ts`:

```ts
describe('threads', () => {
  const xMax = (shape: Shape3D): number => {
    const box = shape.boundingBox
    try {
      return box.bounds[1][0]
    } finally {
      box.delete()
      shape.delete()
    }
  }

  it('builds an M8 rod and a hole bigger by the extra room', () => {
    expect(xMax(build('threaded-rod'))).toBeCloseTo(4, 2)
    expect(xMax(build('threaded-hole', { clearance: 0.2 }))).toBeCloseTo(4.2, 2)
  })

  it('a rod fits inside its matching hole (Review Focus 4)', () => {
    const rod = build('threaded-rod', { length: 10 })
    const hole = build('threaded-hole', { depth: 10, clearance: 0.2 })
    const sticksOut = rod.cut(hole)
    try {
      expect(measureVolume(sticksOut)).toBeLessThan(0.5)
    } finally {
      rod.delete()
      hole.delete()
      sticksOut.delete()
    }
  })

  it('explains threads that are too long', () => {
    expect(() => build('threaded-rod', { size: 'M6', length: 60 })).toThrow('Threads can be up to 40 turns long')
  })

  it('still builds a small hole with lots of extra room (Review Focus 4)', () => {
    expect(volumeOf(build('threaded-hole', { size: 'M6', depth: 10, clearance: 2 }))).toBeGreaterThan(0)
  })
})
```

Add `measureVolume` to this file's `replicad` import if it isn't there. Append `'threaded-rod', 'threaded-hole'` to the expected list in `builtin.test.ts`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/plugins/builtin/fit-tools.test.ts`
Expected: FAIL with "missing plugin threaded-rod".

- [ ] **Step 3: Write the plugins**

`src/plugins/builtin/threaded-rod.ts`:

```ts
import { THREAD_SIZE_OPTIONS, THREADS } from '../fit-sizes'
import { definePlugin } from '../types'

/** A printable metric-style threaded rod. Big sizes (M8 and up) print best. */
export default definePlugin({
  id: 'threaded-rod',
  name: 'Threaded rod',
  icon: '🪛',
  version: 1,
  palette: 'fit',
  params: {
    size: { type: 'choice', default: 'M8', label: 'Thread size', options: THREAD_SIZE_OPTIONS },
    length: { type: 'mm', default: 20, min: 2, max: 100, label: 'Length' },
  },
  size: { z: 'length' },
  build: ({ size, length }, cad) => {
    const { diameter, pitch } = THREADS[size as keyof typeof THREADS]
    return cad.thread(diameter, pitch, length)
  },
})
```

`src/plugins/builtin/threaded-hole.ts`:

```ts
import { THREAD_SIZE_OPTIONS, THREADS } from '../fit-sizes'
import { definePlugin } from '../types'

/** The hole a threaded rod screws into: the same thread, pushed outward by the extra room. */
export default definePlugin({
  id: 'threaded-hole',
  name: 'Threaded hole',
  icon: '🌀',
  version: 1,
  mode: 'hole',
  palette: 'fit',
  params: {
    size: { type: 'choice', default: 'M8', label: 'Thread size', options: THREAD_SIZE_OPTIONS },
    depth: { type: 'mm', default: 15, min: 2, max: 100, label: 'Depth' },
    clearance: { type: 'mm', default: 0.2, min: 0, max: 2, label: 'Extra room', formula: 'fit' },
  },
  size: { z: 'depth' },
  build: ({ size, depth, clearance }, cad) => {
    const { diameter, pitch } = THREADS[size as keyof typeof THREADS]
    return cad.thread(diameter + 2 * clearance, pitch, depth)
  },
})
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/plugins && npm run typecheck`
Expected: PASS, typecheck clean. The "rod fits its hole" test is the slowest so far; report its time.

- [ ] **Step 5: Commit**

```bash
git add src/plugins
git commit -m "feat: add threaded rod and threaded hole fit tools"
```

---

### Task 7: Snap-fit clip and catch plugins

**Files:**
- Create: `src/plugins/builtin/snap-clip.ts`, `src/plugins/builtin/snap-catch.ts`
- Test: `src/plugins/builtin/fit-tools.test.ts`, `src/plugins/builtin/builtin.test.ts`

**Interfaces:**
- Produces plugin `snap-clip`:
  - params `width` (6), `thickness` (1.5, 0.8–10), `length` (12, 4–100), `hook` (1, 0.3–5)
  - solid, `palette: 'hidden'`
  - The arm is centered on x = 0, and the hook sticks out toward +X.
- Produces plugin `snap-catch`:
  - params `width` (6), `thickness` (1.5), `wall` (3, 0.5–50) and `clearance` (formula `fit`)
  - hole, `palette: 'hidden'`
  - A slot `(thickness + 2c) × (width + 2c) × (wall + 2)`, centered on X/Y and sitting on z = 0.

The hook only passes through the slot by bending, because the slot is narrower than arm + hook. It then springs back and its flat underside catches the far side of the wall.

- [ ] **Step 1: Write the failing tests**

Add to `src/plugins/builtin/fit-tools.test.ts`:

```ts
describe('snap-fit clip and catch', () => {
  it('builds an arm with a barbed hook', () => {
    const ramp = 2
    expect(volumeOf(build('snap-clip'))).toBeCloseTo(6 * (1.5 * 12 + (1 * ramp) / 2), 3)
  })

  it('makes the catch slot fit the arm but not the hook', () => {
    expect(volumeOf(build('snap-catch', { clearance: 0.2 }))).toBeCloseTo(1.9 * 6.4 * 5, 3)
  })

  it('explains an arm too short for its hook', () => {
    expect(() => build('snap-clip', { length: 4, hook: 2 })).toThrow('Make the arm longer than 5 mm for that hook.')
  })
})
```

Append `'snap-clip', 'snap-catch'` to `builtin.test.ts`'s expected list. The full list is now: `box, cylinder, sphere, cone, wedge, torus, text, peg, socket, screw-hole, threaded-rod, threaded-hole, snap-clip, snap-catch`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/plugins/builtin/fit-tools.test.ts`
Expected: FAIL with "missing plugin snap-clip".

- [ ] **Step 3: Write the plugins**

`src/plugins/builtin/snap-clip.ts`:

```ts
import { definePlugin } from '../types'

/**
 * A bendy arm with a barbed hook on its tip. Push it through its catch: the sloped tip bends the arm,
 * then it springs back and the flat underside of the hook holds.
 */
export default definePlugin({
  id: 'snap-clip',
  name: 'Snap clip',
  icon: '🪝',
  version: 1,
  palette: 'hidden',
  params: {
    width: { type: 'mm', default: 6, min: 1, max: 50, label: 'Width' },
    thickness: { type: 'mm', default: 1.5, min: 0.8, max: 10, label: 'Arm thickness' },
    length: { type: 'mm', default: 12, min: 4, max: 100, label: 'Arm length' },
    hook: { type: 'mm', default: 1, min: 0.3, max: 5, label: 'Hook size' },
  },
  size: { y: 'width', z: 'length' },
  build: ({ width, thickness, length, hook }, cad) => {
    const ramp = 2 * hook
    if (length <= ramp + 1) throw new Error(`Make the arm longer than ${Math.round((ramp + 1) * 100) / 100} mm for that hook.`)
    const half = thickness / 2
    return cad.extrudeSide([
      [-half, 0], [half, 0], [half, length - ramp], [half + hook, length - ramp], [half, length], [-half, length],
    ], width)
  },
})
```

`src/plugins/builtin/snap-catch.ts`:

```ts
import { definePlugin } from '../types'

/** The slot a snap clip pushes through. It fits the arm, not the hook, so the hook catches the far side. */
export default definePlugin({
  id: 'snap-catch',
  name: 'Snap catch',
  icon: '🔲',
  version: 1,
  mode: 'hole',
  palette: 'hidden',
  params: {
    width: { type: 'mm', default: 6, min: 1, max: 50, label: 'Clip width' },
    thickness: { type: 'mm', default: 1.5, min: 0.8, max: 10, label: 'Arm thickness' },
    wall: { type: 'mm', default: 3, min: 0.5, max: 50, label: 'Wall thickness' },
    clearance: { type: 'mm', default: 0.2, min: 0, max: 2, label: 'Extra room', formula: 'fit' },
  },
  size: { z: 'wall' },
  // 1 mm extra above and below the wall, so the slot always goes right through it.
  build: ({ width, thickness, wall, clearance }, cad) => cad.box(thickness + 2 * clearance, width + 2 * clearance, wall + 2),
})
```

The hook ramp for the default (hook 1) is 2, so the clip volume is `6 × (1.5 × 12 + 1 × 2 / 2) = 114`. For the too-short case (length 4, hook 2), the ramp is 4, the limit is 5, and 4 ≤ 5, so it throws the message the test expects.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/plugins && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/plugins
git commit -m "feat: add snap-fit clip and catch plugins"
```

---

### Task 8: Kits — Peg & socket and Snap-fit clip — and the Fit tools palette

**Files:**
- Create: `src/plugins/kits.ts`, `src/app/add-kit.ts`
- Modify: `src/app/actions.ts`, `src/ui/ShapePalette.tsx`, `src/ui/Workspace.tsx`, `src/ui/App.css`
- Test: `src/plugins/kits.test.ts`, `src/app/add-kit.test.ts`, `src/app/actions.test.ts`, `src/ui/ShapePalette.test.tsx`

**Interfaces:**
- Consumes: `addPart` (Task 2), `addVariable`, `renameVariableIn`, the plugins from Tasks 4 and 7, and `pickColor`.
- Produces:
  - `KitPart { shapeType; name; offset: Vec3; formulas }`
  - `ShapeKit { id; name; icon; variables: { name; expr }[]; parts: KitPart[] }`
  - `KITS` and `kitProblems(kits, registry): string[]`
  - `kitVariableNames(doc, kit): Map<string, string>`
  - `addKit(doc, kit, registry, normalize, workplane | null, firstColorIndex): { doc; ids }`
  - `Actions.addKit(kitId: string): void`
  - `ShapePalette({ registry, kits, onAdd, onAddKit })` with sections "Shapes" and "Fit tools", and test ids `add-kit-<id>`

- [ ] **Step 1: Write the failing tests**

`src/plugins/kits.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { registry } from './index'
import { KITS, kitProblems } from './kits'

describe('kits', () => {
  it('only use real plugins, number params and their own variables', () => {
    expect(kitProblems(KITS, registry)).toEqual([])
    expect(KITS.map((k) => k.id)).toEqual(['peg-socket', 'snap-fit'])
  })

  it('reports broken kits', () => {
    const broken = [{
      id: 'bad', name: 'Bad', icon: '❌', variables: [{ name: 'w', expr: '5' }],
      parts: [
        { shapeType: 'nope', name: 'A', offset: [0, 0, 0], formulas: {} },
        { shapeType: 'peg', name: 'B', offset: [0, 0, 0], formulas: { shape: 'w', size: 'other + 1' } },
      ],
    }] as const
    expect(kitProblems(broken, registry)).toEqual([
      'Kit "Bad": there is no "nope" shape.',
      'Kit "Bad": "shape" on Peg is not a number size.',
      'Kit "Bad": the formula for "size" on Peg uses something besides w and fit.',
    ])
  })
})
```

`src/app/add-kit.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { addVariable, setFit, setVariableExpr } from '../document/variable-ops'
import type { BloKadeDocument } from '../document/types'
import { registry } from '../plugins/index'
import { KITS } from '../plugins/kits'
import { addKit, kitVariableNames } from './add-kit'
import { createFieldNormalizer } from './field-normalizer'

const normalize = createFieldNormalizer(registry)
const pegKit = KITS.find((k) => k.id === 'peg-socket')
if (!pegKit) throw new Error('missing kit')
const add = (doc: BloKadeDocument, workplane: { origin: [number, number, number]; rotation: [number, number, number] } | null = null) =>
  addKit(doc, pegKit, registry, normalize, workplane, 0)

describe('addKit', () => {
  it('adds the shared sizes and a matched peg and socket', () => {
    const { doc, ids } = add(createEmptyDocument())
    expect(doc.variables).toEqual([{ name: 'peg_size', expr: '8' }, { name: 'peg_length', expr: '10' }])
    const [peg, socket] = ids.map((id) => doc.nodes[id])
    expect(peg).toMatchObject({ shapeType: 'peg', mode: 'solid', params: { size: 8, length: 10 }, formulas: { 'param.size': 'peg_size' } })
    expect(socket).toMatchObject({
      shapeType: 'socket', mode: 'hole', params: { size: 8, depth: 11, clearance: 0.2 },
      formulas: { 'param.size': 'peg_size', 'param.depth': 'peg_length + 1', 'param.clearance': 'fit' },
      transform: { position: [25, 0, 0] },
    })
  })

  it('keeps the pair matched when the peg size or fit changes (Review Focus 1)', () => {
    const { doc, ids } = add(createEmptyDocument())
    const resized = setFit(setVariableExpr(doc, 'peg_size', '12', normalize), 0.4, normalize)
    expect(resized.nodes[ids[0] ?? '']?.params).toMatchObject({ size: 12 })
    expect(resized.nodes[ids[1] ?? '']?.params).toMatchObject({ size: 12, clearance: 0.4 })
  })

  it('numbers the variables of a second kit and points its formulas at them (Review Focus 2)', () => {
    const first = add(createEmptyDocument())
    const second = add(first.doc)
    expect(second.doc.variables.map((v) => v.name)).toEqual(['peg_size', 'peg_length', 'peg_size2', 'peg_length2'])
    expect(second.doc.nodes[second.ids[1] ?? '']?.formulas).toMatchObject({ 'param.size': 'peg_size2', 'param.depth': 'peg_length2 + 1' })
    expect(second.doc.nodes[first.ids[0] ?? '']).toEqual(first.doc.nodes[first.ids[0] ?? ''])
  })

  it('skips a suffix when any one of the names is taken', () => {
    const taken = addVariable(createEmptyDocument(), 'peg_length', '3', normalize)
    expect([...kitVariableNames(taken, pegKit).values()]).toEqual(['peg_size2', 'peg_length2'])
  })

  it('places the parts on the workplane, turned with it', () => {
    const { doc, ids } = add(createEmptyDocument(), { origin: [0, 0, 10], rotation: [0, 0, 90] })
    const position = doc.nodes[ids[1] ?? '']?.transform.position ?? [0, 0, 0]
    expect(position[0]).toBeCloseTo(0, 6)
    expect(position[1]).toBeCloseTo(25, 6)
    expect(position[2]).toBeCloseTo(10, 6)
  })
})
```

Add to `src/app/actions.test.ts`, using its `setup()`:

```ts
  it('adds a kit as one undo step and selects its parts (Review Focus 2)', () => {
    const { store, actions } = setup()
    const before = store.getState().history.present
    actions.addKit('peg-socket')
    expect(store.getState().selection).toHaveLength(2)
    actions.undo()
    expect(store.getState().history.present).toBe(before)
    actions.addKit('nope')
    expect(store.getState().notice).toBe('BloKade doesn\'t have a "nope" kit.')
  })
```

If `setup()` doesn't start from an empty design, compare `history.present` against the value captured before `addKit` (as written above). That still holds.

Replace `src/ui/ShapePalette.test.tsx`'s test with:

```tsx
import { KITS } from '../plugins/kits'

describe('ShapePalette', () => {
  it('shows shapes, then fit tools with kits first, and hides kit-only parts', async () => {
    const onAdd = vi.fn()
    const onAddKit = vi.fn()
    render(<ShapePalette registry={registry} kits={KITS} onAdd={onAdd} onAddKit={onAddKit} />)
    const shapes = within(screen.getByRole('region', { name: 'Shapes' })).getAllByRole('button')
    expect(shapes).toHaveLength(7)
    const fit = within(screen.getByRole('region', { name: 'Fit tools' })).getAllByRole('button').map((b) => b.textContent)
    expect(fit).toEqual(['🧷Peg & socket', '🪝Snap-fit clip', '🔩Screw hole', '🪛Threaded rod', '🌀Threaded hole'])
    expect(screen.queryByTestId('add-peg')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Cylinder/ }))
    expect(onAdd).toHaveBeenCalledWith('cylinder')
    await userEvent.click(screen.getByTestId('add-kit-peg-socket'))
    expect(onAddKit).toHaveBeenCalledWith('peg-socket')
    await userEvent.click(screen.getByTestId('add-screw-hole'))
    expect(onAdd).toHaveBeenCalledWith('screw-hole')
  })
})
```

Add `within` to the `@testing-library/react` import.

Update the Task 1 test in the same file ("leaves fit and kit-only plugins out of the Shapes grid") for the new props and sections:

```tsx
    render(<ShapePalette registry={mixed} kits={[]} onAdd={vi.fn()} onAddKit={vi.fn()} />)
    const ids = (name: string) => within(screen.getByRole('region', { name })).getAllByRole('button').map((b) => b.dataset.testid)
    expect(ids('Shapes')).toEqual(['add-plain', 'add-listed'])
    expect(ids('Fit tools')).toEqual(['add-fitty'])
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/plugins/kits.test.ts src/app src/ui/ShapePalette.test.tsx`
Expected: FAIL. The modules are missing.

- [ ] **Step 3: Write `src/plugins/kits.ts`**

```ts
import type { Vec3 } from '../document/types'
import { computeFormula } from '../formulas/formula'
import type { PluginRegistry } from './registry'
import { isNumberSpec } from './types'

export interface KitPart {
  readonly shapeType: string
  readonly name: string
  /** Where this part goes, from the first part (turned with the workplane). */
  readonly offset: Vec3
  /** Formulas by number-parameter name. They may use the kit's variables and `fit`. */
  readonly formulas: Readonly<Record<string, string>>
}

/** Several parts added together and kept matched through shared variables. */
export interface ShapeKit {
  readonly id: string
  readonly name: string
  readonly icon: string
  /** Shared sizes. If a name is taken, every one of them gets the same number added (peg_size2…). */
  readonly variables: readonly { readonly name: string; readonly expr: string }[]
  readonly parts: readonly KitPart[]
}

const pegAndSocket: ShapeKit = {
  id: 'peg-socket',
  name: 'Peg & socket',
  icon: '🧷',
  variables: [{ name: 'peg_size', expr: '8' }, { name: 'peg_length', expr: '10' }],
  parts: [
    { shapeType: 'peg', name: 'Peg', offset: [0, 0, 0], formulas: { size: 'peg_size', length: 'peg_length' } },
    { shapeType: 'socket', name: 'Socket', offset: [25, 0, 0], formulas: { size: 'peg_size', depth: 'peg_length + 1' } },
  ],
}

const snapFit: ShapeKit = {
  id: 'snap-fit',
  name: 'Snap-fit clip',
  icon: '🪝',
  variables: [{ name: 'clip_width', expr: '6' }, { name: 'clip_thickness', expr: '1.5' }],
  parts: [
    { shapeType: 'snap-clip', name: 'Snap clip', offset: [0, 0, 0], formulas: { width: 'clip_width', thickness: 'clip_thickness' } },
    { shapeType: 'snap-catch', name: 'Snap catch', offset: [25, 0, 0], formulas: { width: 'clip_width', thickness: 'clip_thickness' } },
  ],
}

export const KITS: readonly ShapeKit[] = [pegAndSocket, snapFit]

function partProblems(kit: ShapeKit, part: KitPart, registry: PluginRegistry): string[] {
  const plugin = registry.get(part.shapeType)
  if (!plugin) return [`Kit "${kit.name}": there is no "${part.shapeType}" shape.`]
  const scope = new Map([...kit.variables.map((v) => [v.name, 1] as const), ['fit', 0.2] as const])
  const allowed = [...kit.variables.map((v) => v.name), 'fit'].join(' and ')
  return Object.entries(part.formulas).flatMap(([name, text]) => {
    const spec = Object.hasOwn(plugin.params, name) ? plugin.params[name] : undefined
    if (!spec || !isNumberSpec(spec)) return [`Kit "${kit.name}": "${name}" on ${plugin.name} is not a number size.`]
    if (!computeFormula(text, scope).ok) return [`Kit "${kit.name}": the formula for "${name}" on ${plugin.name} uses something besides ${allowed}.`]
    return []
  })
}

/** Problems that would stop a kit working, in plain words. Checked by a test for the built-in kits. */
export function kitProblems(kits: readonly ShapeKit[], registry: PluginRegistry): string[] {
  return kits.flatMap((kit) => kit.parts.flatMap((part) => partProblems(kit, part, registry)))
}
```

The broken-kit test expects the allowed list to read `w and fit`. With one kit variable, `[...['w'], 'fit'].join(' and ')` gives exactly that.

- [ ] **Step 4: Write `src/app/add-kit.ts`**

```ts
import { Euler, MathUtils, Vector3 } from 'three'
import { pickColor } from '../document/factory'
import type { NormalizeField } from '../document/formula-ops'
import { DocumentOpError } from '../document/ops'
import type { BloKadeDocument, NodeId, Vec3 } from '../document/types'
import { addVariable } from '../document/variable-ops'
import { renameVariableIn } from '../formulas/formula'
import type { ShapeKit } from '../plugins/kits'
import type { PluginRegistry } from '../plugins/registry'
import type { Workplane } from '../store/store'
import { addPart } from './add-part'

/** The kit's variable names, all with the same smallest number that makes every one of them free. */
export function kitVariableNames(doc: BloKadeDocument, kit: ShapeKit): Map<string, string> {
  const taken = new Set(doc.variables.map((v) => v.name))
  const named = (n: number) => new Map(kit.variables.map((v) => [v.name, n === 1 ? v.name : `${v.name}${n}`] as const))
  const free = (n: number): Map<string, string> => {
    const names = named(n)
    return [...names.values()].some((name) => taken.has(name)) ? free(n + 1) : names
  }
  return free(1)
}

function placeOffset(offset: Vec3, workplane: Workplane | null): Vec3 {
  if (!workplane) return offset
  const [rx, ry, rz] = workplane.rotation.map((deg) => MathUtils.degToRad(deg))
  const turned = new Vector3(...offset).applyEuler(new Euler(rx, ry, rz, 'XYZ'))
  return [workplane.origin[0] + turned.x, workplane.origin[1] + turned.y, workplane.origin[2] + turned.z]
}

const renameAll = (text: string, names: Map<string, string>): string =>
  [...names].reduce((acc, [from, to]) => (from === to ? acc : renameVariableIn(acc, from, to)), text)

/** Adds a kit's variables and parts in one go. The caller commits it as a single undo step. */
export function addKit(
  doc: BloKadeDocument, kit: ShapeKit, registry: PluginRegistry, normalize: NormalizeField,
  workplane: Workplane | null, firstColorIndex: number,
): { doc: BloKadeDocument; ids: NodeId[] } {
  const names = kitVariableNames(doc, kit)
  const withVariables = kit.variables.reduce((d, v) => addVariable(d, names.get(v.name) ?? v.name, v.expr, normalize), doc)
  return kit.parts.reduce<{ doc: BloKadeDocument; ids: NodeId[] }>((acc, part, i) => {
    const plugin = registry.get(part.shapeType)
    if (!plugin) throw new DocumentOpError(`BloKade doesn't have a "${part.shapeType}" shape.`)
    const formulas = Object.fromEntries(Object.entries(part.formulas).map(([k, text]) => [k, renameAll(text, names)]))
    const { doc: next, id } = addPart(acc.doc, plugin, {
      name: part.name, color: pickColor(firstColorIndex + i), formulas,
      position: placeOffset(part.offset, workplane), rotation: workplane?.rotation,
    }, normalize)
    return { doc: next, ids: [...acc.ids, id] }
  }, { doc: withVariables, ids: [] })
}
```

The workplane test turns the offset [25, 0, 0] by 90° about Z, which gives [0, 25, 0], then adds the origin [0, 0, 10].

- [ ] **Step 5: Add the action**

In `src/app/actions.ts`, add `addKit(kitId: string): void` to the `Actions` interface, with the doc comment `/** Adds a matched set of parts (like a peg and its socket) as one undo step. */`. Import `KITS` from `../plugins/kits` and `addKit as addKitParts` from `./add-kit`, then implement:

```ts
    addKit: (kitId) => {
      const kit = KITS.find((k) => k.id === kitId)
      if (!kit) {
        state().notify(`BloKade doesn't have a "${kitId}" kit.`)
        return
      }
      const firstColor = Object.keys(state().history.present.nodes).length
      selectIf(run(store, (doc) => {
        const { doc: next, ids } = addKitParts(doc, kit, registry, normalize, state().workplane, firstColor)
        return { doc: next, value: ids }
      }))
    },
```

If `src/app/shortcuts.test.ts` builds an `Actions` mock with `satisfies Actions`, add `addKit: vi.fn()` to it.

- [ ] **Step 6: Rewrite `src/ui/ShapePalette.tsx`**

```tsx
import type { ShapeKit } from '../plugins/kits'
import type { PluginRegistry } from '../plugins/registry'
import type { ShapePlugin } from '../plugins/types'

interface ShapePaletteProps {
  registry: PluginRegistry
  kits: readonly ShapeKit[]
  onAdd(pluginId: string): void
  onAddKit(kitId: string): void
}

const sectionOf = (plugin: ShapePlugin): 'shapes' | 'fit' | 'hidden' => plugin.palette ?? 'shapes'

function PaletteButton({ testId, icon, name, onClick }: { testId: string; icon: string; name: string; onClick(): void }) {
  return (
    <button type="button" className="palette-button" data-testid={testId} onClick={onClick}>
      <span className="palette-icon" aria-hidden="true">{icon}</span>
      {name}
    </button>
  )
}

export function ShapePalette({ registry, kits, onAdd, onAddKit }: ShapePaletteProps) {
  const plugins = registry.list()
  const pluginButton = (p: ShapePlugin) => <PaletteButton key={p.id} testId={`add-${p.id}`} icon={p.icon} name={p.name} onClick={() => onAdd(p.id)} />
  return (
    <>
      <section className="panel" aria-label="Shapes">
        <h2>Shapes</h2>
        <div className="palette-grid">{plugins.filter((p) => sectionOf(p) === 'shapes').map(pluginButton)}</div>
      </section>
      <section className="panel" aria-label="Fit tools">
        <h2>Fit tools</h2>
        <div className="palette-grid">
          {kits.map((k) => <PaletteButton key={k.id} testId={`add-kit-${k.id}`} icon={k.icon} name={k.name} onClick={() => onAddKit(k.id)} />)}
          {plugins.filter((p) => sectionOf(p) === 'fit').map(pluginButton)}
        </div>
      </section>
    </>
  )
}
```

Kade's own plugins in `plugins/` have no `palette` field, so they stay under "Shapes".

In `src/ui/Workspace.tsx`, import `KITS` and render `<ShapePalette registry={deps.registry} kits={KITS} onAdd={actions.addShape} onAddKit={actions.addKit} />`.

`App.css` needs no change, because both sections reuse `.panel` and `.palette-grid`. If the left panel no longer fits its column, add `.left-panel { overflow-y: auto; }` and mention it in your report.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS, typecheck clean. If an existing e2e or unit test counts palette buttons, update the count and list the file.

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "feat: add Peg & socket and Snap-fit kits under Fit tools"
```

---

### Task 9: Overlap check in the geometry worker

**Files:**
- Create: `src/geometry/overlap.ts`
- Modify: `src/geometry/types.ts`, `src/geometry/api.ts`, `src/geometry/client.ts`, `src/geometry/spawn.ts`, `src/geometry/geometry.worker.ts`, `src/app/testing/fakes.ts`
- Test: `src/geometry/overlap.test.ts`, `src/geometry/client.test.ts`

**Interfaces:**
- Consumes: `Evaluator.placed` (cache-owned results), `rootAncestorOf`, `toMeshData` and `NodeBuildError`.
- Produces:
  - `type OverlapResult = { status: 'none' } | { status: 'overlap'; volume: number; mesh: MeshData }`
  - `MIN_OVERLAP = 0.001` (mm³)
  - `findOverlap(evaluator, doc, a, b): OverlapResult`, which throws `OverlapError` with a plain-English message
  - `GeometryApi.overlap(doc, a, b)` and `GeometryClient.overlap(doc, a, b)`
  - A fake that returns `{ status: 'none' }`

- [ ] **Step 1: Write the failing tests**

`src/geometry/overlap.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode, groupNodes } from '../document/ops'
import type { BloKadeDocument } from '../document/types'
import { createCadToolkit } from '../plugins/cad'
import { registry } from '../plugins/index'
import { Evaluator } from './evaluate'
import { findOverlap } from './overlap'
import { initTestOC } from './testing/oc-node'

beforeAll(initTestOC)

const cube = (id: string, x: number) =>
  createShapeNode({ id, shapeType: 'box', name: id, params: { width: 20, depth: 20, height: 20 }, color: '#fff', position: [x, 0, 0] })
const twoCubes = (gap: number): BloKadeDocument => [cube('a', 0), cube('b', gap)].reduce((d, n) => addNode(d, n), createEmptyDocument())
const newEvaluator = () => new Evaluator(registry, createCadToolkit())

describe('findOverlap', () => {
  it('measures where two parts overlap and returns its shape', () => {
    const result = findOverlap(newEvaluator(), twoCubes(10), 'a', 'b')
    expect(result.status).toBe('overlap')
    if (result.status !== 'overlap') return
    expect(result.volume).toBeCloseTo(4000, 3)
    expect(result.mesh.positions.length).toBeGreaterThan(0)
  })

  it('says none for parts apart or only touching (Review Focus 5)', () => {
    expect(findOverlap(newEvaluator(), twoCubes(30), 'a', 'b')).toEqual({ status: 'none' })
    expect(findOverlap(newEvaluator(), twoCubes(20), 'a', 'b')).toEqual({ status: 'none' })
  })

  it('checks the whole top-level part when a child is picked', () => {
    const grouped = groupNodes(addNode(twoCubes(10), cube('c', 100)), ['b', 'c'], 'g').doc
    const result = findOverlap(newEvaluator(), grouped, 'a', 'c')
    expect(result.status).toBe('overlap')
  })

  it('explains picks that make no sense (Review Focus 5)', () => {
    const grouped = groupNodes(twoCubes(10), ['a', 'b'], 'g').doc
    expect(() => findOverlap(newEvaluator(), grouped, 'a', 'b')).toThrow('Pick two separate parts to check.')
    expect(() => findOverlap(newEvaluator(), twoCubes(10), 'a', 'gone')).toThrow('Pick two separate parts to check.')
  })

  it('names a part that has a problem (Review Focus 5)', () => {
    const broken = addNode(twoCubes(10), createShapeNode({ id: 'x', shapeType: 'nope', name: 'Mystery', params: {}, color: '#fff' }))
    expect(() => findOverlap(newEvaluator(), broken, 'a', 'x')).toThrow('Can\'t check yet: "Mystery" has a problem.')
  })

  it("never frees the evaluator's cached shapes", () => {
    const ev = newEvaluator()
    const doc = twoCubes(10)
    findOverlap(ev, doc, 'a', 'b')
    expect(findOverlap(ev, doc, 'a', 'b').status).toBe('overlap')
  })
})
```

The second call would crash with a WASM error if the first call had deleted a cached shape.

Add to `src/geometry/client.test.ts`, following its fake-worker pattern:

```ts
  it('forwards overlap checks to the worker', async () => {
    const result = { status: 'none' } as const
    const client = new GeometryClient(() => ({ api: fakeGeometryApi({ overlap: async () => result }), terminate: () => undefined }))
    await expect(client.overlap(createEmptyDocument(), 'a', 'b')).resolves.toBe(result)
  })
```

If that file builds its API from a local `fakeWorker()` instead of `fakeGeometryApi`, add `overlap` to `fakeWorker` and spread it the same way the Milestone 3 `exportStep` test does.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/geometry/overlap.test.ts src/geometry/client.test.ts`
Expected: FAIL. The module and method are missing.

- [ ] **Step 3: Extend `src/geometry/types.ts`**

```ts
/** Where two parts take up the same space: its volume (mm³) and shape, in world coordinates. */
export type OverlapResult =
  | { readonly status: 'none' }
  | { readonly status: 'overlap'; readonly volume: number; readonly mesh: MeshData }
```

Add this to `GeometryApi`:

```ts
  overlap(doc: BloKadeDocument, a: NodeId, b: NodeId): Promise<OverlapResult>
```

- [ ] **Step 4: Write `src/geometry/overlap.ts`**

```ts
import { measureVolume, type Shape3D } from 'replicad'
import { rootAncestorOf } from '../document/tree'
import type { BloKadeDocument, NodeId } from '../document/types'
import { NodeBuildError, type Evaluator } from './evaluate'
import { toMeshData } from './tessellate'
import type { OverlapResult } from './types'

/** Overlaps this small (mm³) are just faces touching. */
export const MIN_OVERLAP = 0.001

export class OverlapError extends Error {
  override name = 'OverlapError'
}

const UNEXPECTED = 'Something went wrong building this part. Try changing its size a little, or undo.'

function placedRoot(evaluator: Evaluator, doc: BloKadeDocument, id: NodeId): Shape3D {
  try {
    return evaluator.placed(doc, id)
  } catch (error) {
    const reason = error instanceof NodeBuildError ? error.message : UNEXPECTED
    const name = Object.hasOwn(doc.nodes, id) ? doc.nodes[id]?.name ?? id : id
    throw new OverlapError(`Can't check yet: "${name}" has a problem. ${reason}`)
  }
}

function rootsOf(doc: BloKadeDocument, a: NodeId, b: NodeId): [NodeId, NodeId] {
  const ra = Object.hasOwn(doc.nodes, a) ? rootAncestorOf(doc, a) : undefined
  const rb = Object.hasOwn(doc.nodes, b) ? rootAncestorOf(doc, b) : undefined
  if (ra === undefined || rb === undefined || ra === rb) throw new OverlapError('Pick two separate parts to check.')
  return [ra, rb]
}

/** Where two top-level parts collide. Selected children count as their top-level part. Cached shapes are never freed. */
export function findOverlap(evaluator: Evaluator, doc: BloKadeDocument, a: NodeId, b: NodeId): OverlapResult {
  const [ra, rb] = rootsOf(doc, a, b)
  const common = placedRoot(evaluator, doc, ra).intersect(placedRoot(evaluator, doc, rb))
  try {
    const volume = measureVolume(common)
    return volume > MIN_OVERLAP ? { status: 'overlap', volume, mesh: toMeshData(common) } : { status: 'none' }
  } finally {
    common.delete()
  }
}
```

`placed()` returns shapes owned by the Evaluator cache. `intersect` keeps both inputs, so only `common` is deleted. If `measureVolume` throws on an empty result, catch it and return `{ status: 'none' }`; add a test that shows it.

- [ ] **Step 5: Wire it through the API, client, worker and fakes**

`src/geometry/api.ts`: import `findOverlap` and `OverlapError` from `./overlap`, then add to the returned object:

```ts
    overlap: async (doc, a, b) => {
      try {
        return findOverlap(evaluator, doc, a, b)
      } catch (error) {
        if (error instanceof OverlapError) throw new Error(error.message)
        console.error('Unexpected overlap failure', error)
        throw new Error(UNEXPECTED)
      }
    },
```

`src/geometry/client.ts`: add `OverlapResult` to the type import, then add:

```ts
  overlap(doc: BloKadeDocument, a: NodeId, b: NodeId): Promise<OverlapResult> {
    return this.call((api) => api.overlap(doc, a, b))
  }
```

`src/geometry/spawn.ts`: `overlap: (doc, a, b) => remote.overlap(doc, a, b),`
`src/geometry/geometry.worker.ts`: `overlap: async (doc, a, b) => (await apiReady).overlap(doc, a, b),`
`src/app/testing/fakes.ts`: `overlap: async () => ({ status: 'none' }),`

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS, typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: find where two parts overlap in the geometry worker"
```

---

### Task 10: Overlap check button, result and red overlay

**Files:**
- Create: `src/store/overlap.ts`, `src/app/check-overlap.ts`, `src/ui/OverlapCheck.tsx`, `src/viewport/OverlapMesh.tsx`
- Modify: `src/store/store.ts`, `src/app/actions.ts`, `src/ui/PropertiesPanel.tsx`, `src/ui/Workspace.tsx`, `src/viewport/Viewport.tsx`, `src/ui/App.css`
- Test: `src/store/overlap.test.ts`, `src/app/check-overlap.test.ts`, `src/ui/OverlapCheck.test.tsx`, `src/app/actions.test.ts`

**Interfaces:**
- Consumes: `GeometryClient.overlap`, `OverlapResult` and `rootAncestorOf` (Task 9).
- Produces:
  - `OverlapView { doc; selection; result: OverlapResult }`
  - store `overlap: OverlapView | null` and `setOverlap(view | null)`, reset by `openDesign`
  - `visibleOverlap({ overlap, present, selection }): OverlapResult | null` and `visibleOverlapOf(state)`
  - `overlapPair(doc, selection): [NodeId, NodeId] | null`
  - `checkOverlap(store, client): Promise<void>`
  - `OverlapCheck({ onCheck })` with test ids `check-overlap` and `overlap-result`
  - `PropertiesPanel({ registry, onCheckOverlap? })`
  - `OverlapMesh`
  - `Actions.cancel` also clears the overlap when it deselects

- [ ] **Step 1: Write the failing tests**

`src/store/overlap.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { visibleOverlapOf } from './overlap'
import { createBloKadeStore } from './store'

describe('visibleOverlapOf (Review Focus 5)', () => {
  it('shows the result only while the design and selection are the ones that were checked', () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    const s = store.getState()
    s.setOverlap({ doc: s.history.present, selection: s.selection, result: { status: 'none' } })
    expect(visibleOverlapOf(store.getState())).toEqual({ status: 'none' })
    store.getState().select([])
    expect(visibleOverlapOf(store.getState())).toBeNull()
    const again = store.getState()
    again.setOverlap({ doc: again.history.present, selection: again.selection, result: { status: 'none' } })
    store.getState().apply((d) => ({ ...d, name: 'Changed' }))
    expect(visibleOverlapOf(store.getState())).toBeNull()
  })

  it('forgets the result when another design opens', () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    const s = store.getState()
    s.setOverlap({ doc: s.history.present, selection: s.selection, result: { status: 'none' } })
    store.getState().openDesign('e', createEmptyDocument())
    expect(store.getState().overlap).toBeNull()
  })
})
```

`select([])` creates a new array even when the selection was already empty, so the reference check hides the result. If the store returns the same array, select a real part instead (add a box first) and report it.

`src/app/check-overlap.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode, groupNodes } from '../document/ops'
import { createBloKadeStore } from '../store/store'
import { visibleOverlapOf } from '../store/overlap'
import { checkOverlap, overlapPair } from './check-overlap'

const box = (id: string) => createShapeNode({ id, shapeType: 'box', name: id, params: {}, color: '#fff' })
const doc = ['a', 'b', 'c'].reduce((d, id) => addNode(d, box(id)), createEmptyDocument())

function setup(overlap = vi.fn(async () => ({ status: 'none' as const }))) {
  const store = createBloKadeStore({ designId: 'd', doc })
  return { store, client: { overlap }, overlap }
}

describe('overlapPair', () => {
  it('needs exactly two different top-level parts', () => {
    expect(overlapPair(doc, ['a', 'b'])).toEqual(['a', 'b'])
    expect(overlapPair(doc, ['a'])).toBeNull()
    expect(overlapPair(doc, ['a', 'b', 'c'])).toBeNull()
    const grouped = groupNodes(doc, ['b', 'c'], 'g').doc
    expect(overlapPair(grouped, ['b', 'c'])).toBeNull()
    expect(overlapPair(grouped, ['a', 'c'])).toEqual(['a', 'g'])
  })
})

describe('checkOverlap', () => {
  it('asks for two parts when the selection is wrong (Review Focus 5)', async () => {
    const { store, client, overlap } = setup()
    store.getState().select(['a'])
    await checkOverlap(store, client)
    expect(store.getState().notice).toBe('Select two parts (Shift-click) to check if they overlap.')
    expect(overlap).not.toHaveBeenCalled()
  })

  it('stores the result for the checked design and selection', async () => {
    const { store, client } = setup(vi.fn(async () => ({ status: 'overlap' as const, volume: 12.34, mesh: {} as never })))
    store.getState().select(['a', 'b'])
    await checkOverlap(store, client)
    expect(visibleOverlapOf(store.getState())).toMatchObject({ status: 'overlap', volume: 12.34 })
  })

  it('drops a result that arrives after the design changed (Review Focus 5)', async () => {
    let finish: (value: { status: 'none' }) => void = () => undefined
    const { store, client } = setup(vi.fn(() => new Promise<{ status: 'none' }>((resolve) => { finish = resolve })))
    store.getState().select(['a', 'b'])
    const running = checkOverlap(store, client)
    store.getState().apply((d) => ({ ...d, name: 'Changed' }))
    finish({ status: 'none' })
    await running
    expect(store.getState().overlap).toBeNull()
  })

  it('shows the engine\'s explanation when a part has a problem', async () => {
    const { store, client } = setup(vi.fn(async () => { throw new Error('Can\'t check yet: "b" has a problem.') }))
    store.getState().select(['a', 'b'])
    await checkOverlap(store, client)
    expect(store.getState().notice).toBe('Can\'t check yet: "b" has a problem.')
  })
})
```

`src/ui/OverlapCheck.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument } from '../document/factory'
import { createBloKadeStore } from '../store/store'
import { OverlapCheck } from './OverlapCheck'

describe('OverlapCheck', () => {
  it('runs the check and shows the result while it is current', async () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    const onCheck = vi.fn()
    renderWithStore(<OverlapCheck onCheck={onCheck} />, store)
    await userEvent.click(screen.getByTestId('check-overlap'))
    expect(onCheck).toHaveBeenCalled()
    expect(screen.queryByTestId('overlap-result')).toBeNull()
    act(() => {
      const s = store.getState()
      s.setOverlap({ doc: s.history.present, selection: s.selection, result: { status: 'overlap', volume: 12.34, mesh: {} as never } })
    })
    expect(screen.getByTestId('overlap-result')).toHaveTextContent('These overlap by 12.3 mm³ (shown in red).')
    act(() => {
      const s = store.getState()
      s.setOverlap({ doc: s.history.present, selection: s.selection, result: { status: 'none' } })
    })
    expect(screen.getByTestId('overlap-result')).toHaveTextContent("No overlap — they don't run into each other.")
  })
})
```

Add to `src/app/actions.test.ts`:

```ts
  it('Escape clears an overlap result when it deselects', () => {
    const { store, actions } = setup()
    const s = store.getState()
    s.setOverlap({ doc: s.history.present, selection: s.selection, result: { status: 'none' } })
    actions.cancel()
    expect(store.getState().overlap).toBeNull()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/store src/app src/ui/OverlapCheck.test.tsx`
Expected: FAIL. The modules and the store field are missing.

- [ ] **Step 3: Store state**

`src/store/store.ts`: import `OverlapResult` with the other geometry types, then add:

```ts
/** The last overlap check, with the design and selection it was run on. */
export interface OverlapView {
  readonly doc: BloKadeDocument
  readonly selection: readonly NodeId[]
  readonly result: OverlapResult
}
```

Also add:
- in `BloKadeState`: `readonly overlap: OverlapView | null` and `setOverlap(overlap: OverlapView | null): void`;
- initial value `overlap: null`;
- setter `setOverlap: (overlap) => set({ overlap }),`;
- `overlap: null` in `openDesign`'s reset.

`src/store/overlap.ts`:

```ts
import type { BloKadeDocument, NodeId } from '../document/types'
import type { OverlapResult } from '../geometry/types'
import type { BloKadeState, OverlapView } from './store'

export interface OverlapInputs {
  readonly overlap: OverlapView | null
  readonly present: BloKadeDocument
  readonly selection: readonly NodeId[]
}

/** The overlap result to show: only while the design and selection are exactly the ones that were checked. */
export function visibleOverlap({ overlap, present, selection }: OverlapInputs): OverlapResult | null {
  return overlap && overlap.doc === present && overlap.selection === selection ? overlap.result : null
}

/** visibleOverlap for the whole store state. */
export const visibleOverlapOf = (s: BloKadeState): OverlapResult | null =>
  visibleOverlap({ overlap: s.overlap, present: s.history.present, selection: s.selection })
```

- [ ] **Step 4: `src/app/check-overlap.ts`**

```ts
import { rootAncestorOf } from '../document/tree'
import type { BloKadeDocument, NodeId } from '../document/types'
import type { GeometryClient } from '../geometry/client'
import type { BloKadeStore } from '../store/store'

const PICK_TWO = 'Select two parts (Shift-click) to check if they overlap.'
const FAILED = "BloKade couldn't check that. Try again."

/** The two different top-level parts covered by the selection, or null. */
export function overlapPair(doc: BloKadeDocument, selection: readonly NodeId[]): [NodeId, NodeId] | null {
  const roots = [...new Set(selection.map((id) => rootAncestorOf(doc, id)))].filter((id): id is NodeId => id !== undefined)
  return roots.length === 2 && roots[0] && roots[1] ? [roots[0], roots[1]] : null
}

/** Checks the two selected parts and stores the result, unless the design or selection changed meanwhile. */
export async function checkOverlap(store: BloKadeStore, client: Pick<GeometryClient, 'overlap'>): Promise<void> {
  const { history, selection } = store.getState()
  const doc = history.present
  const pair = overlapPair(doc, selection)
  if (!pair) {
    store.getState().notify(PICK_TWO)
    return
  }
  const stillCurrent = (): boolean => store.getState().history.present === doc && store.getState().selection === selection
  try {
    const result = await client.overlap(doc, pair[0], pair[1])
    if (stillCurrent()) store.getState().setOverlap({ doc, selection, result })
  } catch (error) {
    if (stillCurrent()) store.getState().notify(error instanceof Error && error.message ? error.message : FAILED)
  }
}
```

In `src/app/actions.ts` `cancel`, replace the final `else s.select([])` with:

```ts
      else {
        s.select([])
        s.setOverlap(null)
      }
```

- [ ] **Step 5: `src/ui/OverlapCheck.tsx` and the panel**

```tsx
import { visibleOverlap } from '../store/overlap'
import { useBloKade } from '../store/context'

const formatVolume = (volume: number): string => (volume < 0.1 ? 'less than 0.1' : String(Math.round(volume * 10) / 10))

/** "Do these two parts run into each other?" — with the answer shown while it's still true. */
export function OverlapCheck({ onCheck }: { onCheck(): void }) {
  const overlap = useBloKade((s) => s.overlap)
  const present = useBloKade((s) => s.history.present)
  const selection = useBloKade((s) => s.selection)
  const result = visibleOverlap({ overlap, present, selection })
  return (
    <div className="overlap-check">
      <h3>Fit check</h3>
      <button type="button" className="tool-button" data-testid="check-overlap" onClick={onCheck}>🔍 Check overlap</button>
      {result && (
        <p className="hint" data-testid="overlap-result" role="status">
          {result.status === 'overlap'
            ? `These overlap by ${formatVolume(result.volume)} mm³ (shown in red).`
            : "No overlap — they don't run into each other."}
        </p>
      )}
    </div>
  )
}
```

Components subscribe to the three pieces with separate `useBloKade` selectors and pass them to `visibleOverlap`. `visibleOverlapOf` is for tests and non-React code.

`src/ui/PropertiesPanel.tsx`:
- add an optional prop: `export function PropertiesPanel({ registry, onCheckOverlap }: { registry: PluginRegistry; onCheckOverlap?(): void })`;
- in the multi-selection branch, render `{onCheckOverlap && <OverlapCheck onCheck={onCheckOverlap} />}` after `<AlignTools />`.

`src/ui/Workspace.tsx`: import `checkOverlap`, then render `<PropertiesPanel registry={deps.registry} onCheckOverlap={() => void checkOverlap(store, deps.client)} />`.

- [ ] **Step 6: `src/viewport/OverlapMesh.tsx` and the viewport**

```tsx
import { useEffect, useMemo } from 'react'
import { useBloKade } from '../store/context'
import { visibleOverlap } from '../store/overlap'
import { toBufferGeometry } from './three-geometry'
import type { MeshData } from '../geometry/types'

const OVERLAP_COLOR = '#ff2d2d'

function RedShape({ mesh }: { mesh: MeshData }) {
  const geometry = useMemo(() => toBufferGeometry(mesh), [mesh])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} renderOrder={10} raycast={() => null}>
      <meshBasicMaterial color={OVERLAP_COLOR} transparent opacity={0.6} depthTest={false} />
    </mesh>
  )
}

/** Where the two checked parts run into each other, drawn in red on top of everything. World coordinates. */
export function OverlapMesh() {
  const overlap = useBloKade((s) => s.overlap)
  const present = useBloKade((s) => s.history.present)
  const selection = useBloKade((s) => s.selection)
  const result = visibleOverlap({ overlap, present, selection })
  return result?.status === 'overlap' ? <RedShape mesh={result.mesh} /> : null
}
```

In `src/viewport/Viewport.tsx`, render `<OverlapMesh />` right after `<EdgeOverlay … />`.

`src/ui/App.css`: add `.overlap-check { margin-top: 8px; }`.

- [ ] **Step 7: Run tests, typecheck and build**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: all PASS and the build is clean.

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "feat: check if two parts overlap and show it in red"
```

After this task, the controller checks it in a browser:
1. Add two boxes and move one so they overlap.
2. Shift-select both and press 🔍 Check overlap. Expect a red block where they overlap and "These overlap by … mm³".
3. Move one box. The red block and the result should disappear.

---

### Task 11: End-to-end tests for Perfect Fit

**Files:**
- Create: `e2e/perfect-fit.spec.ts`

**Interfaces:**
- Consumes these test ids:
  - from Task 8: `add-kit-peg-socket`;
  - from Task 1: `param-clearance` and `param-style`;
  - `fit` (Fit gap), `add-box`, `add-screw-hole`, `add-threaded-rod`, `pos-x`, `group`, `export-stl`;
  - from Task 10: `check-overlap` and `overlap-result`;
  - the scene tree rows (role `treeitem`, named by part name).

- [ ] **Step 1: Write `e2e/perfect-fit.spec.ts`**

```ts
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

async function setField(page: Page, testId: string, value: string) {
  await page.getByTestId(testId).fill(value)
  await page.getByTestId(testId).press('Enter')
}

async function ready(page: Page) {
  await page.goto('/')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
}

test('peg & socket stay matched when the fit gap changes', async ({ page }) => {
  await ready(page)
  await page.getByTestId('add-kit-peg-socket').click()
  await expect(page.getByRole('treeitem', { name: 'Peg' })).toBeVisible()
  await page.getByRole('treeitem', { name: 'Socket' }).click()
  await expect(page.getByTestId('param-clearance')).toHaveValue('fit')
  await expect(page.getByTestId('param-clearance-value')).toHaveText('= 0.2')
  await setField(page, 'fit', '0.4')
  await expect(page.getByTestId('param-clearance-value')).toHaveText('= 0.4')
  await expect(page.getByLabel(/^Problem/)).toHaveCount(0)
})

test('a countersunk screw hole cuts into a box and exports', async ({ page }) => {
  await ready(page)
  await page.getByTestId('add-box').click()
  await page.getByTestId('add-screw-hole').click()
  await page.getByTestId('param-style').selectOption('countersunk')
  await page.getByRole('treeitem', { name: 'Box' }).click()
  await page.getByRole('treeitem', { name: 'Screw hole' }).click({ modifiers: ['Shift'] })
  await page.getByTestId('group').click()
  await expect(async () => {
    const downloading = page.waitForEvent('download')
    await page.getByTestId('export-stl').click()
    const bytes = await readFile(await (await downloading).path())
    expect(bytes.readUInt32LE(80)).toBeGreaterThan(100)
  }).toPass({ timeout: 20_000 })
  await expect(page.getByLabel(/^Problem/)).toHaveCount(0)
})

test('a threaded rod builds', async ({ page }) => {
  await ready(page)
  await page.getByTestId('add-threaded-rod').click()
  await expect(async () => {
    const downloading = page.waitForEvent('download')
    await page.getByTestId('export-stl').click()
    const bytes = await readFile(await (await downloading).path())
    expect(bytes.readUInt32LE(80)).toBeGreaterThan(1000)
  }).toPass({ timeout: 30_000 })
})

test('overlap check finds where two boxes collide', async ({ page }) => {
  await ready(page)
  await page.getByTestId('add-box').click()
  await page.getByTestId('add-box').click()
  await setField(page, 'pos-x', '10')
  await page.getByRole('treeitem', { name: 'Box' }).first().click()
  await page.getByRole('treeitem', { name: 'Box' }).last().click({ modifiers: ['Shift'] })
  await page.getByTestId('check-overlap').click()
  await expect(page.getByTestId('overlap-result')).toHaveText('These overlap by 4000 mm³ (shown in red).', { timeout: 20_000 })
})
```

Notes for these tests:
- The second `add-box` lands at the origin, like the first one. Setting `pos-x` to 10 makes the two 20 mm boxes overlap by 10 × 20 × 20 = 4000 mm³.
- Both boxes are named "Box", which is why the test uses `.first()` and `.last()`.
- The problem badge's accessible name starts with "Problem" (Milestone 1).

- [ ] **Step 2: Run the end-to-end suite**

Run: `npm run e2e`
Expected: 13 passed (9 earlier, 4 new).

If a selector differs from the real UI, check the component and make the smallest change to the test. If the app itself is wrong, don't patch it here: report DONE_WITH_CONCERNS with a reproduction.

- [ ] **Step 3: Commit**

```bash
git add e2e/perfect-fit.spec.ts
git commit -m "test: add end-to-end Perfect Fit flows"
```

---

### Task 12: Docs and final verification

**Files:**
- Modify: `README.md`, `plugins/README.md`

- [ ] **Step 1: Add a "Perfect fit" section to `README.md`**

Put it under "Round & repeat", inside "Using BloKade":

```markdown
### Perfect fit

The **Fit tools** section (left side) makes parts that go together. Every one of them uses the **Fit gap**
(Variables panel, 0.2 mm to start): holes get that much extra room on every side, so parts slide together
after printing. If your printer makes tight parts, raise the fit gap and every hole grows.

- **🧷 Peg & socket:** adds a peg and its socket (a hole) together, linked by the variables `peg_size` and
  `peg_length`. Change those and both follow. Put the socket in a part and group them to cut it.
- **🪝 Snap-fit clip:** a bendy arm with a hook, and the slot it snaps through (linked by `clip_width` and
  `clip_thickness`). Set the catch's *Wall thickness* to the wall it goes through.
- **🔩 Screw hole:** M2–M5, as a plain hole, countersunk (flat-head screws), counterbored (cap-head screws),
  with a nut trap at the bottom, or for a heat-set insert at the top. The screw goes in from the top.
- **🪛 Threaded rod / 🌀 Threaded hole:** printable M6–M20 threads, up to 40 turns long. M8 and bigger print
  best.
- **🔍 Check overlap:** select two parts (Shift-click) and press *Check overlap* in Properties. Any overlap
  shows in red, with its size.

Every fit tool's **Extra room** starts as the formula `fit`. Type a number there to give one part its own gap.
```

- [ ] **Step 2: Mention the new plugin fields in `plugins/README.md`**

Read the file and add a short section that follows its existing tone:

```markdown
### Pick-from-a-list and fit-aware parameters

- `{ type: 'choice', default: 'round', label: 'Shape', options: [{ value: 'round', label: 'Round' }, { value: 'square', label: 'Square' }] }`
  shows a drop-down. `build()` gets the picked `value`.
- Add `formula: 'fit'` to a number parameter to start it as the design's fit gap (only `fit` is allowed there).
- `mode: 'hole'` makes new parts of your shape start as holes.
- `palette: 'fit'` lists your shape under Fit tools instead of Shapes.
```

If the file has no natural place for it, add it at the end.

- [ ] **Step 3: Run every check**

```bash
npm run typecheck
npx vitest run
npm run coverage
npm run build
npm run e2e
```

Expected:
- typecheck clean;
- all unit tests pass;
- coverage meets the thresholds;
- the build succeeds;
- 13 end-to-end tests pass.

If coverage falls short, report the numbers and the files that pull it down. Don't lower thresholds or add filler tests.

- [ ] **Step 4: Commit**

```bash
git add README.md plugins/README.md
git commit -m "docs: explain the fit tools and fit-aware plugin params"
```

---

## Milestone 4 Done When

- **Peg & socket kit:** adds a matched peg and socket hole linked by `peg_size` and `peg_length`. The socket is bigger by the fit gap on every side and follows changes to `fit`. Adding the kit twice numbers the variables, and one undo removes a whole kit.
- **Screw holes:** M2–M5 build as plain, countersunk, counterbored, nut-trap and heat-set-insert holes, with ISO sizes plus the fit gap. Too-shallow holes explain the depth they need.
- **Threads:** M6–M20 threaded rods and holes build, and a rod fits inside its matching hole. Threads over 40 turns are refused instantly.
- **Snap-fit kit:** adds a hooked arm and its catch slot, linked by `clip_width` and `clip_thickness`.
- **Overlap check:** shows where two selected parts collide, in red with the volume, or says there's no overlap. The result disappears when the design or the selection changes.
- **Plugin model:** plugins can declare choice parameters, starting formulas (only `fit`), hole-by-default and a palette section. Fit tools are listed under "Fit tools", with the kits first.
- **Checks pass:** typecheck, unit tests, coverage thresholds, build, and all 13 end-to-end tests.
