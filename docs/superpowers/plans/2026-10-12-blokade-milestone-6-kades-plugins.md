# BloKade Milestone 6 ("Kade's Plugins") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kade writes their own shapes in BloKade, with a code box, a live preview, ten coding lessons and a ❓ Commands list. Their shapes go into designs, travel inside design files, and print.

**Architecture:**

- **Kade's code only ever runs in the geometry worker.**
  - The worker imports it as a module from a blob URL, checks it, and reports back its name, icon and settings, or a friendly problem.
  - The page keeps those details in a catalog. It turns them into ordinary plugin entries for the palette, Properties and size handles.
  - Building always happens in the worker.
- **Designs carry the code of every Kade shape they use** (`plugins`, schema v4).
  - The worker builds a design from its carried code, so a design file opens anywhere, even with an empty shape library.
  - The editor's live preview is a one-part design built on its own "preview" channel.
- **A friendly `cad` toolkit** wraps the existing internal toolkit.
  - Its parts are never changed in place.
  - It tracks every shape a build makes and frees all but the result.
  - It explains bad inputs in plain words.
- **Coding lessons reuse Milestone 5's lesson store, step cards and step watcher.** Their checks read a `CodeView` (the code, whether it builds, its size and its settings) instead of the design.

**Tech Stack:**

- Everything from Milestone 5: TypeScript 5.9 strict with `noUncheckedIndexedAccess`, React 19, Vite 8, Zustand 5, zod 4, Vitest 5 with jsdom per file, Testing Library, Playwright, replicad/OpenCascade in a Comlink worker, and idb-keyval.
- **New dependencies:** CodeMirror 6, as `codemirror@^6.0.2`, `@codemirror/lang-javascript@^6.2.5` and `@lezer/javascript@^1.5.6`. The last is CodeMirror's own JavaScript parser, used to find syntax mistakes without running the code.

**Spec:** `docs/superpowers/specs/2026-10-12-blokade-learn-and-plugins-design.md`, §1 and §3. The main spec, `docs/superpowers/specs/2026-10-11-blokade-design.md`, still applies.

## Global Constraints

- **Earlier rules still apply.** Everything in the Milestone 1–5 Global Constraints still holds:
  - Z-up, mm, degrees.
  - Immutable document and store.
  - Files under 400 lines, functions under 50 lines, nesting at most 4 levels.
  - No `console.log`; `console.error` is allowed for real failures.
  - `Object.hasOwn` for record lookups.
  - 80%+ line coverage on non-UI logic.
  - Conventional commits ending with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Never stage `docs/superpowers/.DS_Store`.
- **Dependencies:** the only new ones are `codemirror`, `@codemirror/lang-javascript` and `@lezer/javascript`.
- **Where Kade's code may run:**
  - It never runs in the page.
  - The only place it runs is a blob-module `import()` in the geometry worker (`src/kade/blob-loader.ts`).
  - `eval` and `new Function` stay banned everywhere.
  - Formulas keep their own no-`eval` parser.
- **Worker-only modules:** `src/kade/args.ts`, `part.ts`, `toolkit.ts`, `run-build.ts`, `kade-shapes.ts` and `blob-loader.ts`. They are imported only by `src/geometry/**` and tests, never by page code, so replicad stays out of the page bundle.
- **Schema v4:**
  - The design gets `plugins: { [id]: { name, code } }`.
  - Shape ids match `^[a-z][a-z0-9-]{0,63}$`; BloKade makes them as `my-` plus 10 hex characters.
  - Names are 1–60 characters, code is at most `MAX_SHAPE_CODE_LENGTH = 50_000` characters, and a design carries at most `MAX_CARRIED_SHAPES = 100` shapes.
  - v3 designs migrate by adding `plugins: {}`.
- **Friendly toolkit limits:**
  - Sizes must be bigger than 0 and at most 2000 mm (`MAX_MM`).
  - Moves are at most 2000 mm.
  - `cad.repeat` makes 1 to 200 copies.
  - Every command returns a new part and never changes the old one.
- **Setting types:** `mm`, `whole`, `number`, `angle`, `text`, `choice` and the new `yesno` (a tick box; `build` gets `true` or `false`). `settings` and `params` are both accepted. `label` is optional and defaults to the setting's name.
- **Timing:**
  - Typing settles 500 ms after it stops (`SAVE_DELAY_MS`). Then the code is saved to the library, checked and previewed.
  - A runaway build or load is stopped by the existing 30 s worker restart, and the preview then shows exactly `This shape took too long to build. Check for a loop that never ends.`
- **Shape library storage:** its own IndexedDB database, `blokade-shapes`, store `shapes`, through idb-keyval. A failed save shows one notice suggesting **Save to file**, and the editor keeps working in memory.
- **Kid-facing writing style** (spec §1):
  - Short sentences, everyday words, one idea per sentence.
  - Name controls the way the screen shows them, **bold** with their icon.
  - No blame.
  - `**text**` is the only markup in lesson and help text.
  - Error messages for Kade's code start with `Line N: ` when the line is known.
- **Not included:** sharing shapes between computers other than by file, TypeScript in the editor, and autocomplete.

## Review Focus

1. **Kade's code never stops**, either an endless loop in `build` or at the top level of the module.
   - Expected: the app stays usable. The preview part shows the loop message after the 30 s restart, and later checks and builds work.
   - Pinned in Task 9 (the client restarts a stuck `inspect` and a stuck preview build, then builds the design) and Task 13 (the preview puts the loop message on the part).
   - Also pinned in Task 11: the catalog reports the loop message for an `inspect` that timed out.
2. **Typing in the code box.** Delete, Backspace, Ctrl+Z, Ctrl+D, H or Esc must not reach the design shortcuts while 🧩 My shapes is open.
   - Expected: the design and its selection are untouched.
   - Pinned in Task 19 (`Workspace.my-shapes.test.tsx`).
3. **A design carrying a shape that is broken, outdated or missing from the library**, for example a file opened in a fresh browser.
   - Expected: the design opens, only that part shows its problem, other parts build, and **Use my newest version** is one undo step.
   - Pinned in Task 8 (a fresh worker builds and exports a carried shape; broken carried code fails only its own part) and Task 11 (the swap is one undo step).
   - Also pinned in Task 19 (the banner) and Task 21 (an end-to-end test in a fresh browser context).
4. **Badly formed shape definitions.** Examples: no `export default`, a setting with a wrong default, `size` pointing at a text setting, `build` returning nothing or an outline, code over 50 000 characters, a misspelt name at the top of the file.
   - Expected: one friendly message, with its line when known, and never a crash.
   - Pinned in Tasks 3, 5 and 6, and in Task 8 (top-level errors and over-long code in the worker).
5. **Shape library storage blocked or holding damaged entries.**
   - Expected: damaged entries are skipped, a failed save shows one notice, and editing keeps working in memory.
   - Pinned in Task 10 (damaged entries) and Task 12 (blocked storage).

---

## File Map

```
src/
├─ kade/                         # Kade's shapes (page-safe unless marked worker only)
│  ├─ args.ts                    # CadError + input checks                          (worker only)
│  ├─ part.ts                    # ShapeTracker, Part, Outline                      (worker only)
│  ├─ toolkit.ts                 # createKadeToolkit, the friendly cad              (worker only)
│  ├─ run-build.ts               # runKadeBuild, MISSING_RETURN                     (worker only)
│  ├─ kade-shapes.ts             # KadeShapes: inspect + registryFor(doc)           (worker only)
│  ├─ blob-loader.ts             # blobModuleLoader                                 (worker only)
│  ├─ syntax.ts, errors.ts       # findSyntaxProblem (lezer), friendlyError, lineOf, problemLine
│  ├─ messages.ts, hash.ts       # TOO_LONG, CHECK_FAILED, CODE_TOO_BIG; codeHash
│  ├─ settings.ts, definition.ts # toParamSpecs; readShapeDefinition
│  ├─ meta.ts                    # ShapeMeta, InspectResult, metaToPlugin
│  ├─ module-loader.ts           # ModuleLoader, LoadedModule, ModuleLoadError
│  ├─ folder.ts                  # loadFolderPlugins (plugins/ folder)
│  ├─ commands.ts                # CAD_COMMANDS (❓ Commands), checked against the toolkit
│  ├─ examples/gear.ts           # GEAR_CODE
│  ├─ library.ts                 # LibraryShape, IndexedDB + memory repos, newShapeId, shapeFileName
│  ├─ catalog.ts                 # the page's inspect results, namesFromChecks
│  ├─ shape-registry.ts          # buildShapeRegistry (built-ins, folder, library, carried)
│  ├─ carried.ts                 # carryShape, outdatedShapes, withNewestVersions
│  ├─ starter.ts                 # NEW_SHAPE_CODE, nameInCode, renameInCode, uniqueName
│  ├─ editor-store.ts            # My shapes state, drafts, autosave
│  ├─ preview.ts                 # preview design + store + status + syncPreview
│  ├─ code-view.ts               # CodeView, codeViewOf, createCodeViewSource
│  ├─ useShapeRegistry.ts, usePreview.ts   # thin hooks
│  ├─ lessons/                   # types, start, watch-code-steps, checks, basics (1–5), shapes (6–10), index
│  └─ testing/                   # file-loader, build-code (Node tests only); lessons/testing: solutions, code-view
├─ learn/ step-watcher.ts (new), all-lessons.ts (new); types, view, lesson-store, watch-steps (generic)
├─ app/ useShapeSetup.ts (new); actions, deps, testing/fakes, testing/main-screen (modified)
├─ ui/
│  ├─ CodeBox, ProblemList, LibraryList, ShapePreview, CommandsReference      (new)
│  ├─ LessonCards, CodeLessonsPanel, MyShapesScreen, NewerShapesBanner        (new)
│  └─ ParamField, PropertiesPanel, ShapePalette, Toolbar, Workspace, LessonStep, LessonsPanel, App.css (modified)
├─ geometry/ types, api, client, evaluate, spawn, geometry.worker (modified)
├─ plugins/ types, params, registry, index (modified)
├─ document/ types, schema, factory (modified); persistence/migrate.ts (modified)
├─ help/ help-texts, help-patterns (modified)
└─ test-setup.ts (jsdom gaps for CodeMirror)
e2e/my-shapes.spec.ts
README.md, plugins/README.md, vite.config.ts (coverage), package.json (CodeMirror)
```

---

## Task 1: Tick-box settings (`yesno`)

A new setting type that `build` receives as `true` or `false`. Built-ins can use it too.

**Files:**
- Modify: `src/document/types.ts` (ParamValue), `src/document/schema.ts` (params union)
- Modify: `src/plugins/types.ts`, `src/plugins/params.ts`, `src/plugins/registry.ts`
- Modify: `src/ui/ParamField.tsx`, `src/ui/PropertiesPanel.tsx` (setRaw type)
- Test: `src/plugins/params.test.ts`, `src/plugins/registry.test.ts`, `src/document/schema.test.ts`, `src/ui/ParamField.test.tsx`

**Interfaces:**
- Produces:
  - `ParamValue = number | string | boolean`.
  - `YesNoParamSpec { type: 'yesno'; default: boolean; label: string }`, which is part of `ParamSpec`.
  - `normalizeYesNoParam(spec, raw): boolean`.
  - `ParamField`'s `setRaw(name: string, value: ParamValue)`.
  - A yesno setting renders `<input type="checkbox" data-testid="param-<name>">` inside `label.checkbox-field`.
  - `export const FIT_ONLY` from `src/plugins/registry.ts`, which Task 6 reuses.

- [ ] **Step 1: Write the failing tests**

Add to `src/plugins/params.test.ts`:

```ts
import { normalizeYesNoParam } from './params'

describe('yes/no settings', () => {
  const spec = { type: 'yesno', default: true, label: 'Round' } as const
  it('keeps true and false', () => {
    expect(normalizeYesNoParam(spec, false)).toBe(false)
    expect(normalizeYesNoParam(spec, true)).toBe(true)
  })
  it('uses the default for anything else', () => {
    expect(normalizeYesNoParam(spec, 'false')).toBe(true)
    expect(normalizeYesNoParam(spec, 0)).toBe(true)
    expect(normalizeYesNoParam(spec, undefined)).toBe(true)
  })
  it('resolves with the rest of the params', () => {
    const plugin = { id: 'p', name: 'P', icon: 'x', version: 1, params: { round: spec }, build: () => { throw new Error('unused') } }
    expect(resolveParams(plugin, { round: false })).toEqual({ round: false })
    expect(resolveParams(plugin, {})).toEqual({ round: true })
  })
})
```

(Merge the import into the file's existing import from `./params`, which already brings in `resolveParams`.)

Add to `src/plugins/registry.test.ts`:

```ts
describe('yes/no settings', () => {
  const plugin = (params: Record<string, unknown>) => ({ id: 'tick', name: 'Tick', icon: 'x', version: 1, params, build: () => null })
  it('accepts a yes/no setting', () => {
    const { problems } = createRegistry([plugin({ round: { type: 'yesno', default: false, label: 'Round' } })])
    expect(problems).toEqual([])
  })
  it('rejects a yes/no default that is not true or false', () => {
    const { problems } = createRegistry([plugin({ round: { type: 'yesno', default: 'no', label: 'Round' } })])
    expect(problems).toHaveLength(1)
  })
  it('refuses a size handle on a yes/no setting', () => {
    const { problems } = createRegistry([{ ...plugin({ round: { type: 'yesno', default: false, label: 'Round' } }), size: { x: 'round' } }])
    expect(problems[0]).toContain("can't change the yesno parameter")
  })
})
```

Add to `src/document/schema.test.ts` (import `createShapeNode` and `createEmptyDocument` from `./factory` and `addNode` from `./ops` if the file doesn't already):

```ts
it('accepts true and false as part settings', () => {
  const node = createShapeNode({ id: 'n', shapeType: 'x', name: 'X', params: { round: true, hollow: false }, color: '#fff' })
  expect(validateDocument(addNode(createEmptyDocument(), node)).ok).toBe(true)
})
```

Add to `src/ui/ParamField.test.tsx`:

```tsx
it('shows a yes/no setting as a tick box and saves true or false', async () => {
  const setRaw = vi.fn()
  const node = createShapeNode({ id: 'n', shapeType: 'x', name: 'X', params: { round: false }, color: '#fff' })
  render(<ParamField node={node} name="round" spec={{ type: 'yesno', default: false, label: 'Round' }} errors={{}}
    setField={vi.fn()} setRaw={setRaw} />)
  const box = screen.getByTestId('param-round')
  expect(box).not.toBeChecked()
  await userEvent.click(box)
  expect(setRaw).toHaveBeenCalledWith('round', true)
  expect(screen.getByLabelText('Round')).toBe(box)
})
```

(Reuse the file's existing imports for `render`, `screen`, `userEvent`, `vi` and `createShapeNode`, and add any that are missing.)

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/plugins/params.test.ts src/plugins/registry.test.ts src/document/schema.test.ts src/ui/ParamField.test.tsx`
Expected: FAIL. `normalizeYesNoParam` is not exported, the registry rejects `type: 'yesno'`, and the schema rejects `true`.

- [ ] **Step 3: Implement**

`src/document/types.ts`, the ParamValue line and its comment:

```ts
/** A shape parameter: a number, a line of text, a picked option, or true/false for a tick box. */
export type ParamValue = number | string | boolean
```

`src/document/schema.ts`, the `params` line of `shapeNode`:

```ts
  params: z.record(z.string(), z.union([z.number(), z.string().max(MAX_TEXT_PARAM_LENGTH * 2), z.boolean()])),
```

`src/plugins/types.ts`:
- Add after `ChoiceParamSpec`:

```ts
/** A tick box. build() gets true or false. Never holds a formula. */
export interface YesNoParamSpec {
  readonly type: 'yesno'
  readonly default: boolean
  readonly label: string
}
```

- Replace the `ParamSpec`, `isNumberSpec` and `ValueOf` lines:

```ts
export type ParamSpec = NumberParamSpec | TextParamSpec | ChoiceParamSpec | YesNoParamSpec

export const isNumberSpec = (spec: ParamSpec): spec is NumberParamSpec =>
  spec.type !== 'text' && spec.type !== 'choice' && spec.type !== 'yesno'
```

```ts
/** Distributes over a union, so a general ParamSpec gives number | string | boolean. Choices give the union of their option values. */
type ValueOf<S> = S extends ChoiceParamSpec ? S['options'][number]['value']
  : S extends TextParamSpec ? string
    : S extends YesNoParamSpec ? boolean
      : number
```

- Change the `ParamValuesOf` doc comment to "What build() receives: numbers, strings for text and choices, booleans for tick boxes."

`src/plugins/params.ts`:
- Import `YesNoParamSpec`.
- Add:

```ts
/** true or false; anything else becomes the default. */
export function normalizeYesNoParam(spec: YesNoParamSpec, raw: unknown): boolean {
  return typeof raw === 'boolean' ? raw : spec.default
}
```

- Add `case 'yesno': return normalizeYesNoParam(spec, raw)` to `normalizeAny`'s switch.

`src/plugins/registry.ts`:
- Add the spec, and add it to the union:

```ts
const yesNoSpec = z.object({ type: z.literal('yesno'), default: z.boolean(), label: z.string().min(1) })
const paramSpec = z.union([numberSpec, textSpec, choiceSpec, yesNoSpec])
```

- Change `const FIT_ONLY` to `export const FIT_ONLY`.

`src/ui/ParamField.tsx`:
- Change `setRaw(name: string, value: string): void` to `setRaw(name: string, value: ParamValue): void` and import `ParamValue` from `../document/types`.
- Add this before the `choice` branch:

```tsx
  if (spec.type === 'yesno') {
    return (
      <label className="checkbox-field">
        <input type="checkbox" data-testid={`param-${name}`} checked={typeof raw === 'boolean' ? raw : spec.default}
          onChange={(e) => setRaw(name, e.target.checked)} />
        <span>{spec.label}</span>
      </label>
    )
  }
```

`src/ui/PropertiesPanel.tsx`: in `ShapeParams`, change `const setRaw = (key: string, value: string)` to `(key: string, value: ParamValue)` and import `ParamValue`.

- [ ] **Step 4: Run the tests and the type check**

Run: `npx vitest run src/plugins src/document src/ui/ParamField.test.tsx src/ui/PropertiesPanel.test.tsx && npm run typecheck`
Expected: PASS, with no type errors. The existing `typeof value === 'number'` checks in `sizing.ts` and `fields.ts` already ignore booleans.

- [ ] **Step 5: Commit**

```bash
git add src/document/types.ts src/document/schema.ts src/document/schema.test.ts src/plugins/types.ts src/plugins/params.ts src/plugins/params.test.ts src/plugins/registry.ts src/plugins/registry.test.ts src/ui/ParamField.tsx src/ui/ParamField.test.tsx src/ui/PropertiesPanel.tsx
git commit -m "feat: add yes/no tick-box settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 2: Designs carry Kade's shapes (schema v4)

**Files:**
- Modify: `src/document/types.ts`, `src/document/schema.ts`, `src/document/factory.ts`, `src/persistence/migrate.ts`
- Test: `src/persistence/migrate.test.ts`, `src/document/schema.test.ts`, `src/persistence/design-file.test.ts`

**Interfaces:**
- Produces, in `src/document/types.ts`:
  - `CarriedShape { readonly name: string; readonly code: string }`.
  - `BloKadeDocument.plugins: Readonly<Record<string, CarriedShape>>` and `schemaVersion: 4`.
  - `CURRENT_SCHEMA_VERSION = 4`, `MAX_SHAPE_CODE_LENGTH = 50_000`, `MAX_CARRIED_SHAPES = 100`, `MAX_SHAPE_NAME_LENGTH = 60`, `SHAPE_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/`.
- `createEmptyDocument()` includes `plugins: {}`.

- [ ] **Step 1: Write the failing tests**

`src/persistence/migrate.test.ts`:
- Update the existing "upgrades to the current version" expectation from version 3 to 4.
- Add:

```ts
it('gives version 3 designs an empty list of carried shapes', () => {
  const v3 = { ...createEmptyDocument(), schemaVersion: 3 } as Record<string, unknown>
  delete v3.plugins
  const result = migrateDocument(v3)
  expect(result.ok && result.value).toMatchObject({ schemaVersion: 4, plugins: {} })
})
```

`src/document/schema.test.ts`:
- Change the "newer version" case from `schemaVersion: 4` to `schemaVersion: 5`.
- Add:

```ts
describe('carried shapes', () => {
  const code = "export default { name: 'Gear', build(s, cad) { return cad.box(1, 1, 1) } }"
  const withShapes = (plugins: unknown) => ({ ...createEmptyDocument(), plugins })

  it('accepts shapes with an id, a name and code', () => {
    expect(validateDocument(withShapes({ 'my-0123456789': { name: 'Gear', code } })).ok).toBe(true)
  })
  it('rejects an id with capitals or spaces', () => {
    expect(validateDocument(withShapes({ 'My Gear': { name: 'Gear', code } })).ok).toBe(false)
  })
  it('rejects code over the length limit', () => {
    expect(validateDocument(withShapes({ 'my-a': { name: 'Gear', code: 'x'.repeat(MAX_SHAPE_CODE_LENGTH + 1) } })).ok).toBe(false)
  })
  it('rejects an empty name', () => {
    expect(validateDocument(withShapes({ 'my-a': { name: '', code } })).ok).toBe(false)
  })
  it('rejects more than the carried shape limit', () => {
    const many = Object.fromEntries(Array.from({ length: MAX_CARRIED_SHAPES + 1 }, (_, i) => [`my-${i}`, { name: 'S', code }]))
    const result = validateDocument(withShapes(many))
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toContain('up to 100 of your shapes')
  })
  it('needs the plugins field', () => {
    const withoutShapes: Record<string, unknown> = { ...createEmptyDocument() }
    delete withoutShapes.plugins
    expect(validateDocument(withoutShapes).ok).toBe(false)
  })
})
```

(Import `MAX_CARRIED_SHAPES` and `MAX_SHAPE_CODE_LENGTH` from `./types` and `createEmptyDocument` from `./factory`.)

`src/persistence/design-file.test.ts`:
- Change line 39's `toBe(3)` to `toBe(4)`.
- Add:

```ts
it('keeps carried shapes through save and load', () => {
  const doc = { ...createEmptyDocument('Gears'), plugins: { 'my-0123456789': { name: 'Gear', code: 'export default {}' } } }
  const loaded = parseDesignFile(serializeDesign(doc))
  expect(loaded.ok && loaded.value.plugins).toEqual(doc.plugins)
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/persistence src/document/schema.test.ts`
Expected: FAIL. There is no migration for version 3, the schema expects version 3, and `plugins` is unknown.

- [ ] **Step 3: Implement**

`src/document/types.ts`:
- Above `BloKadeDocument`, add:

```ts
/** One of Kade's shapes, carried inside a design so the design builds anywhere, even without Kade's library. */
export interface CarriedShape {
  readonly name: string
  readonly code: string
}
```

- In `BloKadeDocument`, change `readonly schemaVersion: 3` to `readonly schemaVersion: 4`, and add as its last field:

```ts
  /** The code of every one of Kade's shapes this design uses, by shape id. */
  readonly plugins: Readonly<Record<string, CarriedShape>>
```

- Change `CURRENT_SCHEMA_VERSION = 3` to `= 4`. Then add:

```ts
/** Kade's shape code can be up to this many characters. */
export const MAX_SHAPE_CODE_LENGTH = 50_000
/** A design can carry up to this many of Kade's shapes. */
export const MAX_CARRIED_SHAPES = 100
export const MAX_SHAPE_NAME_LENGTH = 60
/** Ids of Kade's shapes. BloKade makes them as `my-` plus 10 hex characters. */
export const SHAPE_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/
```

`src/document/schema.ts`:
- Import the four constants.
- Add above `documentShape`:

```ts
const carriedShape = z.object({
  name: z.string().min(1).max(MAX_SHAPE_NAME_LENGTH),
  code: z.string().max(MAX_SHAPE_CODE_LENGTH),
})
const carriedShapes = z.record(z.string().regex(SHAPE_ID_PATTERN), carriedShape)
  .refine((shapes) => Object.keys(shapes).length <= MAX_CARRIED_SHAPES, `A design can carry up to ${MAX_CARRIED_SHAPES} of your shapes`)
```

- In `documentShape`, change `schemaVersion: z.literal(3)` to `z.literal(4)`, and add `plugins: carriedShapes,` after `nodes`.

`src/document/factory.ts`: in `createEmptyDocument`, add `plugins: {},` after `nodes: {}`.

`src/persistence/migrate.ts`, add to `MIGRATIONS`:

```ts
  // Version 4 (Milestone 6) lets a design carry the code of Kade's own shapes.
  3: (doc) => ({ ...doc, plugins: {} }),
```

Then run `npm run typecheck`. Any test that builds a `BloKadeDocument` by hand, instead of through `createEmptyDocument`, now needs `plugins: {}` and `schemaVersion: 4`. Find them with `grep -rn "schemaVersion: 3" src e2e` and fix each one the same way.

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS (the whole suite, because every document now has `plugins`).

- [ ] **Step 5: Commit**

```bash
git add src/document src/persistence
git commit -m "feat: let designs carry Kade's shapes (schema v4)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 3: Spotting mistakes (syntax check and friendly errors)

CodeMirror's JavaScript parser finds syntax mistakes without running anything. `friendlyError` turns JavaScript's own messages into kid-friendly ones, adding the line number when it is known.

**Files:**
- Modify: `package.json`, `package-lock.json` (new dependencies)
- Create: `src/kade/syntax.ts`, `src/kade/errors.ts`, `src/kade/messages.ts`, `src/kade/hash.ts`
- Test: `src/kade/syntax.test.ts`, `src/kade/errors.test.ts`, `src/kade/hash.test.ts`

**Interfaces:**
- Produces:
  - `findSyntaxProblem(code: string): string | null`.
  - `SYNTAX_PROBLEM(line: number): string`.
  - `friendlyError(error: unknown, source: string | null): string`.
  - `lineOf(error: unknown, source: string): number | null`.
  - `problemLine(message: string): number | null`.
  - `codeHash(code: string): string`.
  - In `messages.ts`: `TOO_LONG`, `CHECK_FAILED`, `CODE_TOO_BIG`.

- [ ] **Step 1: Add the dependencies**

Run: `npm install codemirror@^6.0.2 @codemirror/lang-javascript@^6.2.5 @lezer/javascript@^1.5.6`
Expected: `package.json` lists the three under `dependencies`.

- [ ] **Step 2: Write the failing tests**

`src/kade/syntax.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { findSyntaxProblem } from './syntax'

describe('findSyntaxProblem', () => {
  it('is happy with good code', () => {
    expect(findSyntaxProblem("export default { name: 'A', build(s, cad) { return cad.box(1, 2, 3) } }")).toBeNull()
  })
  it('finds a missing bracket and says which line', () => {
    const code = ['export default {', "  name: 'A',", '  build(s, cad) {', '    return cad.box(1, 2, 3', '  },', '}'].join('\n')
    expect(findSyntaxProblem(code)).toMatch(/^Line [45]: something here doesn't look right/)
  })
  it('finds a missing quote', () => {
    expect(findSyntaxProblem("export default { name: 'A }")).toMatch(/^Line 1:/)
  })
  it('is happy with an empty file (the definition check explains what is missing)', () => {
    expect(findSyntaxProblem('')).toBeNull()
  })
})
```

`src/kade/errors.test.ts`:

```ts
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
```

`src/kade/hash.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { codeHash } from './hash'

describe('codeHash', () => {
  it('is the same for the same code and different for different code', () => {
    expect(codeHash('return 1')).toBe(codeHash('return 1'))
    expect(codeHash('return 1')).not.toBe(codeHash('return 2'))
  })
  it('makes a short id-safe string', () => {
    expect(codeHash('x'.repeat(10_000))).toMatch(/^[0-9a-f]{8}-[0-9a-z]+$/)
  })
})
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run src/kade`
Expected: FAIL. The modules don't exist.

- [ ] **Step 4: Implement**

`src/kade/messages.ts`:

```ts
/** Shown when Kade's code is stopped by the worker restart (an endless loop). */
export const TOO_LONG = 'This shape took too long to build. Check for a loop that never ends.'
export const CHECK_FAILED = "BloKade couldn't check this shape. Try again in a moment."
export const CODE_TOO_BIG = "This shape's code is too long. A shape can be up to 50 000 characters."
```

`src/kade/hash.ts`:

```ts
/** FNV-1a hash of the code plus its length. Used as a cache key and as a shape's revision. */
export function codeHash(code: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < code.length; i += 1) {
    hash ^= code.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${(hash >>> 0).toString(16).padStart(8, '0')}-${code.length.toString(36)}`
}
```

`src/kade/syntax.ts`:

```ts
import { parser } from '@lezer/javascript'

export const SYNTAX_PROBLEM = (line: number): string =>
  `Line ${line}: something here doesn't look right — check for a missing bracket, comma or quote.`

const lineAt = (code: string, position: number): number => code.slice(0, position).split('\n').length

/** The first syntax mistake in Kade's code, found without running it. Null when the code parses. */
export function findSyntaxProblem(code: string): string | null {
  let found: number | null = null
  parser.parse(code).iterate({
    enter: (node) => {
      if (found !== null) return false
      if (node.type.isError) found = node.from
      return undefined
    },
  })
  return found === null ? null : SYNTAX_PROBLEM(lineAt(code, found))
}
```

`src/kade/errors.ts`:

```ts
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

interface Rule {
  readonly pattern: RegExp
  explain(match: RegExpMatchArray): string
}

const lastPart = (name: string): string => name.split('.').pop() ?? name

/** JavaScript's own messages (Chrome and Firefox wordings) in plain words. */
const RULES: readonly Rule[] = [
  { pattern: /^(\S+) is not defined$/, explain: (m) => `there's nothing called "${m[1]}" — check the spelling.` },
  { pattern: /^(\S+) is not a function/, explain: (m) => `"${lastPart(m[1] ?? '')}" isn't a command — check the spelling, or look in ❓ Commands.` },
  { pattern: /^Cannot read properties of (?:undefined|null) \(reading '(.+?)'\)$/, explain: (m) => `something is missing before ".${m[1]}" — check that it has a value.` },
  { pattern: /^can't access property "(.+?)", .+ is (?:undefined|null)$/, explain: (m) => `something is missing before ".${m[1]}" — check that it has a value.` },
  { pattern: /^(?:Maximum call stack size exceeded|too much recursion)$/, explain: () => 'a function keeps calling itself and never stops.' },
]

function translate(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  for (const rule of RULES) {
    const match = error.message.match(rule.pattern)
    if (match) return rule.explain(match)
  }
  return error.message
}

/** The line in Kade's code (loaded from `source`) where the error happened, read from the stack. */
export function lineOf(error: unknown, source: string): number | null {
  if (!(error instanceof Error) || !error.stack) return null
  const match = error.stack.match(new RegExp(`${escape(source)}:(\\d+):\\d+`))
  return match ? Number(match[1]) : null
}

/** A kid-friendly message, starting with "Line N: " when the line is known. */
export function friendlyError(error: unknown, source: string | null): string {
  const message = translate(error)
  const line = source ? lineOf(error, source) : null
  return line === null ? message : `Line ${line}: ${message}`
}

/** The line a problem message points at, for jumping to it in the code box. */
export function problemLine(message: string): number | null {
  const match = message.match(/Line (\d+):/)
  return match ? Number(match[1]) : null
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/kade`
Expected: PASS.

If the missing-bracket test reports line 5 or 6 instead of 4, that is fine. Lezer reports the mistake where it notices it, which can be just after the real one; the regex allows 4 or 5. If it reports 6, change the test's regex to `/^Line [4-6]:/`.

- [ ] **Step 6: Add `src/kade` to coverage**

In `vite.config.ts`:
- Add `'src/kade/**'` to `coverage.include`.
- Add `'src/kade/blob-loader.ts'` to `coverage.exclude`. It runs only in a browser worker and Task 7 creates it.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/kade
git commit -m "feat: find syntax mistakes and explain errors in Kade's code

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 4: Input checks and parts that never change

`Part` wraps a replicad solid, and every step returns a new `Part`. `ShapeTracker` remembers every solid a build makes so the build can free them at the end.

**replicad warning:** `translate`, `rotate` and `mirror` **delete the shape they are called on**, while `fuse`, `cut` and `intersect` do not. So each step clones first, and the clone is the shape that gets used up.

**Files:**
- Create: `src/kade/args.ts`, `src/kade/part.ts`
- Test: `src/kade/args.test.ts`, `src/kade/part.test.ts`

**Interfaces:**
- Consumes: `CadToolkit` and `Point2` (`src/plugins/cad-types.ts`), `createCadToolkit` (`src/plugins/cad.ts`), `MAX_MM` (`src/plugins/params.ts`).
- Produces (`args.ts`):
  - `class CadError extends Error`.
  - `MAX_REPEAT = 200` and `type Axis = 'x' | 'y' | 'z'`.
  - `needArgs(args, count, { command, what, example })`.
  - Argument checks: `numberArg(command, name, value)`, `sizeArg(...)`, `sizeOrZeroArg(...)`, `distanceArg(...)`, `wholeArg(command, name, value, min, max)`, `axisArg(command, value)`.
- Produces (`part.ts`):
  - `ShapeTracker { track(shape), freeAllBut(keep), counts() }`.
  - `Part { shape; move; rotate; add; cut; overlap; mirror; copy }`.
  - `Outline { drawing; extrude(height); spin() }`, with `OutlineShape`.
  - `PART_STEPS` and `OUTLINE_STEPS`.

- [ ] **Step 1: Write the failing tests**

`src/kade/args.test.ts`:

```ts
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
```

`src/kade/part.test.ts`:

```ts
import { measureVolume, type Shape3D } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { initTestOC } from '../geometry/testing/oc-node'
import { createCadToolkit } from '../plugins/cad'
import { Outline, Part, ShapeTracker } from './part'

beforeAll(initTestOC)

// `+ 0` turns -0 into 0, because toEqual tells them apart.
const bounds = (shape: Shape3D) => shape.boundingBox.bounds.map((p) => p.map((v) => Math.round(v * 100) / 100 + 0))
const setup = () => {
  const tracker = new ShapeTracker()
  const cad = createCadToolkit()
  const part = (shape: Shape3D) => new Part(tracker, tracker.track(shape))
  return { tracker, cad, part, box: () => part(cad.box(10, 10, 10)) }
}

describe('Part steps', () => {
  it('moves into a new part and leaves the old one where it was', () => {
    const { box } = setup()
    const original = box()
    const moved = original.move(20, 0, 5)
    expect(bounds(moved.shape)).toEqual([[15, -5, 5], [25, 5, 15]])
    expect(bounds(original.shape)).toEqual([[-5, -5, 0], [5, 5, 10]])
  })
  it('turns around an axis through the middle of the ground', () => {
    const { part, cad } = setup()
    const turned = part(cad.box(20, 10, 4)).rotate('z', 90)
    expect(bounds(turned.shape)).toEqual([[-5, -10, 0], [5, 10, 4]])
  })
  it('adds, cuts and overlaps', () => {
    const { box } = setup()
    const a = box()
    const b = box().move(5, 0, 0)
    expect(measureVolume(a.add(b).shape)).toBeCloseTo(1500, 0)
    expect(measureVolume(a.cut(b).shape)).toBeCloseTo(500, 0)
    expect(measureVolume(a.overlap(b).shape)).toBeCloseTo(500, 0)
    expect(measureVolume(a.shape)).toBeCloseTo(1000, 0)
  })
  it('mirrors across the middle', () => {
    const { box } = setup()
    expect(bounds(box().move(20, 0, 0).mirror('x').shape)).toEqual([[-25, -5, 0], [-15, 5, 10]])
    expect(bounds(box().move(0, 0, 5).mirror('z').shape)).toEqual([[-5, -5, -15], [5, 5, -5]])
  })
  it('copies', () => {
    const { box } = setup()
    const original = box()
    const copy = original.copy()
    expect(copy.shape).not.toBe(original.shape)
    expect(bounds(copy.shape)).toEqual(bounds(original.shape))
  })
  it('explains bad steps', () => {
    const { box, tracker, cad } = setup()
    expect(() => box().move(1, 2)).toThrow('.move needs 3 numbers, like .move(10, 0, 0)')
    expect(() => box().move(1, 2, 3000)).toThrow('Moves can be up to 2000 mm — z was 3000')
    expect(() => box().rotate('up', 90)).toThrow(".rotate needs 'x', 'y' or 'z'")
    expect(() => box().add(5)).toThrow('.add needs a part, like .add(cad.box(10, 10, 10))')
    const outline = new Outline(tracker, cad, { kind: 'circle', diameter: 10 })
    expect(() => box().cut(outline)).toThrow('.cut needs a part, not an outline')
    expect(() => box().extrude(5)).toThrow('.extrude is for flat outlines, and this is already a part.')
  })
})

describe('Outline', () => {
  it('pushes a polygon up', () => {
    const { tracker, cad } = setup()
    const outline = new Outline(tracker, cad, { kind: 'polygon', points: [[0, 0], [20, 0], [0, 10]] })
    expect(bounds(outline.extrude(4).shape)).toEqual([[0, 0, 0], [20, 10, 4]])
  })
  it('pushes a circle up into a cylinder', () => {
    const { tracker, cad } = setup()
    expect(bounds(new Outline(tracker, cad, { kind: 'circle', diameter: 10 }).extrude(3).shape)).toEqual([[-5, -5, 0], [5, 5, 3]])
  })
  it('spins a polygon around the up axis', () => {
    const { tracker, cad } = setup()
    const outline = new Outline(tracker, cad, { kind: 'polygon', points: [[0, 0], [10, 0], [10, 5], [0, 5]] })
    expect(bounds(outline.spin().shape)).toEqual([[-10, -10, 0], [10, 10, 5]])
  })
  it('explains what an outline cannot do', () => {
    const { tracker, cad } = setup()
    const circle = new Outline(tracker, cad, { kind: 'circle', diameter: 10 })
    expect(() => circle.spin()).toThrow("A circle can't spin.")
    expect(() => circle.move(1, 0, 0)).toThrow('.move works on parts. Turn the outline into a part first with .extrude(height) or .spin().')
    expect(() => circle.extrude(-1)).toThrow('Sizes must be bigger than 0 — height was -1')
  })
})

describe('ShapeTracker', () => {
  it('frees every shape a build made except the result', () => {
    const { box, tracker } = setup()
    const a = box()
    const b = box().move(5, 0, 0)
    const result = a.add(b).rotate('z', 45)
    expect(tracker.counts()).toEqual({ made: 5, held: 5 })
    tracker.freeAllBut(result.shape)
    expect(tracker.counts()).toEqual({ made: 5, held: 0 })
    expect(measureVolume(result.shape)).toBeCloseTo(1500, 0)
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/kade/args.test.ts src/kade/part.test.ts`
Expected: FAIL. The modules don't exist.

- [ ] **Step 3: Implement `src/kade/args.ts`**

```ts
import { MAX_MM } from '../plugins/params'

/** A problem with how Kade used a cad command. Its message is already kid-friendly. */
export class CadError extends Error {
  override name = 'CadError'
}

/** cad.repeat makes at most this many copies. */
export const MAX_REPEAT = 200

export type Axis = 'x' | 'y' | 'z'

function describe(value: unknown): string {
  if (value === undefined) return 'missing'
  if (typeof value === 'string') return `"${value}"`
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return 'a list'
  return typeof value === 'function' ? 'a function' : 'something else'
}

/** Stops with, for example, "cad.box needs 3 sizes, like cad.box(20, 10, 5)" when arguments are missing. */
export function needArgs(
  args: readonly unknown[], count: number, usage: { readonly command: string; readonly what: string; readonly example: string },
): void {
  if (args.length < count || args.slice(0, count).some((a) => a === undefined)) {
    throw new CadError(`${usage.command} needs ${usage.what}, like ${usage.example}`)
  }
}

export function numberArg(command: string, name: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CadError(`${command}: the ${name} must be a number — it was ${describe(value)}`)
  }
  return value
}

export function sizeArg(command: string, name: string, value: unknown): number {
  const size = numberArg(command, name, value)
  if (size <= 0) throw new CadError(`Sizes must be bigger than 0 — ${name} was ${size}`)
  if (size > MAX_MM) throw new CadError(`Sizes can be up to ${MAX_MM} mm — ${name} was ${size}`)
  return size
}

/** Like sizeArg, but 0 is allowed (for example a cone's pointy top). */
export function sizeOrZeroArg(command: string, name: string, value: unknown): number {
  const size = numberArg(command, name, value)
  if (size < 0) throw new CadError(`Sizes can't be less than 0 — ${name} was ${size}`)
  if (size > MAX_MM) throw new CadError(`Sizes can be up to ${MAX_MM} mm — ${name} was ${size}`)
  return size
}

export function distanceArg(command: string, name: string, value: unknown): number {
  const distance = numberArg(command, name, value)
  if (Math.abs(distance) > MAX_MM) throw new CadError(`Moves can be up to ${MAX_MM} mm — ${name} was ${distance}`)
  return distance
}

export function wholeArg(command: string, name: string, value: unknown, min: number, max: number): number {
  const n = numberArg(command, name, value)
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new CadError(`${command}: the ${name} must be a whole number from ${min} to ${max} — it was ${n}`)
  }
  return n
}

export function axisArg(command: string, value: unknown): Axis {
  if (value === 'x' || value === 'y' || value === 'z') return value
  throw new CadError(`${command} needs 'x', 'y' or 'z' — it was ${describe(value)}`)
}
```

- [ ] **Step 4: Implement `src/kade/part.ts`**

```ts
import type { Shape3D } from 'replicad'
import type { CadToolkit, Point2 } from '../plugins/cad-types'
import { axisArg, CadError, distanceArg, needArgs, numberArg, sizeArg, type Axis } from './args'

/** Remembers every solid one build makes, so all but the result can be freed when it ends. */
export class ShapeTracker {
  private readonly live = new Set<Shape3D>()
  private made = 0

  track(shape: Shape3D): Shape3D {
    this.live.add(shape)
    this.made += 1
    return shape
  }

  /** Frees every shape made so far except `keep` (the build's result, which the caller now owns). */
  freeAllBut(keep: Shape3D | null): void {
    for (const shape of this.live) if (shape !== keep) shape.delete()
    this.live.clear()
  }

  /** How many shapes were made and how many are still held. For leak tests. */
  counts(): { made: number; held: number } {
    return { made: this.made, held: this.live.size }
  }
}

/** The steps a part has and an outline doesn't, and the other way round. The ❓ Commands list is checked against these. */
export const PART_STEPS = ['move', 'rotate', 'add', 'cut', 'overlap', 'mirror', 'copy'] as const
export const OUTLINE_STEPS = ['extrude', 'spin'] as const

const AXIS_DIRECTION: Readonly<Record<Axis, [number, number, number]>> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }
const MIRROR_PLANE = { x: 'YZ', y: 'XZ', z: 'XY' } as const

const notAPartYet = (step: string): CadError =>
  new CadError(`.${step} works on parts. Turn the outline into a part first with .extrude(height) or .spin().`)
const alreadyAPart = (step: string): CadError => new CadError(`.${step} is for flat outlines, and this is already a part.`)

function otherPart(command: string, value: unknown): Part {
  if (value instanceof Part) return value
  if (value instanceof Outline) {
    throw new CadError(`${command} needs a part, not an outline. Use .extrude(height) or .spin() on the outline first.`)
  }
  throw new CadError(`${command} needs a part, like ${command}(cad.box(10, 10, 10))`)
}

/** A solid in Kade's code. Every step makes a new part, and the old one never changes. */
export class Part {
  constructor(private readonly tracker: ShapeTracker, readonly shape: Shape3D) {}

  move(...args: unknown[]): Part {
    needArgs(args, 3, { command: '.move', what: '3 numbers', example: '.move(10, 0, 0)' })
    const x = distanceArg('.move', 'x', args[0])
    const y = distanceArg('.move', 'y', args[1])
    const z = distanceArg('.move', 'z', args[2])
    return this.next(this.shape.clone().translate([x, y, z]))
  }

  rotate(...args: unknown[]): Part {
    needArgs(args, 2, { command: '.rotate', what: 'an axis and an angle', example: ".rotate('z', 45)" })
    const axis = axisArg('.rotate', args[0])
    const degrees = numberArg('.rotate', 'angle', args[1])
    return this.next(this.shape.clone().rotate(degrees, [0, 0, 0], AXIS_DIRECTION[axis]))
  }

  add(other: unknown): Part {
    return this.combine('.add', other, (a, b) => a.fuse(b))
  }

  cut(other: unknown): Part {
    return this.combine('.cut', other, (a, b) => a.cut(b))
  }

  overlap(other: unknown): Part {
    return this.combine('.overlap', other, (a, b) => a.intersect(b))
  }

  mirror(axis: unknown): Part {
    return this.next(this.shape.clone().mirror(MIRROR_PLANE[axisArg('.mirror', axis)]))
  }

  copy(): Part {
    return this.next(this.shape.clone())
  }

  extrude(): never {
    throw alreadyAPart('extrude')
  }

  spin(): never {
    throw alreadyAPart('spin')
  }

  private next(shape: Shape3D): Part {
    return new Part(this.tracker, this.tracker.track(shape))
  }

  private combine(command: string, other: unknown, join: (a: Shape3D, b: Shape3D) => Shape3D): Part {
    const part = otherPart(command, other)
    let joined: Shape3D
    try {
      joined = join(this.shape, part.shape)
    } catch {
      throw new CadError(`${command} couldn't join these parts. Try moving one of them a little.`)
    }
    return this.next(joined)
  }
}

export type OutlineShape =
  | { readonly kind: 'polygon'; readonly points: readonly Point2[] }
  | { readonly kind: 'circle'; readonly diameter: number }

/** A flat drawing on the ground. It becomes a part with .extrude(height) or .spin(). */
export class Outline {
  constructor(private readonly tracker: ShapeTracker, private readonly cad: CadToolkit, readonly drawing: OutlineShape) {}

  extrude(...args: unknown[]): Part {
    needArgs(args, 1, { command: '.extrude', what: 'a height', example: '.extrude(5)' })
    const height = sizeArg('.extrude', 'height', args[0])
    const shape = this.drawing.kind === 'circle'
      ? this.cad.cylinder(this.drawing.diameter, height)
      : this.cad.prism(this.drawing.points, height)
    return new Part(this.tracker, this.tracker.track(shape))
  }

  /** Spins the outline around the up axis. x is the distance from the middle and y becomes the height. */
  spin(): Part {
    if (this.drawing.kind === 'circle') throw new CadError("A circle can't spin. Use cad.sphere for a ball, or spin a polygon.")
    return new Part(this.tracker, this.tracker.track(this.cad.revolve(this.drawing.points)))
  }

  move(): never { throw notAPartYet('move') }
  rotate(): never { throw notAPartYet('rotate') }
  add(): never { throw notAPartYet('add') }
  cut(): never { throw notAPartYet('cut') }
  overlap(): never { throw notAPartYet('overlap') }
  mirror(): never { throw notAPartYet('mirror') }
  copy(): never { throw notAPartYet('copy') }
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/kade/args.test.ts src/kade/part.test.ts`
Expected: PASS.

If the `mirror('z')` bounds come out mirrored through a different point, check replicad's `mirror(plane, origin)`. With no origin it mirrors through the world origin, which is what the test expects. If a replicad version needs it, pass `[0, 0, 0]` as the origin.

- [ ] **Step 6: Commit**

```bash
git add src/kade/args.ts src/kade/args.test.ts src/kade/part.ts src/kade/part.test.ts
git commit -m "feat: add parts that never change and friendly input checks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 5: Reading a shape definition

This task turns a loaded module's `export default { … }` into checked details: name, icon, settings, size handles, mode and palette. Every mistake gets one plain-words message. It also defines how code is loaded, and adds a file loader so Node tests can load real code.

**Files:**
- Create: `src/kade/settings.ts`, `src/kade/definition.ts`, `src/kade/meta.ts`, `src/kade/module-loader.ts`, `src/kade/testing/file-loader.ts`
- Test: `src/kade/settings.test.ts`, `src/kade/definition.test.ts`, `src/kade/module-loader.test.ts`

**Interfaces:**
- Consumes:
  - `FIT_ONLY` (`src/plugins/registry.ts`, from Task 1).
  - `computeFormula` and `MAX_FORMULA_LENGTH` (`src/formulas/formula.ts`).
  - `Result`, `ok` and `fail` (`src/shared/result.ts`).
  - The Task 2 constants.
- Produces:
  - `settings.ts`: `toParamSpecs(raw: unknown): Result<ParamSpecs>`, `isRecord(v)`, `MAX_SETTINGS = 30`.
  - `definition.ts`:
    - `readShapeDefinition(exports: Readonly<Record<string, unknown>>): Result<ShapeDefinition>`.
    - `ShapeDefinition { meta: ShapeMeta; build: ShapeBuild }` and `ShapeBuild = (values: ParamValues, cad: unknown) => unknown`.
    - Messages: `NO_EXPORT`, `NO_NAME`, `NO_BUILD`. Icon default: `DEFAULT_ICON = '🧩'`.
  - `meta.ts`:
    - `ShapeMeta { name; icon; params: ParamSpecs; size?; mode?: 'hole'; palette? }`.
    - `InspectResult = { ok: true; meta } | { ok: false; problem: string }`.
  - `module-loader.ts`:
    - `LoadedModule { exports; source; dispose() }`.
    - `ModuleLoader = (code: string) => Promise<LoadedModule>`.
    - `class ModuleLoadError(original, source)`.
  - `testing/file-loader.ts`: `fileModuleLoader: ModuleLoader`, for Node tests only.

- [ ] **Step 1: Write the failing tests**

`src/kade/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { toParamSpecs } from './settings'

const problem = (raw: unknown): string => {
  const result = toParamSpecs(raw)
  return result.ok ? 'no problem' : result.error
}

describe('toParamSpecs', () => {
  it('accepts every setting type, with the label defaulting to the name', () => {
    const result = toParamSpecs({
      size: { type: 'mm', default: 20, label: 'Size' },
      teeth: { type: 'whole', default: 12, min: 6, max: 60 },
      ratio: { type: 'number', default: 1.5 },
      tilt: { type: 'angle', default: 45 },
      words: { type: 'text', default: 'Hi', maxLength: 10 },
      shape: { type: 'choice', default: 'round', options: ['round', { value: 'square', label: 'Square' }] },
      hollow: { type: 'yesno', default: false },
      gap: { type: 'mm', default: 0.2, formula: 'fit' },
    })
    expect(result.ok && result.value).toEqual({
      size: { type: 'mm', default: 20, label: 'Size' },
      teeth: { type: 'whole', default: 12, min: 6, max: 60, label: 'teeth' },
      ratio: { type: 'number', default: 1.5, label: 'ratio' },
      tilt: { type: 'angle', default: 45, label: 'tilt' },
      words: { type: 'text', default: 'Hi', maxLength: 10, label: 'words' },
      shape: { type: 'choice', default: 'round', label: 'shape', options: [{ value: 'round', label: 'round' }, { value: 'square', label: 'Square' }] },
      hollow: { type: 'yesno', default: false, label: 'hollow' },
      gap: { type: 'mm', default: 0.2, formula: 'fit', label: 'gap' },
    })
  })
  it('allows no settings at all', () => {
    expect(toParamSpecs(undefined)).toEqual({ ok: true, value: {} })
  })
  it('explains each kind of mistake', () => {
    expect(problem(5)).toContain('settings needs curly brackets')
    expect(problem({ size: 20 })).toBe("The setting \"size\" needs curly brackets, like size: { type: 'mm', default: 20 }.")
    expect(problem({ size: { type: 'cm', default: 2 } })).toContain('needs a type: \'mm\', \'whole\'')
    expect(problem({ size: { type: 'mm' } })).toBe('The setting "size" needs a number default, like default: 20.')
    expect(problem({ size: { type: 'mm', default: 50, max: 40 } })).toBe('The default of "size" is outside its min and max.')
    expect(problem({ size: { type: 'mm', default: 5, min: 10, max: 2 } })).toBe('The setting "size" has a min bigger than its max.')
    expect(problem({ size: { type: 'mm', default: 5, formula: 'wall * 2' } })).toContain('can only use fit')
    expect(problem({ words: { type: 'text', default: 3 } })).toContain('needs a default in quotes')
    expect(problem({ shape: { type: 'choice', default: 'a', options: ['a'] } })).toContain('needs at least 2 options')
    expect(problem({ shape: { type: 'choice', default: 'c', options: ['a', 'b'] } })).toBe('The default of "shape" must be one of its options.')
    expect(problem({ shape: { type: 'choice', default: 'a', options: ['a', 'a'] } })).toBe('Two options of "shape" are the same.')
    expect(problem({ round: { type: 'yesno', default: 'yes' } })).toBe('The setting "round" needs default: true or default: false.')
    expect(problem({ 'two words': { type: 'mm', default: 1 } })).toContain("can't be a setting name")
  })
  it('allows up to 30 settings', () => {
    const many = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`s${i}`, { type: 'mm', default: 1 }]))
    expect(toParamSpecs(many(30)).ok).toBe(true)
    expect(problem(many(31))).toBe('A shape can have up to 30 settings.')
  })
})
```

`src/kade/definition.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { NO_BUILD, NO_EXPORT, NO_NAME, readShapeDefinition } from './definition'

const build = () => null
const read = (definition: unknown) => readShapeDefinition({ default: definition })
const problem = (definition: unknown): string => {
  const result = read(definition)
  return result.ok ? 'no problem' : result.error
}

describe('readShapeDefinition', () => {
  it('reads a full definition', () => {
    const result = read({
      name: ' Robot head ', icon: '🤖', build,
      settings: { size: { type: 'mm', default: 20, label: 'Size' } },
      size: { x: 'size', z: 'size' }, mode: 'hole', palette: 'fit',
    })
    expect(result.ok && result.value.meta).toEqual({
      name: 'Robot head', icon: '🤖', params: { size: { type: 'mm', default: 20, label: 'Size' } },
      size: { x: 'size', z: 'size' }, mode: 'hole', palette: 'fit',
    })
    expect(result.ok && result.value.build).toBe(build)
  })
  it('accepts params as another name for settings, and fills in the icon', () => {
    const result = read({ name: 'A', build, params: { w: { type: 'mm', default: 1 } } })
    expect(result.ok && result.value.meta).toEqual({ name: 'A', icon: '🧩', params: { w: { type: 'mm', default: 1, label: 'w' } } })
  })
  it('treats mode solid as the normal mode', () => {
    const result = read({ name: 'A', build, mode: 'solid' })
    expect(result.ok && result.value.meta.mode).toBeUndefined()
  })
  it('explains what is missing or wrong', () => {
    expect(readShapeDefinition({})).toEqual({ ok: false, error: NO_EXPORT })
    expect(problem(5)).toBe(NO_EXPORT)
    expect(problem({ build })).toBe(NO_NAME)
    expect(problem({ name: '   ', build })).toBe(NO_NAME)
    expect(problem({ name: 'x'.repeat(61), build })).toBe('Shape names can be up to 60 letters long.')
    expect(problem({ name: 'A' })).toBe(NO_BUILD)
    expect(problem({ name: 'A', build: 'cad.box(1, 1, 1)' })).toBe(NO_BUILD)
    expect(problem({ name: 'A', build, settings: { s: { type: 'mm' } } })).toContain('needs a number default')
    expect(problem({ name: 'A', build, mode: 'ghost' })).toBe("mode can be 'solid' or 'hole'.")
    expect(problem({ name: 'A', build, palette: 'top' })).toBe("palette can be 'shapes' or 'fit'.")
  })
  it('checks size handles point at number settings', () => {
    const settings = { words: { type: 'text', default: 'Hi' }, w: { type: 'mm', default: 5 } }
    expect(problem({ name: 'A', build, settings, size: { x: 'width' } })).toBe('size.x points at "width", but there\'s no setting called "width".')
    expect(problem({ name: 'A', build, settings, size: { y: 'words' } })).toBe('size.y can only change a number setting, and "words" is a text setting.')
    expect(problem({ name: 'A', build, settings, size: { z: 5 } })).toBe("size.z needs a setting name in quotes, like z: 'width'.")
    expect(problem({ name: 'A', build, settings, size: 'w' })).toContain('size needs curly brackets')
  })
})
```

`src/kade/module-loader.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { friendlyError } from './errors'
import { ModuleLoadError } from './module-loader'
import { fileModuleLoader } from './testing/file-loader'

describe('fileModuleLoader', () => {
  it('loads a module and hands back its exports', async () => {
    const loaded = await fileModuleLoader("export default { name: 'A' }\nexport const extra = 2")
    expect(loaded.exports.default).toEqual({ name: 'A' })
    expect(loaded.exports.extra).toBe(2)
    loaded.dispose()
  })
  it('reports top-level errors with the source, so the line can be found', async () => {
    const error = await fileModuleLoader("const a = 1\nconst b = nope + 1\nexport default {}").catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ModuleLoadError)
    const loadError = error as ModuleLoadError
    expect(friendlyError(loadError.original, loadError.source)).toBe('Line 2: there\'s nothing called "nope" — check the spelling.')
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/kade/settings.test.ts src/kade/definition.test.ts src/kade/module-loader.test.ts`
Expected: FAIL. The modules don't exist.

- [ ] **Step 3: Implement `src/kade/meta.ts` and `src/kade/module-loader.ts`**

```ts
// src/kade/meta.ts
import type { ParamSpecs, ShapePlugin } from '../plugins/types'

/** What the worker reports about one of Kade's shapes. Plain data, so it crosses to the page. */
export interface ShapeMeta {
  readonly name: string
  readonly icon: string
  readonly params: ParamSpecs
  readonly size?: ShapePlugin['size']
  readonly mode?: 'hole'
  readonly palette?: 'shapes' | 'fit' | 'hidden'
}

export type InspectResult =
  | { readonly ok: true; readonly meta: ShapeMeta }
  | { readonly ok: false; readonly problem: string }
```

```ts
// src/kade/module-loader.ts
export interface LoadedModule {
  readonly exports: Readonly<Record<string, unknown>>
  /** Where the code was loaded from. Error stacks name it, which is how errors get line numbers. */
  readonly source: string
  /** Lets go of the loaded file or blob URL. The module's functions keep working. */
  dispose(): void
}

/** Loads Kade's code as a JavaScript module. Only the geometry worker (and Node tests) may do this. */
export type ModuleLoader = (code: string) => Promise<LoadedModule>

/** The code failed while it was loading, for example a misspelt name at the top of the file. */
export class ModuleLoadError extends Error {
  override name = 'ModuleLoadError'
  constructor(readonly original: unknown, readonly source: string) {
    super(original instanceof Error ? original.message : String(original))
  }
}
```

- [ ] **Step 4: Implement `src/kade/testing/file-loader.ts`**

```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ModuleLoadError, type ModuleLoader } from '../module-loader'

const folder = mkdtempSync(join(tmpdir(), 'blokade-shapes-'))
let count = 0

/** Node tests load Kade's code from a temp .mjs file (the worker uses a blob URL). Stacks name the file path. */
export const fileModuleLoader: ModuleLoader = async (code) => {
  count += 1
  const file = join(folder, `shape-${count}.mjs`)
  writeFileSync(file, code)
  const dispose = (): void => rmSync(file, { force: true })
  try {
    const exports = (await import(/* @vite-ignore */ pathToFileURL(file).href)) as Record<string, unknown>
    return { exports, source: file, dispose }
  } catch (error) {
    dispose()
    throw new ModuleLoadError(error, file)
  }
}
```

- [ ] **Step 5: Implement `src/kade/settings.ts`**

```ts
import { MAX_TEXT_PARAM_LENGTH } from '../document/types'
import { computeFormula, MAX_FORMULA_LENGTH } from '../formulas/formula'
import { FIT_ONLY } from '../plugins/registry'
import type { ChoiceOption, ChoiceParamSpec, NumberParamSpec, ParamSpec, ParamSpecs, TextParamSpec, YesNoParamSpec } from '../plugins/types'
import { fail, ok, type Result } from '../shared/result'

export const MAX_SETTINGS = 30
const MAX_LABEL = 40
const MAX_OPTION = 40
const SETTING_NAME = /^[A-Za-z_$][A-Za-z0-9_$]*$/
const NUMBER_TYPES: readonly string[] = ['mm', 'whole', 'number', 'angle']

type Raw = Readonly<Record<string, unknown>>

export const isRecord = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value)

const labelOf = (name: string, raw: Raw): string =>
  typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim().slice(0, MAX_LABEL) : name

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function startingFormula(name: string, value: unknown): Result<string | null> {
  if (value === undefined) return ok(null)
  if (typeof value === 'string' && value.length <= MAX_FORMULA_LENGTH && computeFormula(value, FIT_ONLY).ok) return ok(value)
  return fail(`The starting formula of "${name}" can only use fit, like formula: 'fit'.`)
}

function numberSpec(name: string, raw: Raw, type: NumberParamSpec['type']): Result<ParamSpec> {
  const { default: value, min, max } = raw
  if (!isFiniteNumber(value)) return fail(`The setting "${name}" needs a number default, like default: 20.`)
  if ((min !== undefined && !isFiniteNumber(min)) || (max !== undefined && !isFiniteNumber(max))) {
    return fail(`The min and max of "${name}" must be numbers.`)
  }
  if (isFiniteNumber(min) && isFiniteNumber(max) && min > max) return fail(`The setting "${name}" has a min bigger than its max.`)
  if ((isFiniteNumber(min) && value < min) || (isFiniteNumber(max) && value > max)) {
    return fail(`The default of "${name}" is outside its min and max.`)
  }
  const formula = startingFormula(name, raw.formula)
  if (!formula.ok) return fail(formula.error)
  return ok({
    type, default: value, label: labelOf(name, raw),
    ...(isFiniteNumber(min) ? { min } : {}), ...(isFiniteNumber(max) ? { max } : {}),
    ...(formula.value ? { formula: formula.value } : {}),
  })
}

function textSpec(name: string, raw: Raw): Result<TextParamSpec> {
  const { default: value, maxLength } = raw
  if (typeof value !== 'string' || Array.from(value).length > MAX_TEXT_PARAM_LENGTH) {
    return fail(`The setting "${name}" needs a default in quotes, like default: 'Hi' (up to ${MAX_TEXT_PARAM_LENGTH} letters).`)
  }
  const goodLength = typeof maxLength === 'number' && Number.isInteger(maxLength) && maxLength >= 1 && maxLength <= MAX_TEXT_PARAM_LENGTH
  if (maxLength !== undefined && !goodLength) return fail(`The maxLength of "${name}" must be a whole number from 1 to ${MAX_TEXT_PARAM_LENGTH}.`)
  return ok({ type: 'text', default: value, label: labelOf(name, raw), ...(typeof maxLength === 'number' ? { maxLength } : {}) })
}

function optionOf(value: unknown): ChoiceOption | null {
  if (typeof value === 'string' && value && value.length <= MAX_OPTION) return { value, label: value }
  if (!isRecord(value) || typeof value.value !== 'string' || !value.value || value.value.length > MAX_OPTION) return null
  return { value: value.value, label: typeof value.label === 'string' && value.label ? value.label : value.value }
}

function choiceSpec(name: string, raw: Raw): Result<ChoiceParamSpec> {
  const listed = Array.isArray(raw.options) ? raw.options.map(optionOf) : []
  const options = listed.filter((o): o is ChoiceOption => o !== null)
  if (options.length < 2 || options.length !== listed.length) {
    return fail(`The setting "${name}" needs at least 2 options, like options: ['round', 'square'].`)
  }
  if (new Set(options.map((o) => o.value)).size !== options.length) return fail(`Two options of "${name}" are the same.`)
  const value = raw.default
  if (typeof value !== 'string' || !options.some((o) => o.value === value)) return fail(`The default of "${name}" must be one of its options.`)
  return ok({ type: 'choice', default: value, label: labelOf(name, raw), options })
}

function yesNoSpec(name: string, raw: Raw): Result<YesNoParamSpec> {
  if (typeof raw.default !== 'boolean') return fail(`The setting "${name}" needs default: true or default: false.`)
  return ok({ type: 'yesno', default: raw.default, label: labelOf(name, raw) })
}

function specOf(name: string, raw: unknown): Result<ParamSpec> {
  if (!SETTING_NAME.test(name)) return fail(`"${name}" can't be a setting name. Use letters and numbers, like width2.`)
  if (!isRecord(raw)) return fail(`The setting "${name}" needs curly brackets, like ${name}: { type: 'mm', default: 20 }.`)
  const type = raw.type
  if (typeof type === 'string' && NUMBER_TYPES.includes(type)) return numberSpec(name, raw, type as NumberParamSpec['type'])
  if (type === 'text') return textSpec(name, raw)
  if (type === 'choice') return choiceSpec(name, raw)
  if (type === 'yesno') return yesNoSpec(name, raw)
  return fail(`The setting "${name}" needs a type: 'mm', 'whole', 'number', 'angle', 'text', 'choice' or 'yesno'.`)
}

/** Kade's `settings` (or `params`) as checked parameter specs, or the first problem in plain words. */
export function toParamSpecs(raw: unknown): Result<ParamSpecs> {
  if (raw === undefined) return ok({})
  if (!isRecord(raw)) return fail("settings needs curly brackets, like settings: { size: { type: 'mm', default: 20 } }.")
  const entries = Object.entries(raw)
  if (entries.length > MAX_SETTINGS) return fail(`A shape can have up to ${MAX_SETTINGS} settings.`)
  const checked = entries.map(([name, value]) => [name, specOf(name, value)] as const)
  for (const [, result] of checked) if (!result.ok) return fail(result.error)
  return ok(Object.fromEntries(checked.flatMap(([name, result]) => (result.ok ? [[name, result.value]] : []))))
}
```

- [ ] **Step 6: Implement `src/kade/definition.ts`**

```ts
import { MAX_SHAPE_NAME_LENGTH } from '../document/types'
import { isNumberSpec, type ParamSpecs, type ParamValues } from '../plugins/types'
import { fail, ok, type Result } from '../shared/result'
import type { ShapeMeta } from './meta'
import { isRecord, toParamSpecs } from './settings'

export const DEFAULT_ICON = '🧩'
export const NO_EXPORT = 'Your shape needs to start with export default { … }. Look at a new shape to see how.'
export const NO_NAME = "Your shape needs a name in quotes, like name: 'Robot head'."
export const NO_BUILD = 'Your shape needs a build function, like build(settings, cad) { return cad.box(10, 10, 10) }.'

/** Kade's build function. The worker calls it through runKadeBuild with the friendly toolkit. */
export type ShapeBuild = (values: ParamValues, cad: unknown) => unknown

export interface ShapeDefinition {
  readonly meta: ShapeMeta
  readonly build: ShapeBuild
}

const AXES = ['x', 'y', 'z'] as const

function nameOf(raw: unknown): Result<string> {
  const name = typeof raw === 'string' ? raw.trim() : ''
  if (!name) return fail(NO_NAME)
  return name.length > MAX_SHAPE_NAME_LENGTH ? fail(`Shape names can be up to ${MAX_SHAPE_NAME_LENGTH} letters long.`) : ok(name)
}

const iconOf = (raw: unknown): string =>
  typeof raw === 'string' && raw.trim() ? Array.from(raw.trim()).slice(0, 4).join('') : DEFAULT_ICON

function handleProblem(axis: string, target: unknown, params: ParamSpecs): string | null {
  if (typeof target !== 'string') return `size.${axis} needs a setting name in quotes, like ${axis}: 'width'.`
  const spec = Object.hasOwn(params, target) ? params[target] : undefined
  if (!spec) return `size.${axis} points at "${target}", but there's no setting called "${target}".`
  return isNumberSpec(spec) ? null : `size.${axis} can only change a number setting, and "${target}" is a ${spec.type} setting.`
}

function sizeHandles(raw: unknown, params: ParamSpecs): Result<ShapeMeta['size']> {
  if (raw === undefined) return ok(undefined)
  if (!isRecord(raw)) return fail("size needs curly brackets, like size: { x: 'width', y: 'depth', z: 'height' }.")
  const handles = AXES.flatMap((axis) => (raw[axis] === undefined ? [] : [[axis, raw[axis]] as const]))
  for (const [axis, target] of handles) {
    const problem = handleProblem(axis, target, params)
    if (problem) return fail(problem)
  }
  return ok(Object.fromEntries(handles) as ShapeMeta['size'])
}

function modeOf(raw: unknown): Result<'hole' | undefined> {
  if (raw === undefined || raw === 'solid') return ok(undefined)
  return raw === 'hole' ? ok('hole') : fail("mode can be 'solid' or 'hole'.")
}

function paletteOf(raw: unknown): Result<ShapeMeta['palette']> {
  if (raw === undefined) return ok(undefined)
  return raw === 'shapes' || raw === 'fit' || raw === 'hidden' ? ok(raw) : fail("palette can be 'shapes' or 'fit'.")
}

/** Checks a module's `export default { … }` and returns its details and build, or the first problem in plain words. */
export function readShapeDefinition(exports: Readonly<Record<string, unknown>>): Result<ShapeDefinition> {
  const raw = exports.default
  if (!isRecord(raw)) return fail(NO_EXPORT)
  const name = nameOf(raw.name)
  if (!name.ok) return fail(name.error)
  if (typeof raw.build !== 'function') return fail(NO_BUILD)
  const params = toParamSpecs(raw.settings ?? raw.params)
  if (!params.ok) return fail(params.error)
  const size = sizeHandles(raw.size, params.value)
  if (!size.ok) return fail(size.error)
  const mode = modeOf(raw.mode)
  if (!mode.ok) return fail(mode.error)
  const palette = paletteOf(raw.palette)
  if (!palette.ok) return fail(palette.error)
  const meta: ShapeMeta = {
    name: name.value, icon: iconOf(raw.icon), params: params.value,
    ...(size.value ? { size: size.value } : {}), ...(mode.value ? { mode: mode.value } : {}),
    ...(palette.value ? { palette: palette.value } : {}),
  }
  return ok({ meta, build: raw.build as ShapeBuild })
}
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/kade`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/kade
git commit -m "feat: read and check Kade's shape definitions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 6: The friendly `cad` toolkit

This task adds:
- The toolkit Kade's `build` receives.
- `runKadeBuild`, which runs a build, explains failures and frees every shape except the result.
- The ❓ Commands list the toolkit is checked against.
- The **⚙️ Gear** example.
- A Node test helper that builds real code.

**Files:**
- Create: `src/kade/toolkit.ts`, `src/kade/run-build.ts`, `src/kade/commands.ts`, `src/kade/examples/gear.ts`, `src/kade/testing/build-code.ts`
- Test: `src/kade/toolkit.test.ts`, `src/kade/run-build.test.ts`, `src/kade/commands.test.ts`, `src/kade/examples/gear.test.ts`

**Interfaces:**
- Consumes:
  - Task 4: `Part`, `Outline`, `ShapeTracker`, `PART_STEPS`, `OUTLINE_STEPS`, and the checks in `args.ts`.
  - Task 5: `readShapeDefinition`, `fileModuleLoader`.
  - Task 3: `friendlyError`.
- Produces:
  - `toolkit.ts`: `createKadeToolkit(tracker: ShapeTracker, internal?: CadToolkit): KadeToolkit`, and the `KadeToolkit` type.
  - `run-build.ts`:
    - `runKadeBuild(build: KadeBuild, values: ParamValues, source: string | null, internal?: CadToolkit, tracker?: ShapeTracker): Shape3D`.
    - `KadeBuild = (values: ParamValues, cad: KadeToolkit) => unknown`.
    - Messages: `MISSING_RETURN`, `RETURNED_OUTLINE`.
  - `commands.ts`: `CadCommand { name; on: 'cad' | 'part' | 'outline'; group: 'start' | 'outline' | 'step' | 'helper'; call; does; example }`, `CAD_COMMANDS`, `COMMAND_GROUPS`.
  - `examples/gear.ts`: `GEAR_CODE: string`.
  - `testing/build-code.ts`: `buildKadeCode(code, values?): Promise<{ shape: Shape3D; meta: ShapeMeta; dispose(): void }>`.

- [ ] **Step 1: Write the failing tests**

`src/kade/toolkit.test.ts`:

```ts
import { measureVolume, type Shape3D } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadTestFont } from '../geometry/testing/font-node'
import { initTestOC } from '../geometry/testing/oc-node'
import { Outline, Part, ShapeTracker } from './part'
import { createKadeToolkit } from './toolkit'

beforeAll(async () => {
  await initTestOC()
  await loadTestFont()
})

// `+ 0` turns -0 into 0, because toEqual tells them apart.
const bounds = (shape: Shape3D) => shape.boundingBox.bounds.map((p) => p.map((v) => Math.round(v * 10) / 10 + 0))
const kit = () => createKadeToolkit(new ShapeTracker())

describe('starting parts', () => {
  it('make parts centred on X/Y and sitting on the ground', () => {
    const cad = kit()
    expect(bounds(cad.box(20, 10, 5).shape)).toEqual([[-10, -5, 0], [10, 5, 5]])
    expect(bounds(cad.cylinder(10, 20).shape)).toEqual([[-5, -5, 0], [5, 5, 20]])
    expect(bounds(cad.sphere(20).shape)).toEqual([[-10, -10, 0], [10, 10, 20]])
    expect(bounds(cad.cone(20, 0, 30).shape)).toEqual([[-10, -10, 0], [10, 10, 30]])
    expect(bounds(cad.ring(40, 8).shape)).toEqual([[-20, -20, 0], [20, 20, 8]])
    expect(bounds(cad.wedge(20, 10, 15).shape)).toEqual([[-10, -5, 0], [10, 5, 15]])
    const letters = bounds(cad.text('Hi', 10, 2).shape)
    expect(letters[0]?.[2]).toBe(0)
    expect(letters[1]?.[2]).toBe(2)
  })
  it('explain bad sizes', () => {
    const cad = kit()
    expect(() => cad.box(20, 10)).toThrow('cad.box needs 3 sizes, like cad.box(20, 10, 5)')
    expect(() => cad.box(-3, 10, 5)).toThrow('Sizes must be bigger than 0 — width was -3')
    expect(() => cad.cylinder(10, 0)).toThrow('Sizes must be bigger than 0 — height was 0')
    expect(() => cad.sphere()).toThrow('cad.sphere needs a size, like cad.sphere(20)')
    expect(() => cad.cone(0, 0, 10)).toThrow('A cone needs a bottom or a top bigger than 0.')
    expect(() => cad.ring(10, 8)).toThrow('Make the ring wider than twice its thickness.')
    expect(() => cad.text(5, 10, 2)).toThrow("cad.text needs words in quotes first, like cad.text('Hi', 10, 2)")
    expect(() => cad.text('x'.repeat(41), 10, 2)).toThrow('cad.text can show up to 40 letters.')
  })
})

describe('outlines', () => {
  it('make flat outlines that turn into parts', () => {
    const cad = kit()
    expect(cad.rect(20, 10)).toBeInstanceOf(Outline)
    expect(bounds(cad.rect(20, 10).extrude(5).shape)).toEqual([[-10, -5, 0], [10, 5, 5]])
    expect(bounds(cad.circle(10).extrude(2).shape)).toEqual([[-5, -5, 0], [5, 5, 2]])
    expect(bounds(cad.polygon([[0, 0], [20, 0], [0, 10]]).extrude(4).shape)).toEqual([[0, 0, 0], [20, 10, 4]])
  })
  it('explain bad points', () => {
    const cad = kit()
    expect(() => cad.polygon([[0, 0], [1, 1]])).toThrow('cad.polygon needs a list of at least 3 points, like cad.polygon([[0, 0], [20, 0], [0, 20]])')
    expect(() => cad.polygon('square')).toThrow('at least 3 points')
    expect(() => cad.polygon([[0, 0], [1, 'a'], [2, 2]])).toThrow('cad.polygon: point 2 must be two numbers in brackets, like [10, 5]')
    expect(() => cad.polygon([[0, 0], [3000, 0], [0, 1]])).toThrow('Points can be up to 2000 mm from the middle.')
  })
})

describe('helpers', () => {
  it('repeat makes copies and joins them', () => {
    const cad = kit()
    const row = cad.repeat(3, (i: number) => cad.box(5, 5, 5).move(i * 10, 0, 0))
    expect(row).toBeInstanceOf(Part)
    expect(bounds(row.shape)).toEqual([[-2.5, -2.5, 0], [22.5, 2.5, 5]])
    expect(measureVolume(row.shape)).toBeCloseTo(375, 0)
    expect(bounds(cad.repeat(1, () => cad.box(5, 5, 5)).shape)).toEqual([[-2.5, -2.5, 0], [2.5, 2.5, 5]])
  })
  it('repeat explains mistakes', () => {
    const cad = kit()
    expect(() => cad.repeat(0, () => cad.box(1, 1, 1))).toThrow('cad.repeat: the count must be a whole number from 1 to 200 — it was 0')
    expect(() => cad.repeat(201, () => cad.box(1, 1, 1))).toThrow('from 1 to 200')
    expect(() => cad.repeat(3, 5)).toThrow('cad.repeat needs a function second, like (i) => cad.box(5, 5, 5).move(i * 10, 0, 0)')
    expect(() => cad.repeat(3, () => 5)).toThrow("cad.repeat's function must give back a part — copy 1 didn't.")
  })
  it('works out angles, sines and cosines in degrees', () => {
    const cad = kit()
    expect(cad.angle(1, 4)).toBe(90)
    expect(cad.angle(3, 12)).toBe(90)
    expect(cad.sin(30)).toBeCloseTo(0.5)
    expect(cad.cos(60)).toBeCloseTo(0.5)
    expect(() => cad.angle(1, 0)).toThrow('cad.angle: the count must be bigger than 0 — it was 0')
    expect(() => cad.sin('30')).toThrow('cad.sin: the angle must be a number')
  })
})
```

`src/kade/run-build.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { initTestOC } from '../geometry/testing/oc-node'
import { readShapeDefinition, type ShapeBuild } from './definition'
import { ShapeTracker } from './part'
import { MISSING_RETURN, RETURNED_OUTLINE, runKadeBuild } from './run-build'
import { fileModuleLoader } from './testing/file-loader'

beforeAll(initTestOC)

/** Lines are numbered from 1; build's body starts on line 4. */
const shapeCode = (...body: string[]) =>
  ['export default {', "  name: 'Test',", '  build({ w }, cad) {', ...body.map((l) => `    ${l}`), '  },', '}'].join('\n')

async function load(code: string): Promise<{ build: ShapeBuild; source: string }> {
  const loaded = await fileModuleLoader(code)
  const definition = readShapeDefinition(loaded.exports)
  if (!definition.ok) throw new Error(definition.error)
  return { build: definition.value.build, source: loaded.source }
}

describe('runKadeBuild', () => {
  it('builds the part and frees everything else', async () => {
    const { build, source } = await load(shapeCode('const a = cad.box(w, 10, 10)', 'return a.add(cad.cylinder(5, 20)).move(0, 0, 1)'))
    const tracker = new ShapeTracker()
    const shape = runKadeBuild(build, { w: 20 }, source, undefined, tracker)
    expect(shape.boundingBox.bounds[0]?.[2]).toBeCloseTo(1)
    expect(tracker.counts()).toEqual({ made: 4, held: 0 })
    shape.delete()
  })
  it('says what to do when build forgets to return a part', async () => {
    const { build, source } = await load(shapeCode('cad.box(w, 10, 10)'))
    expect(() => runKadeBuild(build, { w: 20 }, source)).toThrow(MISSING_RETURN)
  })
  it('says what to do when build returns an outline', async () => {
    const { build, source } = await load(shapeCode('return cad.rect(w, 10)'))
    expect(() => runKadeBuild(build, { w: 20 }, source)).toThrow(RETURNED_OUTLINE)
  })
  it('adds the line to errors from Kade\'s code', async () => {
    const misspelt = await load(shapeCode('const width = w', 'return cad.box(widht, 10, 5)'))
    expect(() => runKadeBuild(misspelt.build, { w: 20 }, misspelt.source)).toThrow('Line 5: there\'s nothing called "widht" — check the spelling.')
    const negative = await load(shapeCode('return cad.box(-3, 10, 5)'))
    expect(() => runKadeBuild(negative.build, { w: 20 }, negative.source)).toThrow('Line 4: Sizes must be bigger than 0 — width was -3')
  })
  it('frees every shape when the build fails part way', async () => {
    const { build, source } = await load(shapeCode('const a = cad.box(10, 10, 10)', 'const b = a.move(5, 0, 0)', 'return b.move(1, 2)'))
    const tracker = new ShapeTracker()
    expect(() => runKadeBuild(build, { w: 1 }, source, undefined, tracker)).toThrow('Line 6: .move needs 3 numbers')
    expect(tracker.counts()).toEqual({ made: 2, held: 0 })
  })
})
```

`src/kade/commands.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { loadTestFont } from '../geometry/testing/font-node'
import { initTestOC } from '../geometry/testing/oc-node'
import { CAD_COMMANDS, type CadCommand } from './commands'
import { Outline, OUTLINE_STEPS, Part, PART_STEPS, ShapeTracker } from './part'
import { buildKadeCode } from './testing/build-code'
import { createKadeToolkit } from './toolkit'

beforeAll(async () => {
  await initTestOC()
  await loadTestFont()
})

const names = (on: CadCommand['on']) => CAD_COMMANDS.filter((c) => c.on === on).map((c) => c.name).sort()

describe('the ❓ Commands list', () => {
  it('lists exactly the commands the toolkit, parts and outlines have', () => {
    expect(names('cad')).toEqual(Object.keys(createKadeToolkit(new ShapeTracker())).sort())
    expect(names('part')).toEqual([...PART_STEPS].sort())
    expect(names('outline')).toEqual([...OUTLINE_STEPS].sort())
    for (const step of PART_STEPS) expect(typeof Part.prototype[step]).toBe('function')
    for (const step of OUTLINE_STEPS) expect(typeof Outline.prototype[step]).toBe('function')
  })
  it('has no duplicate names and keeps every line short', () => {
    expect(new Set(CAD_COMMANDS.map((c) => `${c.on}.${c.name}`)).size).toBe(CAD_COMMANDS.length)
    for (const c of CAD_COMMANDS) expect(c.does.length).toBeLessThanOrEqual(90)
  })
  it.each(CAD_COMMANDS.map((c) => [c.call, c] as const))('%s: its example works', async (_call, command) => {
    const code = `export default { name: 'Example', build(s, cad) { const value = ${command.example}; return typeof value === 'number' ? cad.box(1, 1, 1) : value } }`
    const built = await buildKadeCode(code)
    built.dispose()
  })
})
```

`src/kade/examples/gear.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { initTestOC } from '../../geometry/testing/oc-node'
import { buildKadeCode } from '../testing/build-code'
import { GEAR_CODE } from './gear'

beforeAll(initTestOC)

describe('the Gear example', () => {
  it('has the four settings and size handles', async () => {
    const gear = await buildKadeCode(GEAR_CODE)
    expect(gear.meta.name).toBe('Gear')
    expect(Object.keys(gear.meta.params)).toEqual(['teeth', 'size', 'thickness', 'hole'])
    expect(gear.meta.size).toEqual({ x: 'size', y: 'size', z: 'thickness' })
    const [min, max] = gear.shape.boundingBox.bounds
    expect(max?.[0]).toBeCloseTo(20, 0)
    expect(min?.[0]).toBeCloseTo(-20, 0)
    expect(max?.[2]).toBeCloseTo(6, 1)
    gear.dispose()
  })
  it('builds with other settings', async () => {
    const gear = await buildKadeCode(GEAR_CODE, { teeth: 6, size: 60, thickness: 3, hole: 8 })
    expect(gear.shape.boundingBox.bounds[1]?.[2]).toBeCloseTo(3, 1)
    gear.dispose()
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/kade`
Expected: FAIL. `toolkit`, `run-build`, `commands`, `gear` and `build-code` don't exist.

- [ ] **Step 3: Implement `src/kade/toolkit.ts`**

```ts
import type { Shape3D } from 'replicad'
import { MAX_TEXT_PARAM_LENGTH } from '../document/types'
import { createCadToolkit } from '../plugins/cad'
import type { CadToolkit, Point2 } from '../plugins/cad-types'
import { MAX_MM } from '../plugins/params'
import { CadError, MAX_REPEAT, needArgs, numberArg, sizeArg, sizeOrZeroArg, wholeArg } from './args'
import { Outline, Part, type OutlineShape, type ShapeTracker } from './part'

type Command<R> = (...args: unknown[]) => R

/** The `cad` that Kade's build() receives. Every command checks its inputs and explains mistakes. */
export interface KadeToolkit {
  readonly box: Command<Part>
  readonly cylinder: Command<Part>
  readonly sphere: Command<Part>
  readonly cone: Command<Part>
  readonly ring: Command<Part>
  readonly wedge: Command<Part>
  readonly text: Command<Part>
  readonly rect: Command<Outline>
  readonly circle: Command<Outline>
  readonly polygon: Command<Outline>
  readonly repeat: Command<Part>
  readonly angle: Command<number>
  readonly sin: Command<number>
  readonly cos: Command<number>
}

function sizesOf<N extends string>(command: string, args: readonly unknown[], names: readonly N[], example: string): Record<N, number> {
  needArgs(args, names.length, { command, what: names.length === 1 ? 'a size' : `${names.length} sizes`, example })
  return Object.fromEntries(names.map((name, i) => [name, sizeArg(command, name, args[i])])) as Record<N, number>
}

function startingParts(part: (shape: Shape3D) => Part, internal: CadToolkit) {
  return {
    box: (...args: unknown[]) => {
      const { width, depth, height } = sizesOf('cad.box', args, ['width', 'depth', 'height'], 'cad.box(20, 10, 5)')
      return part(internal.box(width, depth, height))
    },
    cylinder: (...args: unknown[]) => {
      const { diameter, height } = sizesOf('cad.cylinder', args, ['diameter', 'height'], 'cad.cylinder(10, 20)')
      return part(internal.cylinder(diameter, height))
    },
    sphere: (...args: unknown[]) => part(internal.sphere(sizesOf('cad.sphere', args, ['diameter'], 'cad.sphere(20)').diameter)),
    cone: (...args: unknown[]) => {
      needArgs(args, 3, { command: 'cad.cone', what: '3 sizes', example: 'cad.cone(20, 0, 30)' })
      const bottom = sizeOrZeroArg('cad.cone', 'bottom', args[0])
      const top = sizeOrZeroArg('cad.cone', 'top', args[1])
      const height = sizeArg('cad.cone', 'height', args[2])
      if (bottom === 0 && top === 0) throw new CadError('A cone needs a bottom or a top bigger than 0.')
      return part(internal.revolve([[0, 0], [bottom / 2, 0], [top / 2, height], [0, height]]))
    },
    ring: (...args: unknown[]) => {
      const { outside, thickness } = sizesOf('cad.ring', args, ['outside', 'thickness'], 'cad.ring(40, 8)')
      return part(internal.torus(outside, thickness))
    },
    wedge: (...args: unknown[]) => {
      const { width, depth, height } = sizesOf('cad.wedge', args, ['width', 'depth', 'height'], 'cad.wedge(20, 10, 15)')
      return part(internal.extrudeSide([[-width / 2, 0], [width / 2, 0], [-width / 2, height]], depth))
    },
    text: (...args: unknown[]) => {
      needArgs(args, 3, { command: 'cad.text', what: 'words, a size and a depth', example: "cad.text('Hi', 10, 2)" })
      const words = args[0]
      if (typeof words !== 'string' || !words.trim()) throw new CadError("cad.text needs words in quotes first, like cad.text('Hi', 10, 2)")
      if (Array.from(words).length > MAX_TEXT_PARAM_LENGTH) throw new CadError(`cad.text can show up to ${MAX_TEXT_PARAM_LENGTH} letters.`)
      return part(internal.text(words, sizeArg('cad.text', 'size', args[1]), sizeArg('cad.text', 'depth', args[2])))
    },
  }
}

const POLYGON_USAGE = 'cad.polygon needs a list of at least 3 points, like cad.polygon([[0, 0], [20, 0], [0, 20]])'

function pointOf(value: unknown, index: number): Point2 {
  const good = Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === 'number' && Number.isFinite(v))
  if (!good) throw new CadError(`cad.polygon: point ${index + 1} must be two numbers in brackets, like [10, 5]`)
  const [x, y] = value as [number, number]
  if (Math.abs(x) > MAX_MM || Math.abs(y) > MAX_MM) throw new CadError(`Points can be up to ${MAX_MM} mm from the middle.`)
  return [x, y]
}

function outlines(outline: (drawing: OutlineShape) => Outline) {
  return {
    rect: (...args: unknown[]) => {
      const { width, depth } = sizesOf('cad.rect', args, ['width', 'depth'], 'cad.rect(20, 10)')
      const [x, y] = [width / 2, depth / 2]
      return outline({ kind: 'polygon', points: [[-x, -y], [x, -y], [x, y], [-x, y]] })
    },
    circle: (...args: unknown[]) => outline({ kind: 'circle', diameter: sizesOf('cad.circle', args, ['diameter'], 'cad.circle(10)').diameter }),
    polygon: (...args: unknown[]) => {
      const list = args[0]
      if (!Array.isArray(list) || list.length < 3) throw new CadError(POLYGON_USAGE)
      return outline({ kind: 'polygon', points: list.map(pointOf) })
    },
  }
}

const REPEAT_EXAMPLE = '(i) => cad.box(5, 5, 5).move(i * 10, 0, 0)'
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180

function helpers() {
  return {
    repeat: (...args: unknown[]) => {
      needArgs(args, 2, { command: 'cad.repeat', what: 'a count and a function', example: `cad.repeat(6, ${REPEAT_EXAMPLE})` })
      const count = wholeArg('cad.repeat', 'count', args[0], 1, MAX_REPEAT)
      const make = args[1]
      if (typeof make !== 'function') throw new CadError(`cad.repeat needs a function second, like ${REPEAT_EXAMPLE}`)
      const copies = Array.from({ length: count }, (_, i) => {
        const made: unknown = make(i)
        if (!(made instanceof Part)) throw new CadError(`cad.repeat's function must give back a part — copy ${i + 1} didn't.`)
        return made
      })
      const [first, ...rest] = copies as [Part, ...Part[]]
      return rest.reduce((acc, copy) => acc.add(copy), first)
    },
    angle: (...args: unknown[]) => {
      needArgs(args, 2, { command: 'cad.angle', what: 'a copy number and a count', example: 'cad.angle(1, 4)' })
      const i = numberArg('cad.angle', 'copy number', args[0])
      const count = numberArg('cad.angle', 'count', args[1])
      if (count <= 0) throw new CadError(`cad.angle: the count must be bigger than 0 — it was ${count}`)
      return (360 * i) / count
    },
    sin: (...args: unknown[]) => Math.sin(toRadians(numberArg('cad.sin', 'angle', args[0]))),
    cos: (...args: unknown[]) => Math.cos(toRadians(numberArg('cad.cos', 'angle', args[0]))),
  }
}

/** A fresh friendly toolkit for one build. Every solid it makes is tracked so the build can free it. */
export function createKadeToolkit(tracker: ShapeTracker, internal: CadToolkit = createCadToolkit()): KadeToolkit {
  const part = (shape: Shape3D): Part => new Part(tracker, tracker.track(shape))
  const outline = (drawing: OutlineShape): Outline => new Outline(tracker, internal, drawing)
  return { ...startingParts(part, internal), ...outlines(outline), ...helpers() }
}
```

- [ ] **Step 4: Implement `src/kade/run-build.ts`**

```ts
import type { Shape3D } from 'replicad'
import type { CadToolkit } from '../plugins/cad-types'
import type { ParamValues } from '../plugins/types'
import { CadError } from './args'
import { friendlyError } from './errors'
import { Outline, Part, ShapeTracker } from './part'
import { createKadeToolkit, type KadeToolkit } from './toolkit'

export type KadeBuild = (values: ParamValues, cad: KadeToolkit) => unknown

export const MISSING_RETURN = 'build() needs to end with return and a part, like return cad.box(10, 10, 10).'
export const RETURNED_OUTLINE = 'build() gave back a flat outline. Turn it into a part first with .extrude(height) or .spin().'

function resultOf(value: unknown): Part {
  if (value instanceof Part) return value
  throw new CadError(value instanceof Outline ? RETURNED_OUTLINE : MISSING_RETURN)
}

/**
 * Runs one of Kade's builds with the friendly toolkit. Errors come back in plain words, with the line when known.
 * Every shape the build made is freed except the result, which the caller now owns.
 */
export function runKadeBuild(
  build: KadeBuild, values: ParamValues, source: string | null, internal?: CadToolkit, tracker = new ShapeTracker(),
): Shape3D {
  let result: Shape3D | null = null
  try {
    result = resultOf(build(values, createKadeToolkit(tracker, internal))).shape
    return result
  } catch (error) {
    throw new Error(friendlyError(error, source))
  } finally {
    tracker.freeAllBut(result)
  }
}
```

- [ ] **Step 5: Implement `src/kade/commands.ts`**

```ts
export interface CadCommand {
  /** The toolkit key, part step or outline step. */
  readonly name: string
  readonly on: 'cad' | 'part' | 'outline'
  readonly group: 'start' | 'outline' | 'step' | 'helper'
  readonly call: string
  /** One short line, in Kade's words. */
  readonly does: string
  /** A tiny working example. Tested: each one builds. */
  readonly example: string
}

export const COMMAND_GROUPS: readonly { readonly group: CadCommand['group']; readonly title: string }[] = [
  { group: 'start', title: 'Starting parts' },
  { group: 'outline', title: 'Flat outlines' },
  { group: 'step', title: 'Part steps' },
  { group: 'helper', title: 'Helpers' },
]

/** Every command Kade can use. The ❓ Commands tab shows this list, and a test checks it against the toolkit. */
export const CAD_COMMANDS: readonly CadCommand[] = [
  { name: 'box', on: 'cad', group: 'start', call: 'cad.box(width, depth, height)', does: 'A box, sitting on the ground in the middle.', example: 'cad.box(20, 10, 5)' },
  { name: 'cylinder', on: 'cad', group: 'start', call: 'cad.cylinder(diameter, height)', does: 'An upright cylinder.', example: 'cad.cylinder(10, 20)' },
  { name: 'sphere', on: 'cad', group: 'start', call: 'cad.sphere(diameter)', does: 'A ball resting on the ground.', example: 'cad.sphere(20)' },
  { name: 'cone', on: 'cad', group: 'start', call: 'cad.cone(bottom, top, height)', does: 'A cone. Make the top 0 for a point.', example: 'cad.cone(20, 0, 30)' },
  { name: 'ring', on: 'cad', group: 'start', call: 'cad.ring(outside, thickness)', does: 'A ring lying flat, like a doughnut.', example: 'cad.ring(40, 8)' },
  { name: 'wedge', on: 'cad', group: 'start', call: 'cad.wedge(width, depth, height)', does: 'A ramp: tall on the left, down to the ground on the right.', example: 'cad.wedge(20, 10, 15)' },
  { name: 'text', on: 'cad', group: 'start', call: "cad.text('words', size, depth)", does: 'Raised letters.', example: "cad.text('Hi', 10, 2)" },
  { name: 'rect', on: 'cad', group: 'outline', call: 'cad.rect(width, depth)', does: 'A flat rectangle outline.', example: 'cad.rect(20, 10).extrude(5)' },
  { name: 'circle', on: 'cad', group: 'outline', call: 'cad.circle(diameter)', does: 'A flat circle outline.', example: 'cad.circle(20).extrude(3)' },
  { name: 'polygon', on: 'cad', group: 'outline', call: 'cad.polygon([[x, y], …])', does: 'A flat outline through the points you list.', example: 'cad.polygon([[0, 0], [20, 0], [0, 10]]).extrude(4)' },
  { name: 'extrude', on: 'outline', group: 'outline', call: '.extrude(height)', does: 'Pushes an outline straight up into a part.', example: 'cad.rect(20, 10).extrude(5)' },
  { name: 'spin', on: 'outline', group: 'outline', call: '.spin()', does: 'Spins an outline around the up line. x is how far out, y is how high.', example: 'cad.polygon([[0, 0], [10, 0], [0, 15]]).spin()' },
  { name: 'move', on: 'part', group: 'step', call: '.move(x, y, z)', does: 'Moves a part. z is up.', example: 'cad.box(10, 10, 10).move(20, 0, 5)' },
  { name: 'rotate', on: 'part', group: 'step', call: ".rotate('x' | 'y' | 'z', degrees)", does: 'Turns a part around a line through the middle of the ground.', example: "cad.box(20, 5, 5).rotate('z', 45)" },
  { name: 'add', on: 'part', group: 'step', call: '.add(part)', does: 'Joins two parts into one.', example: 'cad.box(20, 20, 5).add(cad.cylinder(10, 15))' },
  { name: 'cut', on: 'part', group: 'step', call: '.cut(part)', does: 'Cuts one part out of another, like drilling a hole.', example: 'cad.box(20, 20, 5).cut(cad.cylinder(6, 7).move(0, 0, -1))' },
  { name: 'overlap', on: 'part', group: 'step', call: '.overlap(part)', does: 'Keeps only the space both parts share.', example: 'cad.box(20, 20, 20).overlap(cad.sphere(26).move(0, 0, -3))' },
  { name: 'mirror', on: 'part', group: 'step', call: ".mirror('x' | 'y' | 'z')", does: 'Flips a part to the other side.', example: "cad.wedge(20, 10, 15).mirror('x')" },
  { name: 'copy', on: 'part', group: 'step', call: '.copy()', does: 'Makes a copy of a part.', example: 'cad.box(10, 10, 10).copy()' },
  { name: 'repeat', on: 'cad', group: 'helper', call: 'cad.repeat(count, (i) => part)', does: 'Makes count parts (i counts 0, 1, 2…) and joins them.', example: 'cad.repeat(4, (i) => cad.box(5, 5, 5).move(i * 10, 0, 0))' },
  { name: 'angle', on: 'cad', group: 'helper', call: 'cad.angle(i, count)', does: 'The angle for copy i when count copies go around a circle.', example: 'cad.angle(1, 4)' },
  { name: 'sin', on: 'cad', group: 'helper', call: 'cad.sin(degrees)', does: 'The sine of an angle in degrees, for placing things round a circle.', example: 'cad.sin(30)' },
  { name: 'cos', on: 'cad', group: 'helper', call: 'cad.cos(degrees)', does: 'The cosine of an angle in degrees.', example: 'cad.cos(60)' },
]
```

- [ ] **Step 6: Implement `src/kade/examples/gear.ts`**

```ts
/** The ⚙️ Gear example from ❓ Commands. Built only from commands Kade can see in the list. */
export const GEAR_CODE = `export default {
  name: 'Gear',
  icon: '⚙️',
  settings: {
    teeth: { type: 'whole', default: 12, min: 6, max: 60, label: 'Teeth' },
    size: { type: 'mm', default: 40, label: 'Size' },
    thickness: { type: 'mm', default: 6, label: 'Thickness' },
    hole: { type: 'mm', default: 5, label: 'Hole' },
  },
  size: { x: 'size', y: 'size', z: 'thickness' },
  build({ teeth, size, thickness, hole }, cad) {
    const toothLength = size / 10
    const body = cad.cylinder(size - toothLength * 2, thickness)
    const tooth = cad.box(toothLength * 2, (Math.PI * size) / teeth / 2, thickness).move(size / 2 - toothLength, 0, 0)
    const ring = cad.repeat(teeth, (i) => tooth.rotate('z', cad.angle(i, teeth)))
    return body.add(ring).cut(cad.cylinder(hole, thickness + 2).move(0, 0, -1))
  },
}
`
```

- [ ] **Step 7: Implement `src/kade/testing/build-code.ts`**

```ts
import type { Shape3D } from 'replicad'
import { resolveParams } from '../../plugins/params'
import type { ShapePlugin } from '../../plugins/types'
import { readShapeDefinition } from '../definition'
import type { ShapeMeta } from '../meta'
import { runKadeBuild } from '../run-build'
import { fileModuleLoader } from './file-loader'

/** Node tests: load Kade's code, check it, and build it with its default settings (plus `values`). */
export async function buildKadeCode(
  code: string, values: Readonly<Record<string, unknown>> = {},
): Promise<{ shape: Shape3D; meta: ShapeMeta; dispose(): void }> {
  const loaded = await fileModuleLoader(code)
  const definition = readShapeDefinition(loaded.exports)
  if (!definition.ok) {
    loaded.dispose()
    throw new Error(definition.error)
  }
  const { meta, build } = definition.value
  const plugin: ShapePlugin = { id: 'test', name: meta.name, icon: meta.icon, version: 1, params: meta.params, build: () => { throw new Error('unused') } }
  const shape = runKadeBuild(build, resolveParams(plugin, values), loaded.source)
  return { shape, meta, dispose: () => { shape.delete(); loaded.dispose() } }
}
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run src/kade`
Expected: PASS.

If the `cad.text` bounds check fails, look at `letters[0]?.[2]`: replicad can report about −0.0001, which rounds to 0 in this test's `bounds`. If `cad.ring(10, 8)` gives a different message, the internal toolkit's torus message wins. Copy its exact text into the test.

- [ ] **Step 9: Commit**

```bash
git add src/kade
git commit -m "feat: add the friendly cad toolkit, commands list and gear example

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 7: Kade's shapes in the build engine and the `plugins/` folder

Plugins gain three optional fields:
- `revision`: a hash of the code, used by the build cache in place of `version`.
- `toolkit: 'kade'`: the evaluator calls `build` through `runKadeBuild` with the friendly toolkit.
- `source`: where the code was loaded from, so errors get line numbers.

`plugins/` folder files now use the friendly toolkit and the same friendly checks.

**Files:**
- Modify: `src/plugins/types.ts`, `src/plugins/registry.ts`, `src/plugins/index.ts`, `src/kade/meta.ts`, `src/geometry/evaluate.ts`
- Create: `src/kade/folder.ts`
- Test: `src/kade/meta.test.ts`, `src/kade/folder.test.ts`, `src/geometry/evaluate.test.ts`, `src/plugins/registry.test.ts`

**Interfaces:**
- Consumes:
  - Task 5: `ShapeMeta`, `readShapeDefinition`.
  - Task 6: `runKadeBuild`, `KadeBuild`.
- Produces:
  - `ShapePlugin.revision?: string`, `ShapePlugin.toolkit?: 'kade'`, `ShapePlugin.source?: string`.
  - `metaToPlugin(id: string, meta: ShapeMeta, revision?: string): ShapePlugin`. The page-side `build` it returns always throws.
  - `loadFolderPlugins(modules: Readonly<Record<string, unknown>>): { plugins: ShapePlugin[]; problems: string[] }`.
  - `Evaluator.setRegistry(registry: PluginRegistry): void`.

- [ ] **Step 1: Write the failing tests**

`src/kade/meta.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { CadToolkit } from '../plugins/cad-types'
import { metaToPlugin } from './meta'

describe('metaToPlugin', () => {
  it('makes a plugin entry for the page from the worker\'s report', () => {
    const plugin = metaToPlugin('my-0123456789', {
      name: 'Gear', icon: '⚙️', params: { size: { type: 'mm', default: 40, label: 'Size' } }, size: { x: 'size' }, mode: 'hole', palette: 'fit',
    }, 'abc-1')
    expect(plugin).toMatchObject({
      id: 'my-0123456789', name: 'Gear', icon: '⚙️', version: 1, revision: 'abc-1', toolkit: 'kade',
      params: { size: { type: 'mm', default: 40, label: 'Size' } }, size: { x: 'size' }, mode: 'hole', palette: 'fit',
    })
  })
  it('never builds on the page', () => {
    const plugin = metaToPlugin('my-a', { name: 'A', icon: 'x', params: {} })
    expect(() => plugin.build({}, {} as CadToolkit)).toThrow('built in the geometry worker')
    expect(plugin.revision).toBeUndefined()
  })
})
```

`src/kade/folder.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createRegistry } from '../plugins/registry'
import { NO_NAME } from './definition'
import { loadFolderPlugins } from './folder'

const build = () => null

describe('loadFolderPlugins', () => {
  it('turns plugin files into plugins that use the friendly toolkit', () => {
    const { plugins, problems } = loadFolderPlugins({
      '../../plugins/robot-head.js': { name: 'Robot head', icon: '🤖', build, settings: { size: { type: 'mm', default: 20 } } },
    })
    expect(problems).toEqual([])
    expect(plugins[0]).toMatchObject({
      id: 'robot-head', name: 'Robot head', icon: '🤖', version: 1, toolkit: 'kade',
      params: { size: { type: 'mm', default: 20, label: 'size' } },
    })
    expect(plugins[0]?.build).toBe(build)
    expect(createRegistry(plugins).problems).toEqual([])
  })
  it('keeps an id and version written in the file', () => {
    const { plugins } = loadFolderPlugins({ '../../plugins/x.js': { id: 'robot', version: 3, name: 'Robot', build } })
    expect(plugins[0]).toMatchObject({ id: 'robot', version: 3 })
  })
  it('makes an id from an awkward file name', () => {
    const { plugins } = loadFolderPlugins({ '../../plugins/sub/My Robot!.ts': { name: 'Robot', build } })
    expect(plugins[0]?.id).toBe('my-robot')
  })
  it('reports a broken file by name and leaves it out', () => {
    const { plugins, problems } = loadFolderPlugins({ '../../plugins/broken.js': { build } })
    expect(plugins).toEqual([])
    expect(problems).toEqual([`Plugin file "broken.js" has a problem: ${NO_NAME}`])
  })
})
```

Add to `src/plugins/registry.test.ts`:

```ts
it("accepts the fields Kade's shapes carry", () => {
  const { problems } = createRegistry([{ ...good('mine'), revision: 'abc-1', toolkit: 'kade', source: 'blob:x' }])
  expect(problems).toEqual([])
})
```

Add to `src/geometry/evaluate.test.ts`. Add these imports to the top of the file: `type ShapePlugin` from `../plugins/types` (merged into the existing `definePlugin` import) and `type KadeBuild` from `../kade/run-build`. Then add:

```ts
describe("Evaluator with Kade's shapes", () => {
  const kadePlugin = (revision: string, build: KadeBuild): ShapePlugin => ({
    id: 'kade-thing', name: 'Kade thing', icon: '🧩', version: 1, revision, toolkit: 'kade',
    params: { w: { type: 'mm', default: 10, label: 'W' } },
    // Kade's builds take the friendly toolkit; the evaluator calls them through runKadeBuild.
    build: build as unknown as ShapePlugin['build'],
  })
  const registryOf = (plugin: ShapePlugin) => createRegistry([plugin]).registry
  const doc = () => addNode(createEmptyDocument(), createShapeNode({ id: 'k', shapeType: 'kade-thing', name: 'K', params: { w: 10 }, color: '#fff' }))

  it('builds them with the friendly toolkit', () => {
    const evaluator = new Evaluator(registryOf(kadePlugin('r1', (v, cad) => cad.box(v.w, 10, 10).move(0, 0, 5))), createCadToolkit())
    expect(evaluator.local(doc(), 'k').boundingBox.bounds[0]?.[2]).toBeCloseTo(5)
  })
  it('puts the friendly message on the part', () => {
    const evaluator = new Evaluator(registryOf(kadePlugin('r1', () => undefined)), createCadToolkit())
    expect(buildError(() => evaluator.local(doc(), 'k')).message)
      .toBe("Kade thing couldn't be built: build() needs to end with return and a part, like return cad.box(10, 10, 10).")
  })
  it('rebuilds when the code changes, even with the same id and settings', () => {
    const evaluator = new Evaluator(registryOf(kadePlugin('r1', (_v, cad) => cad.box(10, 10, 10))), createCadToolkit())
    const first = evaluator.local(doc(), 'k')
    evaluator.setRegistry(registryOf(kadePlugin('r2', (_v, cad) => cad.box(20, 10, 10))))
    const second = evaluator.local(doc(), 'k')
    expect(second).not.toBe(first)
    expect(second.boundingBox.bounds[1]?.[0]).toBeCloseTo(10)
  })
})
```

(`cad.box(v.w, …)` type checks because `KadeToolkit` commands take `unknown` arguments.)

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/kade/meta.test.ts src/kade/folder.test.ts src/plugins/registry.test.ts src/geometry/evaluate.test.ts`
Expected: FAIL. `metaToPlugin`, `loadFolderPlugins` and `setRegistry` don't exist, and the registry rejects `revision`.

- [ ] **Step 3: Add the plugin fields**

`src/plugins/types.ts`, inside `ShapePlugin` after `palette`:

```ts
  /** Kade's shapes: a hash of the code. The build cache uses it in place of `version`. */
  readonly revision?: string
  /** 'kade': build() takes the friendly toolkit and is run through runKadeBuild (Kade's library and the plugins/ folder). */
  readonly toolkit?: 'kade'
  /** Where Kade's code was loaded from, so errors can name the line. */
  readonly source?: string
```

`src/plugins/registry.ts`, inside `pluginSchema`'s object after `palette`:

```ts
    revision: z.string().optional(),
    toolkit: z.literal('kade').optional(),
    source: z.string().optional(),
```

- [ ] **Step 4: Add `metaToPlugin` to `src/kade/meta.ts`**

```ts
const BUILT_IN_WORKER = (): never => {
  throw new Error("Kade's shapes are built in the geometry worker.")
}

/** A plugin entry made from the worker's report. The page uses it for the palette, Properties and size handles; it never builds. */
export function metaToPlugin(id: string, meta: ShapeMeta, revision?: string): ShapePlugin {
  return {
    id, name: meta.name, icon: meta.icon, version: 1, toolkit: 'kade', params: meta.params,
    ...(revision ? { revision } : {}),
    ...(meta.size ? { size: meta.size } : {}),
    ...(meta.mode ? { mode: meta.mode } : {}),
    ...(meta.palette ? { palette: meta.palette } : {}),
    build: BUILT_IN_WORKER,
  }
}
```

- [ ] **Step 5: Create `src/kade/folder.ts`**

```ts
import type { ShapePlugin } from '../plugins/types'
import { readShapeDefinition } from './definition'
import { metaToPlugin } from './meta'
import { isRecord } from './settings'

const fileName = (path: string): string => path.split('/').pop() ?? path

function idFromPath(path: string): string {
  const id = fileName(path).replace(/\.(js|ts)$/, '').toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-').replace(/^[^a-z]+/, '').replace(/-+$/, '')
  return id || 'plugin'
}

const versionOf = (raw: unknown): number => (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 ? raw : 1)

type Loaded = { readonly plugin: ShapePlugin } | { readonly problem: string }

function loadOne(path: string, value: unknown): Loaded {
  const definition = readShapeDefinition({ default: value })
  if (!definition.ok) return { problem: `Plugin file "${fileName(path)}" has a problem: ${definition.error}` }
  const raw = isRecord(value) ? value : {}
  const id = typeof raw.id === 'string' ? raw.id : idFromPath(path)
  const plugin: ShapePlugin = {
    ...metaToPlugin(id, definition.value.meta),
    version: versionOf(raw.version),
    // Folder plugins take the friendly toolkit; the evaluator calls them through runKadeBuild.
    build: definition.value.build as unknown as ShapePlugin['build'],
  }
  return { plugin }
}

/** Plugin files in the plugins/ folder, checked the same friendly way as Kade's library shapes. */
export function loadFolderPlugins(modules: Readonly<Record<string, unknown>>): { plugins: ShapePlugin[]; problems: string[] } {
  const loaded = Object.entries(modules).map(([path, value]) => loadOne(path, value))
  return {
    plugins: loaded.flatMap((l) => ('plugin' in l ? [l.plugin] : [])),
    problems: loaded.flatMap((l) => ('problem' in l ? [l.problem] : [])),
  }
}
```

- [ ] **Step 6: Use it in `src/plugins/index.ts`**

Replace the last line with:

```ts
const folder = loadFolderPlugins(kades)
const created = createRegistry([...builtinPlugins, ...folder.plugins])

export const registry = created.registry
export const pluginProblems: readonly string[] = [...folder.problems, ...created.problems]
```

Then add `import { loadFolderPlugins } from '../kade/folder'`.

- [ ] **Step 7: Teach the evaluator**

`src/geometry/evaluate.ts`:
- Import `runKadeBuild` and `type KadeBuild` from `../kade/run-build`, and `type ParamValues` and `type ShapePlugin` from `../plugins/types`.
- Change the constructor to `constructor(private registry: PluginRegistry, private readonly cad: CadToolkit) {}` (the registry is no longer readonly).
- Add after the constructor:

```ts
  /** Swaps the shape list (for example to a design's carried shapes). Cached builds stay; Kade's are keyed by revision. */
  setRegistry(registry: PluginRegistry): void {
    this.registry = registry
  }
```

- In `shapeKey`, change `${plugin?.version ?? 0}` to `${plugin?.revision ?? plugin?.version ?? 0}`.
- In `shapeLocal`, change `return plugin.build(params, this.cad)` to `return this.buildShape(plugin, params)`.
- Add the method:

```ts
  private buildShape(plugin: ShapePlugin, params: ParamValues): Shape3D {
    if (plugin.toolkit !== 'kade') return plugin.build(params, this.cad)
    // Kade's builds take the friendly toolkit, not the internal one their type names.
    return runKadeBuild(plugin.build as unknown as KadeBuild, params, plugin.source ?? null, this.cad)
  }
```

- [ ] **Step 8: Run the tests**

Run: `npm test`
Expected: PASS. `src/plugins/index.test.ts` still finds no plugin problems, because the `plugins/` folder only holds a README.

- [ ] **Step 9: Commit**

```bash
git add src/plugins src/kade src/geometry/evaluate.ts src/geometry/evaluate.test.ts
git commit -m "feat: build Kade's shapes with the friendly toolkit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 8: Loading Kade's code in the worker

`KadeShapes` lives in the worker. It loads and checks code, caching each check by the code's hash. It also builds a shape list for each design from the design's carried code. That is why a design opens anywhere, even with an empty library. The worker's API gains `inspect(code)`, and `rebuild` gains a **channel**. The preview and the design each keep their own cache entries, so neither pushes the other's out.

**Files:**
- Create: `src/kade/kade-shapes.ts`, `src/kade/blob-loader.ts`
- Modify:
  - `src/geometry/types.ts`, `src/geometry/evaluate.ts`, `src/geometry/api.ts`, `src/geometry/geometry.worker.ts`, `src/geometry/spawn.ts`
  - `src/app/testing/fakes.ts`, `src/geometry/client.test.ts` (fake worker)
- Test: `src/kade/kade-shapes.test.ts`, `src/geometry/api.test.ts`, `src/geometry/evaluate.test.ts`

**Interfaces:**
- Consumes:
  - Tasks 3 and 5–7: `findSyntaxProblem`, `friendlyError`, `codeHash`, `readShapeDefinition`, `metaToPlugin`, `ModuleLoader`, `ModuleLoadError`, `KadeBuild`.
  - Messages: `CODE_TOO_BIG`, `CHECK_FAILED`.
- Produces:
  - `class KadeShapes(load: ModuleLoader, base: PluginRegistry, limit = 50)`, with `inspect(code): Promise<InspectResult>` and `registryFor(doc): Promise<PluginRegistry>`.
  - `blobModuleLoader: ModuleLoader`, for the worker only.
  - In `src/geometry/types.ts`: `BuildChannel = 'design' | 'preview'`, `GeometryApi.rebuild(doc, channel?)` and `GeometryApi.inspect(code)`.
  - `createGeometryApi(evaluator, shapes: KadeShapes)`.
  - `Evaluator.beginPass(channel?: BuildChannel)`.
  - `fakeInspect(code): InspectResult` in `src/app/testing/fakes.ts`, which `fakeGeometryApi` uses.

- [ ] **Step 1: Write the failing tests**

`src/kade/kade-shapes.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { initTestOC } from '../geometry/testing/oc-node'
import { registry } from '../plugins/index'
import { NO_BUILD } from './definition'
import { codeHash } from './hash'
import { KadeShapes } from './kade-shapes'
import { CODE_TOO_BIG } from './messages'
import type { ModuleLoader } from './module-loader'
import { fileModuleLoader } from './testing/file-loader'

beforeAll(initTestOC)

const ROBOT = ["export default {", "  name: 'Robot',", "  icon: '🤖',", "  settings: { size: { type: 'mm', default: 20 } },",
  '  build({ size }, cad) { return cad.box(size, size, size) },', '}'].join('\n')

function counting() {
  const counts = { loads: 0, disposed: 0 }
  const load: ModuleLoader = async (code) => {
    counts.loads += 1
    const loaded = await fileModuleLoader(code)
    return { ...loaded, dispose: () => { counts.disposed += 1; loaded.dispose() } }
  }
  return { load, counts }
}

describe('KadeShapes.inspect', () => {
  it('reports the name, icon and settings, and loads each code only once', async () => {
    const { load, counts } = counting()
    const shapes = new KadeShapes(load, registry)
    const expected = { ok: true, meta: { name: 'Robot', icon: '🤖', params: { size: { type: 'mm', default: 20, label: 'size' } } } }
    await expect(shapes.inspect(ROBOT)).resolves.toEqual(expected)
    await expect(shapes.inspect(ROBOT)).resolves.toEqual(expected)
    expect(counts.loads).toBe(1)
  })
  it('finds syntax mistakes and over-long code without running anything', async () => {
    const { load, counts } = counting()
    const shapes = new KadeShapes(load, registry)
    const syntax = await shapes.inspect("export default { name: 'A'")
    expect(!syntax.ok && syntax.problem).toMatch(/^Line 1: something here doesn't look right/)
    await expect(shapes.inspect('x'.repeat(50_001))).resolves.toEqual({ ok: false, problem: CODE_TOO_BIG })
    expect(counts.loads).toBe(0)
  })
  it('explains errors while the code loads, with the line', async () => {
    const shapes = new KadeShapes(fileModuleLoader, registry)
    await expect(shapes.inspect('const size = 1\nconst x = nope\nexport default {}'))
      .resolves.toEqual({ ok: false, problem: 'Line 2: there\'s nothing called "nope" — check the spelling.' })
  })
  it('explains a definition problem and lets go of the module', async () => {
    const { load, counts } = counting()
    await expect(new KadeShapes(load, registry).inspect("export default { name: 'A' }")).resolves.toEqual({ ok: false, problem: NO_BUILD })
    expect(counts.disposed).toBe(1)
  })
  it('forgets the oldest code past its limit', async () => {
    const { load, counts } = counting()
    const shapes = new KadeShapes(load, registry, 2)
    const code = (n: number) => `export default { name: 'S${n}', build(s, cad) { return cad.box(1, 1, 1) } }`
    await shapes.inspect(code(1))
    await shapes.inspect(code(2))
    await shapes.inspect(code(3))
    await new Promise((r) => setTimeout(r, 0))
    expect(counts.disposed).toBe(1)
    await shapes.inspect(code(1))
    expect(counts.loads).toBe(4)
  })
})

describe('KadeShapes.registryFor', () => {
  it('adds the shapes a design carries to the built-in ones', async () => {
    const doc = { ...createEmptyDocument(), plugins: { 'my-robot0001': { name: 'Robot', code: ROBOT } } }
    const shapes = await new KadeShapes(fileModuleLoader, registry).registryFor(doc)
    expect(shapes.get('my-robot0001')).toMatchObject({ name: 'Robot', toolkit: 'kade', revision: codeHash(ROBOT) })
    expect(shapes.list()).toHaveLength(registry.list().length + 1)
    expect(shapes.get('box')).toBe(registry.get('box'))
  })
  it('keeps the built-in shape when a design carries the same id', async () => {
    const doc = { ...createEmptyDocument(), plugins: { box: { name: 'Robot', code: ROBOT } } }
    const shapes = await new KadeShapes(fileModuleLoader, registry).registryFor(doc)
    expect(shapes.get('box')).toBe(registry.get('box'))
  })
  it('hands back the built-in list for a design that carries nothing', async () => {
    expect(await new KadeShapes(fileModuleLoader, registry).registryFor(createEmptyDocument())).toBe(registry)
  })
})
```

`src/geometry/api.test.ts`:
- Add the imports `KadeShapes` from `../kade/kade-shapes` and `fileModuleLoader` from `../kade/testing/file-loader`.
- Change `newApi` to:

```ts
const newApi = () => createGeometryApi(new Evaluator(registry, createCadToolkit()), new KadeShapes(fileModuleLoader, registry))
```

- Add:

```ts
describe("designs carrying Kade's shapes (a fresh worker, an empty library)", () => {
  const ROBOT = "export default { name: 'Robot', settings: { size: { type: 'mm', default: 20 } }, build({ size }, cad) { return cad.box(size, size, size).add(cad.sphere(size).move(0, 0, size)) } }"
  const carrying = (code: string): BloKadeDocument => {
    const robot = createShapeNode({ id: 'robot', shapeType: 'my-robot0001', name: 'Robot', params: { size: 10 }, color: '#fff' })
    const doc = addNode(addNode(createEmptyDocument('Robots'), robot), shape('box', 'box', { width: 10, depth: 10, height: 10 }, [30, 0, 0]))
    return { ...doc, plugins: { 'my-robot0001': { name: 'Robot', code } } }
  }

  it('builds the carried shape', async () => {
    const result = await newApi().rebuild(carrying(ROBOT))
    expect(result.nodes.robot?.status).toBe('ok')
    expect(result.nodes.box?.status).toBe('ok')
  })
  it('exports a design that carries a shape', async () => {
    expect((await newApi().exportStl(carrying(ROBOT))).byteLength).toBeGreaterThan(84)
  })
  it('fails only the part whose carried code has a problem', async () => {
    const result = await newApi().rebuild(carrying("export default { name: 'Robot', build(s, cad) { return cad.box(-1, 1, 1) } }"))
    const robot = result.nodes.robot
    expect(robot?.status === 'error' && robot.message).toBe("Robot couldn't be built: Line 1: Sizes must be bigger than 0 — width was -1")
    expect(result.nodes.box?.status).toBe('ok')
  })
  it('explains carried code that does not even load', async () => {
    const result = await newApi().rebuild(carrying("export default { name: 'Robot' "))
    const robot = result.nodes.robot
    expect(robot?.status === 'error' && robot.message).toMatch(/^Robot couldn't be built: Line 1: something here doesn't look right/)
  })
  it('inspects code', async () => {
    await expect(newApi().inspect(ROBOT)).resolves.toMatchObject({ ok: true, meta: { name: 'Robot' } })
  })
})
```

Add to `src/geometry/evaluate.test.ts`:

```ts
describe('Evaluator build channels', () => {
  const single = (id: string, shapeType: string, params: Record<string, number>) => addNode(createEmptyDocument(), shape(id, shapeType, params))
  const pass = (evaluator: Evaluator, doc: BloKadeDocument, channel: 'design' | 'preview', id: string) => {
    evaluator.beginPass(channel)
    const built = evaluator.local(doc, id)
    evaluator.endPass()
    return built
  }

  it('keeps the preview\'s shapes while the design rebuilds, and the other way round', () => {
    const evaluator = newEvaluator()
    const design = single('b', 'box', { width: 10, depth: 10, height: 10 })
    const preview = single('p', 'cylinder', { diameter: 10, height: 10 })
    const box = pass(evaluator, design, 'design', 'b')
    const cylinder = pass(evaluator, preview, 'preview', 'p')
    expect(pass(evaluator, design, 'design', 'b')).toBe(box)
    expect(pass(evaluator, preview, 'preview', 'p')).toBe(cylinder)
  })
  it('still frees a channel\'s old shapes', () => {
    const evaluator = newEvaluator()
    const design = single('b', 'box', { width: 10, depth: 10, height: 10 })
    const box = pass(evaluator, design, 'design', 'b')
    pass(evaluator, single('s', 'sphere', { diameter: 10 }), 'design', 's')
    expect(pass(evaluator, design, 'design', 'b')).not.toBe(box)
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/kade/kade-shapes.test.ts src/geometry/api.test.ts src/geometry/evaluate.test.ts`
Expected: FAIL. `KadeShapes` doesn't exist, and `createGeometryApi` takes one argument.

- [ ] **Step 3: Create `src/kade/kade-shapes.ts`**

```ts
import { MAX_SHAPE_CODE_LENGTH, type BloKadeDocument, type CarriedShape } from '../document/types'
import type { PluginRegistry } from '../plugins/registry'
import type { ShapePlugin } from '../plugins/types'
import { DEFAULT_ICON, readShapeDefinition } from './definition'
import { friendlyError } from './errors'
import { codeHash } from './hash'
import { CHECK_FAILED, CODE_TOO_BIG } from './messages'
import { metaToPlugin, type InspectResult } from './meta'
import { ModuleLoadError, type LoadedModule, type ModuleLoader } from './module-loader'
import type { KadeBuild } from './run-build'
import { findSyntaxProblem } from './syntax'

interface Checked {
  readonly result: InspectResult
  readonly build?: KadeBuild
  readonly source?: string
  dispose(): void
}

const failed = (problem: string): Checked => ({ result: { ok: false, problem }, dispose: () => undefined })

/** Worker side of Kade's shapes: loads and checks code (cached by hash) and makes each design's shape list. */
export class KadeShapes {
  /** Oldest first, so the first key is the one to forget. */
  private readonly checked = new Map<string, Promise<Checked>>()

  constructor(private readonly load: ModuleLoader, private readonly base: PluginRegistry, private readonly limit = 50) {}

  async inspect(code: string): Promise<InspectResult> {
    return (await this.entry(code)).result
  }

  /** The built-in shapes plus every shape the design carries. Built-in ids always win. */
  async registryFor(doc: BloKadeDocument): Promise<PluginRegistry> {
    const carried = Object.entries(doc.plugins).filter(([id]) => !this.base.get(id))
    if (carried.length === 0) return this.base
    const entries = await Promise.all(carried.map(async ([id, shape]) => [id, this.pluginFor(id, shape, await this.entry(shape.code))] as const))
    const byId = new Map(entries)
    const list = [...this.base.list(), ...byId.values()]
    return { get: (id) => this.base.get(id) ?? byId.get(id), list: () => list }
  }

  private pluginFor(id: string, shape: CarriedShape, checked: Checked): ShapePlugin {
    const revision = codeHash(shape.code)
    if (!checked.result.ok || !checked.build) {
      const problem = checked.result.ok ? CHECK_FAILED : checked.result.problem
      return { id, name: shape.name, icon: DEFAULT_ICON, version: 1, revision, toolkit: 'kade', params: {}, build: () => { throw new Error(problem) } }
    }
    // Kade's builds take the friendly toolkit; the evaluator calls them through runKadeBuild.
    return { ...metaToPlugin(id, checked.result.meta, revision), source: checked.source, build: checked.build as unknown as ShapePlugin['build'] }
  }

  private entry(code: string): Promise<Checked> {
    const key = codeHash(code)
    const hit = this.checked.get(key)
    if (hit) {
      this.checked.delete(key)
      this.checked.set(key, hit)
      return hit
    }
    const made = this.check(code)
    this.checked.set(key, made)
    this.forgetOldest()
    return made
  }

  private forgetOldest(): void {
    while (this.checked.size > this.limit) {
      const oldest = this.checked.keys().next().value
      if (oldest === undefined) return
      const entry = this.checked.get(oldest)
      this.checked.delete(oldest)
      // Shapes already built from it keep working; only the blob URL is let go.
      void entry?.then((c) => c.dispose())
    }
  }

  private async check(code: string): Promise<Checked> {
    if (code.length > MAX_SHAPE_CODE_LENGTH) return failed(CODE_TOO_BIG)
    const syntax = findSyntaxProblem(code)
    if (syntax) return failed(syntax)
    const loaded = await this.loadModule(code)
    if ('problem' in loaded) return failed(loaded.problem)
    const definition = readShapeDefinition(loaded.exports)
    if (!definition.ok) {
      loaded.dispose()
      return failed(definition.error)
    }
    return { result: { ok: true, meta: definition.value.meta }, build: definition.value.build, source: loaded.source, dispose: loaded.dispose }
  }

  private async loadModule(code: string): Promise<LoadedModule | { readonly problem: string }> {
    try {
      return await this.load(code)
    } catch (error) {
      if (error instanceof ModuleLoadError) return { problem: friendlyError(error.original, error.source) }
      console.error("Could not load one of Kade's shapes", error)
      return { problem: CHECK_FAILED }
    }
  }
}
```

- [ ] **Step 4: Create `src/kade/blob-loader.ts`**

```ts
import { ModuleLoadError, type ModuleLoader } from './module-loader'

/**
 * Loads Kade's code in the geometry worker from a blob URL. This is the one sanctioned way BloKade runs
 * Kade's code: never on the page, and never with eval or new Function.
 */
export const blobModuleLoader: ModuleLoader = async (code) => {
  const source = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
  try {
    const exports = (await import(/* @vite-ignore */ source)) as Record<string, unknown>
    return { exports, source, dispose: () => URL.revokeObjectURL(source) }
  } catch (error) {
    URL.revokeObjectURL(source)
    throw new ModuleLoadError(error, source)
  }
}
```

- [ ] **Step 5: Update the geometry types**

`src/geometry/types.ts`:
- Add `import type { InspectResult } from '../kade/meta'`.
- Add above `GeometryApi`:

```ts
/** Which screen a rebuild is for. Each keeps its own cache entries, so the preview and the design don't push each other out. */
export type BuildChannel = 'design' | 'preview'
```

- In `GeometryApi`, change `rebuild` and add `inspect`:

```ts
  rebuild(doc: BloKadeDocument, channel?: BuildChannel): Promise<BuildResult>
  /** Loads and checks one of Kade's shapes: its name, icon and settings, or a friendly problem. */
  inspect(code: string): Promise<InspectResult>
```

- [ ] **Step 6: Give the evaluator channels**

In `src/geometry/evaluate.ts`:
- Import `type BuildChannel` from `./types`.
- Replace the `touched` field with:

```ts
  private channel: BuildChannel = 'design'
  /** Cache keys each channel's latest pass used. Entries no channel used are freed. */
  private readonly touchedBy = new Map<BuildChannel, Set<string>>()
```

- Replace `beginPass` and `endPass` with:

```ts
  beginPass(channel: BuildChannel = 'design'): void {
    this.channel = channel
    this.touchedBy.set(channel, new Set())
    this.passWarnings = new Map()
  }

  endPass(): void {
    const used = (key: string): boolean => this.pinned.has(key) || [...this.touchedBy.values()].some((keys) => keys.has(key))
    for (const [key, shape] of this.cache) {
      if (!used(key)) {
        shape.delete()
        this.cache.delete(key)
        this.warningCache.delete(key)
      }
    }
    this.pinned = new Set()
  }
```

- In `entry`, replace `this.touched.add(key)` with `this.touch(key)`, and add:

```ts
  private touch(key: string): void {
    const keys = this.touchedBy.get(this.channel) ?? new Set<string>()
    this.touchedBy.set(this.channel, keys)
    keys.add(key)
  }
```

- [ ] **Step 7: Update `src/geometry/api.ts`**

- Import `type KadeShapes` from `../kade/kade-shapes`, `type BloKadeDocument` (already there) and `type BuildChannel` from `./types`.
- Change the `rebuild` helper so `beginPass` gets the channel:

```ts
function rebuild(evaluator: Evaluator, doc: BloKadeDocument, channel: BuildChannel): BuildResult {
  evaluator.beginPass(channel)
```

- Replace `createGeometryApi` with:

```ts
export function createGeometryApi(evaluator: Evaluator, shapes: KadeShapes): GeometryApi {
  /**
   * Loads the design's carried shapes, then runs `run` with them. setRegistry and `run` happen with no await
   * between them, so calls that overlap can never build with each other's shapes.
   */
  const withShapes = async <T>(doc: BloKadeDocument, run: () => T): Promise<T> => {
    const registry = await shapes.registryFor(doc)
    evaluator.setRegistry(registry)
    return run()
  }
  const exported = async (doc: BloKadeDocument, ids: readonly NodeId[] | undefined, write: (shape: Shape3D) => Promise<ArrayBuffer> | ArrayBuffer) => {
    const shape = await withShapes(doc, () => exportShape(evaluator, doc, ids))
    try {
      return await write(shape)
    } finally {
      shape.delete()
    }
  }
  return {
    rebuild: (doc, channel = 'design') => withShapes(doc, () => rebuild(evaluator, doc, channel)),
    exportStl: (doc, ids) => exported(doc, ids, (shape) => shape.blobSTL({ binary: true, ...EXPORT_QUALITY }).arrayBuffer()),
    export3mf: (doc, ids) => exported(doc, ids, (shape) => {
      const mesh = shape.mesh(EXPORT_QUALITY)
      return new Uint8Array(write3mf(closedMeshFor3mf(mesh.vertices, mesh.triangles), doc.name)).buffer
    }),
    exportStep: (doc, ids) => exported(doc, ids, (shape) => shape.blobSTEP().arrayBuffer()),
    edgeCandidates: (doc, nodeId, modifierId) => withShapes(doc, () => {
      try {
        return evaluator.edgeCandidates(doc, nodeId, modifierId)
      } catch (error) {
        if (error instanceof NodeBuildError) throw new Error(error.message)
        console.error('Unexpected edge-picking failure', error)
        throw new Error(UNEXPECTED)
      }
    }),
    overlap: (doc, a, b) => withShapes(doc, () => {
      try {
        return findOverlap(evaluator, doc, a, b)
      } catch (error) {
        if (error instanceof OverlapError) throw new Error(error.message)
        console.error('Unexpected overlap failure', error)
        throw new Error(UNEXPECTED)
      }
    }),
    inspect: (code) => shapes.inspect(code),
  }
}
```

If `write3mf(...)`'s `.buffer` is typed `ArrayBufferLike`, keep whatever cast the old code used, since it compiled before. The `write` callback's return type may need `as ArrayBuffer` there.

- [ ] **Step 8: Update the worker, spawn and the fakes**

`src/geometry/geometry.worker.ts`:
- Import `KadeShapes` from `../kade/kade-shapes` and `blobModuleLoader` from `../kade/blob-loader`.
- Change:

```ts
const apiReady = initBrowserOC().then(() =>
  createGeometryApi(new Evaluator(registry, createCadToolkit()), new KadeShapes(blobModuleLoader, registry)))
```

- In the `api` object, use:

```ts
  rebuild: async (doc, channel) => (await apiReady).rebuild(doc, channel),
  inspect: async (code) => (await apiReady).inspect(code),
```

`src/geometry/spawn.ts`: use `rebuild: (doc, channel) => remote.rebuild(doc, channel),` and add `inspect: (code) => remote.inspect(code),`.

`src/app/testing/fakes.ts`:
- Import `type InspectResult` from `../../kade/meta`.
- Add:

```ts
/**
 * Tests only: reads `name: '…'` and `icon: '…'` from the code and reports one Size setting. Code containing BROKEN
 * gets a problem. The real check runs Kade's code in the worker.
 */
export function fakeInspect(code: string): InspectResult {
  if (code.includes('BROKEN')) return { ok: false, problem: 'Line 1: this test shape is broken.' }
  const name = code.match(/name:\s*'([^']*)'/)?.[1] ?? 'Shape'
  const icon = code.match(/icon:\s*'([^']*)'/)?.[1] ?? '🧩'
  return { ok: true, meta: { name, icon, params: { size: { type: 'mm', default: 20, label: 'Size' } } } }
}
```

- Add `inspect: async (code) => fakeInspect(code),` to `fakeGeometryApi`.

In `src/geometry/client.test.ts`, add `inspect: async () => ({ ok: false, problem: 'unused' }),` to `fakeWorker`'s api. Run `grep -rln "overlap: async" src` to find any other hand-written `GeometryApi`, and add `inspect` to each one the same way.

- [ ] **Step 9: Run the tests**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 10: Check the worker still bundles**

Run: `npm run build`
Expected: the build succeeds. The blob `import()` carries `/* @vite-ignore */`, so Vite leaves it alone. Nothing on the page calls `inspect` yet. Task 21's end-to-end tests run the whole path in a real browser.

- [ ] **Step 11: Commit**

```bash
git add src/kade src/geometry src/app/testing/fakes.ts
git commit -m "feat: load Kade's shapes in the geometry worker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 9: The client: inspect, channels and runaway code

The page's `GeometryClient` gains `inspect(code)`, and keeps one waiting rebuild per channel, design first. A runaway inspect or preview build is stopped by the existing 30 s restart, and the next request works.

**Files:**
- Modify: `src/geometry/client.ts`
- Test: `src/geometry/client.test.ts`

**Interfaces:**
- Consumes: `BuildChannel` and `GeometryApi.inspect` (Task 8).
- Produces: `GeometryClient.rebuild(doc, channel: BuildChannel = 'design')` and `GeometryClient.inspect(code): Promise<InspectResult>`.

- [ ] **Step 1: Write the failing tests**

Add to `src/geometry/client.test.ts`:
- Change `fakeWorker`'s `rebuild` to record the channel: `rebuild: (doc, channel) => { … calls.push({ doc, channel, reply }) … }`, and widen the `calls` element type with `channel?: string`.
- Add a `never` helper: `const never = <T>() => new Promise<T>(() => undefined)`.
- Add:

```ts
describe('GeometryClient channels', () => {
  it('keeps one waiting rebuild per channel, so the preview never replaces the design', async () => {
    const { handle, calls } = fakeWorker()
    const client = new GeometryClient(() => handle)
    const first = client.rebuild(doc('one'))
    const preview = client.rebuild(doc('shape'), 'preview')
    const design = client.rebuild(doc('two'))
    calls[0]?.reply.resolve(result('one'))
    await first
    await flush()
    expect(calls[1]?.doc.name).toBe('two')
    calls[1]?.reply.resolve(result('two'))
    await expect(design).resolves.toEqual(result('two'))
    await flush()
    expect(calls[2]).toMatchObject({ channel: 'preview' })
    calls[2]?.reply.resolve(result('shape'))
    await expect(preview).resolves.toEqual(result('shape'))
  })
  it('replaces a waiting preview with a newer one', async () => {
    const { handle, calls } = fakeWorker()
    const client = new GeometryClient(() => handle)
    void client.rebuild(doc('busy'))
    const old = client.rebuild(doc('a'), 'preview')
    void client.rebuild(doc('b'), 'preview')
    await expect(old).resolves.toBeNull()
    calls[0]?.reply.resolve(result('busy'))
    await flush()
    expect(calls[1]?.doc.name).toBe('b')
  })
})

describe('GeometryClient with runaway code', () => {
  it('restarts the worker when checking code never finishes', async () => {
    const stuck = fakeWorker()
    stuck.handle.api.inspect = () => never()
    const fresh = fakeWorker()
    const spawn = vi.fn().mockReturnValueOnce(stuck.handle).mockReturnValueOnce(fresh.handle)
    const client = new GeometryClient(spawn, 20)
    await expect(client.inspect('while (true) {}')).rejects.toBeInstanceOf(GeometryTimeoutError)
    expect(stuck.handle.terminate).toHaveBeenCalled()
    const next = client.rebuild(doc('after'))
    await flush()
    fresh.calls[0]?.reply.resolve(result('after'))
    await expect(next).resolves.toEqual(result('after'))
  })
  it('restarts the worker when a preview build never finishes, then builds the design', async () => {
    const stuck = fakeWorker()
    const fresh = fakeWorker()
    const spawn = vi.fn().mockReturnValueOnce(stuck.handle).mockReturnValueOnce(fresh.handle)
    const client = new GeometryClient(spawn, 20)
    await expect(client.rebuild(doc('loop'), 'preview')).rejects.toBeInstanceOf(GeometryTimeoutError)
    const next = client.rebuild(doc('design'))
    await flush()
    fresh.calls[0]?.reply.resolve(result('design'))
    await expect(next).resolves.toEqual(result('design'))
  })
  it('passes inspect results through', async () => {
    const { handle } = fakeWorker()
    handle.api.inspect = async () => ({ ok: false, problem: 'nope' })
    await expect(new GeometryClient(() => handle).inspect('x')).resolves.toEqual({ ok: false, problem: 'nope' })
  })
})
```

`handle.api` is declared `readonly` in `WorkerHandle`, but its methods are not. If TypeScript refuses `stuck.handle.api.inspect = …`, build that handle as `{ ...stuck.handle, api: { ...stuck.handle.api, inspect: () => never() } }` instead.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/geometry/client.test.ts`
Expected: FAIL. There is no `inspect`, and the preview replaces the design's waiting rebuild.

- [ ] **Step 3: Implement**

In `src/geometry/client.ts`:
- Import `type InspectResult` from `../kade/meta` and `type BuildChannel` from `./types`.
- Add `readonly channel: BuildChannel` to `PendingRebuild`.
- Replace the `pending` field and `rebuild`, and add `inspect`:

```ts
  private pending: Readonly<Record<BuildChannel, PendingRebuild | null>> = { design: null, preview: null }

  /** Newest request per channel wins; the design goes before the preview. */
  rebuild(doc: BloKadeDocument, channel: BuildChannel = 'design'): Promise<BuildResult | null> {
    return new Promise((resolve, reject) => {
      this.pending[channel]?.resolve(null)
      this.pending = { ...this.pending, [channel]: { doc, channel, resolve, reject } }
      this.pump()
    })
  }

  /** Checks one of Kade's shapes in the worker. Runaway code restarts the worker like a stuck build. */
  inspect(code: string): Promise<InspectResult> {
    return this.call((api) => api.inspect(code))
  }
```

- Replace `pump`:

```ts
  private pump(): void {
    const job = this.pending.design ?? this.pending.preview
    if (this.busy || !job) return
    this.pending = { ...this.pending, [job.channel]: null }
    this.busy = true
    this.call((api) => api.rebuild(job.doc, job.channel))
      .then(job.resolve, job.reject)
      .finally(() => {
        this.busy = false
        this.pump()
      })
  }
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/geometry && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/geometry/client.ts src/geometry/client.test.ts
git commit -m "feat: check Kade's code and build previews through the geometry client

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 10: Kade's shape library storage

**Files:**
- Create: `src/kade/library.ts`
- Modify: `src/app/deps.ts`, `src/app/testing/fakes.ts`
- Test: `src/kade/library.test.ts`

**Interfaces:**
- Produces:
  - `LibraryShape { id; name; code; updatedAt }`.
  - `ShapeLibraryRepo { list(): Promise<readonly LibraryShape[]>; save(shape): Promise<void>; remove(id): Promise<void> }`. `list` is sorted by name and skips damaged entries.
  - `createIdbShapeLibrary(dbName = 'blokade-shapes')` (store `shapes`) and `createMemoryShapeLibrary(initial?)`.
  - `newShapeId(): string`, which returns `my-` plus 10 hex characters.
  - `sortByName(shapes)` and `shapeFileName(name): string`.
  - `AppDeps.shapes: ShapeLibraryRepo`.

- [ ] **Step 1: Write the failing test**

`src/kade/library.test.ts`:

```ts
import 'fake-indexeddb/auto'
import { createStore, set } from 'idb-keyval'
import { describe, expect, it, vi } from 'vitest'
import { SHAPE_ID_PATTERN } from '../document/types'
import { createIdbShapeLibrary, createMemoryShapeLibrary, newShapeId, shapeFileName, type LibraryShape, type ShapeLibraryRepo } from './library'

let dbCounter = 0
const shape = (id: string, name: string): LibraryShape => ({ id, name, code: `export default { name: '${name}' }`, updatedAt: 1 })

const implementations: [string, () => ShapeLibraryRepo][] = [
  ['memory', () => createMemoryShapeLibrary()],
  ['indexeddb', () => createIdbShapeLibrary(`shapes-test-${++dbCounter}`)],
]

describe.each(implementations)('%s shape library', (_, make) => {
  it('saves, lists by name and removes', async () => {
    const repo = make()
    await repo.save(shape('my-b', 'Robot'))
    await repo.save(shape('my-a', 'Gear'))
    expect((await repo.list()).map((s) => s.name)).toEqual(['Gear', 'Robot'])
    await repo.remove('my-a')
    expect((await repo.list()).map((s) => s.id)).toEqual(['my-b'])
  })
  it('replaces a shape saved again with the same id', async () => {
    const repo = make()
    await repo.save(shape('my-a', 'Gear'))
    await repo.save({ ...shape('my-a', 'Gear'), code: 'new code' })
    expect(await repo.list()).toEqual([{ ...shape('my-a', 'Gear'), code: 'new code' }])
  })
})

describe('the IndexedDB shape library', () => {
  it('skips damaged entries instead of failing', async () => {
    const dbName = `shapes-test-${++dbCounter}`
    const store = createStore(dbName, 'shapes')
    await set('bad', { id: 'Not An Id', name: '', code: 5 }, store)
    await set('my-good', shape('my-good', 'Good'), store)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await createIdbShapeLibrary(dbName).list()).toEqual([shape('my-good', 'Good')])
    expect(error).toHaveBeenCalledOnce()
    error.mockRestore()
  })
})

describe('shape ids and file names', () => {
  it('makes ids that fit the design format', () => {
    const id = newShapeId()
    expect(id).toMatch(/^my-[0-9a-f]{10}$/)
    expect(SHAPE_ID_PATTERN.test(id)).toBe(true)
    expect(newShapeId()).not.toBe(id)
  })
  it('makes a .js file name from the shape name', () => {
    expect(shapeFileName('Robot Head!')).toBe('robot-head.js')
    expect(shapeFileName('🤖')).toBe('shape.js')
  })
})
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/kade/library.test.ts`
Expected: FAIL. `./library` doesn't exist.

- [ ] **Step 3: Implement `src/kade/library.ts`**

```ts
import { createStore, del, entries, set } from 'idb-keyval'
import { z } from 'zod'
import { newId } from '../document/factory'
import { MAX_SHAPE_CODE_LENGTH, MAX_SHAPE_NAME_LENGTH, SHAPE_ID_PATTERN } from '../document/types'

/** One of Kade's shapes, kept in this browser. */
export interface LibraryShape {
  readonly id: string
  readonly name: string
  readonly code: string
  readonly updatedAt: number
}

export interface ShapeLibraryRepo {
  /** Sorted by name. Damaged entries are skipped. */
  list(): Promise<readonly LibraryShape[]>
  save(shape: LibraryShape): Promise<void>
  remove(id: string): Promise<void>
}

const libraryShape = z.object({
  id: z.string().regex(SHAPE_ID_PATTERN),
  name: z.string().min(1).max(MAX_SHAPE_NAME_LENGTH),
  code: z.string().max(MAX_SHAPE_CODE_LENGTH),
  updatedAt: z.number(),
})

/** Ids for Kade's shapes. Kade never types one. */
export const newShapeId = (): string => `my-${newId().slice(0, 10)}`

export const sortByName = (shapes: readonly LibraryShape[]): LibraryShape[] =>
  [...shapes].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))

export function shapeFileName(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `${slug || 'shape'}.js`
}

function goodShapes(raw: readonly unknown[]): LibraryShape[] {
  const parsed = raw.map((value) => libraryShape.safeParse(value))
  const damaged = parsed.filter((p) => !p.success).length
  if (damaged > 0) console.error(`Skipped ${damaged} damaged shape(s) in Kade's shape library.`)
  return parsed.flatMap((p) => (p.success ? [p.data] : []))
}

/** Kade's shapes in their own IndexedDB database, next to the designs. */
export function createIdbShapeLibrary(dbName = 'blokade-shapes'): ShapeLibraryRepo {
  const store = createStore(dbName, 'shapes')
  return {
    list: async () => sortByName(goodShapes((await entries(store)).map(([, value]) => value))),
    save: (shape) => set(shape.id, shape, store),
    remove: (id) => del(id, store),
  }
}

/** Tests, and a stand-in for browsers where IndexedDB is blocked. */
export function createMemoryShapeLibrary(initial: readonly LibraryShape[] = []): ShapeLibraryRepo {
  let shapes: ReadonlyMap<string, LibraryShape> = new Map(initial.map((s) => [s.id, s]))
  return {
    list: async () => sortByName([...shapes.values()]),
    save: async (shape) => {
      shapes = new Map([...shapes, [shape.id, shape]])
    },
    remove: async (id) => {
      shapes = new Map([...shapes].filter(([key]) => key !== id))
    },
  }
}
```

- [ ] **Step 4: Add the library to the app's dependencies**

`src/app/deps.ts`:
- Import `createIdbShapeLibrary` and `type ShapeLibraryRepo` from `../kade/library`.
- Add to `AppDeps`:

```ts
  /** Kade's own shapes, kept in this browser. */
  readonly shapes: ShapeLibraryRepo
```

- In `createAppDeps`, add `shapes: createIdbShapeLibrary(),`.

`src/app/testing/fakes.ts`: import `createMemoryShapeLibrary` and add `shapes: createMemoryShapeLibrary(),` to `fakeDeps`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/kade/library.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/kade/library.ts src/kade/library.test.ts src/app/deps.ts src/app/testing/fakes.ts
git commit -m "feat: keep Kade's shapes in their own browser library

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 11: One shape list for the page, and designs that carry code

The page gets a shape list that combines four sources:
- the built-ins;
- the `plugins/` folder;
- Kade's library;
- the shapes the open design carries.

Kade's entries come from the **catalog**, which asks the worker about each piece of code once. Adding one of Kade's shapes copies its code into the design in the same undo step. **Use my newest version** swaps carried code for the library's, also in one undo step.

**Files:**
- Create: `src/kade/catalog.ts`, `src/kade/shape-registry.ts`, `src/kade/useShapeRegistry.ts`, `src/kade/carried.ts`
- Modify: `src/app/actions.ts`, `vite.config.ts` (coverage exclude for hooks)
- Test: `src/kade/catalog.test.ts`, `src/kade/shape-registry.test.ts`, `src/kade/carried.test.ts`, `src/app/actions.test.ts`

**Interfaces:**
- Consumes:
  - Task 8: `GeometryClient.inspect`, through a function. Task 9 added the method on the client.
  - Task 7: `metaToPlugin`. Task 3: `codeHash`. Task 10: `LibraryShape`.
  - `DocumentOpError` (`src/document/ops.ts`).
- Produces:
  - `createShapeCatalog(inspect: (code: string) => Promise<InspectResult>): ShapeCatalog`, with state `{ results: Record<hash, InspectResult>; request(code) }`. Also `resultFor(results, code)`.
  - `buildShapeRegistry({ base, library, carried, results }): ShapeRegistry`. `ShapeRegistry extends PluginRegistry` with `mine(): readonly ShapePlugin[]`.
  - `useShapeRegistry({ base, catalog, library, carried }): ShapeRegistry`.
  - In `carried.ts`:
    - `carryShape(doc, id, shape: CarriedShape): BloKadeDocument`.
    - `outdatedShapes(doc, library): LibraryShape[]`.
    - `withNewestVersions(doc, library): BloKadeDocument`.
    - `TOO_MANY_SHAPES`.
  - `createActions(store, registry, carriedCodeOf?: (id: string) => CarriedShape | undefined)`.

- [ ] **Step 1: Write the failing tests**

`src/kade/catalog.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { GeometryTimeoutError } from '../geometry/client'
import { createShapeCatalog, resultFor } from './catalog'
import { CHECK_FAILED, TOO_LONG } from './messages'
import type { InspectResult } from './meta'

const flush = () => new Promise((r) => setTimeout(r, 0))
const good: InspectResult = { ok: true, meta: { name: 'Gear', icon: '⚙️', params: {} } }

describe('the shape catalog', () => {
  it('asks the worker about each code once and keeps the answer', async () => {
    const inspect = vi.fn(async () => good)
    const catalog = createShapeCatalog(inspect)
    catalog.getState().request('code one')
    catalog.getState().request('code one')
    await flush()
    catalog.getState().request('code one')
    expect(inspect).toHaveBeenCalledOnce()
    expect(resultFor(catalog.getState().results, 'code one')).toEqual(good)
    expect(resultFor(catalog.getState().results, 'other code')).toBeUndefined()
  })
  it('says a shape took too long when the worker had to restart', async () => {
    const catalog = createShapeCatalog(async () => { throw new GeometryTimeoutError() })
    catalog.getState().request('while (true) {}')
    await flush()
    expect(resultFor(catalog.getState().results, 'while (true) {}')).toEqual({ ok: false, problem: TOO_LONG })
  })
  it('reports any other failure in plain words', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const catalog = createShapeCatalog(async () => { throw new Error('worker gone') })
    catalog.getState().request('x')
    await flush()
    expect(resultFor(catalog.getState().results, 'x')).toEqual({ ok: false, problem: CHECK_FAILED })
    error.mockRestore()
  })
})
```

`src/kade/shape-registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { registry as base } from '../plugins/index'
import { codeHash } from './hash'
import type { LibraryShape } from './library'
import type { InspectResult } from './meta'
import { buildShapeRegistry } from './shape-registry'

const meta = (name: string): InspectResult => ({ ok: true, meta: { name, icon: '🧩', params: {} } })
const lib = (id: string, code: string): LibraryShape => ({ id, name: id, code, updatedAt: 1 })
const results = { [codeHash('gear v2')]: meta('Gear v2'), [codeHash('gear v1')]: meta('Gear v1'), [codeHash('robot')]: meta('Robot'), [codeHash('broken')]: { ok: false, problem: 'x' } as InspectResult }

describe('buildShapeRegistry', () => {
  const shapes = buildShapeRegistry({
    base,
    library: [lib('my-gear', 'gear v2'), lib('my-broken', 'broken'), lib('my-waiting', 'not checked yet')],
    carried: { 'my-gear': { name: 'Gear', code: 'gear v1' }, 'my-robot': { name: 'Robot', code: 'robot' }, box: { name: 'Box?', code: 'robot' } },
    results,
  })

  it('puts the built-ins first, then the library, then shapes only the design carries', () => {
    expect(shapes.list().slice(0, base.list().length)).toEqual(base.list())
    expect(shapes.mine().map((p) => p.name)).toEqual(['Gear v2', 'Robot'])
    expect(shapes.list()).toHaveLength(base.list().length + 2)
  })
  it("uses the design's own version of a shape for its parts", () => {
    expect(shapes.get('my-gear')).toMatchObject({ name: 'Gear v1', revision: codeHash('gear v1'), toolkit: 'kade' })
    expect(shapes.get('my-robot')?.name).toBe('Robot')
  })
  it('never lets a carried shape replace a built-in', () => {
    expect(shapes.get('box')).toBe(base.get('box'))
  })
  it('leaves out shapes that are broken or not checked yet', () => {
    expect(shapes.get('my-broken')).toBeUndefined()
    expect(shapes.get('my-waiting')).toBeUndefined()
  })
  it('uses the library version when the design does not carry the shape', () => {
    const libraryOnly = buildShapeRegistry({ base, library: [lib('my-gear', 'gear v2')], carried: {}, results })
    expect(libraryOnly.get('my-gear')?.name).toBe('Gear v2')
  })
})
```

`src/kade/carried.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { DocumentOpError } from '../document/ops'
import { MAX_CARRIED_SHAPES } from '../document/types'
import { createBloKadeStore } from '../store/store'
import { carryShape, outdatedShapes, withNewestVersions } from './carried'
import type { LibraryShape } from './library'

const gear = { name: 'Gear', code: 'v1' }
const lib = (id: string, code: string, name = 'Gear'): LibraryShape => ({ id, name, code, updatedAt: 1 })

describe('carried shapes', () => {
  it('copies a shape into a design once', () => {
    const doc = carryShape(createEmptyDocument(), 'my-gear', gear)
    expect(doc.plugins).toEqual({ 'my-gear': gear })
    expect(carryShape(doc, 'my-gear', { name: 'Gear', code: 'v2' })).toBe(doc)
  })
  it('refuses more than the limit', () => {
    const full = { ...createEmptyDocument(), plugins: Object.fromEntries(Array.from({ length: MAX_CARRIED_SHAPES }, (_, i) => [`my-${i}`, gear])) }
    expect(() => carryShape(full, 'my-one-more', gear)).toThrow(DocumentOpError)
  })
  it('finds shapes the library has a different version of', () => {
    const doc = { ...createEmptyDocument(), plugins: { 'my-gear': gear, 'my-cup': { name: 'Cup', code: 'same' } } }
    const library = [lib('my-gear', 'v2'), lib('my-cup', 'same', 'Cup'), lib('my-other', 'x')]
    expect(outdatedShapes(doc, library).map((s) => s.id)).toEqual(['my-gear'])
  })
  it('swaps in the newest versions as one undo step', () => {
    const doc = { ...createEmptyDocument(), plugins: { 'my-gear': gear } }
    const store = createBloKadeStore({ designId: 'd', doc })
    store.getState().apply((d) => withNewestVersions(d, [lib('my-gear', 'v2', 'Big gear')]))
    expect(store.getState().history.present.plugins).toEqual({ 'my-gear': { name: 'Big gear', code: 'v2' } })
    store.getState().undo()
    expect(store.getState().history.present).toBe(doc)
  })
})
```

Add to `src/app/actions.test.ts`:

```ts
describe("adding Kade's shapes", () => {
  const code = "export default { name: 'Gear' }"
  const shapes = buildShapeRegistry({
    base: registry, library: [{ id: 'my-gear', name: 'Gear', code, updatedAt: 1 }], carried: {},
    results: { [codeHash(code)]: { ok: true, meta: { name: 'Gear', icon: '⚙️', params: { size: { type: 'mm', default: 40, label: 'Size' } } } } },
  })
  const codeOf = (id: string) => (id === 'my-gear' ? { name: 'Gear', code } : undefined)

  it('copies the code into the design with the part, as one undo step', () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    const before = store.getState().history.present
    createActions(store, shapes, codeOf).addShape('my-gear')
    const doc = store.getState().history.present
    expect(doc.plugins).toEqual({ 'my-gear': { name: 'Gear', code } })
    expect(Object.values(doc.nodes)[0]).toMatchObject({ shapeType: 'my-gear', name: 'Gear', params: { size: 40 } })
    store.getState().undo()
    expect(store.getState().history.present).toBe(before)
  })
  it('keeps the version a design already carries', () => {
    const doc = { ...createEmptyDocument(), plugins: { 'my-gear': { name: 'Gear', code: 'older' } } }
    const store = createBloKadeStore({ designId: 'd', doc })
    createActions(store, shapes, codeOf).addShape('my-gear')
    expect(store.getState().history.present.plugins['my-gear']?.code).toBe('older')
  })
})
```

(Import `buildShapeRegistry` from `../kade/shape-registry` and `codeHash` from `../kade/hash`.)

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/kade src/app/actions.test.ts`
Expected: FAIL. The catalog, registry and carried modules don't exist, and `addShape` doesn't copy code.

- [ ] **Step 3: Implement `src/kade/catalog.ts`**

```ts
import { createStore, type StoreApi } from 'zustand/vanilla'
import { GeometryTimeoutError } from '../geometry/client'
import { codeHash } from './hash'
import { CHECK_FAILED, TOO_LONG } from './messages'
import type { InspectResult } from './meta'

export interface CatalogState {
  /** What the worker said about each piece of code, by code hash. */
  readonly results: Readonly<Record<string, InspectResult>>
  /** Asks the worker about this code. Each code is only ever asked about once. */
  request(code: string): void
}

export type ShapeCatalog = StoreApi<CatalogState>

export const resultFor = (results: CatalogState['results'], code: string): InspectResult | undefined => {
  const key = codeHash(code)
  return Object.hasOwn(results, key) ? results[key] : undefined
}

function failureOf(error: unknown): InspectResult {
  if (error instanceof GeometryTimeoutError) return { ok: false, problem: TOO_LONG }
  console.error("Could not check one of Kade's shapes", error)
  return { ok: false, problem: CHECK_FAILED }
}

/**
 * The page's memory of Kade's shapes. The worker runs the code; the page only keeps the answers.
 * An answer is kept for the whole session: changed code has a new hash and is asked about again.
 */
export function createShapeCatalog(inspect: (code: string) => Promise<InspectResult>): ShapeCatalog {
  const asked = new Set<string>()
  return createStore<CatalogState>()((set) => ({
    results: {},
    request: (code) => {
      const key = codeHash(code)
      if (asked.has(key)) return
      asked.add(key)
      void inspect(code).catch(failureOf).then((result) => set((s) => ({ results: { ...s.results, [key]: result } })))
    },
  }))
}
```

- [ ] **Step 4: Implement `src/kade/shape-registry.ts`**

```ts
import type { CarriedShape } from '../document/types'
import type { PluginRegistry } from '../plugins/registry'
import type { ShapePlugin } from '../plugins/types'
import { resultFor, type CatalogState } from './catalog'
import { codeHash } from './hash'
import type { LibraryShape } from './library'
import { metaToPlugin } from './meta'

export interface ShapeSources {
  readonly base: PluginRegistry
  readonly library: readonly LibraryShape[]
  readonly carried: Readonly<Record<string, CarriedShape>>
  readonly results: CatalogState['results']
}

export interface ShapeRegistry extends PluginRegistry {
  /** Kade's shapes for the My shapes palette: the library first, then shapes only the design carries. */
  mine(): readonly ShapePlugin[]
}

/**
 * The page's shape list: built-ins and plugins/ folder files, then Kade's library, then the design's carried shapes.
 * A part uses the version its design carries; the palette shows the library's.
 */
export function buildShapeRegistry({ base, library, carried, results }: ShapeSources): ShapeRegistry {
  const pluginOf = (id: string, code: string): ShapePlugin[] => {
    if (base.get(id)) return []
    const result = resultFor(results, code)
    return result?.ok ? [metaToPlugin(id, result.meta, codeHash(code))] : []
  }
  const fromLibrary = library.flatMap((shape) => pluginOf(shape.id, shape.code))
  const fromDesign = Object.entries(carried).flatMap(([id, shape]) => pluginOf(id, shape.code))
  const libraryById = new Map(fromLibrary.map((p) => [p.id, p]))
  const designById = new Map(fromDesign.map((p) => [p.id, p]))
  const mine = [...fromLibrary, ...fromDesign.filter((p) => !libraryById.has(p.id))]
  const list = [...base.list(), ...mine]
  return {
    get: (id) => base.get(id) ?? designById.get(id) ?? libraryById.get(id),
    list: () => list,
    mine: () => mine,
  }
}
```

- [ ] **Step 5: Implement `src/kade/useShapeRegistry.ts`**

```ts
import { useEffect, useMemo } from 'react'
import { useStore } from 'zustand'
import type { CarriedShape } from '../document/types'
import type { PluginRegistry } from '../plugins/registry'
import type { ShapeCatalog } from './catalog'
import type { LibraryShape } from './library'
import { buildShapeRegistry, type ShapeRegistry } from './shape-registry'

interface Input {
  readonly base: PluginRegistry
  readonly catalog: ShapeCatalog
  readonly library: readonly LibraryShape[]
  readonly carried: Readonly<Record<string, CarriedShape>>
}

/** The combined shape list, rebuilt when the library, the carried shapes or the worker's answers change. */
export function useShapeRegistry({ base, catalog, library, carried }: Input): ShapeRegistry {
  const results = useStore(catalog, (s) => s.results)
  useEffect(() => {
    const { request } = catalog.getState()
    for (const shape of library) request(shape.code)
    for (const shape of Object.values(carried)) request(shape.code)
  }, [catalog, library, carried])
  return useMemo(() => buildShapeRegistry({ base, library, carried, results }), [base, library, carried, results])
}
```

In `vite.config.ts`'s `coverage.exclude`, add `'src/kade/use*.ts'`. These hooks are thin wrappers, like `useGeometrySync`, and their logic is tested through the functions they call.

- [ ] **Step 6: Implement `src/kade/carried.ts`**

```ts
import { DocumentOpError } from '../document/ops'
import { MAX_CARRIED_SHAPES, type BloKadeDocument, type CarriedShape } from '../document/types'
import type { LibraryShape } from './library'

export const TOO_MANY_SHAPES = `A design can carry up to ${MAX_CARRIED_SHAPES} of your shapes. Try a new design for more.`

/** Copies one of Kade's shapes into the design. A shape the design already carries keeps its version. */
export function carryShape(doc: BloKadeDocument, id: string, shape: CarriedShape): BloKadeDocument {
  if (Object.hasOwn(doc.plugins, id)) return doc
  if (Object.keys(doc.plugins).length >= MAX_CARRIED_SHAPES) throw new DocumentOpError(TOO_MANY_SHAPES)
  return { ...doc, plugins: { ...doc.plugins, [id]: { name: shape.name, code: shape.code } } }
}

/** Library shapes whose code differs from the version this design carries. */
export function outdatedShapes(doc: BloKadeDocument, library: readonly LibraryShape[]): LibraryShape[] {
  return library.filter((shape) => Object.hasOwn(doc.plugins, shape.id) && doc.plugins[shape.id]?.code !== shape.code)
}

/** The design with the library's newest code for every outdated shape (one undo step when applied once). */
export function withNewestVersions(doc: BloKadeDocument, library: readonly LibraryShape[]): BloKadeDocument {
  const outdated = outdatedShapes(doc, library)
  if (outdated.length === 0) return doc
  const newest = Object.fromEntries(outdated.map((shape) => [shape.id, { name: shape.name, code: shape.code }]))
  return { ...doc, plugins: { ...doc.plugins, ...newest } }
}
```

- [ ] **Step 7: Copy code in when adding a shape**

In `src/app/actions.ts`:
- Import `carryShape` from `../kade/carried` and `type CarriedShape` from `../document/types`.
- Change the signature:

```ts
export function createActions(
  store: BloKadeStore, registry: PluginRegistry, carriedCodeOf: (id: string) => CarriedShape | undefined = () => undefined,
): Actions {
```

- In `addShape`, replace the `run(...)` body so the code is copied in the same step as the part:

```ts
      const carried = carriedCodeOf(pluginId)
      selectIf(run(store, (doc) => {
        const placement = { color, position: workplane?.origin, rotation: workplane?.rotation }
        const withCode = carried ? carryShape(doc, pluginId, carried) : doc
        const { doc: next, id } = addPart(withCode, plugin, placement, normalize)
        return { doc: next, value: [id] }
      }))
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run src/kade src/app && npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/kade src/app/actions.ts src/app/actions.test.ts vite.config.ts
git commit -m "feat: combine Kade's shapes into one shape list and carry them in designs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 12: The My shapes editor store

This task holds the editor's state:
- whether it is open, plus the selected shape and the tab;
- the library, with a draft of each shape Kade is typing in.

A draft **settles** 500 ms after typing stops. Then it is saved, previewed and checked. A failed save shows one notice, and editing keeps working in memory.

**Files:**
- Create: `src/kade/starter.ts`, `src/kade/editor-store.ts`
- Test: `src/kade/starter.test.ts`, `src/kade/editor-store.test.ts`

**Interfaces:**
- Consumes: Task 10: `ShapeLibraryRepo`, `LibraryShape`, `newShapeId`, `sortByName`.
- Produces:
  - `starter.ts`: `NEW_SHAPE_CODE`, `nameInCode(code): string | null`, `renameInCode(code, name): string`, `uniqueName(base, taken): string`.
  - `editor-store.ts`:
    - `createEditorStore(repo, now = Date.now): EditorStore`.
    - Constants: `SAVE_DELAY_MS = 500`, `SAVE_FAILED`, `LOAD_FAILED`.
    - `EditorTab = 'lessons' | 'commands'`.
    - Selectors: `selectedShape(state)`, `currentCode(state, id)`.
    - `EditorState` holds `open`, `loaded`, `shapes`, `drafts`, `selectedId`, `tab` and `notice`. Its actions are `setOpen`, `setTab`, `select`, `load`, `create(code?)`, `setCode(id, code)`, `duplicate(id)`, `remove(id)`, `syncNames(names)`, `flush()` and `notify(notice)`.

- [ ] **Step 1: Write the failing tests**

`src/kade/starter.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { nameInCode, NEW_SHAPE_CODE, renameInCode, uniqueName } from './starter'

describe('starter code helpers', () => {
  it('reads and changes the name in the code', () => {
    expect(nameInCode(NEW_SHAPE_CODE)).toBe('My shape')
    const renamed = renameInCode(NEW_SHAPE_CODE, "Kade's gear")
    expect(nameInCode(renamed)).toBe("Kade\\'s gear")
    expect(renamed).toContain("name: 'Kade\\'s gear'")
    expect(renameInCode('export default { name: "A" }', 'B')).toBe('export default { name: "B" }')
  })
  it('leaves code without a name alone', () => {
    expect(nameInCode('export default {}')).toBeNull()
    expect(renameInCode('export default {}', 'B')).toBe('export default {}')
  })
  it('makes names unique', () => {
    expect(uniqueName('Gear', ['Robot'])).toBe('Gear')
    expect(uniqueName('Gear', ['Gear', 'Gear 2'])).toBe('Gear 3')
  })
})
```

`src/kade/editor-store.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { currentCode, createEditorStore, LOAD_FAILED, SAVE_DELAY_MS, SAVE_FAILED, selectedShape } from './editor-store'
import { createMemoryShapeLibrary, type LibraryShape, type ShapeLibraryRepo } from './library'
import { nameInCode, NEW_SHAPE_CODE } from './starter'

const shape = (id: string, name: string): LibraryShape => ({ id, name, code: `export default { name: '${name}' }`, updatedAt: 1 })

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('the editor store', () => {
  it('loads the library and selects the first shape', async () => {
    const editor = createEditorStore(createMemoryShapeLibrary([shape('my-b', 'Robot'), shape('my-a', 'Gear')]))
    await editor.getState().load()
    expect(editor.getState().loaded).toBe(true)
    expect(editor.getState().shapes.map((s) => s.name)).toEqual(['Gear', 'Robot'])
    expect(selectedShape(editor.getState())?.name).toBe('Gear')
  })
  it('creates new shapes with unique names and saves them', async () => {
    const repo = createMemoryShapeLibrary()
    const editor = createEditorStore(repo)
    const first = editor.getState().create()
    const second = editor.getState().create()
    expect([first.name, second.name]).toEqual(['My shape', 'My shape 2'])
    expect(nameInCode(second.code)).toBe('My shape 2')
    expect(editor.getState().selectedId).toBe(second.id)
    await vi.runAllTimersAsync()
    expect((await repo.list()).map((s) => s.id).sort()).toEqual([first.id, second.id].sort())
  })
  it('keeps typing as a draft and settles it 500 ms after typing stops', async () => {
    const repo = createMemoryShapeLibrary()
    const editor = createEditorStore(repo, () => 42)
    const { id } = editor.getState().create(NEW_SHAPE_CODE)
    editor.getState().setCode(id, 'draft one')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS - 100)
    editor.getState().setCode(id, 'draft two')
    expect(currentCode(editor.getState(), id)).toBe('draft two')
    expect(selectedShape(editor.getState())?.code).toBe(NEW_SHAPE_CODE)
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(selectedShape(editor.getState())).toMatchObject({ code: 'draft two', updatedAt: 42 })
    expect(editor.getState().drafts).toEqual({})
    expect((await repo.list())[0]?.code).toBe('draft two')
  })
  it('settles drafts at once on flush', async () => {
    const editor = createEditorStore(createMemoryShapeLibrary())
    const { id } = editor.getState().create()
    editor.getState().setCode(id, 'now')
    await editor.getState().flush()
    expect(selectedShape(editor.getState())?.code).toBe('now')
  })
  it('duplicates a shape with a new name in its code', () => {
    const editor = createEditorStore(createMemoryShapeLibrary())
    const original = editor.getState().create()
    const copy = editor.getState().duplicate(original.id)
    expect(copy?.name).toBe('My shape copy')
    expect(nameInCode(copy?.code ?? '')).toBe('My shape copy')
    expect(editor.getState().duplicate('my-missing')).toBeNull()
  })
  it('deletes a shape and selects another', async () => {
    const repo = createMemoryShapeLibrary([shape('my-a', 'A'), shape('my-b', 'B')])
    const editor = createEditorStore(repo)
    await editor.getState().load()
    await editor.getState().remove('my-a')
    expect(editor.getState().shapes.map((s) => s.id)).toEqual(['my-b'])
    expect(editor.getState().selectedId).toBe('my-b')
    expect((await repo.list()).map((s) => s.id)).toEqual(['my-b'])
  })
  it('takes names from the checked code', async () => {
    const repo = createMemoryShapeLibrary([shape('my-a', 'A')])
    const editor = createEditorStore(repo)
    await editor.getState().load()
    editor.getState().syncNames({ 'my-a': 'Rocket', 'my-gone': 'X' })
    expect(editor.getState().shapes[0]?.name).toBe('Rocket')
    await vi.runAllTimersAsync()
    expect((await repo.list())[0]?.name).toBe('Rocket')
  })
})

describe('the editor store when browser storage fails (Review Focus 5)', () => {
  const failing: ShapeLibraryRepo = {
    list: async () => { throw new Error('blocked') },
    save: async () => { throw new Error('quota') },
    remove: async () => { throw new Error('blocked') },
  }

  it('says the library could not be opened and still lets Kade make shapes', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const editor = createEditorStore(failing)
    await editor.getState().load()
    expect(editor.getState()).toMatchObject({ loaded: true, notice: LOAD_FAILED })
    const made = editor.getState().create()
    editor.getState().setCode(made.id, 'still works')
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS)
    expect(selectedShape(editor.getState())?.code).toBe('still works')
    expect(editor.getState().notice).toBe(SAVE_FAILED)
    expect(error.mock.calls.filter(([message]) => message === 'Could not save a shape')).toHaveLength(1)
    error.mockRestore()
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/kade/starter.test.ts src/kade/editor-store.test.ts`
Expected: FAIL. The modules don't exist.

- [ ] **Step 3: Implement `src/kade/starter.ts`**

```ts
/** The code every new shape starts with. */
export const NEW_SHAPE_CODE = `export default {
  name: 'My shape',
  icon: '🧩',
  settings: {
    size: { type: 'mm', default: 20, label: 'Size' },
  },
  build({ size }, cad) {
    return cad.box(size, size, size)
  },
}
`

/** The first `name: '…'` (or "…") in the code: the shape's name. */
const NAME_IN_CODE = /(\bname\s*:\s*)(['"])((?:\\.|(?!\2)[^\\\n])*)\2/

export function nameInCode(code: string): string | null {
  return code.match(NAME_IN_CODE)?.[3]?.trim() || null
}

/** The code with its shape name changed, quoting it safely. Code without a name is left alone. */
export function renameInCode(code: string, name: string): string {
  return code.replace(NAME_IN_CODE, (_match, start: string, quote: string) =>
    `${start}${quote}${name.replaceAll('\\', '\\\\').replaceAll(quote, `\\${quote}`)}${quote}`)
}

export function uniqueName(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base
  for (let n = 2; ; n += 1) {
    const name = `${base} ${n}`
    if (!taken.includes(name)) return name
  }
}
```

- [ ] **Step 4: Implement `src/kade/editor-store.ts`**

```ts
import { createStore, type StoreApi } from 'zustand/vanilla'
import { MAX_SHAPE_NAME_LENGTH } from '../document/types'
import { newShapeId, sortByName, type LibraryShape, type ShapeLibraryRepo } from './library'
import { nameInCode, NEW_SHAPE_CODE, renameInCode, uniqueName } from './starter'

/** Typing settles this long after it stops: then the code is saved, checked and previewed. */
export const SAVE_DELAY_MS = 500
export const SAVE_FAILED = "BloKade couldn't save your shapes in this browser. Use 💾 Save to file to keep a copy."
export const LOAD_FAILED = "BloKade couldn't open your saved shapes in this browser. New shapes still work, so save them to a file."

export type EditorTab = 'lessons' | 'commands'

export interface EditorState {
  readonly open: boolean
  readonly loaded: boolean
  /** The settled versions, sorted by name. */
  readonly shapes: readonly LibraryShape[]
  /** Code Kade is still typing, by shape id. */
  readonly drafts: Readonly<Record<string, string>>
  readonly selectedId: string | null
  readonly tab: EditorTab
  readonly notice: string | null
  setOpen(open: boolean): void
  setTab(tab: EditorTab): void
  select(id: string | null): void
  load(): Promise<void>
  create(code?: string): LibraryShape
  setCode(id: string, code: string): void
  duplicate(id: string): LibraryShape | null
  remove(id: string): Promise<void>
  /** Names read from the checked code, by shape id. */
  syncNames(names: Readonly<Record<string, string>>): void
  /** Settles every draft now (before leaving the editor). */
  flush(): Promise<void>
  /** Shows a message in the editor, or clears it with null. */
  notify(notice: string | null): void
}

export type EditorStore = StoreApi<EditorState>

export const selectedShape = (state: Pick<EditorState, 'shapes' | 'selectedId'>): LibraryShape | null =>
  state.shapes.find((s) => s.id === state.selectedId) ?? null

export const currentCode = (state: Pick<EditorState, 'shapes' | 'drafts'>, id: string): string | undefined =>
  Object.hasOwn(state.drafts, id) ? state.drafts[id] : state.shapes.find((s) => s.id === id)?.code

const without = <T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([k]) => k !== key))

interface Context {
  readonly repo: ShapeLibraryRepo
  readonly now: () => number
  readonly timers: Map<string, ReturnType<typeof setTimeout>>
  readonly set: StoreApi<EditorState>['setState']
  readonly get: () => EditorState
}

async function saveShape(ctx: Context, shape: LibraryShape): Promise<void> {
  try {
    await ctx.repo.save(shape)
  } catch (error) {
    if (ctx.get().notice !== SAVE_FAILED) console.error('Could not save a shape', error)
    ctx.set({ notice: SAVE_FAILED })
  }
}

const replaceShape = (ctx: Context, shape: LibraryShape): void =>
  ctx.set((s) => ({ shapes: sortByName(s.shapes.map((x) => (x.id === shape.id ? shape : x))) }))

function stopTimer(ctx: Context, id: string): void {
  const timer = ctx.timers.get(id)
  if (timer) clearTimeout(timer)
  ctx.timers.delete(id)
}

function settle(ctx: Context, id: string): Promise<void> {
  stopTimer(ctx, id)
  const { drafts, shapes } = ctx.get()
  const shape = shapes.find((s) => s.id === id)
  const draft = Object.hasOwn(drafts, id) ? drafts[id] : undefined
  if (!shape || draft === undefined) return Promise.resolve()
  const next = { ...shape, code: draft, updatedAt: ctx.now() }
  ctx.set((s) => ({ drafts: without(s.drafts, id) }))
  replaceShape(ctx, next)
  return saveShape(ctx, next)
}

function addShape(ctx: Context, code: string, baseName: string): LibraryShape {
  const name = uniqueName(baseName.slice(0, MAX_SHAPE_NAME_LENGTH), ctx.get().shapes.map((s) => s.name))
  const shape = { id: newShapeId(), name, code: renameInCode(code, name), updatedAt: ctx.now() }
  ctx.set((s) => ({ shapes: sortByName([...s.shapes, shape]), selectedId: shape.id }))
  void saveShape(ctx, shape)
  return shape
}

async function removeShape(ctx: Context, id: string): Promise<void> {
  stopTimer(ctx, id)
  ctx.set((s) => {
    const shapes = s.shapes.filter((x) => x.id !== id)
    return { shapes, drafts: without(s.drafts, id), selectedId: s.selectedId === id ? shapes[0]?.id ?? null : s.selectedId }
  })
  try {
    await ctx.repo.remove(id)
  } catch (error) {
    console.error('Could not delete a shape', error)
    ctx.set({ notice: SAVE_FAILED })
  }
}

function syncShapeNames(ctx: Context, names: Readonly<Record<string, string>>): void {
  const renamed = ctx.get().shapes.flatMap((shape) => {
    const name = Object.hasOwn(names, shape.id) ? names[shape.id] : undefined
    return name && name !== shape.name ? [{ ...shape, name }] : []
  })
  for (const shape of renamed) {
    replaceShape(ctx, shape)
    void saveShape(ctx, shape)
  }
}

async function loadShapes(ctx: Context): Promise<void> {
  try {
    const shapes = await ctx.repo.list()
    ctx.set((s) => ({ shapes, loaded: true, selectedId: s.selectedId ?? shapes[0]?.id ?? null }))
  } catch (error) {
    console.error("Could not open Kade's shape library", error)
    ctx.set({ loaded: true, notice: LOAD_FAILED })
  }
}

export function createEditorStore(repo: ShapeLibraryRepo, now: () => number = Date.now): EditorStore {
  return createStore<EditorState>()((set, get) => {
    const ctx: Context = { repo, now, timers: new Map(), set, get }
    return {
      open: false, loaded: false, shapes: [], drafts: {}, selectedId: null, tab: 'lessons', notice: null,
      setOpen: (open) => set({ open }),
      setTab: (tab) => set({ tab }),
      select: (selectedId) => set({ selectedId }),
      notify: (notice) => set({ notice }),
      load: () => loadShapes(ctx),
      create: (code = NEW_SHAPE_CODE) => addShape(ctx, code, nameInCode(code) ?? 'My shape'),
      setCode: (id, code) => {
        set((s) => ({ drafts: { ...s.drafts, [id]: code } }))
        stopTimer(ctx, id)
        ctx.timers.set(id, setTimeout(() => void settle(ctx, id), SAVE_DELAY_MS))
      },
      duplicate: (id) => {
        const source = get().shapes.find((s) => s.id === id)
        return source ? addShape(ctx, currentCode(get(), id) ?? source.code, `${source.name} copy`) : null
      },
      remove: (id) => removeShape(ctx, id),
      syncNames: (names) => syncShapeNames(ctx, names),
      flush: async () => {
        await Promise.all([...ctx.timers.keys()].map((id) => settle(ctx, id)))
      },
    }
  })
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/kade/starter.test.ts src/kade/editor-store.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/kade/starter.ts src/kade/starter.test.ts src/kade/editor-store.ts src/kade/editor-store.test.ts
git commit -m "feat: add the My shapes editor store with autosave

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 13: The live preview and the code view

The preview is a one-part design in its own `BloKadeStore`. It carries the selected shape's settled code and rebuilds on the `'preview'` channel. A runaway build puts the loop message on the preview part. `CodeView` sums up what Kade's code does right now: whether it parses, the one problem to show, whether it built, its size and its details. Coding lessons check `CodeView`.

**Files:**
- Create: `src/kade/preview.ts`, `src/kade/code-view.ts`, `src/kade/usePreview.ts`
- Test: `src/kade/preview.test.ts`, `src/kade/code-view.test.ts`

**Interfaces:**
- Consumes:
  - Task 9: `GeometryClient.rebuild(doc, 'preview')` and `GeometryTimeoutError`.
  - Task 12: `EditorStore`, `selectedShape`.
  - Task 11: `ShapeCatalog`, `resultFor`.
  - `meshBox` (`src/viewport/bounds.ts`) and `Box` (`src/document/box.ts`).
- Produces:
  - `preview.ts`:
    - `PREVIEW_ID = 'preview'` and `PREVIEW_PROBLEM`.
    - Preview document helpers: `previewDocument(shape, params?)`, `withPreviewCode(doc, shape)`, `createPreviewStore()`, `showShape(store, shape)`, `followSelectedShape(editor, preview)`.
    - Build status: `createPreviewStatus(): PreviewStatusStore`, whose state is `{ builtFor: { shapeId; code } | null; setBuilt(shapeId, code) }`.
    - Building: `syncPreview(store, client, status): () => void` and `previewFailure(error): BuildResult`.
  - `code-view.ts`:
    - `CodeView { shapeId; code; typing; syntaxOk; problem; built; bounds: Box | null; meta: ShapeMeta | null }`.
    - `codeViewOf(input: CodeViewInput): CodeView` and `createCodeViewSource(sources): CodeViewSource` (`{ read(); subscribe(listener) }`).
  - `usePreview.ts`: `usePreview(editor, client): { store, status }` and `useCodeView(source): CodeView`.

- [ ] **Step 1: Write the failing tests**

`src/kade/preview.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { fakeGeometryApi } from '../app/testing/fakes'
import { boxMesh } from '../app/testing/meshes'
import { updateNode } from '../document/ops'
import { validateDocument } from '../document/schema'
import { GeometryClient } from '../geometry/client'
import type { GeometryApi } from '../geometry/types'
import { createEditorStore } from './editor-store'
import { createMemoryShapeLibrary, type LibraryShape } from './library'
import { TOO_LONG } from './messages'
import {
  createPreviewStatus, createPreviewStore, followSelectedShape, previewDocument, PREVIEW_ID, PREVIEW_PROBLEM, showShape, syncPreview,
} from './preview'

const gear: LibraryShape = { id: 'my-gear', name: 'Gear', code: "export default { name: 'Gear' }", updatedAt: 1 }
const flush = () => new Promise((r) => setTimeout(r, 0))
const clientWith = (overrides: Partial<GeometryApi>, timeoutMs?: number) =>
  new GeometryClient(() => ({ api: fakeGeometryApi(overrides), terminate: () => undefined }), timeoutMs)

describe('the preview design', () => {
  it('is a valid one-part design that carries the shape', () => {
    const doc = previewDocument(gear, { size: 30 })
    expect(validateDocument(doc).ok).toBe(true)
    expect(doc.plugins).toEqual({ 'my-gear': { name: 'Gear', code: gear.code } })
    expect(doc.nodes[PREVIEW_ID]).toMatchObject({ shapeType: 'my-gear', params: { size: 30 } })
  })
  it('opens a new shape fresh, and keeps the settings Kade is trying when the code changes', () => {
    const store = createPreviewStore()
    showShape(store, gear)
    expect(store.getState().designId).toBe('my-gear')
    store.getState().apply((d) => updateNode(d, PREVIEW_ID, (n) => (n.kind === 'shape' ? { ...n, params: { size: 30 } } : n)))
    showShape(store, { ...gear, code: 'new code' })
    const doc = store.getState().history.present
    expect(doc.plugins['my-gear']?.code).toBe('new code')
    expect(doc.nodes[PREVIEW_ID]).toMatchObject({ params: { size: 30 } })
    const before = store.getState().history.present
    showShape(store, { ...gear, code: 'new code' })
    expect(store.getState().history.present).toBe(before)
  })
  it('follows the shape selected in the editor', () => {
    const editor = createEditorStore(createMemoryShapeLibrary())
    const store = createPreviewStore()
    const stop = followSelectedShape(editor, store)
    const made = editor.getState().create()
    expect(store.getState().designId).toBe(made.id)
    stop()
  })
})

describe('building the preview', () => {
  it('shows the build and remembers which code it was for', async () => {
    const store = createPreviewStore()
    const status = createPreviewStatus()
    const client = clientWith({ rebuild: async () => ({ nodes: { [PREVIEW_ID]: { status: 'ok', mesh: boxMesh(10, 10, 10) } } }) })
    const stop = syncPreview(store, client, status)
    showShape(store, gear)
    await flush()
    expect(store.getState().meshes[PREVIEW_ID]).toBeDefined()
    expect(status.getState().builtFor).toEqual({ shapeId: 'my-gear', code: gear.code })
    stop()
  })
  it('builds on the preview channel', async () => {
    const rebuild = vi.fn(async () => ({ nodes: {} }))
    const store = createPreviewStore()
    const stop = syncPreview(store, clientWith({ rebuild }), createPreviewStatus())
    showShape(store, gear)
    await flush()
    expect(rebuild).toHaveBeenCalledWith(expect.objectContaining({ name: 'Gear' }), 'preview')
    stop()
  })
  it('puts the loop message on the part when the build never finishes (Review Focus 1)', async () => {
    const store = createPreviewStore()
    const status = createPreviewStatus()
    const stop = syncPreview(store, clientWith({ rebuild: () => new Promise(() => undefined) }, 20), status)
    showShape(store, gear)
    await vi.waitFor(() => expect(store.getState().errors[PREVIEW_ID]).toBe(TOO_LONG))
    expect(status.getState().builtFor).toEqual({ shapeId: 'my-gear', code: gear.code })
    stop()
  })
  it('explains any other failure', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const store = createPreviewStore()
    const stop = syncPreview(store, clientWith({ rebuild: async () => { throw new Error('boom') } }), createPreviewStatus())
    showShape(store, gear)
    await vi.waitFor(() => expect(store.getState().errors[PREVIEW_ID]).toBe(PREVIEW_PROBLEM))
    stop()
    error.mockRestore()
  })
})
```

`src/kade/code-view.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { fakeGeometryApi } from '../app/testing/fakes'
import { boxMesh } from '../app/testing/meshes'
import { GeometryClient } from '../geometry/client'
import { createShapeCatalog } from './catalog'
import { codeViewOf, createCodeViewSource, type CodeViewInput } from './code-view'
import { createEditorStore } from './editor-store'
import { createMemoryShapeLibrary, type LibraryShape } from './library'
import { createPreviewStatus, createPreviewStore, PREVIEW_ID, showShape, syncPreview } from './preview'

const shape: LibraryShape = { id: 'my-a', name: 'A', code: "export default { name: 'A', build(s, cad) { return cad.box(1, 2, 3) } }", updatedAt: 1 }
const box = { min: [-5, -5, 0] as const, max: [5, 5, 30] as const }
const input = (over: Partial<CodeViewInput> = {}): CodeViewInput => ({
  shape, typing: false, inspect: { ok: true, meta: { name: 'A', icon: '🧩', params: {} } },
  builtFor: { shapeId: shape.id, code: shape.code }, bounds: box, buildError: undefined, ...over,
})

describe('codeViewOf', () => {
  it('reports a shape that builds', () => {
    expect(codeViewOf(input())).toMatchObject({ shapeId: 'my-a', syntaxOk: true, problem: null, built: true, bounds: box, meta: { name: 'A' } })
  })
  it('shows a syntax mistake first', () => {
    const view = codeViewOf(input({ shape: { ...shape, code: 'export default {' } }))
    expect(view.syntaxOk).toBe(false)
    expect(view.problem).toMatch(/^Line 1:/)
    expect(view.built).toBe(false)
  })
  it('shows a problem the worker found', () => {
    expect(codeViewOf(input({ inspect: { ok: false, problem: 'Line 3: nope' } })).problem).toBe('Line 3: nope')
  })
  it('shows a build error only for the code that was built', () => {
    expect(codeViewOf(input({ buildError: 'A couldn\'t be built: x', bounds: null })).problem).toBe('A couldn\'t be built: x')
    const stale = codeViewOf(input({ builtFor: { shapeId: shape.id, code: 'older code' }, buildError: 'old problem' }))
    expect(stale).toMatchObject({ problem: null, built: false, bounds: null })
  })
  it('is empty with no shape selected', () => {
    expect(codeViewOf(input({ shape: null }))).toMatchObject({ shapeId: null, code: '', built: false, problem: null })
  })
})

describe('createCodeViewSource', () => {
  it('puts the editor, the catalog and the preview together, and only changes when they do', async () => {
    const editor = createEditorStore(createMemoryShapeLibrary([shape]))
    await editor.getState().load()
    const catalog = createShapeCatalog(async () => ({ ok: true, meta: { name: 'A', icon: '🧩', params: {} } }))
    catalog.getState().request(shape.code)
    const preview = createPreviewStore()
    const status = createPreviewStatus()
    const client = new GeometryClient(() => ({
      api: fakeGeometryApi({ rebuild: async () => ({ nodes: { [PREVIEW_ID]: { status: 'ok', mesh: boxMesh(10, 10, 30) } } }) }),
      terminate: () => undefined,
    }))
    const stop = syncPreview(preview, client, status)
    showShape(preview, shape)
    const source = createCodeViewSource({ editor, catalog, preview, status })
    const seen: unknown[] = []
    const unsubscribe = source.subscribe(() => seen.push(source.read()))
    await new Promise((r) => setTimeout(r, 0))
    const view = source.read()
    expect(view).toMatchObject({ built: true, meta: { name: 'A' } })
    expect(view.bounds?.max[2]).toBeCloseTo(30)
    expect(source.read()).toBe(view)
    expect(seen.length).toBeGreaterThan(0)
    unsubscribe()
    stop()
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/kade/preview.test.ts src/kade/code-view.test.ts`
Expected: FAIL. The modules don't exist.

- [ ] **Step 3: Implement `src/kade/preview.ts`**

```ts
import { createStore, type StoreApi } from 'zustand/vanilla'
import { createEmptyDocument, createShapeNode, pickColor } from '../document/factory'
import type { BloKadeDocument, ParamValue } from '../document/types'
import { GeometryTimeoutError, type GeometryClient } from '../geometry/client'
import type { BuildResult } from '../geometry/types'
import { createBloKadeStore, type BloKadeStore } from '../store/store'
import { selectedShape, type EditorStore } from './editor-store'
import type { LibraryShape } from './library'
import { TOO_LONG } from './messages'

export const PREVIEW_ID = 'preview'
export const PREVIEW_PROBLEM = "The preview had a problem, so it can't update right now. Try reloading the page."

/** A one-part design that carries the shape, for the preview. Its id is the shape's id. */
export function previewDocument(shape: LibraryShape, params: Readonly<Record<string, ParamValue>> = {}): BloKadeDocument {
  const node = createShapeNode({ id: PREVIEW_ID, shapeType: shape.id, name: shape.name, params, color: pickColor(1) })
  return {
    ...createEmptyDocument(shape.name),
    root: [PREVIEW_ID],
    nodes: { [PREVIEW_ID]: node },
    plugins: { [shape.id]: { name: shape.name, code: shape.code } },
  }
}

/** The preview with the shape's newest code. The settings Kade is trying out stay. */
export function withPreviewCode(doc: BloKadeDocument, shape: LibraryShape): BloKadeDocument {
  return { ...doc, plugins: { [shape.id]: { name: shape.name, code: shape.code } } }
}

export const createPreviewStore = (): BloKadeStore => createBloKadeStore({ designId: '', doc: createEmptyDocument('Preview') })

/** Shows `shape`: a fresh preview for a different shape, or its newer code for the same one. */
export function showShape(store: BloKadeStore, shape: LibraryShape): void {
  const state = store.getState()
  if (state.designId !== shape.id) {
    state.openDesign(shape.id, previewDocument(shape))
    return
  }
  const plugins = state.history.present.plugins
  const carried = Object.hasOwn(plugins, shape.id) ? plugins[shape.id] : undefined
  if (carried?.code !== shape.code || carried.name !== shape.name) state.apply((doc) => withPreviewCode(doc, shape))
}

/** Keeps the preview on the editor's selected shape (its settled code). */
export function followSelectedShape(editor: EditorStore, preview: BloKadeStore): () => void {
  const show = (): void => {
    const shape = selectedShape(editor.getState())
    if (shape) showShape(preview, shape)
  }
  show()
  return editor.subscribe(show)
}

export interface PreviewStatusState {
  /** The shape and code the preview's latest build was for. */
  readonly builtFor: { readonly shapeId: string; readonly code: string } | null
  setBuilt(shapeId: string, code: string | null): void
}

export type PreviewStatusStore = StoreApi<PreviewStatusState>

export const createPreviewStatus = (): PreviewStatusStore => createStore<PreviewStatusState>()((set) => ({
  builtFor: null,
  setBuilt: (shapeId, code) => set({ builtFor: code === null ? null : { shapeId, code } }),
}))

/** A build result that puts a friendly message on the preview part. */
export function previewFailure(error: unknown): BuildResult {
  if (!(error instanceof GeometryTimeoutError)) console.error('Preview build failed', error)
  const message = error instanceof GeometryTimeoutError ? TOO_LONG : PREVIEW_PROBLEM
  return { nodes: { [PREVIEW_ID]: { status: 'error', message } } }
}

/** Rebuilds the preview on the 'preview' channel whenever its design changes. */
export function syncPreview(store: BloKadeStore, client: GeometryClient, status: PreviewStatusStore): () => void {
  const rebuild = (doc: BloKadeDocument, shapeId: string): void => {
    if (!shapeId) return
    const code = Object.hasOwn(doc.plugins, shapeId) ? doc.plugins[shapeId]?.code ?? null : null
    const done = (result: BuildResult): void => {
      store.getState().applyBuild(shapeId, result)
      status.getState().setBuilt(shapeId, code)
    }
    client.rebuild(doc, 'preview').then((result) => { if (result) done(result) }, (error: unknown) => done(previewFailure(error)))
  }
  const initial = store.getState()
  rebuild(initial.history.present, initial.designId)
  return store.subscribe((next, prev) => {
    if (next.history.present !== prev.history.present) rebuild(next.history.present, next.designId)
  })
}
```

- [ ] **Step 4: Implement `src/kade/code-view.ts`**

```ts
import { Matrix4 } from 'three'
import type { Box } from '../document/box'
import type { BloKadeStore } from '../store/store'
import { meshBox } from '../viewport/bounds'
import { resultFor, type ShapeCatalog } from './catalog'
import { selectedShape, type EditorStore } from './editor-store'
import type { LibraryShape } from './library'
import type { InspectResult, ShapeMeta } from './meta'
import { PREVIEW_ID, type PreviewStatusStore, type PreviewStatusState } from './preview'
import { findSyntaxProblem } from './syntax'

/** What Kade's code does right now. Coding lessons check this, never the screen. */
export interface CodeView {
  readonly shapeId: string | null
  /** The settled code (typing settles 500 ms after it stops). */
  readonly code: string
  /** Kade is still typing, so the checks below are about the code before. */
  readonly typing: boolean
  readonly syntaxOk: boolean
  /** The one problem to show: a syntax mistake, a definition problem, or a build error. */
  readonly problem: string | null
  /** The preview built this exact code without a problem. */
  readonly built: boolean
  /** The built part's size, when built. */
  readonly bounds: Box | null
  readonly meta: ShapeMeta | null
}

export interface CodeViewInput {
  readonly shape: LibraryShape | null
  readonly typing: boolean
  readonly inspect: InspectResult | undefined
  readonly builtFor: PreviewStatusState['builtFor']
  readonly bounds: Box | null
  readonly buildError: string | undefined
}

export function codeViewOf({ shape, typing, inspect, builtFor, bounds, buildError }: CodeViewInput): CodeView {
  const code = shape?.code ?? ''
  const syntax = shape ? findSyntaxProblem(code) : null
  const fresh = shape !== null && builtFor?.shapeId === shape.id && builtFor.code === code
  const inspectProblem = inspect && !inspect.ok ? inspect.problem : null
  const problem = syntax ?? inspectProblem ?? (fresh && buildError ? buildError : null)
  const built = fresh && problem === null && bounds !== null
  return {
    shapeId: shape?.id ?? null, code, typing, syntaxOk: syntax === null, problem, built,
    bounds: built ? bounds : null, meta: inspect?.ok ? inspect.meta : null,
  }
}

export interface CodeViewSources {
  readonly editor: EditorStore
  readonly catalog: ShapeCatalog
  readonly preview: BloKadeStore
  readonly status: PreviewStatusStore
}

export interface CodeViewSource {
  /** The same object until something it depends on changes. */
  read(): CodeView
  subscribe(listener: () => void): () => void
}

export function createCodeViewSource({ editor, catalog, preview, status }: CodeViewSources): CodeViewSource {
  let last: { readonly key: readonly unknown[]; readonly view: CodeView } | null = null
  const read = (): CodeView => {
    const e = editor.getState()
    const p = preview.getState()
    const shape = selectedShape(e)
    const key = [shape, e.drafts, catalog.getState().results, p.meshes, p.errors, p.designId, status.getState().builtFor]
    if (last && key.every((value, i) => value === last?.key[i])) return last.view
    const showing = shape !== null && p.designId === shape.id
    const displayed = showing && Object.hasOwn(p.meshes, PREVIEW_ID) ? p.meshes[PREVIEW_ID] : undefined
    const view = codeViewOf({
      shape,
      typing: shape !== null && Object.hasOwn(e.drafts, shape.id),
      inspect: shape ? resultFor(catalog.getState().results, shape.code) : undefined,
      builtFor: status.getState().builtFor,
      bounds: displayed && !displayed.stale ? meshBox(displayed.mesh.positions, new Matrix4()) : null,
      buildError: showing && Object.hasOwn(p.errors, PREVIEW_ID) ? p.errors[PREVIEW_ID] : undefined,
    })
    last = { key, view }
    return view
  }
  return {
    read,
    subscribe: (listener) => {
      const stops = [editor.subscribe(listener), catalog.subscribe(listener), preview.subscribe(listener), status.subscribe(listener)]
      return () => stops.forEach((stop) => stop())
    },
  }
}
```

- [ ] **Step 5: Implement `src/kade/usePreview.ts`**

```ts
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { GeometryClient } from '../geometry/client'
import type { BloKadeStore } from '../store/store'
import type { CodeView, CodeViewSource } from './code-view'
import type { EditorStore } from './editor-store'
import { createPreviewStatus, createPreviewStore, followSelectedShape, syncPreview, type PreviewStatusStore } from './preview'

/** The preview's own design store, following the editor's selected shape and rebuilding on the 'preview' channel. */
export function usePreview(editor: EditorStore, client: GeometryClient): { store: BloKadeStore; status: PreviewStatusStore } {
  const [store] = useState(createPreviewStore)
  const [status] = useState(createPreviewStatus)
  useEffect(() => syncPreview(store, client, status), [store, client, status])
  useEffect(() => followSelectedShape(editor, store), [editor, store])
  return { store, status }
}

export function useCodeView(source: CodeViewSource): CodeView {
  return useSyncExternalStore(source.subscribe, source.read)
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/kade && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/kade
git commit -m "feat: add the live shape preview and the code view

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 14: The code box and the problem list

This task adds the CodeMirror code box and, under it, the one problem to show. Clicking the problem jumps to its line.

**Files:**
- Create: `src/ui/CodeBox.tsx`, `src/ui/ProblemList.tsx`
- Modify: `src/test-setup.ts` (jsdom gaps CodeMirror needs)
- Test: `src/ui/CodeBox.test.tsx`, `src/ui/ProblemList.test.tsx`

**Interfaces:**
- Consumes: Task 13: `CodeView`. Task 3: `problemLine`.
- Produces:
  - `CodeBox({ docKey, code, onChange, jump })`.
    - The wrapper has `data-testid="code-box"`. The editable area has `data-testid="code-input"` and `aria-label="Shape code"`.
    - `CodeJump { line: number; nonce: number }`.
  - `ProblemList({ view, onJump })`. It shows `problem-0` (a button when the line is known), `code-ok` or `code-checking`, inside `code-problems` when there is a problem.

- [ ] **Step 1: Fill jsdom's gaps for CodeMirror**

Append to `src/test-setup.ts`:

```ts
// CodeMirror measures text with Range rectangles, which jsdom doesn't have.
if (typeof Range !== 'undefined' && typeof Range.prototype.getClientRects !== 'function') {
  const noRect = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) } as DOMRect
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => noRect
}
```

- [ ] **Step 2: Write the failing tests**

`src/ui/CodeBox.test.tsx`:

```tsx
// @vitest-environment jsdom
import { EditorView } from 'codemirror'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CodeBox } from './CodeBox'

const viewOf = (): EditorView => {
  const view = EditorView.findFromDOM(screen.getByTestId('code-box'))
  if (!view) throw new Error('no editor')
  return view
}

describe('CodeBox', () => {
  it('shows the code and reports what Kade types', () => {
    const onChange = vi.fn()
    render(<CodeBox docKey="a" code="return 1" onChange={onChange} jump={null} />)
    expect(screen.getByTestId('code-input')).toHaveTextContent('return 1')
    expect(screen.getByLabelText('Shape code')).toBe(screen.getByTestId('code-input'))
    viewOf().dispatch({ changes: { from: 0, insert: '// hi\n' } })
    expect(onChange).toHaveBeenLastCalledWith('// hi\nreturn 1')
  })
  it('keeps its own text while the same shape is open, and starts fresh for another shape', () => {
    const { rerender } = render(<CodeBox docKey="a" code="one" onChange={vi.fn()} jump={null} />)
    rerender(<CodeBox docKey="a" code="changed outside" onChange={vi.fn()} jump={null} />)
    expect(viewOf().state.doc.toString()).toBe('one')
    rerender(<CodeBox docKey="b" code="two" onChange={vi.fn()} jump={null} />)
    expect(viewOf().state.doc.toString()).toBe('two')
  })
  it('jumps to a line', () => {
    const { rerender } = render(<CodeBox docKey="a" code={'one\ntwo\nthree'} onChange={vi.fn()} jump={null} />)
    rerender(<CodeBox docKey="a" code={'one\ntwo\nthree'} onChange={vi.fn()} jump={{ line: 3, nonce: 1 }} />)
    expect(viewOf().state.selection.main.head).toBe(8)
    rerender(<CodeBox docKey="a" code={'one\ntwo\nthree'} onChange={vi.fn()} jump={{ line: 99, nonce: 2 }} />)
    expect(viewOf().state.selection.main.head).toBe(8)
  })
})
```

`src/ui/ProblemList.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CodeView } from '../kade/code-view'
import { ProblemList } from './ProblemList'

const view = (over: Partial<CodeView>): CodeView => ({
  shapeId: 'my-a', code: '', typing: false, syntaxOk: true, problem: null, built: false, bounds: null, meta: null, ...over,
})

describe('ProblemList', () => {
  it('shows a problem with a line as a button that jumps there', async () => {
    const onJump = vi.fn()
    render(<ProblemList view={view({ problem: 'Line 4: there\'s nothing called "widht" — check the spelling.' })} onJump={onJump} />)
    await userEvent.click(screen.getByTestId('problem-0'))
    expect(onJump).toHaveBeenCalledWith(4)
    expect(screen.getByRole('alert')).toHaveTextContent('nothing called "widht"')
  })
  it('shows a problem without a line as text', () => {
    render(<ProblemList view={view({ problem: 'Your shape needs a name.' })} onJump={vi.fn()} />)
    expect(screen.queryByTestId('problem-0')).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent('Your shape needs a name.')
  })
  it('cheers when the shape works, and says when it is checking', () => {
    const { rerender } = render(<ProblemList view={view({ built: true })} onJump={vi.fn()} />)
    expect(screen.getByTestId('code-ok')).toHaveTextContent('Your shape works!')
    rerender(<ProblemList view={view({})} onJump={vi.fn()} />)
    expect(screen.getByTestId('code-checking')).toBeInTheDocument()
    rerender(<ProblemList view={view({ shapeId: null })} onJump={vi.fn()} />)
    expect(screen.queryByTestId('code-checking')).toBeNull()
  })
})
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run src/ui/CodeBox.test.tsx src/ui/ProblemList.test.tsx`
Expected: FAIL. The components don't exist.

- [ ] **Step 4: Implement `src/ui/CodeBox.tsx`**

```tsx
import { javascript } from '@codemirror/lang-javascript'
import { basicSetup, EditorView } from 'codemirror'
import { useEffect, useRef } from 'react'

export interface CodeJump {
  readonly line: number
  /** Changes on every click, so clicking the same problem twice still jumps. */
  readonly nonce: number
}

interface CodeBoxProps {
  /** A new key makes a fresh editor: another shape. While the key stays, the editor owns the text. */
  docKey: string
  code: string
  onChange(code: string): void
  jump: CodeJump | null
}

/** Kade's code box (CodeMirror): line numbers, colours and bracket matching. */
export function CodeBox({ docKey, code, onChange, jump }: CodeBoxProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const changed = useRef(onChange)
  const startCode = useRef(code)
  startCode.current = code

  useEffect(() => {
    changed.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!host.current) return undefined
    const editor = new EditorView({
      doc: startCode.current,
      parent: host.current,
      extensions: [
        basicSetup,
        javascript(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) changed.current(update.state.doc.toString())
        }),
        EditorView.contentAttributes.of({ 'data-testid': 'code-input', 'aria-label': 'Shape code' }),
      ],
    })
    view.current = editor
    return () => {
      editor.destroy()
      view.current = null
    }
  }, [docKey])

  useEffect(() => {
    const editor = view.current
    if (!editor || !jump) return
    const doc = editor.state.doc
    const line = doc.line(Math.min(Math.max(jump.line, 1), doc.lines))
    editor.dispatch({ selection: { anchor: line.from }, scrollIntoView: true })
    editor.focus()
  }, [jump])

  return <div className="code-box" ref={host} data-testid="code-box" />
}
```

- [ ] **Step 5: Implement `src/ui/ProblemList.tsx`**

```tsx
import type { CodeView } from '../kade/code-view'
import { problemLine } from '../kade/errors'

/** Under the code box: the one problem to fix (click it to jump to its line), or a ✓ when the shape works. */
export function ProblemList({ view, onJump }: { view: CodeView; onJump(line: number): void }) {
  if (!view.shapeId) return null
  if (view.problem) {
    const line = problemLine(view.problem)
    return (
      <div className="problem-list" role="alert" data-testid="code-problems">
        {line === null
          ? <p className="error-text">⚠ {view.problem}</p>
          : <button type="button" className="problem" data-testid="problem-0" onClick={() => onJump(line)}>⚠ {view.problem}</button>}
      </div>
    )
  }
  if (view.built) return <p className="code-ok" data-testid="code-ok" role="status">✓ Your shape works!</p>
  return <p className="hint" data-testid="code-checking" role="status">Checking your shape…</p>
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/ui/CodeBox.test.tsx src/ui/ProblemList.test.tsx && npm run typecheck`
Expected: PASS.

If CodeMirror throws in jsdom about another missing browser method, add a guarded stub for it to `src/test-setup.ts`, the same way as `getClientRects`. Do not mock CodeMirror itself.

- [ ] **Step 7: Commit**

```bash
git add src/ui/CodeBox.tsx src/ui/CodeBox.test.tsx src/ui/ProblemList.tsx src/ui/ProblemList.test.tsx src/test-setup.ts
git commit -m "feat: add the code box and problem list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 15: The library list, the preview pane and ❓ Commands

**Files:**
- Create: `src/ui/LibraryList.tsx`, `src/ui/ShapePreview.tsx`, `src/ui/CommandsReference.tsx`
- Modify: `src/ui/PropertiesPanel.tsx` (export `ShapeSettings`)
- Test: `src/ui/LibraryList.test.tsx`, `src/ui/ShapePreview.test.tsx`, `src/ui/CommandsReference.test.tsx`

**Interfaces:**
- Consumes:
  - Task 12: `EditorStore`, `currentCode`.
  - Task 10: `shapeFileName`.
  - Task 6: `CAD_COMMANDS`, `COMMAND_GROUPS`.
  - Task 13: `PREVIEW_ID`.
  - `downloadBytes` (`src/app/download.ts`).
- Produces:
  - `LibraryList({ editor })`. Test ids:
    - Each shape is a `shape-item-<id>` button.
    - Buttons: `new-shape`, `duplicate-shape`, `delete-shape`, `delete-shape-yes`, `delete-shape-no`, `save-shape-file`.
    - The file input: `load-shape-file`.
  - `ShapePreview({ store, registry, canAdd, onAdd })`, with `preview-view` and `add-to-design`.
  - `CommandsReference({ onUseGear })`, with `use-gear`.
  - `PropertiesPanel.tsx` now exports `ShapeSettings({ node, errors, setField, registry })`. It is the old internal `ShapeParams`.

- [ ] **Step 1: Write the failing tests**

`src/ui/LibraryList.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createEditorStore } from '../kade/editor-store'
import { createMemoryShapeLibrary, type LibraryShape } from '../kade/library'
import { CODE_TOO_BIG } from '../kade/messages'
import { downloadBytes } from '../app/download'
import { LibraryList } from './LibraryList'

vi.mock('../app/download', () => ({ downloadBytes: vi.fn() }))

const shape = (id: string, name: string): LibraryShape => ({ id, name, code: `export default { name: '${name}' }`, updatedAt: 1 })

async function setup(shapes: LibraryShape[] = [shape('my-a', 'Gear'), shape('my-b', 'Robot')]) {
  const editor = createEditorStore(createMemoryShapeLibrary(shapes))
  await editor.getState().load()
  render(<LibraryList editor={editor} />)
  return editor
}

describe('LibraryList', () => {
  it('lists the shapes and selects one', async () => {
    const editor = await setup()
    expect(screen.getByTestId('shape-item-my-a')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByTestId('shape-item-my-b'))
    expect(editor.getState().selectedId).toBe('my-b')
  })
  it('makes and duplicates shapes', async () => {
    const editor = await setup()
    await userEvent.click(screen.getByTestId('new-shape'))
    expect(screen.getByRole('button', { name: 'My shape' })).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('duplicate-shape'))
    expect(editor.getState().shapes.map((s) => s.name)).toContain('My shape copy')
  })
  it('asks before deleting', async () => {
    const editor = await setup()
    await userEvent.click(screen.getByTestId('delete-shape'))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Delete Gear?')
    await userEvent.click(screen.getByTestId('delete-shape-no'))
    expect(editor.getState().shapes).toHaveLength(2)
    await userEvent.click(screen.getByTestId('delete-shape'))
    await userEvent.click(screen.getByTestId('delete-shape-yes'))
    expect(editor.getState().shapes.map((s) => s.id)).toEqual(['my-b'])
  })
  it('saves the code Kade is typing to a .js file', async () => {
    const editor = await setup()
    act(() => editor.getState().setCode('my-a', 'typed just now'))
    await userEvent.click(screen.getByTestId('save-shape-file'))
    expect(downloadBytes).toHaveBeenCalledWith('typed just now', 'gear.js', 'text/javascript')
  })
  it('loads a shape from a file', async () => {
    const editor = await setup([])
    const file = new File(["export default { name: 'Rocket' }"], 'rocket.js', { type: 'text/javascript' })
    await userEvent.upload(screen.getByTestId('load-shape-file'), file)
    await vi.waitFor(() => expect(editor.getState().shapes.map((s) => s.name)).toEqual(['Rocket']))
  })
  it('refuses a file that is too long', async () => {
    const editor = await setup([])
    const file = new File(['x'.repeat(50_001)], 'big.js', { type: 'text/javascript' })
    await userEvent.upload(screen.getByTestId('load-shape-file'), file)
    await vi.waitFor(() => expect(editor.getState().notice).toBe(CODE_TOO_BIG))
    expect(editor.getState().shapes).toEqual([])
  })
  it('says how to start when the library is empty', async () => {
    await setup([])
    expect(screen.getByText(/No shapes yet/)).toBeInTheDocument()
    expect(screen.getByTestId('delete-shape')).toBeDisabled()
  })
})
```

`src/ui/ShapePreview.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { codeHash } from '../kade/hash'
import { createPreviewStore, PREVIEW_ID, showShape } from '../kade/preview'
import { buildShapeRegistry } from '../kade/shape-registry'
import { registry as base } from '../plugins/index'
import { ShapePreview } from './ShapePreview'

vi.mock('../viewport/Viewport', () => ({ Viewport: () => null }))

const shape = { id: 'my-gear', name: 'Gear', code: "export default { name: 'Gear' }", updatedAt: 1 }
const registry = buildShapeRegistry({
  base, library: [], carried: { 'my-gear': { name: 'Gear', code: shape.code } },
  results: { [codeHash(shape.code)]: { ok: true, meta: { name: 'Gear', icon: '⚙️', params: { teeth: { type: 'whole', default: 12, label: 'Teeth' } } } } },
})

describe('ShapePreview', () => {
  it("shows the shape's settings and changes them in the preview", async () => {
    const store = createPreviewStore()
    showShape(store, shape)
    render(<ShapePreview store={store} registry={registry} canAdd onAdd={vi.fn()} />)
    const teeth = screen.getByTestId('param-teeth')
    await userEvent.clear(teeth)
    await userEvent.type(teeth, '20{Enter}')
    expect(store.getState().history.present.nodes[PREVIEW_ID]).toMatchObject({ params: { teeth: 20 } })
  })
  it('adds the shape to the design when it works', async () => {
    const onAdd = vi.fn()
    const store = createPreviewStore()
    showShape(store, shape)
    const { rerender } = render(<ShapePreview store={store} registry={registry} canAdd={false} onAdd={onAdd} />)
    expect(screen.getByTestId('add-to-design')).toBeDisabled()
    rerender(<ShapePreview store={store} registry={registry} canAdd onAdd={onAdd} />)
    await userEvent.click(screen.getByTestId('add-to-design'))
    expect(onAdd).toHaveBeenCalledOnce()
  })
})
```

`src/ui/CommandsReference.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CAD_COMMANDS } from '../kade/commands'
import { CommandsReference } from './CommandsReference'

describe('CommandsReference', () => {
  it('lists every command with what it does and an example', () => {
    render(<CommandsReference onUseGear={vi.fn()} />)
    for (const command of CAD_COMMANDS) {
      expect(screen.getByText(command.call)).toBeInTheDocument()
      expect(screen.getByText(command.does, { exact: false })).toBeInTheDocument()
    }
    expect(screen.getByRole('heading', { name: 'Starting parts' })).toBeInTheDocument()
  })
  it('copies the gear into my shapes', async () => {
    const onUseGear = vi.fn()
    render(<CommandsReference onUseGear={onUseGear} />)
    await userEvent.click(screen.getByTestId('use-gear'))
    expect(onUseGear).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/ui/LibraryList.test.tsx src/ui/ShapePreview.test.tsx src/ui/CommandsReference.test.tsx`
Expected: FAIL. The components don't exist.

- [ ] **Step 3: Export `ShapeSettings` from `src/ui/PropertiesPanel.tsx`**

Rename the internal `ShapeParams` function to `ShapeSettings` and add `export` with a doc comment: `/** A shape's own settings (its parameters). Also used by the My shapes preview. */`. Update its one use inside `PropertiesPanel`. Nothing else changes.

- [ ] **Step 4: Implement `src/ui/LibraryList.tsx`**

```tsx
import { useState, type ChangeEvent } from 'react'
import { useStore } from 'zustand'
import { downloadBytes } from '../app/download'
import { MAX_SHAPE_CODE_LENGTH } from '../document/types'
import { currentCode, type EditorStore } from '../kade/editor-store'
import { shapeFileName } from '../kade/library'
import { CODE_TOO_BIG } from '../kade/messages'

const LOAD_FAILED = "That file couldn't be read. Try another one."

/** Kade's shapes, with + New shape, Duplicate, Delete (asks first), Save to file and Load from file. */
export function LibraryList({ editor }: { editor: EditorStore }) {
  const shapes = useStore(editor, (s) => s.shapes)
  const selectedId = useStore(editor, (s) => s.selectedId)
  const [confirming, setConfirming] = useState(false)
  const selected = shapes.find((s) => s.id === selectedId) ?? null
  const { create, duplicate, remove, select, notify } = editor.getState()

  const saveFile = (): void => {
    if (!selected) return
    downloadBytes(currentCode(editor.getState(), selected.id) ?? selected.code, shapeFileName(selected.name), 'text/javascript')
  }
  const loadFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      if (text.length > MAX_SHAPE_CODE_LENGTH) notify(CODE_TOO_BIG)
      else create(text)
    } catch (error) {
      console.error('Could not read a shape file', error)
      notify(LOAD_FAILED)
    }
  }

  return (
    <section className="panel library" aria-label="My shapes">
      <h2 data-help="panel-library">🧩 My shapes</h2>
      {shapes.length === 0 && <p className="hint">No shapes yet. Press <strong>+ New shape</strong>, or start a lesson below.</p>}
      <ul className="shape-list">
        {shapes.map((s) => (
          <li key={s.id}>
            <button type="button" className="shape-item" data-testid={`shape-item-${s.id}`} aria-pressed={s.id === selectedId}
              onClick={() => select(s.id)}>{s.name}</button>
          </li>
        ))}
      </ul>
      <div className="library-actions">
        <button type="button" className="tool-button" data-testid="new-shape" onClick={() => create()}>+ New shape</button>
        <button type="button" className="tool-button" data-testid="duplicate-shape" disabled={!selected}
          onClick={() => selected && duplicate(selected.id)}>Duplicate</button>
        <button type="button" className="tool-button" data-testid="delete-shape" disabled={!selected} onClick={() => setConfirming(true)}>🗑 Delete</button>
        <button type="button" className="tool-button" data-testid="save-shape-file" disabled={!selected} onClick={saveFile}>💾 Save to file</button>
        <label className="tool-button">
          📂 Load from file
          <input type="file" accept=".js,text/javascript" hidden data-testid="load-shape-file" onChange={(e) => void loadFile(e)} />
        </label>
      </div>
      {confirming && selected && (
        <div className="confirm" role="alertdialog" aria-label="Delete shape">
          <p>Delete {selected.name}? This can't be undone.</p>
          <button type="button" className="tool-button" data-testid="delete-shape-yes"
            onClick={() => { setConfirming(false); void remove(selected.id) }}>Yes, delete it</button>
          <button type="button" className="tool-button" data-testid="delete-shape-no" onClick={() => setConfirming(false)}>Keep it</button>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 5: Implement `src/ui/ShapePreview.tsx`**

```tsx
import { useMemo } from 'react'
import { createFieldNormalizer } from '../app/field-normalizer'
import { formulaErrors, setFieldInput } from '../document/formula-ops'
import type { FieldKey } from '../document/types'
import { PREVIEW_ID } from '../kade/preview'
import type { PluginRegistry } from '../plugins/registry'
import { StoreProvider, useBloKade } from '../store/context'
import type { BloKadeStore } from '../store/store'
import { Viewport } from '../viewport/Viewport'
import { ShapeSettings } from './PropertiesPanel'

function PreviewSettings({ registry }: { registry: PluginRegistry }) {
  const doc = useBloKade((s) => s.history.present)
  const apply = useBloKade((s) => s.apply)
  const normalize = useMemo(() => createFieldNormalizer(registry), [registry])
  const errors = useMemo(() => formulaErrors(doc), [doc])
  const node = Object.hasOwn(doc.nodes, PREVIEW_ID) ? doc.nodes[PREVIEW_ID] : undefined
  if (node?.kind !== 'shape') return null
  const setField = (key: FieldKey, text: string): void => apply((d) => setFieldInput(d, PREVIEW_ID, key, text, normalize))
  return <ShapeSettings key={node.shapeType} node={node} errors={errors[PREVIEW_ID] ?? {}} setField={setField} registry={registry} />
}

interface ShapePreviewProps {
  /** The preview's own one-part design. */
  store: BloKadeStore
  registry: PluginRegistry
  canAdd: boolean
  onAdd(): void
}

/** The right side of My shapes: the shape in 3D, its settings to try, and ➕ Add to my design. */
export function ShapePreview({ store, registry, canAdd, onAdd }: ShapePreviewProps) {
  return (
    <StoreProvider store={store}>
      <section className="panel shape-preview" aria-label="Preview">
        <h2 data-help="panel-preview">Preview</h2>
        <div className="preview-view" data-testid="preview-view">
          <Viewport registry={registry} onToggleEdge={() => undefined} />
        </div>
        <PreviewSettings registry={registry} />
        <button type="button" className="tool-button primary add-to-design" data-testid="add-to-design" disabled={!canAdd} onClick={onAdd}>
          ➕ Add to my design
        </button>
      </section>
    </StoreProvider>
  )
}
```

- [ ] **Step 6: Implement `src/ui/CommandsReference.tsx`**

```tsx
import { CAD_COMMANDS, COMMAND_GROUPS } from '../kade/commands'

/** ❓ Commands: every cad command with what it does and a tiny example, plus the ⚙️ Gear to start from. */
export function CommandsReference({ onUseGear }: { onUseGear(): void }) {
  return (
    <section className="panel commands" aria-label="Commands">
      <p className="hint">Every command makes a new part. Parts never change by themselves.</p>
      {COMMAND_GROUPS.map(({ group, title }) => (
        <div key={group}>
          <h3>{title}</h3>
          <dl className="command-list">
            {CAD_COMMANDS.filter((c) => c.group === group).map((c) => (
              <div key={`${c.on}.${c.name}`} className="command">
                <dt><code>{c.call}</code></dt>
                <dd>{c.does} <code className="command-example">{c.example}</code></dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      <div className="gear-card">
        <h3>⚙️ Gear</h3>
        <p className="hint">A finished shape made only from these commands. It has settings for teeth, size, thickness and hole.</p>
        <button type="button" className="tool-button" data-testid="use-gear" onClick={onUseGear}>Use as a starting point</button>
      </div>
    </section>
  )
}
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/ui && npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/ui/LibraryList.tsx src/ui/LibraryList.test.tsx src/ui/ShapePreview.tsx src/ui/ShapePreview.test.tsx src/ui/CommandsReference.tsx src/ui/CommandsReference.test.tsx src/ui/PropertiesPanel.tsx
git commit -m "feat: add the shape library list, preview pane and commands reference

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 16: Lessons for code: shared step cards and a shared step watcher

This task makes Milestone 5's lesson machinery work for any kind of lesson:
- Lesson types are generic over what a step's check looks at: `LessonView` for design lessons, `CodeView` for coding lessons.
- The step watcher gets a generic core.
- The step card becomes a shared component.
- `CodeLessonsPanel` runs coding lessons inside My shapes.

The existing design-lesson tests must still pass unchanged.

**Files:**
- Modify: `src/learn/types.ts`, `src/learn/view.ts`, `src/learn/lesson-store.ts`, `src/learn/watch-steps.ts`, `src/ui/LessonStep.tsx`, `src/ui/LessonsPanel.tsx`, `src/ui/Workspace.tsx` (one line)
- Create:
  - `src/learn/step-watcher.ts`
  - `src/kade/lessons/types.ts`, `src/kade/lessons/start.ts`, `src/kade/lessons/watch-code-steps.ts`
  - `src/ui/LessonCards.tsx`, `src/ui/CodeLessonsPanel.tsx`
- Test: `src/learn/step-watcher.test.ts`, `src/kade/lessons/start.test.ts`, `src/kade/lessons/watch-code-steps.test.ts`, `src/ui/CodeLessonsPanel.test.tsx`

**Interfaces:**
- Consumes: Task 12: `EditorStore`. Task 13: `CodeView`, `CodeViewSource`.
- Produces:
  - In `learn/types.ts`: `TutorialStep<V = LessonView>`, `Tutorial<V = LessonView>`, and `AnyTutorial = Tutorial<never>` for lists that mix kinds.
  - Lesson helpers: `isStepDone<V>(step, view)` and `currentStepOf<V>(progress, tutorials)`. The tutorials argument is now required.
  - `createLessonStore(storage, tutorials: readonly AnyTutorial[] = TUTORIALS)`.
  - `watchLessonSteps<V>(lessons, tutorials, source: StepViewSource<V>): () => void`, where `StepViewSource<V> = { read(): { view: V; ownerId: string | null }; subscribe(listener) }`.
  - Coding lessons:
    - `CodeLesson extends Tutorial<CodeView> { starter: string }`.
    - `startCodeLesson(editor, lessons, lesson): void`.
    - `watchCodeSteps(lessons, source, codeLessons): () => void`.
  - Shared cards:
    - `StepCard({ title, icon, stepIndex, total, step: { text; hint; target?; hasCheck }, done, onNext, onBack, onQuit })`.
    - `FinishedCard({ title, onBack })`.
  - `CodeLessonsPanel({ lessons, editor, view, codeLessons })`.
    - New test ids: `code-lesson-start-<id>`, `code-lesson-done-<id>`, `code-lesson-go-back`, `code-lesson-restart`.
    - The step controls reuse `lesson-step`, `lesson-next`, `lesson-skip`, `lesson-back`, `lesson-hint` and `lesson-quit`.

- [ ] **Step 1: Write the failing tests**

`src/learn/step-watcher.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createLessonStore } from './lesson-store'
import { watchLessonSteps, type StepViewSource } from './step-watcher'
import type { Tutorial } from './types'

interface Counter { readonly count: number; readonly owner: string }

const lesson: Tutorial<Counter> = {
  id: 'count', title: 'Count', icon: '🔢', intro: 'i',
  steps: [
    { id: 'one', text: 'Get to 1', hint: 'h', check: (v) => v.count >= 1 },
    { id: 'two', text: 'Get to 2', hint: 'h', check: (v) => v.count >= 2 },
  ],
}

function fakeSource(start: Counter) {
  let view = start
  const listeners = new Set<() => void>()
  const source: StepViewSource<Counter> = {
    read: () => ({ view, ownerId: view.owner }),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  const set = (next: Counter) => {
    view = next
    listeners.forEach((l) => l())
  }
  return { source, set }
}

describe('watchLessonSteps', () => {
  it('moves on when a check turns true for the lesson\'s own view', () => {
    const lessons = createLessonStore(null, [lesson])
    lessons.getState().begin('count', 'mine')
    const { source, set } = fakeSource({ count: 0, owner: 'mine' })
    const stop = watchLessonSteps(lessons, [lesson], source)
    set({ count: 1, owner: 'other' })
    expect(lessons.getState().progress.active?.step).toBe(0)
    set({ count: 0, owner: 'mine' })
    set({ count: 1, owner: 'mine' })
    expect(lessons.getState().progress.active?.step).toBe(1)
    set({ count: 2, owner: 'mine' })
    expect(lessons.getState().finished).toBe('count')
    stop()
  })
  it('ignores lessons it was not given', () => {
    const lessons = createLessonStore(null, [lesson])
    lessons.getState().begin('count', 'mine')
    const { source, set } = fakeSource({ count: 0, owner: 'mine' })
    const stop = watchLessonSteps(lessons, [], source)
    set({ count: 5, owner: 'mine' })
    expect(lessons.getState().progress.active?.step).toBe(0)
    stop()
  })
})
```

`src/kade/lessons/start.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createLessonStore } from '../../learn/lesson-store'
import { createEditorStore, selectedShape } from '../editor-store'
import { createMemoryShapeLibrary } from '../library'
import { startCodeLesson } from './start'
import type { CodeLesson } from './types'

const lesson: CodeLesson = {
  id: 'code-test', title: 'Test', icon: '🧪', intro: 'i', starter: "export default { name: 'Practice' }",
  steps: [{ id: 'a', text: 't', hint: 'h', check: (v) => v.built }],
}

describe('startCodeLesson', () => {
  it('makes the starter code a new shape and begins the lesson on it', () => {
    const editor = createEditorStore(createMemoryShapeLibrary())
    const lessons = createLessonStore(null, [lesson])
    startCodeLesson(editor, lessons, lesson)
    const shape = selectedShape(editor.getState())
    expect(shape?.code).toBe(lesson.starter)
    expect(lessons.getState().progress.active).toEqual({ tutorialId: 'code-test', step: 0, designId: shape?.id })
    expect(lessons.getState().panelOpen).toBe(true)
  })
})
```

`src/kade/lessons/watch-code-steps.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createLessonStore } from '../../learn/lesson-store'
import type { CodeView, CodeViewSource } from '../code-view'
import type { CodeLesson } from './types'
import { watchCodeSteps } from './watch-code-steps'

const lesson: CodeLesson = {
  id: 'code-test', title: 'Test', icon: '🧪', intro: 'i', starter: '',
  steps: [{ id: 'build', text: 't', hint: 'h', check: (v) => v.built }, { id: 'read', text: 'r', hint: 'h' }],
}
const view = (over: Partial<CodeView>): CodeView => ({
  shapeId: 'my-a', code: '', typing: false, syntaxOk: true, problem: null, built: false, bounds: null, meta: null, ...over,
})

describe('watchCodeSteps', () => {
  it('moves on when the lesson\'s shape builds', () => {
    let current = view({})
    const listeners = new Set<() => void>()
    const source: CodeViewSource = { read: () => current, subscribe: (l) => { listeners.add(l); return () => listeners.delete(l) } }
    const lessons = createLessonStore(null, [lesson])
    lessons.getState().begin('code-test', 'my-a')
    const stop = watchCodeSteps(lessons, source, [lesson])
    current = view({ built: true })
    listeners.forEach((l) => l())
    expect(lessons.getState().progress.active?.step).toBe(1)
    stop()
  })
})
```

`src/ui/CodeLessonsPanel.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { CodeView } from '../kade/code-view'
import { createEditorStore } from '../kade/editor-store'
import type { CodeLesson } from '../kade/lessons/types'
import { createMemoryShapeLibrary } from '../kade/library'
import { createLessonStore } from '../learn/lesson-store'
import { CodeLessonsPanel } from './CodeLessonsPanel'

const lesson: CodeLesson = {
  id: 'code-test', title: 'Practice', icon: '🧪', intro: 'Try it out.', starter: "export default { name: 'Practice' }",
  steps: [
    { id: 'build', text: 'Make it **build**.', target: 'code-input', hint: 'Fix the code.', check: (v) => v.built },
    { id: 'read', text: 'Well done.', hint: 'Just read it.' },
  ],
}
const view = (over: Partial<CodeView>): CodeView => ({
  shapeId: null, code: '', typing: false, syntaxOk: true, problem: null, built: false, bounds: null, meta: null, ...over,
})

function setup() {
  const editor = createEditorStore(createMemoryShapeLibrary())
  const lessons = createLessonStore(null, [lesson])
  const ui = (v: CodeView) => <CodeLessonsPanel lessons={lessons} editor={editor} view={v} codeLessons={[lesson]} />
  const utils = render(ui(view({})))
  return { editor, lessons, rerender: (v: CodeView) => utils.rerender(ui(v)) }
}

describe('CodeLessonsPanel', () => {
  it('starts a lesson on a new shape and shows its first step', async () => {
    const { editor, lessons, rerender } = setup()
    expect(screen.getByText('Try it out.')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('code-lesson-start-code-test'))
    const id = editor.getState().selectedId
    expect(lessons.getState().progress.active?.designId).toBe(id)
    rerender(view({ shapeId: id }))
    expect(screen.getByTestId('lesson-step')).toHaveTextContent('Make it build.')
    expect(screen.getByTestId('lesson-skip')).toBeInTheDocument()
    rerender(view({ shapeId: id, built: true }))
    expect(screen.getByTestId('lesson-next')).toBeInTheDocument()
  })
  it('pauses on another shape and goes back to the lesson\'s shape', async () => {
    const { editor, rerender } = setup()
    await userEvent.click(screen.getByTestId('code-lesson-start-code-test'))
    const id = editor.getState().selectedId
    act(() => editor.getState().create())
    rerender(view({ shapeId: editor.getState().selectedId }))
    await userEvent.click(screen.getByTestId('code-lesson-go-back'))
    expect(editor.getState().selectedId).toBe(id)
  })
  it('offers to start again when the lesson\'s shape is gone', async () => {
    const { editor, lessons, rerender } = setup()
    await userEvent.click(screen.getByTestId('code-lesson-start-code-test'))
    await act(async () => editor.getState().remove(editor.getState().selectedId ?? ''))
    rerender(view({}))
    await userEvent.click(screen.getByTestId('code-lesson-restart'))
    expect(lessons.getState().progress.active?.designId).toBe(editor.getState().selectedId)
  })
  it('cheers at the end and shows a ✓ in the list', async () => {
    const { editor, lessons, rerender } = setup()
    await userEvent.click(screen.getByTestId('code-lesson-start-code-test'))
    rerender(view({ shapeId: editor.getState().selectedId }))
    act(() => { lessons.getState().next(); lessons.getState().next() })
    rerender(view({ shapeId: editor.getState().selectedId }))
    expect(screen.getByTestId('lesson-finished')).toHaveTextContent('You finished Practice!')
    await userEvent.click(screen.getByTestId('lessons-list-back'))
    expect(screen.getByTestId('code-lesson-done-code-test')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/learn src/kade/lessons src/ui/CodeLessonsPanel.test.tsx`
Expected: FAIL. `step-watcher`, `lessons/*` and `CodeLessonsPanel` don't exist.

- [ ] **Step 3: Make the lesson types generic**

`src/learn/types.ts`:
- Change `export interface TutorialStep {` to `export interface TutorialStep<V = LessonView> {`, and its check to `readonly check?: (view: V) => boolean`.
- Change `export interface Tutorial {` to `export interface Tutorial<V = LessonView> {`, and its steps to `readonly steps: readonly TutorialStep<V>[]`.
- Add:

```ts
/** Any lesson, design or code, for lists that hold both kinds. Its checks can't be called through this type. */
export type AnyTutorial = Tutorial<never>
```

`src/learn/view.ts`, replace `reported` and `isStepDone`:

```ts
const reported = new WeakSet<object>()

/** True when the step's check passes. A check that throws counts as "not done yet" and is logged once. */
export function isStepDone<V>(step: TutorialStep<V>, view: V): boolean {
```

(The body is unchanged.)

`src/learn/lesson-store.ts`:
- Import `type AnyTutorial`.
- Replace `currentStepOf` with a generic version that has no default:

```ts
export function currentStepOf<V>(progress: LessonProgress, tutorials: readonly Tutorial<V>[]): TutorialStep<V> | undefined {
  const active = progress.active
  return active ? tutorials.find((t) => t.id === active.tutorialId)?.steps[active.step] : undefined
}
```

- Change `sanitize`'s and `createLessonStore`'s `tutorials` parameter types to `readonly AnyTutorial[]`. Keep `createLessonStore`'s default of `TUTORIALS`.

`src/ui/Workspace.tsx`: change `currentStepOf(s.progress)` to `currentStepOf(s.progress, TUTORIALS)`. `TUTORIALS` is already imported there.

- [ ] **Step 4: Create the generic watcher and use it for design lessons**

`src/learn/step-watcher.ts`:

```ts
import { currentStepOf, type LessonStore } from './lesson-store'
import type { Tutorial } from './types'
import { isStepDone } from './view'

/** Where a kind of lesson gets the view its checks look at, and which design or shape that view belongs to. */
export interface StepViewSource<V> {
  read(): { readonly view: V; readonly ownerId: string | null }
  subscribe(listener: () => void): () => void
}

/**
 * Moves the active lesson on when its current step's check turns true, for lessons in `tutorials` only.
 * A step that is already done when Kade reaches it (for example after Back) waits for Next instead.
 */
export function watchLessonSteps<V>(lessons: LessonStore, tutorials: readonly Tutorial<V>[], source: StepViewSource<V>): () => void {
  let seen: { key: string; done: boolean } | null = null
  const evaluate = (): void => {
    const { progress } = lessons.getState()
    const active = progress.active
    const step = currentStepOf(progress, tutorials)
    const { view, ownerId } = source.read()
    if (!active || !step || ownerId !== active.designId) {
      seen = null
      return
    }
    const key = `${active.tutorialId}:${active.step}:${active.designId}`
    const done = isStepDone(step, view)
    const becameDone = seen?.key === key && done && !seen.done
    seen = { key, done }
    if (becameDone) lessons.getState().next()
  }
  const stops = [source.subscribe(evaluate), lessons.subscribe(evaluate)]
  evaluate()
  return () => stops.forEach((stop) => stop())
}
```

`src/learn/watch-steps.ts`: replace `watchSteps`'s body so it uses the core. `useStepWatcher` stays as it is.

```ts
export function watchSteps(store: BloKadeStore, lessons: LessonStore, tutorials: readonly Tutorial[] = TUTORIALS): () => void {
  return watchLessonSteps(lessons, tutorials, {
    read: () => {
      const view = lessonView(store.getState())
      return { view, ownerId: view.designId }
    },
    subscribe: (listener) => store.subscribe(listener),
  })
}
```

Update its imports. It now needs `watchLessonSteps`, `lessonView`, `TUTORIALS` and the types, and no longer needs `currentStepOf` or `isStepDone`.

- [ ] **Step 5: Create the coding-lesson helpers**

`src/kade/lessons/types.ts`:

```ts
import type { Tutorial } from '../../learn/types'
import type { CodeView } from '../code-view'

/** A coding lesson: its checks look at what Kade's code does. */
export interface CodeLesson extends Tutorial<CodeView> {
  /** The code the lesson's practice shape starts with. */
  readonly starter: string
}
```

`src/kade/lessons/start.ts`:

```ts
import type { LessonStore } from '../../learn/lesson-store'
import type { EditorStore } from '../editor-store'
import type { CodeLesson } from './types'

/** Makes the lesson's starter code a new shape (so Kade's shapes stay safe) and begins the lesson on it. */
export function startCodeLesson(editor: EditorStore, lessons: LessonStore, lesson: CodeLesson): void {
  const shape = editor.getState().create(lesson.starter)
  lessons.getState().begin(lesson.id, shape.id)
}
```

`src/kade/lessons/watch-code-steps.ts`:

```ts
import type { LessonStore } from '../../learn/lesson-store'
import { watchLessonSteps } from '../../learn/step-watcher'
import type { CodeViewSource } from '../code-view'
import type { CodeLesson } from './types'

/** Moves the active coding lesson on when Kade's code passes the current step's check. */
export function watchCodeSteps(lessons: LessonStore, source: CodeViewSource, codeLessons: readonly CodeLesson[]): () => void {
  return watchLessonSteps(lessons, codeLessons, {
    read: () => {
      const view = source.read()
      return { view, ownerId: view.shapeId }
    },
    subscribe: source.subscribe,
  })
}
```

- [ ] **Step 6: Extract the shared step card**

Create `src/ui/LessonCards.tsx`. Move `LessonStep`'s step markup here unchanged, so its test ids and text stay the same:

```tsx
import { useState } from 'react'
import { useTargetRect } from '../learn/target'
import { LessonHighlight } from './LessonHighlight'
import { RichText } from './RichText'

interface StepCardProps {
  title: string
  icon: string
  stepIndex: number
  total: number
  step: { readonly text: string; readonly hint: string; readonly target?: string; readonly hasCheck: boolean }
  done: boolean
  onNext(): void
  onBack(): void
  onQuit(): void
}

/** One lesson step: what to do, a highlight on the control, and Back / Skip / Next / Show me. Design and code lessons share it. */
export function StepCard({ title, icon, stepIndex, total, step, done, onNext, onBack, onQuit }: StepCardProps) {
  const rect = useTargetRect(step.target)
  const [showHint, setShowHint] = useState(false)
  const last = stepIndex + 1 === total
  return (
    <section className="lesson-step" aria-label={title}>
      <h3><span aria-hidden="true">{icon}</span> {title}</h3>
      <p className="hint">Step {stepIndex + 1} of {total}</p>
      <progress className="lesson-progress" max={total} value={stepIndex} />
      <p className="lesson-text" data-testid="lesson-step"><RichText text={step.text} /></p>
      {step.target && !rect && <p className="hint" data-testid="lesson-find-it">Can't see it? <RichText text={step.hint} /></p>}
      {done && <p className="lesson-done" role="status">✓ Done!</p>}
      {showHint && <p className="lesson-hint" data-testid="lesson-hint-text">💡 <RichText text={step.hint} /></p>}
      <div className="lesson-actions">
        <button type="button" className="tool-button" data-testid="lesson-back" disabled={stepIndex === 0} onClick={onBack}>Back</button>
        {!step.hasCheck || done
          ? <button type="button" className="tool-button primary" data-testid="lesson-next" onClick={onNext}>{last ? 'Finish' : 'Next'}</button>
          : <button type="button" className="tool-button" data-testid="lesson-skip" onClick={onNext}>Skip</button>}
        <button type="button" className="tool-button" data-testid="lesson-hint" aria-pressed={showHint}
          onClick={() => setShowHint((shown) => !shown)}>💡 Show me</button>
      </div>
      <button type="button" className="link-button" data-testid="lesson-quit" onClick={onQuit}>Stop this lesson</button>
      {rect && <LessonHighlight rect={rect} />}
    </section>
  )
}

/** The 🎉 shown when a lesson is finished. */
export function FinishedCard({ title, onBack }: { title: string; onBack(): void }) {
  return (
    <div className="lesson-finished" data-testid="lesson-finished" role="status">
      <p className="lesson-cheer">🎉 You finished <strong>{title}</strong>!</p>
      <button type="button" className="tool-button" data-testid="lessons-list-back" onClick={onBack}>Back to all lessons</button>
    </div>
  )
}
```

`src/ui/LessonStep.tsx`: keep `PausedLesson`. Replace `LessonStep`'s body after the `paused` check with the shared card:

```tsx
export function LessonStep({ lessons, session, tutorial, active }: LessonStepProps) {
  const step = tutorial.steps[active.step]
  const paused = useBloKade((s) => s.designId !== active.designId)
  const done = useBloKade((s) => (step ? isStepDone(step, lessonView(s)) : false))
  if (!step) return null
  if (paused) return <PausedLesson lessons={lessons} session={session} tutorial={tutorial} />
  const { next, back, quit } = lessons.getState()
  return (
    <StepCard title={tutorial.title} icon={tutorial.icon} stepIndex={active.step} total={tutorial.steps.length}
      step={{ text: step.text, hint: step.hint, target: step.target, hasCheck: step.check !== undefined }}
      done={done} onNext={next} onBack={back} onQuit={quit} />
  )
}
```

Update its imports: add `StepCard`, and drop the now-unused `useState`, `useTargetRect`, `LessonHighlight` and `RichText`. `useState` is still used by `PausedLesson`, so keep it. The old hint line showed `step.hint` as plain text. It now goes through `RichText`, so `**…**` in hints shows bold too.

`src/ui/LessonsPanel.tsx`: replace the `Finished` component's markup with `<FinishedCard title={title} onBack={() => lessons.getState().clearFinished()} />`.

- [ ] **Step 7: Create `src/ui/CodeLessonsPanel.tsx`**

```tsx
import { useStore } from 'zustand'
import type { CodeView } from '../kade/code-view'
import type { EditorStore } from '../kade/editor-store'
import { startCodeLesson } from '../kade/lessons/start'
import type { CodeLesson } from '../kade/lessons/types'
import type { LessonStore } from '../learn/lesson-store'
import type { ActiveLesson } from '../learn/progress'
import { isStepDone } from '../learn/view'
import { FinishedCard, StepCard } from './LessonCards'

interface CodeLessonsPanelProps {
  lessons: LessonStore
  editor: EditorStore
  view: CodeView
  codeLessons: readonly CodeLesson[]
}

function CodeLessonList({ lessons, editor, codeLessons }: Omit<CodeLessonsPanelProps, 'view'>) {
  const done = useStore(lessons, (s) => s.progress.done)
  return (
    <ol className="lesson-list">
      {codeLessons.map((lesson) => {
        const finished = done.includes(lesson.id)
        return (
          <li key={lesson.id} className="lesson-item">
            <span className="lesson-title">
              <span aria-hidden="true">{lesson.icon}</span> {lesson.title}
              {finished && <span className="lesson-check" data-testid={`code-lesson-done-${lesson.id}`} aria-label="Finished">✓</span>}
            </span>
            <p className="hint">{lesson.intro}</p>
            <button type="button" className="tool-button" data-testid={`code-lesson-start-${lesson.id}`}
              onClick={() => startCodeLesson(editor, lessons, lesson)}>{finished ? 'Do it again' : 'Start'}</button>
          </li>
        )
      })}
    </ol>
  )
}

function PausedCodeLesson({ lessons, editor, lesson, active }: { lessons: LessonStore; editor: EditorStore; lesson: CodeLesson; active: ActiveLesson }) {
  const exists = useStore(editor, (s) => s.shapes.some((shape) => shape.id === active.designId))
  return (
    <div className="lesson-paused" role="status">
      <p>This lesson uses its own shape. Go back to it to keep going.</p>
      {exists
        ? <button type="button" className="tool-button" data-testid="code-lesson-go-back" onClick={() => editor.getState().select(active.designId)}>Go back</button>
        : <button type="button" className="tool-button" data-testid="code-lesson-restart" onClick={() => startCodeLesson(editor, lessons, lesson)}>Start again</button>}
      <button type="button" className="link-button" data-testid="lesson-quit" onClick={() => lessons.getState().quit()}>Stop this lesson</button>
    </div>
  )
}

/** 📘 Lessons inside My shapes: the coding lessons, the active step, or a 🎉. Progress is shared with the design lessons. */
export function CodeLessonsPanel({ lessons, editor, view, codeLessons }: CodeLessonsPanelProps) {
  const active = useStore(lessons, (s) => s.progress.active)
  const finished = useStore(lessons, (s) => s.finished)
  const lesson = active ? codeLessons.find((l) => l.id === active.tutorialId) : undefined
  const step = active && lesson ? lesson.steps[active.step] : undefined
  if (active && lesson && step) {
    if (view.shapeId !== active.designId) return <PausedCodeLesson lessons={lessons} editor={editor} lesson={lesson} active={active} />
    const { next, back, quit } = lessons.getState()
    return (
      <StepCard key={`${lesson.id}-${active.step}`} title={lesson.title} icon={lesson.icon} stepIndex={active.step} total={lesson.steps.length}
        step={{ text: step.text, hint: step.hint, target: step.target, hasCheck: step.check !== undefined }}
        done={isStepDone(step, view)} onNext={next} onBack={back} onQuit={quit} />
    )
  }
  const finishedLesson = codeLessons.find((l) => l.id === finished)
  if (finishedLesson) return <FinishedCard title={finishedLesson.title} onBack={() => lessons.getState().clearFinished()} />
  return <CodeLessonList lessons={lessons} editor={editor} codeLessons={codeLessons} />
}
```

`ActiveLesson` is exported from `src/learn/progress.ts` (`LessonStep.tsx` already imports it from there).

- [ ] **Step 8: Run the tests**

Run: `npm test && npm run typecheck`
Expected: PASS. That includes every Milestone 5 lesson test, `src/learn/watch-steps.test.ts` and `src/ui/LessonsPanel.test.tsx`, unchanged.

- [ ] **Step 9: Commit**

```bash
git add src/learn src/kade/lessons src/ui/LessonCards.tsx src/ui/LessonStep.tsx src/ui/LessonsPanel.tsx src/ui/CodeLessonsPanel.tsx src/ui/CodeLessonsPanel.test.tsx src/ui/Workspace.tsx
git commit -m "feat: run coding lessons with the shared lesson cards and step watcher

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 17: The ten coding lessons

Each lesson loads starter code as a new shape and has two or three "Try this" challenges. A challenge is done when the settled code builds and passes a check. Every check is tested in Node against a worked solution, through the real worker pipeline. Each check must be **false before** its solution and **true after** it, so no step can be pre-satisfied.

**Files:**
- Create:
  - `src/kade/lessons/checks.ts`, `src/kade/lessons/basics.ts` (lessons 1–5), `src/kade/lessons/shapes.ts` (lessons 6–10), `src/kade/lessons/index.ts`
  - `src/kade/lessons/testing/solutions.ts`, `src/kade/lessons/testing/code-view.ts`
  - `src/learn/all-lessons.ts`
- Test: `src/kade/lessons/lessons.test.ts`, `src/kade/lessons/index.test.ts`

**Interfaces:**
- Consumes:
  - Task 16: `CodeLesson`.
  - Task 13: `CodeView`, `codeViewOf`, `previewDocument`, `PREVIEW_ID`.
  - Task 8: `KadeShapes`, `createGeometryApi`.
  - Task 5: `fileModuleLoader`.
- Produces:
  - `CODE_LESSONS: readonly CodeLesson[]`, with ids `code-numbers`, `code-variables`, `code-functions`, `code-errors`, `code-first-shape`, `code-settings`, `code-add-cut`, `code-move-turn`, `code-outlines` and `code-repeat`.
  - `ALL_LESSONS: readonly AnyTutorial[]`.
  - Check helpers: `near`, `widthOf`, `depthOf`, `heightOf`, `bottomOf`, `codeHas`, `settingType`.

- [ ] **Step 1: Write the test helper and the solutions**

`src/kade/lessons/testing/code-view.ts`:

```ts
import { Matrix4 } from 'three'
import type { ParamValue } from '../../../document/types'
import { createGeometryApi } from '../../../geometry/api'
import { Evaluator } from '../../../geometry/evaluate'
import { createCadToolkit } from '../../../plugins/cad'
import { registry } from '../../../plugins/index'
import { meshBox } from '../../../viewport/bounds'
import { codeViewOf, type CodeView } from '../../code-view'
import { KadeShapes } from '../../kade-shapes'
import { previewDocument, PREVIEW_ID } from '../../preview'
import { fileModuleLoader } from '../../testing/file-loader'

const shapes = new KadeShapes(fileModuleLoader, registry)
const api = createGeometryApi(new Evaluator(registry, createCadToolkit()), shapes)

/** Node tests: the CodeView a lesson step sees once Kade's code has settled and the preview has built it. */
export async function codeViewFor(code: string, values: Readonly<Record<string, ParamValue>> = {}): Promise<CodeView> {
  const shape = { id: 'my-lesson0001', name: 'Lesson', code, updatedAt: 0 }
  const inspect = await shapes.inspect(code)
  const built = (await api.rebuild(previewDocument(shape, values), 'preview')).nodes[PREVIEW_ID]
  return codeViewOf({
    shape, typing: false, inspect, builtFor: { shapeId: shape.id, code },
    bounds: built?.status === 'ok' ? meshBox(built.mesh.positions, new Matrix4()) : null,
    buildError: built?.status === 'error' ? built.message : undefined,
  })
}
```

`src/kade/lessons/testing/solutions.ts`:

```ts
import type { ParamValue } from '../../../document/types'
import { addCut, moveTurn, outlines, repeatLesson, settingsLesson } from '../shapes'
import { errorsLesson, firstShape, functionsLesson, numbers, variables } from '../basics'

export interface Solution {
  readonly code: string
  readonly values?: Readonly<Record<string, ParamValue>>
}

/** The code after one edit. Fails loudly if a lesson's starter changed under the solution. */
function edit(code: string, from: string, to: string): string {
  if (!code.includes(from)) throw new Error(`Solution text not found: ${from}`)
  return code.replace(from, to)
}

const n1 = edit(numbers.starter, 'cad.box(20, 10, 5)', 'cad.box(40, 10, 5)')
const n2 = edit(n1, 'cad.box(40, 10, 5)', 'cad.box(40, 10, 25)')
const n3 = edit(n2, 'cad.box(40, 10, 25)', 'cad.cylinder(20, 30)')

const v1 = edit(variables.starter, 'const width = 30\n    return cad.box(width, 10, 5)', 'const width = 30\n    const height = 25\n    return cad.box(width, 10, height)')
const v2 = edit(v1, 'const height = 25', 'const height = 40')

const f1 = edit(functionsLesson.starter, 'return post(0)\n', 'return post(0).add(post(20))\n')
const f2 = edit(f1, 'return post(0).add(post(20))', 'return post(0).add(post(20)).add(post(40))')
const f3 = edit(f2, 'cad.box(4, 4, 20)', 'cad.box(4, 4, 35)')

const e1 = edit(errorsLesson.starter, 'cad.box(widht, 10, 5\n', 'cad.box(widht, 10, 5)\n')
const e2 = edit(e1, 'widht', 'width')
const e3 = edit(e2, '    box\n', '    return box\n')

const s1 = edit(firstShape.starter, "name: 'My first shape'", "name: 'Robot head'")
const s2 = edit(s1, "icon: '🧩'", "icon: '🤖'")

const HEIGHT_SETTING = "    height: { type: 'mm', default: 30, label: 'Height' },\n"
const WIDTH_SETTING = "    width: { type: 'mm', default: 20, label: 'Width' },\n"
const t2 = [
  (c: string) => edit(c, HEIGHT_SETTING, HEIGHT_SETTING + WIDTH_SETTING),
  (c: string) => edit(c, 'build({ height }, cad)', 'build({ height, width }, cad)'),
  (c: string) => edit(c, 'cad.box(20, 20, height)', 'cad.box(width, width, height)'),
].reduce((code, step) => step(code), settingsLesson.starter)
const t3 = edit(t2, WIDTH_SETTING, `${WIDTH_SETTING}    round: { type: 'yesno', default: false, label: 'Round' },\n`)

const c1 = edit(addCut.starter, '    return body\n', '    return body.cut(cad.cylinder(24, 40).move(0, 0, 3))\n')
const c2 = edit(c1, 'return body.cut(', 'return body.add(cad.box(6, 4, 24).move(18, 0, 8)).cut(')

const m1 = edit(moveTurn.starter, '    return bar\n', "    return bar.add(bar.rotate('z', 90))\n")
const m2 = edit(m1, "bar.add(bar.rotate('z', 90))", "bar.add(bar.rotate('z', 90)).move(0, 0, 10)")

const o1 = edit(outlines.starter, 'extrude(5)', 'extrude(12)')
const o2 = edit(o1, '[30, 0], [30, 10]', '[30, 0], [40, 5], [30, 10]')
const o3 = edit(o2, 'extrude(12)', 'spin()')

const r1 = edit(repeatLesson.starter, 'body.add(tooth)', "body.add(cad.repeat(12, (i) => tooth.rotate('z', cad.angle(i, 12))))")
const r2 = edit(r1, 'cad.angle(i, 12))))\n', 'cad.angle(i, 12)))).cut(cad.cylinder(5, 8).move(0, 0, -1))\n')

/** What Kade could type to finish each checked step, by lesson id and step id. */
export const SOLUTIONS: Readonly<Record<string, Readonly<Record<string, Solution>>>> = {
  'code-numbers': { wider: { code: n1 }, taller: { code: n2 }, cylinder: { code: n3 } },
  'code-variables': { 'add-height': { code: v1 }, 'change-it': { code: v2 } },
  'code-functions': { 'second-post': { code: f1 }, 'third-post': { code: f2 }, taller: { code: f3 } },
  'code-errors': { bracket: { code: e1 }, spelling: { code: e2 }, return: { code: e3 } },
  'code-first-shape': { name: { code: s1 }, icon: { code: s2 } },
  'code-settings': { 'try-it': { code: settingsLesson.starter, values: { height: 60 } }, 'add-width': { code: t2, values: { height: 60 } }, yesno: { code: t3, values: { height: 60 } } },
  'code-add-cut': { hollow: { code: c1 }, handle: { code: c2 } },
  'code-move-turn': { turn: { code: m1 }, lift: { code: m2 } },
  'code-outlines': { taller: { code: o1 }, point: { code: o2 }, spin: { code: o3 } },
  'code-repeat': { teeth: { code: r1 }, hole: { code: r2 } },
}
```

- [ ] **Step 2: Write the failing tests**

`src/kade/lessons/lessons.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { initTestOC } from '../../geometry/testing/oc-node'
import { CODE_LESSONS } from './index'
import { codeViewFor } from './testing/code-view'
import { SOLUTIONS, type Solution } from './testing/solutions'

beforeAll(initTestOC)

describe.each(CODE_LESSONS.map((lesson) => [lesson.id, lesson] as const))('coding lesson %s', (_id, lesson) => {
  it('has a solution for every checked step, and no step is done before its solution', async () => {
    let previous: Solution = { code: lesson.starter }
    for (const step of lesson.steps) {
      if (!step.check) continue
      const solution = SOLUTIONS[lesson.id]?.[step.id]
      if (!solution) throw new Error(`No solution for ${lesson.id} / ${step.id}`)
      expect(step.check(await codeViewFor(previous.code, previous.values)), `${step.id} before its solution`).toBe(false)
      expect(step.check(await codeViewFor(solution.code, solution.values)), `${step.id} after its solution`).toBe(true)
      previous = solution
    }
  })
})
```

`src/kade/lessons/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ALL_LESSONS } from '../../learn/all-lessons'
import { findSyntaxProblem } from '../syntax'
import { CODE_LESSONS } from './index'

describe('the coding lessons', () => {
  it('are the ten lessons in teaching order', () => {
    expect(CODE_LESSONS.map((l) => l.id)).toEqual([
      'code-numbers', 'code-variables', 'code-functions', 'code-errors', 'code-first-shape',
      'code-settings', 'code-add-cut', 'code-move-turn', 'code-outlines', 'code-repeat',
    ])
  })
  it('have ids that never clash with the design lessons', () => {
    const ids = ALL_LESSONS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('have two or three challenges each, short texts and a hint for every step', () => {
    for (const lesson of CODE_LESSONS) {
      const checked = lesson.steps.filter((s) => s.check)
      expect(checked.length, lesson.id).toBeGreaterThanOrEqual(2)
      expect(checked.length, lesson.id).toBeLessThanOrEqual(3)
      expect(new Set(lesson.steps.map((s) => s.id)).size).toBe(lesson.steps.length)
      for (const step of lesson.steps) {
        expect(step.text.length, `${lesson.id}/${step.id}`).toBeLessThanOrEqual(200)
        expect(step.hint.length, `${lesson.id}/${step.id}`).toBeGreaterThan(0)
        expect(step.text.split('**').length % 2, `${lesson.id}/${step.id} has unmatched **`).toBe(1)
      }
    }
  })
  it('start from code that parses, except the lesson about fixing mistakes', () => {
    for (const lesson of CODE_LESSONS) {
      expect(findSyntaxProblem(lesson.starter) === null, lesson.id).toBe(lesson.id !== 'code-errors')
    }
  })
})
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run src/kade/lessons`
Expected: FAIL. The lesson modules don't exist.

- [ ] **Step 4: Implement `src/kade/lessons/checks.ts`**

```ts
import type { CodeView } from '../code-view'

const TOLERANCE = 0.5

export const near = (value: number | undefined, target: number, tolerance = TOLERANCE): boolean =>
  value !== undefined && Math.abs(value - target) <= tolerance

const sizeOf = (view: CodeView, axis: 0 | 1 | 2): number | undefined =>
  view.bounds ? view.bounds.max[axis] - view.bounds.min[axis] : undefined

/** Left to right (x). */
export const widthOf = (view: CodeView): number | undefined => sizeOf(view, 0)
/** Front to back (y). */
export const depthOf = (view: CodeView): number | undefined => sizeOf(view, 1)
/** Bottom to top (z). */
export const heightOf = (view: CodeView): number | undefined => sizeOf(view, 2)
export const bottomOf = (view: CodeView): number | undefined => view.bounds?.min[2]

export const codeHas = (view: CodeView, pattern: RegExp): boolean => pattern.test(view.code)

export const settingType = (view: CodeView, name: string): string | undefined =>
  view.meta && Object.hasOwn(view.meta.params, name) ? view.meta.params[name]?.type : undefined
```

- [ ] **Step 5: Implement `src/kade/lessons/basics.ts` (lessons 1–5)**

```ts
import { codeHas, heightOf, near, widthOf } from './checks'
import type { CodeLesson } from './types'

export const numbers: CodeLesson = {
  id: 'code-numbers', title: 'Numbers', icon: '🔢',
  intro: 'Change the numbers in your code and watch the shape change.',
  starter: `export default {
  name: 'Numbers practice',
  icon: '🔢',
  build(settings, cad) {
    return cad.box(20, 10, 5)
  },
}
`,
  steps: [
    { id: 'wider', target: 'code-input', text: 'The code says **cad.box(20, 10, 5)**. The first number is the width. Change **20** to **40**.',
      hint: 'Click in the code box just after 20. Press Backspace twice, then type 40. The preview on the right changes when you stop typing.',
      check: (v) => v.built && near(widthOf(v), 40) },
    { id: 'taller', target: 'code-input', text: 'The last number is the height. Make the box taller than **20** mm.',
      hint: 'Change the 5 at the end to a bigger number, like 25.',
      check: (v) => v.built && (heightOf(v) ?? 0) > 20 },
    { id: 'cylinder', target: 'code-input', text: 'Swap **cad.box(…)** for **cad.cylinder(20, 30)**. A cylinder needs two numbers: how wide, and how tall.',
      hint: 'Replace everything from cad.box to its closing bracket with cad.cylinder(20, 30). Keep the word return in front.',
      check: (v) => v.built && codeHas(v, /cad\.cylinder\(/) && near(widthOf(v), 20) && near(heightOf(v), 30) },
  ],
}

export const variables: CodeLesson = {
  id: 'code-variables', title: 'Names for numbers', icon: '🏷️',
  intro: 'Give a number a name, then use the name.',
  starter: `export default {
  name: 'Names practice',
  icon: '🏷️',
  build(settings, cad) {
    const width = 30
    return cad.box(width, 10, 5)
  },
}
`,
  steps: [
    { id: 'add-height', target: 'code-input', text: 'Under the width line, add **const height = 25**. Then change the **5** in cad.box to **height**.',
      hint: 'Click at the end of the line const width = 30 and press Enter. Type const height = 25. Then swap the last number in cad.box for the word height.',
      check: (v) => v.built && codeHas(v, /const\s+height\s*=/) && near(heightOf(v), 25) },
    { id: 'change-it', target: 'code-input', text: 'Now change **25** to **40** on the height line. The box grows, because cad.box uses the name.',
      hint: 'Only change the number after const height =. Leave cad.box(width, 10, height) as it is.',
      check: (v) => v.built && codeHas(v, /const\s+height\s*=\s*40\b/) && near(heightOf(v), 40) },
    { id: 'why', text: 'A name keeps a number in one place. Change it once, and everything that uses the name changes too.',
      hint: "Names can use letters and numbers, like height or wall2. They can't have spaces." },
  ],
}

export const functionsLesson: CodeLesson = {
  id: 'code-functions', title: 'Doing it again', icon: '🔁',
  intro: 'Write a function once and use it again and again.',
  starter: `export default {
  name: 'Fence',
  icon: '🔁',
  build(settings, cad) {
    function post(x) {
      return cad.box(4, 4, 20).move(x, 0, 0)
    }
    return post(0)
  },
}
`,
  steps: [
    { id: 'second-post', target: 'code-input', text: 'A function is a recipe you can use again. Change the last line to **return post(0).add(post(20))**.',
      hint: 'post(20) makes a post 20 mm along. .add joins it to the first one.',
      check: (v) => v.built && near(widthOf(v), 24) },
    { id: 'third-post', target: 'code-input', text: 'Add a third post at **40**: put **.add(post(40))** on the end of that line.',
      hint: 'The line becomes return post(0).add(post(20)).add(post(40)).',
      check: (v) => v.built && near(widthOf(v), 44) },
    { id: 'taller', target: 'code-input', text: 'Inside the function, change the **20** in **cad.box(4, 4, 20)** to **35**. Every post grows at once.',
      hint: 'Only the recipe changes, and every post uses the recipe.',
      check: (v) => v.built && near(widthOf(v), 44) && near(heightOf(v), 35) },
  ],
}

export const errorsLesson: CodeLesson = {
  id: 'code-errors', title: 'Reading error messages', icon: '🔧',
  intro: 'Every coder makes mistakes. Error messages help you fix them.',
  starter: `export default {
  name: 'Fix me',
  icon: '🔧',
  build(settings, cad) {
    const width = 30
    const box = cad.box(widht, 10, 5
    box
  },
}
`,
  steps: [
    { id: 'bracket', target: 'code-problems', text: 'This code is broken. Read the message under the code box, then add the missing **)** at the end of the cad.box line.',
      hint: 'Click the message to jump to the line. The line should end with 5) and a closing bracket.',
      check: (v) => v.syntaxOk },
    { id: 'spelling', target: 'code-problems', text: "A new message! **widht** is a spelling mistake. Change it to **width**.",
      hint: 'Look on the cad.box line. Swap the h and the t.',
      check: (v) => v.syntaxOk && !codeHas(v, /widht/) },
    { id: 'return', target: 'code-problems', text: 'Last one. build has to **return** the part. Change the line **box** to **return box**.',
      hint: 'Type return and a space in front of box.',
      check: (v) => v.built },
  ],
}

export const firstShape: CodeLesson = {
  id: 'code-first-shape', title: 'Your first shape', icon: '🧩',
  intro: 'Make a shape of your own and put it in your design.',
  starter: `export default {
  name: 'My first shape',
  icon: '🧩',
  build(settings, cad) {
    return cad.box(20, 20, 20)
  },
}
`,
  steps: [
    { id: 'name', target: 'code-input', text: 'Give your shape its own name. Change **My first shape** to a name you like, such as **Robot head**.',
      hint: 'Keep the quote marks around the name.',
      check: (v) => v.meta !== null && !v.meta.name.startsWith('My first shape') },
    { id: 'icon', target: 'code-input', text: 'Now pick an icon. Change **🧩** to another emoji, like **🤖**.',
      hint: 'On a Mac, press Ctrl+Cmd+Space for emoji. On Windows, press the Windows key and the full stop together.',
      check: (v) => v.meta !== null && v.meta.icon !== '🧩' },
    { id: 'add', target: 'add-to-design', text: 'Click **➕ Add to my design**. Your shape joins your design. Find it again under **My shapes** on the left.',
      hint: 'The button is under the preview, on the right.' },
  ],
}
```

- [ ] **Step 6: Implement `src/kade/lessons/shapes.ts` (lessons 6–10)**

```ts
import { bottomOf, codeHas, depthOf, heightOf, near, settingType, widthOf } from './checks'
import type { CodeLesson } from './types'

export const settingsLesson: CodeLesson = {
  id: 'code-settings', title: 'Settings', icon: '🎛️',
  intro: 'Turn numbers into settings you can change, just like in Properties.',
  starter: `export default {
  name: 'Tower',
  icon: '🗼',
  settings: {
    height: { type: 'mm', default: 30, label: 'Height' },
  },
  build({ height }, cad) {
    return cad.box(20, 20, height)
  },
}
`,
  steps: [
    { id: 'try-it', target: 'param-height', text: 'Your shape has a **Height** setting. Change it to **60** under the preview, and press Enter.',
      hint: 'Settings show under the preview on the right, like the sizes in Properties.',
      check: (v) => v.built && near(heightOf(v), 60) },
    { id: 'add-width', target: 'code-input', text: "Add a second setting under height: **width: { type: 'mm', default: 20, label: 'Width' },** Then use **width** in cad.box.",
      hint: 'Add width to build({ height, width }), then use cad.box(width, width, height).',
      check: (v) => v.built && settingType(v, 'width') === 'mm' },
    { id: 'yesno', target: 'code-input', text: "Add a tick box: **round: { type: 'yesno', default: false, label: 'Round' },** It gives build true or false.",
      hint: 'To use it, add round to build({ … }) and put if (round) { return cad.cylinder(width, height) } before the last return.',
      check: (v) => v.built && settingType(v, 'round') === 'yesno' },
  ],
}

export const addCut: CodeLesson = {
  id: 'code-add-cut', title: 'Add and cut', icon: '☕',
  intro: 'Stick parts together with add, and drill holes with cut.',
  starter: `export default {
  name: 'Cup',
  icon: '☕',
  build(settings, cad) {
    const body = cad.cylinder(30, 40)
    return body
  },
}
`,
  steps: [
    { id: 'hollow', target: 'code-input', text: 'Make it a cup. Change the last line to **return body.cut(cad.cylinder(24, 40).move(0, 0, 3))**. That drills out the inside but leaves a floor.',
      hint: '.cut takes the second part away from the first. The move lifts the drill 3 mm, so the cup keeps its floor.',
      check: (v) => v.built && codeHas(v, /\.cut\(/) && near(heightOf(v), 40) },
    { id: 'handle', target: 'code-input', text: 'Add a handle: put **.add(cad.box(6, 4, 24).move(18, 0, 8))** after **body** and before **.cut**.',
      hint: 'The line becomes return body.add(cad.box(6, 4, 24).move(18, 0, 8)).cut(…).',
      check: (v) => v.built && codeHas(v, /\.add\(/) && (widthOf(v) ?? 0) >= 35 },
    { id: 'three-ways', text: '**add** joins parts, **cut** takes one away, and **overlap** keeps only the space they share.',
      hint: 'You can look them up in **❓ Commands** any time.' },
  ],
}

export const moveTurn: CodeLesson = {
  id: 'code-move-turn', title: 'Move and turn', icon: '🔀',
  intro: 'Put parts exactly where you want them with move and rotate.',
  starter: `export default {
  name: 'Plus sign',
  icon: '➕',
  build(settings, cad) {
    const bar = cad.box(40, 8, 4)
    return bar
  },
}
`,
  steps: [
    { id: 'turn', target: 'code-input', text: "Make a plus sign. Change the last line to **return bar.add(bar.rotate('z', 90))**. The copy turns 90° around the up line.",
      hint: "rotate needs the line to turn around ('z' is up) and how far to turn, in degrees.",
      check: (v) => v.built && near(widthOf(v), 40) && near(depthOf(v), 40) },
    { id: 'lift', target: 'code-input', text: 'Lift the whole sign **10** mm off the ground: add **.move(0, 0, 10)** to the end of that line.',
      hint: 'move takes three numbers: left and right, front and back, and up.',
      check: (v) => v.built && near(bottomOf(v), 10) },
  ],
}

export const outlines: CodeLesson = {
  id: 'code-outlines', title: 'Outlines', icon: '✏️',
  intro: 'Draw a flat shape with polygon, then push it up or spin it round.',
  starter: `export default {
  name: 'Arrow',
  icon: '✏️',
  build(settings, cad) {
    const outline = cad.polygon([[0, 0], [30, 0], [30, 10], [0, 10]])
    return outline.extrude(5)
  },
}
`,
  steps: [
    { id: 'taller', target: 'code-input', text: 'An outline is flat, and **extrude** pushes it up. Change **extrude(5)** to **extrude(12)**.',
      hint: 'Change only the number inside extrude( ).',
      check: (v) => v.built && near(heightOf(v), 12) },
    { id: 'point', target: 'code-input', text: 'Make an arrow tip: put **[40, 5],** between **[30, 0],** and **[30, 10]**.',
      hint: 'Each [x, y] is a corner. The new corner sticks out to x = 40.',
      check: (v) => v.built && near(widthOf(v), 40) },
    { id: 'spin', target: 'code-input', text: 'Now change **extrude(12)** to **spin()**. The outline spins round the middle line, like clay on a potter’s wheel.',
      hint: 'spin turns the outline all the way round the up line, so the shape becomes twice as wide.',
      check: (v) => v.built && codeHas(v, /\.spin\(\)/) && near(widthOf(v), 80) },
  ],
}

export const repeatLesson: CodeLesson = {
  id: 'code-repeat', title: 'Repeat', icon: '⚙️',
  intro: "Use cad.repeat to give a gear all its teeth.",
  starter: `export default {
  name: 'Gear',
  icon: '⚙️',
  build(settings, cad) {
    const body = cad.cylinder(32, 6)
    const tooth = cad.box(8, 5, 6).move(16, 0, 0)
    return body.add(tooth)
  },
}
`,
  steps: [
    { id: 'teeth', target: 'code-input', text: "One tooth is lonely. Change **body.add(tooth)** to **body.add(cad.repeat(12, (i) => tooth.rotate('z', cad.angle(i, 12))))**.",
      hint: 'cad.repeat makes 12 teeth. Each one turns by cad.angle(i, 12): 0°, then 30°, then 60°, and so on.',
      check: (v) => v.built && codeHas(v, /cad\.repeat\(/) && near(depthOf(v), 40, 1) },
    { id: 'hole', target: 'code-input', text: 'Drill a hole for an axle: add **.cut(cad.cylinder(5, 8).move(0, 0, -1))** to the end of the return line.',
      hint: 'The drill is a little taller than the gear and starts below it, so it goes all the way through.',
      check: (v) => v.built && codeHas(v, /\.cut\(/) },
    { id: 'done', target: 'tab-commands', text: 'You made a gear! Open **❓ Commands** and find **⚙️ Gear**. It has settings for teeth, size and hole.',
      hint: '**Use as a starting point** copies it into your shapes, so you can change it.' },
  ],
}
```

- [ ] **Step 7: Implement the lists**

`src/kade/lessons/index.ts`:

```ts
import { errorsLesson, firstShape, functionsLesson, numbers, variables } from './basics'
import { addCut, moveTurn, outlines, repeatLesson, settingsLesson } from './shapes'
import type { CodeLesson } from './types'

/** In teaching order. */
export const CODE_LESSONS: readonly CodeLesson[] = [
  numbers, variables, functionsLesson, errorsLesson, firstShape, settingsLesson, addCut, moveTurn, outlines, repeatLesson,
]
```

`src/learn/all-lessons.ts`:

```ts
import { CODE_LESSONS } from '../kade/lessons'
import { TUTORIALS } from './tutorials'
import type { AnyTutorial } from './types'

/** Every lesson, so progress and ✓ marks are kept for design lessons and coding lessons alike. */
export const ALL_LESSONS: readonly AnyTutorial[] = [...TUTORIALS, ...CODE_LESSONS]
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run src/kade/lessons`
Expected: PASS.

If a check fails "after its solution", print the view in the failing case, for example `console.error(await codeViewFor(solution.code))` in a scratch run. Then fix the **check or the solution**, not the test loop. The `near` tolerance is 0.5 mm. Rotated parts can come out a little bigger, which is why the gear's depth check allows 1 mm.

- [ ] **Step 9: Commit**

```bash
git add src/kade/lessons src/learn/all-lessons.ts
git commit -m "feat: add the ten coding lessons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 18: The My shapes screen

This task puts the pieces together into one screen:
- **Left:** the library and the **📘 Lessons** / **❓ Commands** tabs.
- **Centre:** the code box and its problem.
- **Right:** the preview with **➕ Add to my design**.

**Files:**
- Create: `src/ui/MyShapesScreen.tsx`
- Modify: `src/ui/App.css`, `src/app/testing/fakes.ts` (a client that builds)
- Test: `src/ui/MyShapesScreen.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 11–17.
- Produces:
  - `MyShapesScreen({ editor, lessons, catalog, base, client, helpMode, onHelpMode, onBack, onAdd })`.
    - New test ids: `back-to-design`, `tab-lessons`, `tab-commands`.
    - Headings with `data-help`: `panel-code`, plus `panel-library` and `panel-preview` from Task 15.
  - In `src/app/testing/fakes.ts`: `buildingGeometryApi()`, which builds every top-level part as a 20 mm box, and `clientFor(api)`.

- [ ] **Step 1: Add the test helpers to `src/app/testing/fakes.ts`**

```ts
/** A geometry api that builds every top-level part as a 20 mm box, so previews show and "it works" checks pass. */
export function buildingGeometryApi(): GeometryApi {
  return fakeGeometryApi({
    rebuild: async (doc) => ({ nodes: Object.fromEntries(doc.root.map((id) => [id, { status: 'ok' as const, mesh: boxMesh(20, 20, 20) }])) }),
  })
}

export const clientFor = (api: GeometryApi): GeometryClient => new GeometryClient(() => ({ api, terminate: () => undefined }))
```

(Import `boxMesh` from `./meshes`.)

- [ ] **Step 2: Write the failing test**

`src/ui/MyShapesScreen.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildingGeometryApi, clientFor, fakeInspect } from '../app/testing/fakes'
import { createShapeCatalog } from '../kade/catalog'
import { createEditorStore } from '../kade/editor-store'
import { createMemoryShapeLibrary } from '../kade/library'
import { createLessonStore } from '../learn/lesson-store'
import { ALL_LESSONS } from '../learn/all-lessons'
import { registry } from '../plugins/index'
import { MyShapesScreen } from './MyShapesScreen'

vi.mock('../viewport/Viewport', () => ({ Viewport: () => null }))

function setup() {
  const editor = createEditorStore(createMemoryShapeLibrary())
  const lessons = createLessonStore(null, ALL_LESSONS)
  const catalog = createShapeCatalog(async (code) => fakeInspect(code))
  const onBack = vi.fn()
  const onAdd = vi.fn()
  render(<MyShapesScreen editor={editor} lessons={lessons} catalog={catalog} base={registry} client={clientFor(buildingGeometryApi())}
    helpMode={false} onHelpMode={vi.fn()} onBack={onBack} onAdd={onAdd} />)
  return { editor, lessons, onBack, onAdd }
}

describe('MyShapesScreen', () => {
  it('makes a new shape, shows that it works, and adds it to the design', async () => {
    const { editor, onAdd } = setup()
    await userEvent.click(screen.getByTestId('new-shape'))
    expect(screen.getByTestId('code-input')).toHaveTextContent("name: 'My shape'")
    await screen.findByTestId('code-ok')
    await waitFor(() => expect(screen.getByTestId('add-to-design')).toBeEnabled())
    await userEvent.click(screen.getByTestId('add-to-design'))
    expect(onAdd).toHaveBeenCalledWith(editor.getState().selectedId)
  })
  it('shows the problem with broken code', async () => {
    const { editor } = setup()
    act(() => { editor.getState().create("export default { name: 'BROKEN' }") })
    expect(await screen.findByTestId('problem-0')).toHaveTextContent('this test shape is broken')
    expect(screen.getByTestId('add-to-design')).toBeDisabled()
  })
  it('lists the commands and copies the gear into my shapes', async () => {
    const { editor } = setup()
    await userEvent.click(screen.getByTestId('tab-commands'))
    await userEvent.click(screen.getByTestId('use-gear'))
    expect(editor.getState().shapes.map((s) => s.name)).toEqual(['Gear'])
  })
  it('starts a coding lesson', async () => {
    const { lessons } = setup()
    await userEvent.click(screen.getByTestId('code-lesson-start-code-numbers'))
    expect(lessons.getState().progress.active?.tutorialId).toBe('code-numbers')
    expect(await screen.findByTestId('lesson-step')).toHaveTextContent('Change 20 to 40')
  })
  it('goes back to the design', async () => {
    const { onBack } = setup()
    await userEvent.click(screen.getByTestId('back-to-design'))
    expect(onBack).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 3: Run the test to see it fail**

Run: `npx vitest run src/ui/MyShapesScreen.test.tsx`
Expected: FAIL. `MyShapesScreen` doesn't exist.

- [ ] **Step 4: Implement `src/ui/MyShapesScreen.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useStore } from 'zustand'
import type { GeometryClient } from '../geometry/client'
import type { ShapeCatalog } from '../kade/catalog'
import { createCodeViewSource, type CodeView } from '../kade/code-view'
import { currentCode, selectedShape, type EditorStore } from '../kade/editor-store'
import { GEAR_CODE } from '../kade/examples/gear'
import { CODE_LESSONS } from '../kade/lessons'
import { watchCodeSteps } from '../kade/lessons/watch-code-steps'
import type { LibraryShape } from '../kade/library'
import { useCodeView, usePreview } from '../kade/usePreview'
import { useShapeRegistry } from '../kade/useShapeRegistry'
import type { LessonStore } from '../learn/lesson-store'
import type { PluginRegistry } from '../plugins/registry'
import { CodeBox, type CodeJump } from './CodeBox'
import { CodeLessonsPanel } from './CodeLessonsPanel'
import { CommandsReference } from './CommandsReference'
import { LibraryList } from './LibraryList'
import { ProblemList } from './ProblemList'
import { ShapePreview } from './ShapePreview'

const NO_SHAPES: readonly LibraryShape[] = []

export interface MyShapesScreenProps {
  editor: EditorStore
  lessons: LessonStore
  catalog: ShapeCatalog
  /** Built-in shapes and plugins/ folder files. */
  base: PluginRegistry
  client: GeometryClient
  helpMode: boolean
  onHelpMode(): void
  onBack(): void
  onAdd(shapeId: string): void
}

function EditorHeader({ helpMode, onHelpMode, onBack }: Pick<MyShapesScreenProps, 'helpMode' | 'onHelpMode' | 'onBack'>) {
  return (
    <header className="toolbar">
      <span className="brand">BloKade</span>
      <button type="button" className="tool-button" data-testid="back-to-design" onClick={onBack}>⬅ Back to my design</button>
      <h1 className="editor-title">🧩 My shapes</h1>
      <button type="button" className="tool-button" data-testid="help-mode" data-help-toggle="" aria-pressed={helpMode}
        aria-label="Help mode" onClick={onHelpMode}>❓</button>
    </header>
  )
}

function EditorSidebar({ editor, lessons, view }: { editor: EditorStore; lessons: LessonStore; view: CodeView }) {
  const tab = useStore(editor, (s) => s.tab)
  const { setTab, create } = editor.getState()
  return (
    <aside className="left-panel">
      <LibraryList editor={editor} />
      <div className="editor-tabs" role="tablist" aria-label="Lessons and commands">
        <button type="button" role="tab" className="tool-button" data-testid="tab-lessons" aria-selected={tab === 'lessons'}
          onClick={() => setTab('lessons')}>📘 Lessons</button>
        <button type="button" role="tab" className="tool-button" data-testid="tab-commands" aria-selected={tab === 'commands'}
          onClick={() => setTab('commands')}>❓ Commands</button>
      </div>
      {tab === 'lessons'
        ? <div className="panel"><CodeLessonsPanel lessons={lessons} editor={editor} view={view} codeLessons={CODE_LESSONS} /></div>
        : <CommandsReference onUseGear={() => create(GEAR_CODE)} />}
    </aside>
  )
}

function CodePane({ editor, view }: { editor: EditorStore; view: CodeView }) {
  const shape = useStore(editor, (s) => selectedShape(s))
  const notice = useStore(editor, (s) => s.notice)
  const [jump, setJump] = useState<CodeJump | null>(null)
  const onJump = (line: number): void => setJump((last) => ({ line, nonce: (last?.nonce ?? 0) + 1 }))
  return (
    <main className="code-pane" aria-label="Code">
      <h2 className="code-heading" data-help="panel-code">{shape ? shape.name : 'Code'}</h2>
      {notice && (
        <p className="editor-notice" role="alert">
          {notice}
          <button type="button" className="icon-button" data-help="toast-dismiss" aria-label="Dismiss message"
            onClick={() => editor.getState().notify(null)}>✕</button>
        </p>
      )}
      {shape ? (
        <>
          <CodeBox docKey={shape.id} code={currentCode(editor.getState(), shape.id) ?? shape.code}
            onChange={(code) => editor.getState().setCode(shape.id, code)} jump={jump} />
          <ProblemList view={view} onJump={onJump} />
        </>
      ) : (
        <p className="hint">Press <strong>+ New shape</strong> to start, or try a lesson on the left.</p>
      )}
    </main>
  )
}

/** 🧩 My shapes: Kade's library and lessons on the left, the code in the middle, the live preview on the right. */
export function MyShapesScreen({ editor, lessons, catalog, base, client, helpMode, onHelpMode, onBack, onAdd }: MyShapesScreenProps) {
  const preview = usePreview(editor, client)
  const source = useMemo(
    () => createCodeViewSource({ editor, catalog, preview: preview.store, status: preview.status }),
    [editor, catalog, preview.store, preview.status],
  )
  const view = useCodeView(source)
  useEffect(() => watchCodeSteps(lessons, source, CODE_LESSONS), [lessons, source])
  const carried = useStore(preview.store, (s) => s.history.present.plugins)
  const registry = useShapeRegistry({ base, catalog, library: NO_SHAPES, carried })
  const shapeId = view.shapeId
  const canAdd = shapeId !== null && view.built && registry.get(shapeId) !== undefined
  return (
    <div className="workspace my-shapes">
      <EditorHeader helpMode={helpMode} onHelpMode={onHelpMode} onBack={onBack} />
      <EditorSidebar editor={editor} lessons={lessons} view={view} />
      <CodePane editor={editor} view={view} />
      <aside className="right-panel">
        {shapeId && <ShapePreview store={preview.store} registry={registry} canAdd={canAdd} onAdd={() => onAdd(shapeId)} />}
      </aside>
    </div>
  )
}
```

- [ ] **Step 5: Add the styles to `src/ui/App.css`**

```css
.workspace.my-shapes { grid-template-columns: 300px 1fr 340px; }
.editor-title { margin: 0 auto 0 8px; font-size: 1.1rem; }
.code-pane { grid-area: viewport; display: flex; flex-direction: column; gap: 8px; min-height: 0; padding: 12px; background: var(--bg); }
.code-heading { margin: 0; font-size: 1rem; }
.code-box { flex: 1; min-height: 0; overflow: auto; border: 1px solid var(--border); border-radius: var(--radius); background: var(--panel); }
.code-box .cm-editor { height: 100%; font-size: 15px; }
.problem-list .problem {
  width: 100%; text-align: left; padding: 8px; border: 1px solid var(--danger); border-radius: 8px;
  background: #fff1f1; color: var(--danger); cursor: pointer; font: inherit;
}
.code-ok { margin: 0; color: #1a7f37; font-weight: 700; }
.editor-notice { display: flex; gap: 8px; align-items: center; margin: 0; padding: 8px; border-radius: 8px; background: #fff1f1; color: var(--danger); }
.shape-list { list-style: none; margin: 0 0 8px; padding: 0; display: grid; gap: 4px; }
.shape-item { width: 100%; text-align: left; padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); cursor: pointer; }
.shape-item[aria-pressed='true'] { border-color: var(--accent); background: #dceaff; }
.library-actions { display: flex; flex-wrap: wrap; gap: 4px; }
.confirm { margin-top: 8px; padding: 8px; border: 2px solid var(--danger); border-radius: 8px; }
.editor-tabs { display: flex; gap: 4px; padding: 0 12px; }
.editor-tabs [aria-selected='true'] { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.command-list { margin: 0; }
.command { margin-bottom: 8px; }
.command dt code { font-weight: 700; }
.command dd { margin: 2px 0 0; font-size: 0.9rem; }
.command-example { display: block; margin-top: 2px; padding: 2px 6px; border-radius: 4px; background: var(--bg); font-size: 0.8rem; white-space: pre-wrap; }
.gear-card { margin-top: 12px; padding: 8px; border: 1px solid var(--border); border-radius: var(--radius); }
.shape-preview { display: flex; flex-direction: column; gap: 8px; }
.preview-view { position: relative; height: 280px; border-radius: var(--radius); overflow: hidden; background: #e9eef7; }
.add-to-design { width: 100%; }
.newer-shapes {
  position: absolute; top: 64px; left: 50%; transform: translateX(-50%); z-index: 5;
  display: flex; gap: 8px; align-items: center; padding: 8px 12px; border-radius: var(--radius);
  background: #fff8db; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/ui && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ui/MyShapesScreen.tsx src/ui/MyShapesScreen.test.tsx src/ui/App.css src/app/testing/fakes.ts
git commit -m "feat: add the My shapes screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 19: Wiring My shapes into BloKade

This task connects My shapes to the rest of the app:
- **🧩 My shapes** in the top bar opens the editor. **⬅ Back to my design** settles typing first, then returns.
- Every panel uses the combined shape list, and the palette gets a **My shapes** section.
- A banner offers **Use my newest version**.
- Design shortcuts are off while the editor is open.
- The lesson store keeps progress for both kinds of lesson.

**Files:**
- Create: `src/app/useShapeSetup.ts`, `src/ui/NewerShapesBanner.tsx`
- Modify:
  - `src/kade/catalog.ts` (`namesFromChecks`)
  - `src/ui/Workspace.tsx`, `src/ui/Toolbar.tsx`, `src/ui/ShapePalette.tsx`
  - `src/app/testing/main-screen.tsx` (optional deps), `vite.config.ts` (coverage exclude)
- Test:
  - `src/kade/catalog.test.ts`, `src/ui/Workspace.my-shapes.test.tsx`
  - `src/ui/ShapePalette.test.tsx`, `src/ui/Toolbar.test.tsx`, `src/ui/NewerShapesBanner.test.tsx`

**Interfaces:**
- Consumes: Tasks 10–18.
- Produces:
  - `useShapeSetup(deps, store): ShapeSetup`, where `ShapeSetup = { editor; catalog; registry: ShapeRegistry; library; carriedCodeOf(id) }`.
  - `namesFromChecks(library, results): Record<id, name>`.
  - `Toolbar.onMyShapes?()`, which shows a `my-shapes` button.
  - `ShapePalette.mine?: readonly ShapePlugin[]`, which shows a **My shapes** section (`panel-my-shapes`).
  - `NewerShapesBanner({ library })`, with `newer-shapes` and `use-newest`.
  - `renderMainScreen(store, lessons?, deps?)`.

- [ ] **Step 1: Write the failing tests**

Add to `src/kade/catalog.test.ts`:

```ts
import { namesFromChecks } from './catalog'
import { codeHash } from './hash'

describe('namesFromChecks', () => {
  it("takes each library shape's name from its checked code", () => {
    const library = [
      { id: 'my-a', name: 'Old', code: 'a', updatedAt: 1 },
      { id: 'my-b', name: 'B', code: 'b', updatedAt: 1 },
      { id: 'my-c', name: 'C', code: 'c', updatedAt: 1 },
    ]
    const results = {
      [codeHash('a')]: { ok: true, meta: { name: 'Rocket', icon: '🚀', params: {} } },
      [codeHash('b')]: { ok: false, problem: 'x' },
    } as const
    expect(namesFromChecks(library, results)).toEqual({ 'my-a': 'Rocket' })
  })
})
```

(Merge these imports with the file's existing ones.)

`src/ui/NewerShapesBanner.test.tsx`:

```tsx
// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument } from '../document/factory'
import { createBloKadeStore } from '../store/store'
import { NewerShapesBanner } from './NewerShapesBanner'

describe('NewerShapesBanner', () => {
  it('offers the newest version and swaps it in as one undo step', async () => {
    const doc = { ...createEmptyDocument(), plugins: { 'my-gear': { name: 'Gear', code: 'v1' } } }
    const store = createBloKadeStore({ designId: 'd', doc })
    renderWithStore(<NewerShapesBanner library={[{ id: 'my-gear', name: 'Gear', code: 'v2', updatedAt: 2 }]} />, store)
    expect(screen.getByTestId('newer-shapes')).toHaveTextContent('Gear has a newer version in My shapes.')
    await userEvent.click(screen.getByTestId('use-newest'))
    expect(store.getState().history.present.plugins['my-gear']?.code).toBe('v2')
    expect(screen.queryByTestId('newer-shapes')).toBeNull()
    store.getState().undo()
    expect(store.getState().history.present).toBe(doc)
  })
  it('stays hidden when the design is up to date', () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    renderWithStore(<NewerShapesBanner library={[{ id: 'my-gear', name: 'Gear', code: 'v2', updatedAt: 2 }]} />, store)
    expect(screen.queryByTestId('newer-shapes')).toBeNull()
  })
})
```

Add to `src/ui/ShapePalette.test.tsx`:

```tsx
it("lists Kade's shapes in their own My shapes section", async () => {
  const mine = definePlugin({ id: 'my-gear', name: 'Gear', icon: '⚙️', version: 1, palette: 'fit', params: {}, build: () => { throw new Error('unused') } })
  const { registry: withMine } = createRegistry([...registry.list(), mine])
  const onAdd = vi.fn()
  render(<ShapePalette registry={withMine} mine={[mine]} kits={KITS} onAdd={onAdd} onAddKit={vi.fn()} />)
  const ids = (name: string) => within(screen.getByRole('region', { name })).getAllByRole('button').map((b) => b.dataset.testid)
  expect(ids('My shapes')).toEqual(['add-my-gear'])
  expect(ids('Fit tools')).not.toContain('add-my-gear')
  await userEvent.click(screen.getByTestId('add-my-gear'))
  expect(onAdd).toHaveBeenCalledWith('my-gear')
})
it('says how to make shapes when there are none yet', () => {
  render(<ShapePalette registry={registry} mine={[]} kits={KITS} onAdd={vi.fn()} onAddKit={vi.fn()} />)
  expect(within(screen.getByRole('region', { name: 'My shapes' })).getByText(/Make your own/)).toBeInTheDocument()
})
```

Add to `src/ui/Toolbar.test.tsx`:
- Pass `onMyShapes` in `setup()`: create `const onMyShapes = vi.fn()`, add `onMyShapes={onMyShapes}` to the `<Toolbar>` props, and return it from `setup()`.
- Then add:

```tsx
it('opens My shapes', async () => {
  const { onMyShapes } = setup()
  await userEvent.click(screen.getByTestId('my-shapes'))
  expect(onMyShapes).toHaveBeenCalledOnce()
})
```

`src/ui/Workspace.my-shapes.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildingGeometryApi, clientFor, fakeDeps } from '../app/testing/fakes'
import { renderMainScreen, sampleStores } from '../app/testing/main-screen'
import { createEmptyDocument } from '../document/factory'
import { createMemoryShapeLibrary } from '../kade/library'
import { ALL_LESSONS } from '../learn/all-lessons'
import { createLessonStore } from '../learn/lesson-store'
import { createBloKadeStore } from '../store/store'

vi.mock('../viewport/Viewport', () => ({ Viewport: () => null }))
afterEach(cleanup)

const buildingDeps = (shapes = createMemoryShapeLibrary()) => fakeDeps({ client: clientFor(buildingGeometryApi()), shapes })

describe('My shapes in the app', () => {
  it('keeps design shortcuts away from the code box (Review Focus 2)', async () => {
    const store = sampleStores()[0]!
    renderMainScreen(store, createLessonStore(null, ALL_LESSONS), buildingDeps())
    await userEvent.click(screen.getByTestId('my-shapes'))
    await userEvent.click(screen.getByTestId('new-shape'))
    const input = screen.getByTestId('code-input')
    const before = store.getState()
    for (const key of [{ key: 'Delete' }, { key: 'Backspace' }, { key: 'z', ctrlKey: true }, { key: 'd', ctrlKey: true }, { key: 'h' }, { key: 'Escape' }]) {
      fireEvent.keyDown(input, key)
      fireEvent.keyDown(window, key)
    }
    expect(store.getState().history.present).toBe(before.history.present)
    expect(store.getState().selection).toEqual(before.selection)
  })
  it('opens My shapes and goes back to the same design', async () => {
    const store = sampleStores()[0]!
    renderMainScreen(store, undefined, buildingDeps())
    const before = store.getState().history.present
    await userEvent.click(screen.getByTestId('my-shapes'))
    expect(screen.queryByTestId('viewport')).toBeNull()
    await userEvent.click(screen.getByTestId('back-to-design'))
    expect(await screen.findByTestId('viewport')).toBeInTheDocument()
    expect(store.getState().history.present).toBe(before)
  })
  it('adds a new shape to the design, carrying its code', async () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    renderMainScreen(store, undefined, buildingDeps())
    await userEvent.click(screen.getByTestId('my-shapes'))
    await userEvent.click(screen.getByTestId('new-shape'))
    await waitFor(() => expect(screen.getByTestId('add-to-design')).toBeEnabled())
    await userEvent.click(screen.getByTestId('add-to-design'))
    await waitFor(() => expect(Object.keys(store.getState().history.present.plugins)).toHaveLength(1))
    const [id] = Object.keys(store.getState().history.present.plugins)
    expect(Object.values(store.getState().history.present.nodes)[0]).toMatchObject({ shapeType: id })
    expect(await screen.findByTestId(`add-${id}`)).toBeInTheDocument()
  })
  it('offers the newest version of a shape the design carries', async () => {
    const code = "export default { name: 'Gear' }"
    const shapes = createMemoryShapeLibrary([{ id: 'my-gear', name: 'Gear', code, updatedAt: 2 }])
    const store = createBloKadeStore({ designId: 'd', doc: { ...createEmptyDocument(), plugins: { 'my-gear': { name: 'Gear', code: 'older' } } } })
    renderMainScreen(store, undefined, buildingDeps(shapes))
    await userEvent.click(await screen.findByTestId('use-newest'))
    expect(store.getState().history.present.plugins['my-gear']?.code).toBe(code)
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/kade/catalog.test.ts src/ui`
Expected: FAIL. There is no `namesFromChecks`, `NewerShapesBanner`, `mine` section or `my-shapes` button.

- [ ] **Step 3: Add `namesFromChecks` to `src/kade/catalog.ts`**

```ts
/** The name in each library shape's checked code, by shape id. Shapes not checked yet, or broken, are left out. */
export function namesFromChecks(library: readonly LibraryShape[], results: CatalogState['results']): Record<string, string> {
  return Object.fromEntries(library.flatMap((shape) => {
    const result = resultFor(results, shape.code)
    return result?.ok ? [[shape.id, result.meta.name]] : []
  }))
}
```

(Import `type LibraryShape` from `./library`.)

- [ ] **Step 4: Create `src/app/useShapeSetup.ts`**

```ts
import { useCallback, useEffect, useState } from 'react'
import { useStore } from 'zustand'
import type { CarriedShape } from '../document/types'
import { createShapeCatalog, namesFromChecks, type ShapeCatalog } from '../kade/catalog'
import { createEditorStore, type EditorStore } from '../kade/editor-store'
import type { LibraryShape } from '../kade/library'
import type { ShapeRegistry } from '../kade/shape-registry'
import { useShapeRegistry } from '../kade/useShapeRegistry'
import type { BloKadeStore } from '../store/store'
import type { AppDeps } from './deps'

export interface ShapeSetup {
  readonly editor: EditorStore
  readonly catalog: ShapeCatalog
  /** Built-ins, the plugins/ folder, Kade's library and the open design's carried shapes. */
  readonly registry: ShapeRegistry
  readonly library: readonly LibraryShape[]
  /** The code to copy into a design when Kade adds one of their shapes. */
  carriedCodeOf(id: string): CarriedShape | undefined
}

/** Kade's shapes for the whole app: the library, the worker's answers about the code, and the combined shape list. */
export function useShapeSetup(deps: AppDeps, store: BloKadeStore): ShapeSetup {
  const [editor] = useState(() => createEditorStore(deps.shapes))
  const [catalog] = useState(() => createShapeCatalog((code) => deps.client.inspect(code)))
  useEffect(() => {
    void editor.getState().load()
  }, [editor])
  const library = useStore(editor, (s) => s.shapes)
  const carried = useStore(store, (s) => s.history.present.plugins)
  const registry = useShapeRegistry({ base: deps.registry, catalog, library, carried })
  const results = useStore(catalog, (s) => s.results)
  useEffect(() => {
    editor.getState().syncNames(namesFromChecks(library, results))
  }, [editor, library, results])
  const carriedCodeOf = useCallback((id: string): CarriedShape | undefined => {
    const shape = library.find((s) => s.id === id)
    return shape ? { name: shape.name, code: shape.code } : undefined
  }, [library])
  return { editor, catalog, registry, library, carriedCodeOf }
}
```

In `vite.config.ts`'s `coverage.exclude`, add `'src/app/useShapeSetup.ts'` next to the other hook files.

- [ ] **Step 5: Create `src/ui/NewerShapesBanner.tsx`**

```tsx
import { useMemo } from 'react'
import { outdatedShapes, withNewestVersions } from '../kade/carried'
import type { LibraryShape } from '../kade/library'
import { useBloKade } from '../store/context'

/** Shown when Kade changed one of their shapes after putting it in this design. */
export function NewerShapesBanner({ library }: { library: readonly LibraryShape[] }) {
  const doc = useBloKade((s) => s.history.present)
  const apply = useBloKade((s) => s.apply)
  const outdated = useMemo(() => outdatedShapes(doc, library), [doc, library])
  if (outdated.length === 0) return null
  const names = outdated.map((s) => s.name).join(', ')
  const message = outdated.length === 1 ? `${names} has a newer version in My shapes.` : `${names} have newer versions in My shapes.`
  return (
    <div className="newer-shapes" role="status" data-testid="newer-shapes">
      <span>{message}</span>
      <button type="button" className="tool-button primary" data-testid="use-newest"
        onClick={() => apply((d) => withNewestVersions(d, library))}>Use my newest version</button>
    </div>
  )
}
```

- [ ] **Step 6: Add the toolbar button and the palette section**

`src/ui/Toolbar.tsx`:
- Add `onMyShapes?(): void` to `ToolbarProps`, and destructure it.
- In the Learn group, after the ❓ button, add:

```tsx
        {onMyShapes && <button type="button" className="tool-button" data-testid="my-shapes" onClick={onMyShapes}>🧩 My shapes</button>}
```

`src/ui/ShapePalette.tsx`:
- Add `mine?: readonly ShapePlugin[]` to the props.
- Leave Kade's shapes out of the Shapes and Fit tools grids:

```tsx
export function ShapePalette({ registry, kits, onAdd, onAddKit, mine }: ShapePaletteProps) {
  const mineIds = new Set((mine ?? []).map((p) => p.id))
  const plugins = registry.list().filter((p) => !mineIds.has(p.id))
```

- Add after the Fit tools section:

```tsx
      {mine && (
        <section className="panel" aria-label="My shapes">
          <h2 data-help="panel-my-shapes">My shapes</h2>
          {mine.length > 0
            ? <div className="palette-grid">{mine.map(pluginButton)}</div>
            : <p className="hint">Make your own with <strong>🧩 My shapes</strong> at the top.</p>}
        </section>
      )}
```

- [ ] **Step 7: Rewire `src/ui/Workspace.tsx`**

Replace the file with:

```tsx
import { useCallback, useMemo, useState } from 'react'
import { useStore } from 'zustand'
import { checkOverlap } from '../app/check-overlap'
import { createActions, type Actions } from '../app/actions'
import type { AppDeps } from '../app/deps'
import type { DesignSession } from '../app/design-session'
import { exportDesign, type ExportFormat } from '../app/export'
import { useShortcuts } from '../app/shortcuts'
import { useAutosave } from '../app/useAutosave'
import { useEdgeCandidates } from '../app/useEdgeCandidates'
import { useGeometrySync } from '../app/useGeometrySync'
import { useShapeSetup, type ShapeSetup } from '../app/useShapeSetup'
import { ALL_LESSONS } from '../learn/all-lessons'
import { createLessonStore, currentStepOf, type LessonStore } from '../learn/lesson-store'
import { browserStorage } from '../learn/progress'
import { startLesson } from '../learn/start-lesson'
import { TUTORIALS } from '../learn/tutorials'
import { useStepWatcher } from '../learn/watch-steps'
import { KITS } from '../plugins/kits'
import { useBloKadeStore } from '../store/context'
import type { BloKadeStore } from '../store/store'
import { Viewport } from '../viewport/Viewport'
import { DesignsDialog } from './DesignsDialog'
import { EmptyNudge } from './EmptyNudge'
import { HelpMode } from './HelpMode'
import { HelpTooltips } from './HelpTooltips'
import { LessonsPanel } from './LessonsPanel'
import { MyShapesScreen } from './MyShapesScreen'
import { NewerShapesBanner } from './NewerShapesBanner'
import { PropertiesPanel } from './PropertiesPanel'
import { SceneTree } from './SceneTree'
import { ShapePalette } from './ShapePalette'
import { Toasts } from './Toasts'
import { Toolbar } from './Toolbar'
import { VariablesPanel } from './VariablesPanel'

function useLessonTarget(store: BloKadeStore, lessons: LessonStore): string | null {
  const openDesignId = useStore(store, (s) => s.designId)
  return useStore(lessons, (s) => {
    const active = s.progress.active
    if (!s.panelOpen || !active || active.designId !== openDesignId) return null
    return currentStepOf(s.progress, TUTORIALS)?.target ?? null
  })
}

interface DesignPanesProps {
  deps: AppDeps
  store: BloKadeStore
  actions: Actions
  shapes: ShapeSetup
  lessons: LessonStore
  session: DesignSession
}

/** The design screen's left, middle and right panes. */
function DesignPanes({ deps, store, actions, shapes, lessons, session }: DesignPanesProps) {
  return (
    <>
      <aside className="left-panel">
        <ShapePalette registry={shapes.registry} mine={shapes.registry.mine()} kits={KITS} onAdd={actions.addShape} onAddKit={actions.addKit} />
        <SceneTree registry={shapes.registry} />
      </aside>
      <main className="viewport" data-testid="viewport">
        <Viewport registry={shapes.registry} onToggleEdge={actions.togglePickedEdge} />
        <EmptyNudge lessons={lessons} onStart={() => {
          const first = TUTORIALS[0]
          if (first) void startLesson(session, lessons, first)
        }} />
        <NewerShapesBanner library={shapes.library} />
      </main>
      <aside className="right-panel">
        <PropertiesPanel registry={shapes.registry} onCheckOverlap={() => void checkOverlap(store, deps.client)} />
        <VariablesPanel registry={shapes.registry} />
      </aside>
    </>
  )
}

export function Workspace({ deps, lessons: injected }: { deps: AppDeps; lessons?: LessonStore }) {
  const store = useBloKadeStore()
  const shapes = useShapeSetup(deps, store)
  const actions = useMemo(() => createActions(store, shapes.registry, shapes.carriedCodeOf), [store, shapes.registry, shapes.carriedCodeOf])
  const [showDesigns, setShowDesigns] = useState(false)
  useGeometrySync(store, deps.client)
  useEdgeCandidates(store, deps.client)
  const flushAutosave = useAutosave(store, deps.repo, deps.openTabChannel)
  const [lessons] = useState<LessonStore>(() => injected ?? createLessonStore(browserStorage(), ALL_LESSONS))
  const session = useMemo<DesignSession>(() => ({ repo: deps.repo, store, flushAutosave }), [deps.repo, store, flushAutosave])
  useStepWatcher(store, lessons)
  const lessonsOpen = useStore(lessons, (s) => s.panelOpen)
  const editorOpen = useStore(shapes.editor, (s) => s.open)
  const [helpMode, setHelpMode] = useState(false)
  const exitHelp = useCallback(() => setHelpMode(false), [])
  const lessonTarget = useLessonTarget(store, lessons)
  const learnMore = useCallback((tutorialId: string) => {
    setHelpMode(false)
    lessons.getState().openPanel(tutorialId)
  }, [lessons])
  // The code box is typing, not design editing: Delete or Ctrl+Z there must never change the design.
  useShortcuts(actions, !showDesigns && !helpMode && !editorOpen)
  const closeEditor = useCallback(async () => {
    await shapes.editor.getState().flush()
    shapes.editor.getState().setOpen(false)
  }, [shapes.editor])
  const onExport = (format: ExportFormat): void => void exportDesign({ client: deps.client, store, format })
  const help = (
    <>
      <Toasts />
      <HelpTooltips suppressKey={lessonTarget} disabled={helpMode} />
      <HelpMode active={helpMode} onExit={exitHelp} onLearnMore={learnMore} />
    </>
  )

  if (editorOpen) {
    return (
      <>
        <MyShapesScreen editor={shapes.editor} lessons={lessons} catalog={shapes.catalog} base={deps.registry} client={deps.client}
          helpMode={helpMode} onHelpMode={() => setHelpMode((on) => !on)} onBack={() => void closeEditor()}
          onAdd={(id) => void closeEditor().then(() => actions.addShape(id))} />
        {help}
      </>
    )
  }
  return (
    <div className={lessonsOpen ? 'workspace with-lessons' : 'workspace'}>
      <Toolbar actions={actions} onExport={onExport} onOpenDesigns={() => setShowDesigns(true)}
        learnOpen={lessonsOpen} onLearn={() => lessons.getState().togglePanel()}
        helpMode={helpMode} onHelpMode={() => setHelpMode((on) => !on)} onMyShapes={() => shapes.editor.getState().setOpen(true)} />
      <DesignPanes deps={deps} store={store} actions={actions} shapes={shapes} lessons={lessons} session={session} />
      {lessonsOpen && <LessonsPanel lessons={lessons} session={session} />}
      {showDesigns && <DesignsDialog repo={deps.repo} flushAutosave={flushAutosave} onClose={() => setShowDesigns(false)} />}
      {help}
    </div>
  )
}
```

`Workspace` is a little over 50 lines, because it wires the whole app together. Everything with logic lives in the hooks and components it calls.

- [ ] **Step 8: Let `renderMainScreen` take deps**

In `src/app/testing/main-screen.tsx`, change the signature to `renderMainScreen(store: BloKadeStore, lessons?: LessonStore, deps: AppDeps = fakeDeps())`, and pass `deps` to `Workspace`. Import `type AppDeps` from `../deps`.

- [ ] **Step 9: Run every test**

Run: `npm test && npm run typecheck`
Expected: PASS, including the Milestone 5 help-mode and help-coverage tests. The coverage test now finds the new `my-shapes` toolbar button without help, and the empty **My shapes** palette section. If so, that is expected: Task 20 adds their help, so the failure must be in `src/help/coverage.test.tsx` only. To keep this task's commit green, add these two entries to `HELP_TEXTS` now (Task 20 adds the rest):

```ts
  'my-shapes': { tip: 'Opens My shapes, where you write your own shapes in code.', card: 'My shapes is where you make shapes with code. Write a few lines, watch the preview, then add your shape to the design. The coding lessons start there too.' },
  'panel-my-shapes': { tip: 'Shapes you made yourself.', card: 'Every shape you write in 🧩 My shapes appears here. Click one to add it to your design.' },
```

- [ ] **Step 10: Commit**

```bash
git add src/app src/kade/catalog.ts src/kade/catalog.test.ts src/ui src/help/help-texts.ts vite.config.ts
git commit -m "feat: open My shapes from the top bar and use Kade's shapes in designs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 20: Help for everything in My shapes

Every new control gets a tooltip and a ❓ help card, written in Kade's words. A coverage test walks through My shapes in its different states.

**Files:**
- Modify: `src/help/help-texts.ts`, `src/help/help-patterns.ts`, `src/ui/ParamField.tsx` (`data-help` on tick boxes)
- Test: `src/help/coverage.test.tsx`, `src/help/lookup.test.ts`

**Interfaces:**
- Consumes: the test ids from Tasks 14–19.
- Produces:
  - Help entries for every new control.
  - Patterns: `shape-item-*`, `problem-<n>`, `code-lesson-start-*`.
  - A `param-yesno` help key on tick-box settings.

- [ ] **Step 1: Write the failing tests**

Add to `src/help/lookup.test.ts`, inside `describe('helpFor', …)`:

```ts
  it("has help for My shapes' families of controls", () => {
    expect(helpFor('shape-item-my-0123456789', 'Gear')?.tip).toBe('Opens Gear.')
    expect(helpFor('problem-0')).not.toBeNull()
    expect(helpFor('code-lesson-start-code-numbers', 'Start')).not.toBeNull()
    expect(helpFor('param-yesno')?.tip).toContain('Tick')
  })
```

Add to `src/help/coverage.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { buildingGeometryApi, clientFor, fakeDeps } from '../app/testing/fakes'
import { createMemoryShapeLibrary } from '../kade/library'
import { ALL_LESSONS } from '../learn/all-lessons'

/** Buttons and fields, plus the code box and every heading that has a help id. */
const MY_SHAPES_CONTROLS = 'button, input, select, textarea, [data-help], [data-testid="code-input"], [data-testid="code-box"]'

function missingHelpIn(selector: string): string[] {
  return [...document.querySelectorAll(selector)].flatMap((el) => {
    const found = helpKeyOf(el)
    const entry = found ? helpFor(found.key, found.label) : null
    return entry ? [] : [el.outerHTML.slice(0, 120)]
  })
}

describe('help coverage in My shapes', () => {
  it('has help for every control in My shapes, in all its states', async () => {
    const deps = fakeDeps({ client: clientFor(buildingGeometryApi()), shapes: createMemoryShapeLibrary() })
    renderMainScreen(sampleStores()[3]!, createLessonStore(null, ALL_LESSONS), deps)
    expect(missingHelpIn(MY_SHAPES_CONTROLS)).toEqual([])
    await userEvent.click(screen.getByTestId('my-shapes'))
    expect(missingHelpIn(MY_SHAPES_CONTROLS)).toEqual([])
    await userEvent.click(screen.getByTestId('new-shape'))
    await screen.findByTestId('code-ok')
    expect(missingHelpIn(MY_SHAPES_CONTROLS)).toEqual([])
    await userEvent.click(screen.getByTestId('delete-shape'))
    expect(missingHelpIn(MY_SHAPES_CONTROLS)).toEqual([])
    await userEvent.click(screen.getByTestId('delete-shape-no'))
    await userEvent.click(screen.getByTestId('code-lesson-start-code-numbers'))
    await screen.findByTestId('lesson-step')
    expect(missingHelpIn(MY_SHAPES_CONTROLS)).toEqual([])
    const other = screen.getAllByRole('button', { pressed: false }).find((b) => b.dataset.testid?.startsWith('shape-item-'))
    if (other) await userEvent.click(other)
    await screen.findByTestId('code-lesson-go-back')
    expect(missingHelpIn(MY_SHAPES_CONTROLS)).toEqual([])
    await userEvent.click(screen.getByTestId('tab-commands'))
    expect(missingHelpIn(MY_SHAPES_CONTROLS)).toEqual([])
  })
})
```

(Merge the imports with the file's existing ones.)

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/help`
Expected: FAIL. `missingHelpIn` lists the new controls (`back-to-design`, `new-shape`, `code-box`, and so on), and the new `helpFor` cases return null.

- [ ] **Step 3: Add the help texts**

In `src/help/help-texts.ts`:
- Add above `HELP_TEXTS`:

```ts
const CODE_BOX: HelpEntry = { tip: "Your shape's code. Type to change it.", card: 'This is where your shape is written. The colours help you read it. Your code is saved as you type, and the preview updates when you stop.' }
const NEWER_SHAPES: HelpEntry = { tip: 'Puts your newest code for this shape in the design.', card: 'You changed this shape after adding it to the design. This uses your newest version. Undo puts the old one back.' }
```

- Add these entries to `HELP_TEXTS`. `my-shapes` and `panel-my-shapes` are already there from Task 19.

```ts
  // My shapes
  'back-to-design': { tip: 'Goes back to your design. Your shapes are saved.', card: 'Back to my design shows your design again, just as you left it. Your shapes are saved as you type.' },
  'panel-library': { tip: 'All the shapes you have made.', card: 'Your shapes live in this browser. Click one to open its code. Save a shape to a file to keep a copy or move it to another computer.' },
  'new-shape': { tip: 'Starts a new shape from a simple box.', card: 'New shape makes a shape with a little code to start from: a box with a Size setting. Change the code to make it your own.' },
  'duplicate-shape': { tip: 'Makes a copy of this shape to try ideas on.', card: 'Duplicate copies the code into a new shape, so you can try things out and keep the first one safe.' },
  'delete-shape': { tip: 'Deletes this shape. It asks first.', card: 'Delete removes the shape from My shapes. Designs that already use it keep working, because they carry their own copy.' },
  'delete-shape-yes': { tip: 'Yes, delete this shape.', card: "This removes the shape from My shapes. It can't be undone, but designs that use it keep their copy." },
  'delete-shape-no': { tip: 'Keeps the shape.', card: 'Nothing is deleted.' },
  'save-shape-file': { tip: "Downloads this shape's code as a .js file.", card: 'Save to file keeps a copy of the code outside the browser. Load from file brings it back, on this computer or another one.' },
  'load-shape-file': { tip: 'Opens a shape from a .js file.', card: 'Load from file adds a shape from a .js file you saved before. It becomes a new shape in My shapes.' },
  'tab-lessons': { tip: 'Coding lessons, one small step at a time.', card: 'Ten short lessons teach coding with shapes, from changing numbers to making a gear. Each lesson makes its own practice shape.' },
  'tab-commands': { tip: 'Every cad command, with an example.', card: 'Commands lists everything cad can do, what each command does, and a tiny example you can copy.' },
  'use-gear': { tip: 'Copies the Gear into your shapes to change.', card: 'Use as a starting point makes a new shape from the Gear code. Change its numbers, or read it to see how it works.' },
  'panel-code': { tip: "Your shape's code.", card: 'Type your code here. BloKade saves it and updates the preview half a second after you stop typing.' },
  'code-box': CODE_BOX,
  'code-input': CODE_BOX,
  'code-problems': { tip: 'What needs fixing in your code.', card: 'When something is wrong, a message shows here. Click it to jump to the line it talks about.' },
  'code-ok': { tip: 'Your shape builds without problems.', card: 'Everything works! Try the settings under the preview, or add your shape to your design.' },
  'code-checking': { tip: 'BloKade is checking your code.', card: 'BloKade checks your code and builds the preview a moment after you stop typing.' },
  'panel-preview': { tip: 'Your shape in 3D.', card: 'The preview shows what your code makes. Try its settings below it. Nothing here changes your design.' },
  'preview-view': { tip: 'Your shape in 3D. Drag to spin it.', card: 'Drag to spin the preview, and scroll to zoom in and out.' },
  'add-to-design': { tip: 'Puts this shape in your design.', card: 'Add to my design goes back to your design and adds this shape. The design keeps a copy of the code, so it works anywhere.' },
  'newer-shapes': NEWER_SHAPES,
  'use-newest': NEWER_SHAPES,
  'code-lesson-go-back': { tip: "Opens this lesson's practice shape again.", card: 'Each coding lesson has its own practice shape. Go back opens it so you can keep going.' },
  'code-lesson-restart': { tip: 'Starts this lesson again with a new practice shape.', card: "The lesson's practice shape is gone, so this makes a fresh one." },
  'param-yesno': { tip: 'Tick or untick to switch this setting on or off.', card: 'A tick box is a yes-or-no setting. The shape changes as soon as you tick it.' },
```

`src/help/help-patterns.ts`: add these to the start of `HELP_PATTERNS`, so they are checked before `add-*`:

```ts
  { pattern: /^shape-item-.+$/, entry: (label) => ({ tip: `Opens ${label}.`, card: 'Click a shape to open its code and its preview.' }) },
  { pattern: /^problem-\d+$/, entry: () => ({ tip: 'Click to jump to the line with the problem.', card: 'The message says what is wrong and which line to look at. Click it and the code box jumps there.' }) },
  { pattern: /^code-lesson-start-.+$/, entry: () => ({ tip: 'Starts this coding lesson with its own practice shape.', card: 'Coding lessons make a practice shape, so your own shapes stay safe.' }) },
```

`src/ui/ParamField.tsx`: add `data-help="param-yesno"` to the tick-box `<input>`. It now has both `data-help` and `data-testid`, and help looks at `data-help` first.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/help src/ui/ParamField.test.tsx`
Expected: PASS.

If the coverage test still lists a control, add its entry to `HELP_TEXTS` in the same style. Examples are a Viewport-less element that renders in the preview, or the editor notice's ✕, which already uses `toast-dismiss`. Never weaken the test.

- [ ] **Step 5: Commit**

```bash
git add src/help src/ui/ParamField.tsx
git commit -m "feat: add help for everything in My shapes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 21: End-to-end tests, documentation and final verification

**Files:**
- Create: `e2e/my-shapes.spec.ts`
- Modify: `README.md`, `plugins/README.md`

- [ ] **Step 1: Write the end-to-end tests**

`e2e/my-shapes.spec.ts`:

```ts
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

const ROBOT = `export default {
  name: 'Robot head',
  icon: '🤖',
  settings: { size: { type: 'mm', default: 20, label: 'Size' } },
  build({ size }, cad) {
    return cad.box(size, size, size).cut(cad.cylinder(6, size + 2).move(0, 0, -1))
  },
}`

const numbersCode = (call: string) => `export default {
  name: 'Numbers practice',
  icon: '🔢',
  build(settings, cad) {
    return ${call}
  },
}`

async function openMyShapes(page: Page) {
  await page.goto('/')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
  await page.getByTestId('my-shapes').click()
}

/** Replaces all the code. insertText avoids CodeMirror adding closing brackets as it would for typed keys. */
async function replaceCode(page: Page, code: string) {
  await page.getByTestId('code-input').click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Delete')
  await page.keyboard.insertText(code)
}

async function writeRobot(page: Page) {
  await page.getByTestId('new-shape').click()
  await replaceCode(page, ROBOT)
  await expect(page.getByTestId('code-ok')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Robot head' })).toBeVisible()
}

async function exportStlTriangles(page: Page): Promise<number> {
  const downloading = page.waitForEvent('download')
  await page.getByTestId('export-stl').click()
  const bytes = await readFile(await (await downloading).path())
  return bytes.readUInt32LE(80)
}

test('Kade writes a shape, tries a setting, adds it to a design and exports it', async ({ page }) => {
  await openMyShapes(page)
  await writeRobot(page)
  await page.getByTestId('param-size').fill('30')
  await page.getByTestId('param-size').press('Enter')
  await expect(page.getByTestId('code-ok')).toBeVisible()
  await page.getByTestId('add-to-design').click()
  await expect(page.getByRole('treeitem', { name: 'Robot head' })).toBeVisible()
  await expect(page.locator('[data-testid^="add-my-"]')).toHaveCount(1)
  expect(await exportStlTriangles(page)).toBeGreaterThan(12)
})

test('a design file carrying a shape builds in a fresh browser profile', async ({ page, browser }) => {
  await openMyShapes(page)
  await writeRobot(page)
  await page.getByTestId('add-to-design').click()
  await expect(page.getByRole('treeitem', { name: 'Robot head' })).toBeVisible()
  await page.getByTestId('open-designs').click()
  const saving = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save to file' }).click()
  const designFile = await (await saving).path()

  const fresh = await browser.newContext()
  const other = await fresh.newPage()
  await other.goto('/')
  await expect(other.getByText('Warming up the geometry engine…')).toBeHidden()
  await other.getByTestId('open-designs').click()
  await other.getByTestId('load-file').setInputFiles(designFile)
  await expect(other.getByRole('treeitem', { name: 'Robot head' })).toBeVisible()
  expect(await exportStlTriangles(other)).toBeGreaterThan(12)
  await fresh.close()
})

test('Kade finishes coding lesson 1', async ({ page }) => {
  await openMyShapes(page)
  await page.getByTestId('tab-lessons').click()
  await page.getByTestId('code-lesson-start-code-numbers').click()
  const step = page.getByTestId('lesson-step')
  await expect(step).toContainText('Change 20 to 40')
  await replaceCode(page, numbersCode('cad.box(40, 10, 5)'))
  await expect(step).toContainText('taller than 20')
  await replaceCode(page, numbersCode('cad.box(40, 10, 25)'))
  await expect(step).toContainText('cad.cylinder(20, 30)')
  await replaceCode(page, numbersCode('cad.cylinder(20, 30)'))
  await expect(page.getByTestId('lesson-finished')).toBeVisible()
})
```

Loading a design file saves it as a new design and opens it (`DesignsDialog.tsx`, `loadFile`). The second browser context has empty storage, which is the "fresh profile".

- [ ] **Step 2: Run the end-to-end tests**

Run: `npx playwright install chromium && npm run e2e -- my-shapes`
Expected: PASS (3 tests).

If a test times out at `code-ok`, open the trace (`npx playwright show-trace test-results/…/trace.zip`) and read the problem under the code box. The blob import must work under the Vite dev server. If the console says the worker could not import a `blob:` URL, recheck the `/* @vite-ignore */` comment in `src/kade/blob-loader.ts`.

- [ ] **Step 3: Update `README.md`**

- In **Learning BloKade**, add after the first bullet:

```markdown
- **Coding lessons:** open **🧩 My shapes**, then **📘 Lessons**. Ten short lessons teach coding with shapes, from
  changing a number to building a gear. Each lesson makes its own practice shape.
```

- Add a section after **Perfect fit**:

````markdown
### My shapes (shapes you write in code)

**🧩 My shapes** (top bar) opens the shape editor. **⬅ Back to my design** returns, with the design unchanged.

- **Left:** your shapes, with **+ New shape**, **Duplicate**, **Delete**, **💾 Save to file** and **📂 Load from file**.
  Below them are **📘 Lessons** and **❓ Commands** (every `cad` command with an example, plus a ready-made ⚙️ Gear).
- **Middle:** the code. It saves as you type. If something is wrong, the message under it says which line to look at;
  click the message to jump there.
- **Right:** a live preview, updated half a second after you stop typing, with the shape's settings to try.
  **➕ Add to my design** puts the shape in your design.

A shape is a file like this:

```js
export default {
  name: 'Robot head',
  icon: '🤖',
  settings: { size: { type: 'mm', default: 20, label: 'Size' } },
  build({ size }, cad) {
    return cad.box(size, size, size).cut(cad.cylinder(6, size + 2).move(0, 0, -1))
  },
}
```

Setting types are `mm`, `whole`, `number`, `angle`, `text`, `choice` and `yesno` (a tick box).

Designs carry the code of every shape they use, so a design file works on any computer. When you change a shape
after adding it, the design offers **Use my newest version** (one undo step). Your shapes are kept in this browser,
separate from your designs: use **💾 Save to file** to keep a copy.

Kade's code runs only inside the geometry engine's worker, never on the page. A shape that never finishes building
(an endless loop) is stopped after 30 seconds and shows "This shape took too long to build".
````

- In **How it's built**, add: ``- `src/kade`: Kade's own shapes: the friendly `cad` toolkit, the code checks, the shape library, the editor and the coding lessons``.
- Replace the last section, **Making your own shapes**, with:

```markdown
## Shape files in the plugins/ folder

Most shapes are made in **🧩 My shapes**. Shape files can also live in the `plugins/` folder, where they are built into
the app for everyone. See [`plugins/README.md`](plugins/README.md).
```

- [ ] **Step 4: Rewrite `plugins/README.md`**

````markdown
# Shape files

The easiest way to make a shape is **🧩 My shapes** in BloKade itself. Files in this folder are for shapes that should
be built into the app for everyone who uses it.

Every `.js` or `.ts` file here that `export default`s a shape shows up in BloKade's palette. A file looks exactly
like a shape in My shapes:

```js
export default {
  name: 'Robot head',
  icon: '🤖',
  settings: {
    size: { type: 'mm', default: 20, label: 'Size' },
  },
  size: { x: 'size', y: 'size', z: 'size' },
  build({ size }, cad) {
    return cad.box(size, size, size).cut(cad.cylinder(6, size + 2).move(0, 0, -1))
  },
}
```

- The shape's id comes from the file name (`robot-head.js` is `robot-head`). Add `id: 'robot'` to choose one, and
  `version: 2` when a change should rebuild designs that use it. Built-in ids like `box` or `peg` are taken.
- `settings` (or `params`) can be `mm`, `whole`, `number`, `angle`, `text` (one line, up to 40 letters),
  `choice` (`options: ['round', 'square']`) or `yesno` (a tick box: `build` gets `true` or `false`).
  `label` is optional. `min` and `max` work on number settings, and `formula: 'fit'` starts a number as the
  design's fit gap.
- `size` says which number settings the x, y and z size handles change.
- `mode: 'hole'` makes new parts start as holes. `palette: 'fit'` lists the shape under Fit tools.
- `build` gets the settings and the friendly `cad` toolkit. Every command makes a new part and never changes the
  old one. Open **❓ Commands** in My shapes for the full list with examples:
  - parts: `box`, `cylinder`, `sphere`, `cone`, `ring`, `wedge`, `text`
  - outlines: `rect`, `circle`, `polygon`, then `.extrude(height)` or `.spin()`
  - steps: `.move`, `.rotate`, `.add`, `.cut`, `.overlap`, `.mirror`, `.copy`
  - helpers: `cad.repeat`, `cad.angle`, `cad.sin`, `cad.cos`

If a file has a problem, BloKade shows a message when it starts and leaves that shape out.
````

- [ ] **Step 5: Run the full verification**

Run each, in order:

```bash
npm run typecheck
npm test
npm run coverage
npm run build
npm run e2e
```

Expected:
- No type errors.
- All unit tests pass.
- Coverage is at or above the 80% lines, 80% statements, 80% functions and 75% branches thresholds.
- The build succeeds.
- Every end-to-end test passes. That includes Milestones 1–5's tests, which still run unchanged.

If coverage drops below a threshold, look at the `src/kade/**` report rows first. Add tests for the missing branches; do not add files to the coverage `exclude` list, except the hook files already named in Tasks 11 and 19.

- [ ] **Step 6: Commit**

```bash
git add e2e/my-shapes.spec.ts README.md plugins/README.md
git commit -m "docs: explain My shapes and test it end to end

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
