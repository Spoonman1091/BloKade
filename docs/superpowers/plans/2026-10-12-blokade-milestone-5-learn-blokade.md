# BloKade Milestone 5 ("Learn BloKade") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kade can learn BloKade on their own, with Larry nearby. There are nine guided tutorials that tick themselves off, a short tooltip on every control, a ❓ help mode, and a nudge for empty designs.

**Architecture:**
- **Tutorials are plain data** (`src/learn/tutorials/*.ts`). A tutorial step names a control by its `data-testid` and has a pure `check(view)`, which reads the design, selection, tool, workplane and design id from the existing store.
- **A small separate Zustand store** (`src/learn/lesson-store.ts`) holds the open panel, the active lesson and ✓ progress. Progress is saved to `localStorage`, wrapped so failures never break the app.
- **A watcher** moves to the next step when a design change makes the current step's check turn true.
- **Help texts** live in one map keyed by `data-testid` (or a `data-help` id), plus patterns for families like `add-*` and `param-*`.
- **Tooltips and help mode** are document-level listeners that look up the nearest `[data-help]`/`[data-testid]`.
- **Unchanged:** the geometry worker and the document schema.

**Tech Stack:** The same as Milestone 4: TypeScript 5.9 strict with `noUncheckedIndexedAccess`, React 19, Vite 8, Zustand 5 (vanilla stores + `useStore`), zod 4, Vitest 5 with jsdom per file, Testing Library, and Playwright. No new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-10-12-blokade-learn-and-plugins-design.md` §1 and §2. The main spec, `docs/superpowers/specs/2026-10-11-blokade-design.md`, still applies.

## Global Constraints

- **Earlier rules still apply.** Everything in the Milestone 1–4 Global Constraints still holds:
  - Z-up, mm, degrees;
  - immutable document and store;
  - no `eval`/`new Function`/`crypto.randomUUID`;
  - files under 400 lines, functions under 50 lines, nesting at most 4 levels;
  - no `console.log` (`console.error` for real failures is fine);
  - `Object.hasOwn` for node lookups;
  - 80%+ line coverage on non-UI logic;
  - conventional commits ending with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **No new npm dependencies, and no document schema change** (it stays `schemaVersion: 3`).
- **Kid-facing writing style** (spec §1):
  - short sentences, everyday words, one idea per sentence;
  - name controls the way the screen shows them, **bold** with their icon;
  - say what to do, then what will happen;
  - no blame.
  - In tutorial and help text, `**text**` is the only markup, and it renders as bold.
- **Tutorial rules:**
  - Each tutorial runs in its own practice design named `Lesson: <title>`.
  - A step's `target` is a `data-testid`.
  - `check(view)` is pure and reads only the `LessonView` (never the DOM, the 3D view or pixels). A check that throws counts as "not done yet" and is logged once.
  - A step with no `check` is a reading step with a **Next** button.
- **Auto-advance:** BloKade moves to the next step only when a design or selection change makes the current step's check go from false to true. A step that is already done when Kade arrives at it (after **Back**, for example) shows "✓ Done!" and a **Next** button. It never jumps ahead by itself.
- **Pausing:** if the open design isn't the lesson's practice design, the lesson pauses with "This lesson uses its own design. Go back to it to keep going." If the practice design is gone, **Start again** makes a new one.
- **Progress storage:** key `blokade.lessons.v1` in `localStorage`. Every read and write is wrapped in try/catch, and a failed save is logged once. Unreadable, invalid or out-of-date data falls back to empty progress, and the app still works.
- **Tooltips:**
  - appear 500 ms after hover or focus;
  - hide on leave, blur, scroll or Esc;
  - the tooltip of the control a lesson is highlighting is suppressed;
  - all tooltips are off in help mode.
- **Help mode:**
  - Clicks are captured before they reach the page, so nothing in the design changes.
  - Esc, the ❓ button or the card's **Close** leaves help mode.
  - Clicking something without help shows "No help for this yet."
- **Help coverage:** every `button`, `input`, `select` and `textarea` on the main screen resolves to a help entry. A unit test enforces this.
- **Not included:** videos, animations beyond the pulsing highlight, voice-over and translations.

## Review Focus

1. **Kade does something unexpected mid-lesson.** Examples: deleting the box the step is about, undoing past a finished step, or pressing **Back** onto a step that's already done.
   - Expected: no crash, no skipping ahead. The step just isn't done (or shows ✓ Done with **Next**).
   - Pinned in Task 6 (watcher tests) and Task 2 (checks only look at the current state).
2. **Kade switches designs, or deletes the practice design, while a lesson is running.**
   - Expected: the lesson pauses with **Go back**; if the design is gone, **Start again**; nothing is lost.
   - Pinned in Task 5 (resume returns `missing`) and Task 8 (paused panel UI).
3. **Clicking around in help mode, including the 3D view and Esc.**
   - Expected: the design, selection and tool never change; Esc leaves help mode without deselecting.
   - Pinned in Task 10 (component tests) and Task 12 (end-to-end).
4. **Browser storage is blocked, full, or holds junk.** Examples: a private window, garbage JSON, an unknown tutorial id, or a step number past the end.
   - Expected: the lessons work and forget progress, with no crash and one logged error.
   - Pinned in Task 4.
5. **The highlighted control isn't on screen.** Examples: Properties is empty, the field is scrolled out of its panel, or the Designs dialog is closed.
   - Expected: no outline pointing at nothing; the step shows "Can't see it?" with the hint.
   - Pinned in Task 7 (`findTargetRect`) and Task 8 (panel shows the find-it line).

---

## File Map

```
src/
├─ learn/
│  ├─ types.ts               # LessonView, TutorialStep, Tutorial
│  ├─ names.ts               # lessonDesignName()
│  ├─ checks.ts              # shapesOf, groupsOf, nodeById, modifiersOfType, variableExpr, paramFormula
│  ├─ view.ts                # lessonView(state), isStepDone(step, view)
│  ├─ tutorials/
│  │  ├─ first-shape.ts, move-turn-size.ts, holes-groups.ts, undo-save.ts, smart-sizes.ts
│  │  ├─ workplane.ts, round-repeat.ts, perfect-fit.ts, ready-to-print.ts
│  │  └─ index.ts            # TUTORIALS, tutorialById
│  ├─ testing/harness.ts     # lessonHarness() for tutorial walkthrough tests
│  ├─ progress.ts            # LessonProgress, load/save, KeyValueStorage
│  ├─ lesson-store.ts        # createLessonStore, currentStepOf
│  ├─ start-lesson.ts        # startLesson, resumeLesson
│  ├─ watch-steps.ts         # watchSteps, useStepWatcher
│  └─ target.ts              # findTargetRect, useTargetRect, TargetRect
├─ help/
│  ├─ types.ts               # HelpEntry
│  ├─ help-texts.ts          # HELP_TEXTS (exact keys)
│  ├─ help-patterns.ts       # HELP_PATTERNS (add-*, param-*, mod-*…)
│  └─ lookup.ts              # helpKeyOf(element), helpFor(key, label), NO_HELP
├─ app/
│  ├─ design-session.ts      # DesignSession, switchToDesign, openFreshDesign, openSavedDesign
│  └─ testing/main-screen.tsx # renderMainScreen() + sample stores for coverage tests
├─ ui/
│  ├─ RichText.tsx           # **bold** renderer
│  ├─ LessonHighlight.tsx    # pulsing outline (portal)
│  ├─ LessonsPanel.tsx       # list / finished / active step
│  ├─ LessonStep.tsx         # one step + paused state
│  ├─ HelpTooltips.tsx       # hover/focus bubbles
│  ├─ HelpMode.tsx           # ❓ capture layer + HelpCard
│  ├─ EmptyNudge.tsx         # "New here?" in an empty design
│  ├─ Toolbar.tsx            # 📘 Learn, ❓ buttons; data-help on Snap
│  ├─ Workspace.tsx          # wires lessons, help, nudge
│  ├─ DesignsDialog.tsx      # uses design-session
│  ├─ ShapePalette.tsx, SceneTree.tsx, PropertiesPanel.tsx, VariablesPanel.tsx, Toasts.tsx  # data-help attributes
│  └─ App.css                # lessons column, highlight, tooltip, help card, nudge
e2e/lessons.spec.ts          # all nine tutorials + help mode
vite.config.ts               # coverage includes src/learn/** and src/help/**
README.md                    # "Learning BloKade" section
```

---

### Task 1: The lesson model, check helpers and view

**Files:**
- Create: `src/learn/types.ts`, `src/learn/names.ts`, `src/learn/checks.ts`, `src/learn/view.ts`
- Modify: `vite.config.ts` (coverage include)
- Test: `src/learn/checks.test.ts`, `src/learn/view.test.ts`

**Interfaces:**
- Consumes:
  - `BloKadeState`, `ToolMode` and `Workplane` from `src/store/store.ts`;
  - `visibleOverlapOf` from `src/store/overlap.ts`;
  - `canUndo` from `src/history/history.ts`;
  - `formulaOf` and `paramField` from `src/document/fields.ts`.
- Produces:
  - `LessonView`, `TutorialStep` and `Tutorial` (types);
  - `lessonDesignName(title)`;
  - `lessonView(state)` and `isStepDone(step, view)`;
  - check helpers: `nodeById`, `shapesOf`, `groupsOf`, `modifiersOfType`, `variableExpr` and `paramFormula`.

- [ ] **Step 1: Write the failing tests**

`src/learn/checks.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { paramField } from '../document/fields'
import { addModifier } from '../document/modifiers'
import { addNode, groupNodes } from '../document/ops'
import type { BloKadeDocument } from '../document/types'
import { groupsOf, modifiersOfType, nodeById, paramFormula, shapesOf, variableExpr } from './checks'
import type { LessonView } from './types'

const viewOf = (doc: BloKadeDocument, selection: string[] = []): LessonView => ({
  doc, selection, tool: 'move', workplane: null, pickingWorkplane: false, designId: 'd', overlapShown: false, canUndo: false,
})
const box = createShapeNode({ id: 'b', shapeType: 'box', name: 'Box', params: { width: 20 }, color: '#fff' })
const cyl = createShapeNode({ id: 'c', shapeType: 'cylinder', name: 'Cylinder', params: { diameter: 20 }, color: '#fff' })
const twoParts = addNode(addNode(createEmptyDocument(), box), cyl)

describe('lesson checks', () => {
  it('finds shapes by type and groups', () => {
    expect(shapesOf(viewOf(twoParts)).map((s) => s.id)).toEqual(['b', 'c'])
    expect(shapesOf(viewOf(twoParts), 'cylinder').map((s) => s.id)).toEqual(['c'])
    const grouped = groupNodes(twoParts, ['b', 'c'], 'g').doc
    expect(groupsOf(viewOf(grouped)).map((g) => g.id)).toEqual(['g'])
  })

  it('looks nodes up safely', () => {
    expect(nodeById(viewOf(twoParts), 'b')?.name).toBe('Box')
    expect(nodeById(viewOf(twoParts), 'toString')).toBeUndefined()
  })

  it('reads modifiers, variables and formulas', () => {
    const rounded = addModifier(twoParts, 'b', 'fillet').doc
    expect(modifiersOfType(viewOf(rounded), 'fillet')).toHaveLength(1)
    expect(modifiersOfType(viewOf(rounded), 'mirror')).toEqual([])
    const withVar = { ...twoParts, variables: [{ name: 'wall', expr: '3' }] }
    expect(variableExpr(viewOf(withVar), 'wall')).toBe('3')
    expect(variableExpr(viewOf(withVar), 'gap')).toBeUndefined()
    const formula = { ...box, formulas: { [paramField('width')]: 'wall * 10' } }
    expect(paramFormula(formula, 'width')).toBe('wall * 10')
    expect(paramFormula(box, 'width')).toBeUndefined()
  })
})
```

`src/learn/view.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { createBloKadeStore } from '../store/store'
import { lessonDesignName } from './names'
import type { TutorialStep } from './types'
import { isStepDone, lessonView } from './view'

describe('lessonView', () => {
  it('copies what checks may read from the store', () => {
    const store = createBloKadeStore({ designId: 'd1', doc: createEmptyDocument('Lesson: X') })
    store.getState().setTool('rotate')
    store.getState().setPickingWorkplane(true)
    const view = lessonView(store.getState())
    expect(view).toMatchObject({ designId: 'd1', tool: 'rotate', pickingWorkplane: true, workplane: null, overlapShown: false, canUndo: false })
    expect(view.doc.name).toBe('Lesson: X')
    store.getState().apply((d) => ({ ...d, name: 'Y' }))
    expect(lessonView(store.getState()).canUndo).toBe(true)
  })
})

describe('isStepDone', () => {
  const view = lessonView(createBloKadeStore({ designId: 'd', doc: createEmptyDocument() }).getState())

  it('is false for reading steps and follows the check otherwise', () => {
    expect(isStepDone({ id: 'read', text: 'Look', hint: 'h' }, view)).toBe(false)
    expect(isStepDone({ id: 'yes', text: 't', hint: 'h', check: () => true }, view)).toBe(true)
  })

  it('treats a throwing check as not done and logs it once', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const broken: TutorialStep = { id: 'broken-once', text: 't', hint: 'h', check: () => { throw new Error('boom') } }
    expect(isStepDone(broken, view)).toBe(false)
    expect(isStepDone(broken, view)).toBe(false)
    expect(logged).toHaveBeenCalledTimes(1)
    logged.mockRestore()
  })
})

describe('lessonDesignName', () => {
  it('names practice designs after the tutorial', () => {
    expect(lessonDesignName('Your first shape')).toBe('Lesson: Your first shape')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/learn`
Expected: FAIL because the modules are missing.

- [ ] **Step 3: Write the model**

`src/learn/types.ts`:

```ts
import type { BloKadeDocument, NodeId } from '../document/types'
import type { ToolMode, Workplane } from '../store/store'

/** Everything a tutorial step's check may look at. Never the DOM or the 3D view. */
export interface LessonView {
  readonly doc: BloKadeDocument
  readonly selection: readonly NodeId[]
  readonly tool: ToolMode
  readonly workplane: Workplane | null
  readonly pickingWorkplane: boolean
  readonly designId: string
  /** An overlap check result is showing for the current design and selection. */
  readonly overlapShown: boolean
  readonly canUndo: boolean
}

export interface TutorialStep {
  /** Unique within its tutorial. */
  readonly id: string
  /** One instruction. `**text**` shows in bold. */
  readonly text: string
  /** `data-testid` of the control to highlight. */
  readonly target?: string
  /** The step is done when this returns true. Missing means a reading step with a Next button. */
  readonly check?: (view: LessonView) => boolean
  /** Longer help for 💡 Show me. It also says where to find the control. */
  readonly hint: string
}

export interface Tutorial {
  readonly id: string
  readonly title: string
  readonly icon: string
  readonly intro: string
  readonly steps: readonly TutorialStep[]
}
```

`src/learn/names.ts`:

```ts
/** The practice design a tutorial opens, e.g. "Lesson: Your first shape". */
export const lessonDesignName = (title: string): string => `Lesson: ${title}`
```

`src/learn/checks.ts`:

```ts
import { formulaOf, paramField } from '../document/fields'
import type { GroupNode, Modifier, ModifierType, SceneNode, ShapeNode } from '../document/types'
import type { LessonView } from './types'

const nodesOf = (view: LessonView): SceneNode[] => Object.values(view.doc.nodes)

export function nodeById(view: LessonView, id: string): SceneNode | undefined {
  return Object.hasOwn(view.doc.nodes, id) ? view.doc.nodes[id] : undefined
}

/** Every shape, or only shapes of one plugin id such as 'box'. */
export function shapesOf(view: LessonView, shapeType?: string): ShapeNode[] {
  return nodesOf(view).filter((n): n is ShapeNode => n.kind === 'shape' && (shapeType === undefined || n.shapeType === shapeType))
}

export const groupsOf = (view: LessonView): GroupNode[] => nodesOf(view).filter((n): n is GroupNode => n.kind === 'group')

export function modifiersOfType(view: LessonView, type: ModifierType): Modifier[] {
  return nodesOf(view).flatMap((n) => (n.modifiers ?? []).filter((m) => m.type === type))
}

export const variableExpr = (view: LessonView, name: string): string | undefined =>
  view.doc.variables.find((v) => v.name === name)?.expr

export const paramFormula = (node: ShapeNode, name: string): string | undefined => formulaOf(node, paramField(name))
```

If `Modifier` isn't exported from `src/document/types.ts` under that name, use the union type the file exports for modifiers and say so in your report.

`src/learn/view.ts`:

```ts
import { canUndo } from '../history/history'
import { visibleOverlapOf } from '../store/overlap'
import type { BloKadeState } from '../store/store'
import type { LessonView, TutorialStep } from './types'

export function lessonView(state: BloKadeState): LessonView {
  return {
    doc: state.history.present,
    selection: state.selection,
    tool: state.tool,
    workplane: state.workplane,
    pickingWorkplane: state.pickingWorkplane,
    designId: state.designId,
    overlapShown: visibleOverlapOf(state) !== null,
    canUndo: canUndo(state.history),
  }
}

const reported = new Set<string>()

/** True when the step's check passes. A check that throws counts as "not done yet" and is logged once. */
export function isStepDone(step: TutorialStep, view: LessonView): boolean {
  if (!step.check) return false
  try {
    return step.check(view)
  } catch (error) {
    if (!reported.has(step.id)) {
      reported.add(step.id)
      console.error(`Lesson step "${step.id}" could not be checked`, error)
    }
    return false
  }
}
```

In `vite.config.ts`, add `'src/learn/**', 'src/help/**'` to `coverage.include`. The existing `**/testing/**` and `**/*.tsx` excludes keep helpers and components out.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/learn && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/learn vite.config.ts
git commit -m "feat: add the lesson model and step checks"
```

---

### Task 2: Tutorials 1–5

**Files:**
- Create: `src/learn/tutorials/first-shape.ts`, `move-turn-size.ts`, `holes-groups.ts`, `undo-save.ts`, `smart-sizes.ts`; `src/learn/testing/harness.ts`
- Test: `src/learn/tutorials/tutorials-1-5.test.ts`

**Interfaces:**
- Consumes: Task 1, plus `createActions` (`src/app/actions.ts`), `createFieldNormalizer`, `setFieldInput`, `addVariable`, `renameVariable`, `setVariableExpr` (`src/document/variable-ops.ts`), `renameDocument` (`src/document/ops.ts`) and the real `registry`.
- Produces:
  - `firstShape`, `moveTurnSize`, `holesGroups`, `undoSave`, `smartSizes` (`Tutorial`);
  - `lessonHarness(tutorial)`, returning `{ store, actions, done(stepId), firstShape(type), setField(id, key, text), apply(fn), normalize }`.

- [ ] **Step 1: Write the harness and failing walkthrough tests**

`src/learn/testing/harness.ts`:

```ts
import { createActions } from '../../app/actions'
import { createFieldNormalizer } from '../../app/field-normalizer'
import { createEmptyDocument } from '../../document/factory'
import { setFieldInput } from '../../document/formula-ops'
import type { BloKadeDocument, FieldKey, NodeId } from '../../document/types'
import { registry } from '../../plugins/index'
import { createBloKadeStore } from '../../store/store'
import { shapesOf } from '../checks'
import { lessonDesignName } from '../names'
import type { Tutorial } from '../types'
import { isStepDone, lessonView } from '../view'

/** A practice design plus the real actions, for walking through a tutorial the way Kade would. */
export function lessonHarness(tutorial: Tutorial) {
  const store = createBloKadeStore({ designId: 'practice', doc: createEmptyDocument(lessonDesignName(tutorial.title)) })
  const actions = createActions(store, registry)
  const normalize = createFieldNormalizer(registry)
  const view = () => lessonView(store.getState())
  const stepById = (id: string) => {
    const found = tutorial.steps.find((s) => s.id === id)
    if (!found) throw new Error(`Tutorial ${tutorial.id} has no step ${id}`)
    return found
  }
  return {
    store,
    actions,
    normalize,
    done: (stepId: string): boolean => isStepDone(stepById(stepId), view()),
    firstShape: (shapeType: string): NodeId => {
      const shape = shapesOf(view(), shapeType)[0]
      if (!shape) throw new Error(`No ${shapeType} yet`)
      return shape.id
    },
    setField: (id: NodeId, key: FieldKey, text: string): void =>
      store.getState().apply((d) => setFieldInput(d, id, key, text, normalize)),
    apply: (fn: (doc: BloKadeDocument) => BloKadeDocument): void => store.getState().apply(fn),
  }
}
```

`src/learn/tutorials/tutorials-1-5.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { paramField, positionField, rotationField } from '../../document/fields'
import { renameDocument } from '../../document/ops'
import { addVariable, renameVariable, setVariableExpr } from '../../document/variable-ops'
import { lessonHarness } from '../testing/harness'
import { firstShape } from './first-shape'
import { holesGroups } from './holes-groups'
import { moveTurnSize } from './move-turn-size'
import { smartSizes } from './smart-sizes'
import { undoSave } from './undo-save'

describe('Your first shape', () => {
  it('ticks off each step as Kade does it', () => {
    const h = lessonHarness(firstShape)
    expect(h.done('add-box')).toBe(false)
    h.actions.addShape('box')
    expect(h.done('add-box')).toBe(true)
    expect(h.done('width')).toBe(false)
    h.setField(h.firstShape('box'), paramField('width'), '40')
    expect(h.done('width')).toBe(true)
    expect(h.done('look')).toBe(false)
    expect(h.done('deselect')).toBe(false)
    h.actions.cancel()
    expect(h.done('deselect')).toBe(true)
    expect(h.done('reselect')).toBe(false)
    h.actions.selectNode(h.firstShape('box'), false)
    expect(h.done('reselect')).toBe(true)
  })

  it('is not fooled by an empty design (Review Focus 1)', () => {
    const h = lessonHarness(firstShape)
    h.actions.cancel()
    expect(h.done('deselect')).toBe(false)
  })
})

describe('Move, turn and size', () => {
  it('ticks off each step', () => {
    const h = lessonHarness(moveTurnSize)
    h.actions.addShape('cylinder')
    expect(h.done('add-cylinder')).toBe(true)
    const id = h.firstShape('cylinder')
    expect(h.done('slide')).toBe(false)
    h.setField(id, positionField(1), '10')
    expect(h.done('slide')).toBe(true)
    h.setField(id, positionField(0), '30')
    expect(h.done('exact')).toBe(true)
    h.actions.setTool('rotate')
    expect(h.done('rotate-tool')).toBe(true)
    h.setField(id, rotationField(1), '45')
    expect(h.done('tip-over')).toBe(true)
    h.actions.setTool('size')
    expect(h.done('size-tool')).toBe(true)
    expect(h.done('taller')).toBe(false)
    h.setField(id, paramField('height'), '40')
    expect(h.done('taller')).toBe(true)
    h.actions.setTool('move')
    expect(h.done('move-tool')).toBe(true)
  })
})

describe('Holes and groups', () => {
  it('ticks off each step', () => {
    const h = lessonHarness(holesGroups)
    h.actions.addShape('box')
    h.actions.addShape('cylinder')
    expect(h.done('add-box') && h.done('add-cylinder')).toBe(true)
    expect(h.done('make-hole')).toBe(false)
    h.actions.toggleHole()
    expect(h.done('make-hole')).toBe(true)
    expect(h.done('select-both')).toBe(false)
    h.actions.selectNode(h.firstShape('box'), false)
    h.actions.selectNode(h.firstShape('cylinder'), true)
    expect(h.done('select-both')).toBe(true)
    expect(h.done('group')).toBe(false)
    h.actions.groupSelection()
    expect(h.done('group')).toBe(true)
  })
})

describe('Undo, names and saving', () => {
  it('ticks off each step', () => {
    const h = lessonHarness(undoSave)
    h.actions.addShape('sphere')
    expect(h.done('add-sphere')).toBe(true)
    expect(h.done('delete')).toBe(false)
    h.actions.deleteSelection()
    expect(h.done('delete')).toBe(true)
    expect(h.done('undo')).toBe(false)
    h.actions.undo()
    expect(h.done('undo')).toBe(true)
    h.actions.redo()
    expect(h.done('redo')).toBe(true)
    h.actions.undo()
    expect(h.done('undo-again')).toBe(true)
    expect(h.done('rename')).toBe(false)
    h.apply((d) => renameDocument(d, 'My robot'))
    expect(h.done('rename')).toBe(true)
  })
})

describe('Smart sizes', () => {
  it('ticks off each step', () => {
    const h = lessonHarness(smartSizes)
    h.actions.addShape('box')
    expect(h.done('add-variable')).toBe(false)
    h.apply((d) => addVariable(d, 'var1', '10', h.normalize))
    expect(h.done('add-variable')).toBe(true)
    h.apply((d) => renameVariable(d, 'var1', 'wall', h.normalize))
    expect(h.done('name-it')).toBe(true)
    h.apply((d) => setVariableExpr(d, 'wall', '3', h.normalize))
    expect(h.done('set-it')).toBe(true)
    h.setField(h.firstShape('box'), paramField('width'), 'wall * 10')
    expect(h.done('use-it')).toBe(true)
    h.actions.addShape('cylinder')
    expect(h.done('add-cylinder')).toBe(true)
    h.setField(h.firstShape('cylinder'), paramField('diameter'), 'wall * 5')
    expect(h.done('diameter')).toBe(true)
    expect(h.done('change')).toBe(false)
    h.apply((d) => setVariableExpr(d, 'wall', '4', h.normalize))
    expect(h.done('change')).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/learn/tutorials`
Expected: FAIL because the tutorial modules are missing.

- [ ] **Step 3: Write the five tutorials**

`src/learn/tutorials/first-shape.ts`:

```ts
import { shapesOf } from '../checks'
import type { Tutorial } from '../types'

export const firstShape: Tutorial = {
  id: 'first-shape',
  title: 'Your first shape',
  icon: '🟦',
  intro: 'Add a box, change its size, and look at it from every side.',
  steps: [
    {
      id: 'add-box', text: 'Click **Box** in the Shapes list to add a box.', target: 'add-box',
      check: (v) => shapesOf(v, 'box').length > 0,
      hint: 'The Shapes list is at the top left. The box is the first button.',
    },
    {
      id: 'width', text: 'Your box is selected, so its sizes show on the right. Type **40** into **Width** and press Enter.',
      target: 'param-width',
      check: (v) => shapesOf(v, 'box').some((b) => b.params.width === 40),
      hint: 'Width is under Size in Properties, on the right. If Properties is empty, click the box first.',
    },
    {
      id: 'look', text: 'Look around! Drag in the 3D view to spin it. Scroll to zoom. Right-drag to slide. Click **Next** when you are ready.',
      target: 'viewport',
      hint: 'Hold the left mouse button and drag to spin. Hold the right button to slide. The mouse wheel zooms.',
    },
    {
      id: 'deselect', text: 'Press **Esc** to unselect the box. (Clicking empty space in the 3D view works too.)',
      check: (v) => v.selection.length === 0 && shapesOf(v, 'box').length > 0,
      hint: 'Esc is the key in the top left corner of your keyboard.',
    },
    {
      id: 'reselect', text: 'Now click the box again, in the 3D view or in **Parts** on the left, to select it.',
      check: (v) => shapesOf(v, 'box').some((b) => v.selection.includes(b.id)),
      hint: 'Parts is the list under the shapes on the left. Click the row called Box.',
    },
  ],
}
```

`src/learn/tutorials/move-turn-size.ts`:

```ts
import { shapesOf } from '../checks'
import type { LessonView, Tutorial } from '../types'

const cylinder = (v: LessonView) => shapesOf(v, 'cylinder')[0]

export const moveTurnSize: Tutorial = {
  id: 'move-turn-size',
  title: 'Move, turn and size',
  icon: '✥',
  intro: 'Slide a part around, turn it, and stretch it.',
  steps: [
    {
      id: 'add-cylinder', text: 'Click **Cylinder** to add one.', target: 'add-cylinder',
      check: (v) => cylinder(v) !== undefined,
      hint: 'Cylinder is in the Shapes list at the top left, next to Box.',
    },
    {
      id: 'slide', text: 'Drag the red arrow in the 3D view to slide the cylinder. (You can also type a number into Position **x**.)',
      target: 'viewport',
      check: (v) => { const c = cylinder(v); return c !== undefined && (c.transform.position[0] !== 0 || c.transform.position[1] !== 0) },
      hint: 'Put the mouse on the red arrow, hold the button down and move the mouse.',
    },
    {
      id: 'exact', text: 'Type **30** into Position **x** and press Enter. Now it is exactly 30 mm from the middle.',
      target: 'pos-x',
      check: (v) => cylinder(v)?.transform.position[0] === 30,
      hint: 'Position is in Properties on the right. x is the first box.',
    },
    {
      id: 'rotate-tool', text: 'Click **⟳ Rotate** in the top bar.', target: 'tool-rotate',
      check: (v) => v.tool === 'rotate',
      hint: 'The top bar is the row of buttons at the very top. Rotate is next to Move.',
    },
    {
      id: 'tip-over', text: 'Type **45** into Rotation **y** and press Enter to tip it over. (Or drag a ring in the 3D view.)',
      target: 'rot-y',
      check: (v) => cylinder(v)?.transform.rotation[1] === 45,
      hint: 'Rotation is in Properties, under Position. y is the middle box.',
    },
    {
      id: 'size-tool', text: 'Click **⤢ Size** in the top bar.', target: 'tool-size',
      check: (v) => v.tool === 'size',
      hint: 'Size is next to Rotate in the top bar.',
    },
    {
      id: 'taller', text: 'Make it taller: drag the top handle, or type **40** into **Height**.', target: 'param-height',
      check: (v) => { const h = cylinder(v)?.params.height; return typeof h === 'number' && h > 20 },
      hint: 'Height is under Size in Properties. The cylinder starts 20 mm tall.',
    },
    {
      id: 'move-tool', text: 'Click **✥ Move** to go back to moving things.', target: 'tool-move',
      check: (v) => v.tool === 'move',
      hint: 'Move is the first of the three handle buttons in the top bar.',
    },
  ],
}
```

`src/learn/tutorials/holes-groups.ts`:

```ts
import { groupsOf, nodeById, shapesOf } from '../checks'
import type { LessonView, Tutorial } from '../types'

const box = (v: LessonView) => shapesOf(v, 'box')[0]
const cylinder = (v: LessonView) => shapesOf(v, 'cylinder')[0]

export const holesGroups: Tutorial = {
  id: 'holes-groups',
  title: 'Holes and groups',
  icon: '⬚',
  intro: 'Turn a part into a hole and use it to cut another part.',
  steps: [
    {
      id: 'add-box', text: 'Click **Box** to add a box.', target: 'add-box',
      check: (v) => box(v) !== undefined,
      hint: 'Box is the first button in the Shapes list at the top left.',
    },
    {
      id: 'add-cylinder', text: 'Click **Cylinder**. It lands inside the box.', target: 'add-cylinder',
      check: (v) => cylinder(v) !== undefined,
      hint: 'Cylinder is next to Box in the Shapes list.',
    },
    {
      id: 'make-hole', text: 'The cylinder is selected. Click **Hole** in Properties.', target: 'mode-hole',
      check: (v) => cylinder(v)?.mode === 'hole',
      hint: 'Solid and Hole are under the name in Properties, on the right.',
    },
    {
      id: 'select-both', text: 'Select both: click **Box** in **Parts**, then hold **Shift** and click **Cylinder**.',
      check: (v) => {
        const b = box(v)
        const c = cylinder(v)
        return b !== undefined && c !== undefined && v.selection.includes(b.id) && v.selection.includes(c.id)
      },
      hint: 'Parts is the list on the left. Shift is the key with the up arrow, above Ctrl.',
    },
    {
      id: 'group', text: 'Click **Group** in the top bar. The hole cuts through the box!', target: 'group',
      check: (v) => groupsOf(v).some((g) => g.children.some((id) => nodeById(v, id)?.mode === 'hole')),
      hint: 'Group is in the top bar, after Undo and Redo. It only works with two or more parts selected.',
    },
    {
      id: 'why', text: 'A hole only cuts the parts in its own group. Click **Ungroup** any time to change the pieces again.',
      target: 'ungroup',
      hint: 'Ungroup is next to Group in the top bar.',
    },
  ],
}
```

`src/learn/tutorials/undo-save.ts`:

```ts
import { shapesOf } from '../checks'
import { lessonDesignName } from '../names'
import type { LessonView, Tutorial } from '../types'

const TITLE = 'Undo, names and saving'
const hasSphere = (v: LessonView): boolean => shapesOf(v, 'sphere').length > 0

export const undoSave: Tutorial = {
  id: 'undo-save',
  title: TITLE,
  icon: '↶',
  intro: 'Fix mistakes with Undo, name your design, and save a copy to a file.',
  steps: [
    {
      id: 'add-sphere', text: 'Click **Sphere** to add a ball.', target: 'add-sphere',
      check: hasSphere,
      hint: 'Sphere is in the Shapes list at the top left.',
    },
    {
      id: 'delete', text: 'Click **Delete** in the top bar to remove the ball.', target: 'delete',
      check: (v) => !hasSphere(v) && v.canUndo,
      hint: 'Delete is in the top bar. The ball must be selected: click it first if Delete is grey.',
    },
    {
      id: 'undo', text: 'Oops! Click **↶ Undo** to bring it back.', target: 'undo',
      check: hasSphere,
      hint: 'Undo is near the left of the top bar. Ctrl+Z does the same.',
    },
    {
      id: 'redo', text: 'Click **↷ Redo**. It does the delete again.', target: 'redo',
      check: (v) => !hasSphere(v),
      hint: 'Redo is right next to Undo.',
    },
    {
      id: 'undo-again', text: 'Click **↶ Undo** once more to keep the ball.', target: 'undo',
      check: hasSphere,
      hint: 'Undo can go back many steps, one click at a time.',
    },
    {
      id: 'rename', text: "Click the **📁** button at the top left. Type a new name into **This design's name** and press Enter.",
      target: 'design-name',
      check: (v) => v.doc.name.trim() !== '' && v.doc.name !== lessonDesignName(TITLE),
      hint: 'The 📁 button shows the design name. It opens Designs, where the name box is at the top.',
    },
    {
      id: 'save-file', text: 'In Designs, **Save to file** downloads a copy. **Load from file** opens it again. Click **Close**, then **Next**.',
      hint: 'Save to file and Load from file are at the bottom of the Designs window.',
    },
  ],
}
```

`src/learn/tutorials/smart-sizes.ts`:

```ts
import { paramFormula, shapesOf, variableExpr } from '../checks'
import type { LessonView, Tutorial } from '../types'

const usesWall = (formula: string | undefined): boolean => formula !== undefined && /\bwall\b/.test(formula)
const box = (v: LessonView) => shapesOf(v, 'box')[0]
const cylinder = (v: LessonView) => shapesOf(v, 'cylinder')[0]

export const smartSizes: Tutorial = {
  id: 'smart-sizes',
  title: 'Smart sizes',
  icon: '🧮',
  intro: 'Give a number a name, use it in two parts, and change both at once.',
  steps: [
    {
      id: 'add-box', text: 'Click **Box** to add a box.', target: 'add-box',
      check: (v) => box(v) !== undefined,
      hint: 'Box is the first button in the Shapes list.',
    },
    {
      id: 'add-variable', text: 'Click **+ Add variable** under **Variables** on the right.', target: 'add-variable',
      check: (v) => v.doc.variables.length > 0,
      hint: 'Variables is below Properties on the right. Scroll down if you cannot see it.',
    },
    {
      id: 'name-it', text: 'Click its **Name** box, type **wall** and press Enter.', target: 'var-name-var1',
      check: (v) => variableExpr(v, 'wall') !== undefined,
      hint: 'The new variable is called var1. Its name box is on the left of its row.',
    },
    {
      id: 'set-it', text: 'Type **3** into the box after **=** and press Enter.', target: 'var-expr-wall',
      check: (v) => variableExpr(v, 'wall')?.trim() === '3',
      hint: 'The = box is on the right of the wall row.',
    },
    {
      id: 'use-it', text: 'Click the box, then type **wall * 10** into **Width** and press Enter. Width becomes 30.',
      target: 'param-width',
      check: (v) => usesWall(box(v) && paramFormula(box(v)!, 'width')),
      hint: 'Width is under Size in Properties. The * means "times".',
    },
    {
      id: 'add-cylinder', text: 'Click **Cylinder** to add one.', target: 'add-cylinder',
      check: (v) => cylinder(v) !== undefined,
      hint: 'Cylinder is next to Box in the Shapes list.',
    },
    {
      id: 'diameter', text: 'Type **wall * 5** into the cylinder’s **Diameter** and press Enter.', target: 'param-diameter',
      check: (v) => { const c = cylinder(v); return c !== undefined && usesWall(paramFormula(c, 'diameter')) },
      hint: 'Diameter is under Size in Properties while the cylinder is selected.',
    },
    {
      id: 'change', text: 'Now change **wall** to **4**. Watch the box and the cylinder both grow!', target: 'var-expr-wall',
      check: (v) => variableExpr(v, 'wall')?.trim() === '4',
      hint: 'wall is in Variables, on the right. Type 4 into its = box and press Enter.',
    },
  ],
}
```

The `use-it` check uses a non-null assertion. If the lint rules forbid `!`, write it as `{ const b = box(v); return b !== undefined && usesWall(paramFormula(b, 'width')) }`. That form is preferred, so use it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/learn && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/learn
git commit -m "feat: add the first five BloKade tutorials"
```

---

### Task 3: Tutorials 6–9 and the tutorial list

**Files:**
- Create: `src/learn/tutorials/workplane.ts`, `round-repeat.ts`, `perfect-fit.ts`, `ready-to-print.ts`, `src/learn/tutorials/index.ts`
- Test: `src/learn/tutorials/tutorials-6-9.test.ts`, `src/learn/tutorials/index.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2, `addModifier` and `updateModifier` from `src/document/modifiers.ts`, `setFit`, and `setOverlap` on the store.
- Produces:
  - `workplaneTutorial`, `roundRepeat`, `perfectFit`, `readyToPrint`;
  - `TUTORIALS: readonly Tutorial[]` in the order 1–9;
  - `tutorialById(id): Tutorial | undefined`.

- [ ] **Step 1: Write the failing tests**

`src/learn/tutorials/tutorials-6-9.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { modifierField } from '../../document/fields'
import { addModifier } from '../../document/modifiers'
import { setFit } from '../../document/variable-ops'
import { lessonHarness } from '../testing/harness'
import { perfectFit } from './perfect-fit'
import { readyToPrint } from './ready-to-print'
import { roundRepeat } from './round-repeat'
import { workplaneTutorial } from './workplane'

describe('Build on a face', () => {
  it('ticks off each step', () => {
    const h = lessonHarness(workplaneTutorial)
    h.actions.addShape('box')
    expect(h.done('add-box')).toBe(true)
    expect(h.done('workplane-button')).toBe(false)
    h.actions.toggleWorkplanePicking()
    expect(h.done('workplane-button')).toBe(true)
    expect(h.done('pick-face')).toBe(false)
    h.store.getState().setWorkplane({ origin: [0, 0, 20], rotation: [0, 0, 0] })
    expect(h.done('pick-face')).toBe(true)
    h.actions.addShape('cone')
    expect(h.done('add-cone')).toBe(true)
    expect(h.done('ground')).toBe(false)
    h.actions.resetWorkplane()
    expect(h.done('ground')).toBe(true)
  })
})

describe('Round and repeat', () => {
  it('ticks off each step', () => {
    const h = lessonHarness(roundRepeat)
    h.actions.addShape('box')
    const id = h.firstShape('box')
    let filletId = ''
    h.apply((d) => { const r = addModifier(d, id, 'fillet'); filletId = r.modifierId; return r.doc })
    expect(h.done('round')).toBe(true)
    expect(h.done('roundness')).toBe(false)
    h.setField(id, modifierField(filletId, 'radius'), '3')
    expect(h.done('roundness')).toBe(true)
    let rowId = ''
    h.apply((d) => { const r = addModifier(d, id, 'linearPattern'); rowId = r.modifierId; return r.doc })
    expect(h.done('repeat')).toBe(true)
    expect(h.done('count')).toBe(false)
    h.setField(id, modifierField(rowId, 'count'), '4')
    expect(h.done('count')).toBe(true)
    h.apply((d) => addModifier(d, id, 'mirror').doc)
    expect(h.done('mirror')).toBe(true)
  })
})

describe('Perfect fit', () => {
  it('ticks off each step', () => {
    const h = lessonHarness(perfectFit)
    h.actions.addKit('peg-socket')
    expect(h.done('kit')).toBe(true)
    expect(h.done('fit')).toBe(false)
    h.apply((d) => setFit(d, 0.3, h.normalize))
    expect(h.done('fit')).toBe(true)
    expect(h.done('select-pair')).toBe(false)
    h.actions.selectNode(h.firstShape('peg'), false)
    h.actions.selectNode(h.firstShape('socket'), true)
    expect(h.done('select-pair')).toBe(true)
    expect(h.done('check')).toBe(false)
    const s = h.store.getState()
    s.setOverlap({ doc: s.history.present, selection: s.selection, result: { status: 'none' } })
    expect(h.done('check')).toBe(true)
  })
})

describe('Ready to print', () => {
  it('needs a part, then reads through the export steps', () => {
    const h = lessonHarness(readyToPrint)
    expect(h.done('add-box')).toBe(false)
    h.actions.addShape('box')
    expect(h.done('add-box')).toBe(true)
    expect(readyToPrint.steps.slice(1).every((s) => s.check === undefined)).toBe(true)
  })
})
```

`src/learn/tutorials/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { TUTORIALS, tutorialById } from './index'

describe('TUTORIALS', () => {
  it('lists the nine tutorials in teaching order', () => {
    expect(TUTORIALS.map((t) => t.id)).toEqual([
      'first-shape', 'move-turn-size', 'holes-groups', 'undo-save', 'smart-sizes',
      'workplane', 'round-repeat', 'perfect-fit', 'ready-to-print',
    ])
    expect(tutorialById('smart-sizes')?.title).toBe('Smart sizes')
    expect(tutorialById('nope')).toBeUndefined()
  })

  it('gives every step a unique id, a hint, and short text', () => {
    for (const t of TUTORIALS) {
      const ids = t.steps.map((s) => s.id)
      expect(new Set(ids).size, t.id).toBe(ids.length)
      expect(t.steps.length, t.id).toBeGreaterThanOrEqual(4)
      expect(t.steps.length, t.id).toBeLessThanOrEqual(10)
      for (const s of t.steps) {
        expect(s.hint.length, `${t.id}/${s.id}`).toBeGreaterThan(0)
        expect(s.text.length, `${t.id}/${s.id}`).toBeLessThanOrEqual(160)
        if (s.target !== undefined) expect(s.target, `${t.id}/${s.id}`).toMatch(/^[a-z0-9-]+$/)
      }
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/learn/tutorials`
Expected: FAIL because the modules are missing.

- [ ] **Step 3: Write the four tutorials and the index**

`src/learn/tutorials/workplane.ts`:

```ts
import { shapesOf } from '../checks'
import type { Tutorial } from '../types'

export const workplaneTutorial: Tutorial = {
  id: 'workplane',
  title: 'Build on a face',
  icon: '📐',
  intro: 'Stick new shapes onto the side or top of a part.',
  steps: [
    {
      id: 'add-box', text: 'Click **Box** to add a box.', target: 'add-box',
      check: (v) => shapesOf(v, 'box').length > 0,
      hint: 'Box is the first button in the Shapes list.',
    },
    {
      id: 'workplane-button', text: 'Click **📐 Workplane** in the top bar.', target: 'workplane',
      check: (v) => v.pickingWorkplane || v.workplane !== null,
      hint: 'Workplane is in the top bar, after the Move, Rotate and Size buttons.',
    },
    {
      id: 'pick-face', text: 'Now click any face of the box in the 3D view. A marker shows where new shapes will go.',
      target: 'viewport',
      check: (v) => v.workplane !== null,
      hint: 'Click right on the box, not on the grid. If nothing happens, click 📐 Workplane again first.',
    },
    {
      id: 'add-cone', text: 'Click **Cone**. It stands on the face you picked!', target: 'add-cone',
      check: (v) => shapesOf(v, 'cone').length > 0,
      hint: 'Cone is in the Shapes list, below Box.',
    },
    {
      id: 'ground', text: 'Click **Ground** in the top bar to build on the floor again.', target: 'workplane-reset',
      check: (v) => v.workplane === null && !v.pickingWorkplane,
      hint: 'Ground appears next to Workplane while you are building on a face.',
    },
  ],
}
```

`src/learn/tutorials/round-repeat.ts`:

```ts
import { modifiersOfType, shapesOf } from '../checks'
import type { Tutorial } from '../types'

export const roundRepeat: Tutorial = {
  id: 'round-repeat',
  title: 'Round and repeat',
  icon: '◠',
  intro: 'Round off sharp edges, make a row of copies, and mirror them.',
  steps: [
    {
      id: 'add-box', text: 'Click **Box** to add a box.', target: 'add-box',
      check: (v) => shapesOf(v, 'box').length > 0,
      hint: 'Box is the first button in the Shapes list.',
    },
    {
      id: 'round', text: 'Pick **◠ Round edges** in **+ Add a modifier…** in Properties.', target: 'add-modifier',
      check: (v) => modifiersOfType(v, 'fillet').length > 0,
      hint: 'Modifiers is near the bottom of Properties. The list starts with "+ Add a modifier…".',
    },
    {
      id: 'roundness', text: 'Type **3** into **Roundness** and press Enter.', target: 'mod-radius-0',
      check: (v) => modifiersOfType(v, 'fillet').some((m) => m.type === 'fillet' && m.radius === 3),
      hint: 'Roundness is inside the Round edges card, under Modifiers.',
    },
    {
      id: 'repeat', text: 'Now pick **⋯ Repeat in a row** in **+ Add a modifier…**.', target: 'add-modifier',
      check: (v) => modifiersOfType(v, 'linearPattern').length > 0,
      hint: 'It is the same list you used for Round edges.',
    },
    {
      id: 'count', text: 'Type **4** into **How many** and press Enter. Four boxes in a row!', target: 'mod-count-1',
      check: (v) => modifiersOfType(v, 'linearPattern').some((m) => m.type === 'linearPattern' && m.count === 4),
      hint: 'How many is inside the Repeat in a row card, the second card under Modifiers.',
    },
    {
      id: 'mirror', text: 'Last one: pick **⇋ Mirror**. It copies the row to the other side.', target: 'add-modifier',
      check: (v) => modifiersOfType(v, 'mirror').length > 0,
      hint: 'Mirror is at the end of the + Add a modifier… list.',
    },
  ],
}
```

`src/learn/tutorials/perfect-fit.ts`:

```ts
import { shapesOf } from '../checks'
import type { LessonView, Tutorial } from '../types'

const peg = (v: LessonView) => shapesOf(v, 'peg')[0]
const socket = (v: LessonView) => shapesOf(v, 'socket')[0]

export const perfectFit: Tutorial = {
  id: 'perfect-fit',
  title: 'Perfect fit',
  icon: '🧷',
  intro: 'Make two parts that slide together after printing.',
  steps: [
    {
      id: 'kit', text: 'Click **🧷 Peg & socket** under **Fit tools**.', target: 'add-kit-peg-socket',
      check: (v) => peg(v) !== undefined && socket(v) !== undefined,
      hint: 'Fit tools is below the Shapes list on the left. Scroll down if you cannot see it.',
    },
    {
      id: 'why', text: 'The socket is a hole a little bigger than the peg, so the printed peg slides in. **Fit gap** sets how much bigger.',
      target: 'fit',
      hint: 'Fit gap is at the top of Variables, on the right.',
    },
    {
      id: 'fit', text: 'Type **0.3** into **Fit gap** and press Enter. The socket grows a tiny bit.', target: 'fit',
      check: (v) => v.doc.settings.fit === 0.3,
      hint: 'Fit gap is at the top of Variables, on the right. It starts at 0.2.',
    },
    {
      id: 'select-pair', text: 'Click **Peg** in **Parts**, then hold **Shift** and click **Socket**.',
      check: (v) => {
        const p = peg(v)
        const s = socket(v)
        return p !== undefined && s !== undefined && v.selection.length === 2 && v.selection.includes(p.id) && v.selection.includes(s.id)
      },
      hint: 'Parts is the list on the left. Hold Shift while you click the second one.',
    },
    {
      id: 'check', text: 'Click **🔍 Check overlap**. It tells you if the two parts bump into each other.', target: 'check-overlap',
      check: (v) => v.overlapShown,
      hint: 'Check overlap is in Properties while two parts are selected.',
    },
  ],
}
```

`src/learn/tutorials/ready-to-print.ts`:

```ts
import { shapesOf } from '../checks'
import type { Tutorial } from '../types'

export const readyToPrint: Tutorial = {
  id: 'ready-to-print',
  title: 'Ready to print',
  icon: '🖨',
  intro: 'Turn your design into a file your 3D printer can use.',
  steps: [
    {
      id: 'add-box', text: 'Click **Box** so there is something to print.', target: 'add-box',
      check: (v) => shapesOf(v).length > 0,
      hint: 'Box is the first button in the Shapes list.',
    },
    {
      id: 'stl', text: 'Click **⬇ STL**. Your browser downloads a file you can open in your slicer. Then click **Next**.',
      target: 'export-stl',
      hint: 'STL is near the right end of the top bar.',
    },
    {
      id: '3mf', text: '**⬇ 3MF** makes a file too, and it keeps your colours. Most slicers open both. Click **Next**.',
      target: 'export-3mf',
      hint: '3MF is right next to STL in the top bar.',
    },
    {
      id: 'slicer', text: 'In your slicer (like Cura, PrusaSlicer or Bambu Studio), open the file. Check it lies flat, then slice and print!',
      hint: 'The slicer is the program that talks to your printer. Ask Larry which one your printer uses.',
    },
  ],
}
```

`src/learn/tutorials/index.ts`:

```ts
import type { Tutorial } from '../types'
import { firstShape } from './first-shape'
import { holesGroups } from './holes-groups'
import { moveTurnSize } from './move-turn-size'
import { perfectFit } from './perfect-fit'
import { readyToPrint } from './ready-to-print'
import { roundRepeat } from './round-repeat'
import { smartSizes } from './smart-sizes'
import { undoSave } from './undo-save'
import { workplaneTutorial } from './workplane'

/** In teaching order. */
export const TUTORIALS: readonly Tutorial[] = [
  firstShape, moveTurnSize, holesGroups, undoSave, smartSizes, workplaneTutorial, roundRepeat, perfectFit, readyToPrint,
]

export const tutorialById = (id: string): Tutorial | undefined => TUTORIALS.find((t) => t.id === id)
```

If a step's text is longer than 160 characters, shorten the wording rather than relaxing the test.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/learn && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/learn
git commit -m "feat: add the remaining four tutorials and the tutorial list"
```

---

### Task 4: Lesson progress and the lesson store

**Files:**
- Create: `src/learn/progress.ts`, `src/learn/lesson-store.ts`
- Test: `src/learn/progress.test.ts`, `src/learn/lesson-store.test.ts`

**Interfaces:**
- Consumes: `TUTORIALS` and `Tutorial` / `TutorialStep`.
- Produces in `src/learn/progress.ts`:
  - `ActiveLesson { tutorialId; step; designId }`
  - `LessonProgress { done; active; nudgeHidden }`
  - `EMPTY_PROGRESS` and `PROGRESS_KEY = 'blokade.lessons.v1'`
  - `KeyValueStorage`
  - `browserStorage()`, `loadProgress(storage)` and `saveProgress(storage, progress): boolean`
- Produces in `src/learn/lesson-store.ts`:
  - `LessonState` and `LessonStore`
  - `createLessonStore(storage, tutorials?)`
  - `currentStepOf(progress, tutorials?): TutorialStep | undefined`

- [ ] **Step 1: Write the failing tests**

`src/learn/progress.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { EMPTY_PROGRESS, loadProgress, PROGRESS_KEY, saveProgress, type KeyValueStorage } from './progress'

const memory = (initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } => {
  const data = { ...initial }
  return { data, getItem: (k) => (Object.hasOwn(data, k) ? data[k] ?? null : null), setItem: (k, v) => { data[k] = v } }
}
const throwing: KeyValueStorage = {
  getItem: () => { throw new Error('blocked') },
  setItem: () => { throw new Error('full') },
}

describe('lesson progress storage (Review Focus 4)', () => {
  it('round-trips progress', () => {
    const storage = memory()
    const progress = { done: ['first-shape'], active: { tutorialId: 'smart-sizes', step: 2, designId: 'abc' }, nudgeHidden: true }
    expect(saveProgress(storage, progress)).toBe(true)
    expect(loadProgress(storage)).toEqual(progress)
  })

  it('starts empty with no storage, blocked storage, junk or the wrong shape', () => {
    expect(loadProgress(null)).toEqual(EMPTY_PROGRESS)
    expect(loadProgress(throwing)).toEqual(EMPTY_PROGRESS)
    expect(loadProgress(memory({ [PROGRESS_KEY]: '{not json' }))).toEqual(EMPTY_PROGRESS)
    expect(loadProgress(memory({ [PROGRESS_KEY]: JSON.stringify({ done: 'all' }) }))).toEqual(EMPTY_PROGRESS)
  })

  it('reports a failed save instead of throwing', () => {
    expect(saveProgress(throwing, EMPTY_PROGRESS)).toBe(false)
    expect(saveProgress(null, EMPTY_PROGRESS)).toBe(false)
  })
})
```

`src/learn/lesson-store.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { currentStepOf, createLessonStore } from './lesson-store'
import { PROGRESS_KEY, type KeyValueStorage } from './progress'
import type { Tutorial } from './types'

const tiny: Tutorial = {
  id: 'tiny', title: 'Tiny', icon: '🔹', intro: 'i',
  steps: [{ id: 'a', text: 'a', hint: 'h' }, { id: 'b', text: 'b', hint: 'h' }],
}
const memory = (initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } => {
  const data = { ...initial }
  return { data, getItem: (k) => (Object.hasOwn(data, k) ? data[k] ?? null : null), setItem: (k, v) => { data[k] = v } }
}

describe('lesson store', () => {
  it('starts, steps through and finishes a lesson', () => {
    const storage = memory()
    const lessons = createLessonStore(storage, [tiny])
    lessons.getState().begin('tiny', 'design-1')
    expect(lessons.getState()).toMatchObject({ panelOpen: true, progress: { active: { tutorialId: 'tiny', step: 0, designId: 'design-1' } } })
    expect(currentStepOf(lessons.getState().progress, [tiny])?.id).toBe('a')
    lessons.getState().next()
    expect(currentStepOf(lessons.getState().progress, [tiny])?.id).toBe('b')
    lessons.getState().back()
    lessons.getState().back()
    expect(lessons.getState().progress.active?.step).toBe(0)
    lessons.getState().next()
    lessons.getState().next()
    expect(lessons.getState()).toMatchObject({ finished: 'tiny', progress: { active: null, done: ['tiny'] } })
    expect(JSON.parse(storage.data[PROGRESS_KEY] ?? '{}')).toMatchObject({ done: ['tiny'], active: null })
  })

  it('does not list a lesson twice when it is done again', () => {
    const lessons = createLessonStore(memory(), [tiny])
    for (const _ of [1, 2]) {
      lessons.getState().begin('tiny', 'd')
      lessons.getState().next()
      lessons.getState().next()
    }
    expect(lessons.getState().progress.done).toEqual(['tiny'])
  })

  it('opens, toggles and focuses the panel, and quits a lesson', () => {
    const lessons = createLessonStore(memory(), [tiny])
    lessons.getState().openPanel('tiny')
    expect(lessons.getState()).toMatchObject({ panelOpen: true, focused: 'tiny' })
    lessons.getState().togglePanel()
    expect(lessons.getState().panelOpen).toBe(false)
    lessons.getState().begin('tiny', 'd')
    lessons.getState().quit()
    expect(lessons.getState().progress.active).toBeNull()
    lessons.getState().hideNudge()
    expect(lessons.getState().progress.nudgeHidden).toBe(true)
  })

  it('drops saved lessons that no longer exist and clamps steps (Review Focus 4)', () => {
    const saved = (active: object) => memory({ [PROGRESS_KEY]: JSON.stringify({ done: ['tiny', 'gone'], active, nudgeHidden: false }) })
    const unknown = createLessonStore(saved({ tutorialId: 'gone', step: 0, designId: 'd' }), [tiny])
    expect(unknown.getState().progress).toMatchObject({ done: ['tiny'], active: null })
    const tooFar = createLessonStore(saved({ tutorialId: 'tiny', step: 9, designId: 'd' }), [tiny])
    expect(tooFar.getState().progress.active?.step).toBe(1)
  })

  it('keeps working and logs once when saving fails (Review Focus 4)', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const broken: KeyValueStorage = { getItem: () => null, setItem: () => { throw new Error('full') } }
    const lessons = createLessonStore(broken, [tiny])
    lessons.getState().begin('tiny', 'd')
    lessons.getState().next()
    expect(lessons.getState().progress.active?.step).toBe(1)
    expect(logged).toHaveBeenCalledTimes(1)
    logged.mockRestore()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/learn/progress.test.ts src/learn/lesson-store.test.ts`
Expected: FAIL because the modules are missing.

- [ ] **Step 3: Implement**

`src/learn/progress.ts`:

```ts
import { z } from 'zod'

export interface ActiveLesson {
  readonly tutorialId: string
  readonly step: number
  /** The practice design this lesson runs in. */
  readonly designId: string
}

export interface LessonProgress {
  /** Tutorial ids Kade has finished at least once. */
  readonly done: readonly string[]
  readonly active: ActiveLesson | null
  readonly nudgeHidden: boolean
}

export const EMPTY_PROGRESS: LessonProgress = { done: [], active: null, nudgeHidden: false }
export const PROGRESS_KEY = 'blokade.lessons.v1'

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const progressSchema = z.object({
  done: z.array(z.string().max(64)).max(100),
  active: z.object({ tutorialId: z.string().max(64), step: z.number().int().min(0).max(100), designId: z.string().max(64) }).nullable(),
  nudgeHidden: z.boolean(),
})

/** The browser's localStorage, or null where it can't be reached (some private windows). */
export function browserStorage(): KeyValueStorage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function loadProgress(storage: KeyValueStorage | null): LessonProgress {
  if (!storage) return EMPTY_PROGRESS
  try {
    const raw = storage.getItem(PROGRESS_KEY)
    if (!raw) return EMPTY_PROGRESS
    const parsed = progressSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : EMPTY_PROGRESS
  } catch {
    return EMPTY_PROGRESS
  }
}

/** True when saved. Never throws: progress is a convenience, and the lessons work without it. */
export function saveProgress(storage: KeyValueStorage | null, progress: LessonProgress): boolean {
  if (!storage) return false
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify(progress))
    return true
  } catch {
    return false
  }
}
```

Both `catch` blocks are intentional fallbacks. The lesson store logs a failed save once (below), so nothing is silently lost.

`src/learn/lesson-store.ts`:

```ts
import { createStore, type StoreApi } from 'zustand/vanilla'
import { loadProgress, saveProgress, type KeyValueStorage, type LessonProgress } from './progress'
import { TUTORIALS } from './tutorials'
import type { Tutorial, TutorialStep } from './types'

export interface LessonState {
  readonly panelOpen: boolean
  /** The tutorial to show first in the list (from Help → Learn more). */
  readonly focused: string | null
  /** A tutorial just finished: the panel shows 🎉 until Kade goes back to the list. */
  readonly finished: string | null
  readonly progress: LessonProgress
  openPanel(focus?: string): void
  closePanel(): void
  togglePanel(): void
  begin(tutorialId: string, designId: string): void
  /** Next and Skip. On the last step it finishes the lesson. */
  next(): void
  back(): void
  quit(): void
  hideNudge(): void
  clearFinished(): void
}

export type LessonStore = StoreApi<LessonState>

export function currentStepOf(progress: LessonProgress, tutorials: readonly Tutorial[] = TUTORIALS): TutorialStep | undefined {
  const active = progress.active
  return active ? tutorials.find((t) => t.id === active.tutorialId)?.steps[active.step] : undefined
}

function sanitize(progress: LessonProgress, tutorials: readonly Tutorial[]): LessonProgress {
  const known = new Set(tutorials.map((t) => t.id))
  const active = progress.active
  const tutorial = active ? tutorials.find((t) => t.id === active.tutorialId) : undefined
  return {
    ...progress,
    done: progress.done.filter((id) => known.has(id)),
    active: active && tutorial ? { ...active, step: Math.min(active.step, tutorial.steps.length - 1) } : null,
  }
}

function finish(progress: LessonProgress, tutorialId: string): LessonProgress {
  const done = progress.done.includes(tutorialId) ? progress.done : [...progress.done, tutorialId]
  return { ...progress, done, active: null }
}

export function createLessonStore(storage: KeyValueStorage | null, tutorials: readonly Tutorial[] = TUTORIALS): LessonStore {
  const store = createStore<LessonState>()((set, get) => ({
    panelOpen: false,
    focused: null,
    finished: null,
    progress: sanitize(loadProgress(storage), tutorials),
    openPanel: (focus) => set({ panelOpen: true, focused: focus ?? null, ...(focus ? { finished: null } : {}) }),
    closePanel: () => set({ panelOpen: false }),
    togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
    begin: (tutorialId, designId) => set((s) => ({
      panelOpen: true, focused: tutorialId, finished: null,
      progress: { ...s.progress, active: { tutorialId, step: 0, designId } },
    })),
    next: () => {
      const { progress } = get()
      const active = progress.active
      if (!active) return
      const tutorial = tutorials.find((t) => t.id === active.tutorialId)
      if (!tutorial || active.step + 1 >= tutorial.steps.length) {
        set({ finished: active.tutorialId, progress: finish(progress, active.tutorialId) })
        return
      }
      set({ progress: { ...progress, active: { ...active, step: active.step + 1 } } })
    },
    back: () => set((s) => (s.progress.active
      ? { progress: { ...s.progress, active: { ...s.progress.active, step: Math.max(0, s.progress.active.step - 1) } } }
      : {})),
    quit: () => set((s) => ({ progress: { ...s.progress, active: null } })),
    hideNudge: () => set((s) => ({ progress: { ...s.progress, nudgeHidden: true } })),
    clearFinished: () => set({ finished: null }),
  }))
  let warned = false
  store.subscribe((state, previous) => {
    if (state.progress === previous.progress || saveProgress(storage, state.progress) || warned) return
    warned = true
    console.error('Lesson progress could not be saved in this browser. It will be forgotten when the page closes.')
  })
  return store
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/learn && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/learn
git commit -m "feat: remember lesson progress and track the active lesson"
```

---

### Task 5: Opening designs from one place, and starting or resuming a lesson

**Files:**
- Create: `src/app/design-session.ts`, `src/learn/start-lesson.ts`
- Modify: `src/ui/DesignsDialog.tsx`
- Test: `src/app/design-session.test.ts`, `src/learn/start-lesson.test.ts` (the existing `src/ui/DesignsDialog.test.tsx` must still pass unchanged)

**Interfaces:**
- Consumes: `DesignRepository`, `createMemoryDesignRepository`, `newId`, `createEmptyDocument`, `BloKadeStore`, `LessonStore` and `lessonDesignName`.
- Produces in `src/app/design-session.ts`:
  - `DesignSession { repo; store; flushAutosave(): Promise<void> }`
  - `switchToDesign(session, id, doc)`
  - `openFreshDesign(session, name): Promise<string>`
  - `openSavedDesign(session, id): Promise<Result<string>>`
- Produces in `src/learn/start-lesson.ts`:
  - `startLesson(session, lessons, tutorial): Promise<void>`
  - `resumeLesson(session, lessons): Promise<'resumed' | 'missing'>`
  - `LESSON_DESIGN_FAILED`

- [ ] **Step 1: Write the failing tests**

`src/app/design-session.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { createMemoryDesignRepository } from '../persistence/memory-repository'
import { createBloKadeStore } from '../store/store'
import { openFreshDesign, openSavedDesign } from './design-session'

function setup() {
  const repo = createMemoryDesignRepository()
  const store = createBloKadeStore({ designId: 'start', doc: createEmptyDocument('Start') })
  const flushAutosave = vi.fn(async () => undefined)
  return { repo, store, session: { repo, store, flushAutosave }, flushAutosave }
}

describe('design session', () => {
  it('saves a fresh design and opens it', async () => {
    const { repo, store, session, flushAutosave } = setup()
    const id = await openFreshDesign(session, 'Lesson: Your first shape')
    expect(flushAutosave).toHaveBeenCalled()
    expect(store.getState()).toMatchObject({ designId: id, history: { present: { name: 'Lesson: Your first shape' } } })
    expect((await repo.list()).map((d) => d.id)).toContain(id)
    expect(await repo.getLastOpened()).toBe(id)
  })

  it('opens a saved design, or explains that it is gone', async () => {
    const { repo, store, session } = setup()
    await repo.save('kept', createEmptyDocument('Kept'))
    expect(await openSavedDesign(session, 'kept')).toEqual({ ok: true, value: 'kept' })
    expect(store.getState().designId).toBe('kept')
    const missing = await openSavedDesign(session, 'gone')
    expect(missing.ok).toBe(false)
    expect(store.getState().designId).toBe('kept')
  })
})
```

If `Result`'s success shape isn't `{ ok: true, value }`, adapt the assertion to `src/shared/result.ts` and keep the meaning.

`src/learn/start-lesson.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { createMemoryDesignRepository } from '../persistence/memory-repository'
import type { DesignRepository } from '../persistence/repository'
import { createBloKadeStore } from '../store/store'
import { createLessonStore } from './lesson-store'
import { LESSON_DESIGN_FAILED, resumeLesson, startLesson } from './start-lesson'
import { firstShape } from './tutorials/first-shape'

function setup(repo: DesignRepository = createMemoryDesignRepository()) {
  const store = createBloKadeStore({ designId: 'mine', doc: createEmptyDocument('My robot') })
  const session = { repo, store, flushAutosave: async () => undefined }
  const lessons = createLessonStore(null)
  return { repo, store, session, lessons }
}

describe('startLesson', () => {
  it('opens a fresh practice design named after the tutorial and begins it', async () => {
    const { store, session, lessons } = setup()
    await startLesson(session, lessons, firstShape)
    const { designId, history } = store.getState()
    expect(history.present.name).toBe('Lesson: Your first shape')
    expect(lessons.getState().progress.active).toEqual({ tutorialId: 'first-shape', step: 0, designId })
  })

  it("explains when the practice design can't be made", async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const broken = { ...createMemoryDesignRepository(), save: async () => { throw new Error('quota') } }
    const { store, session, lessons } = setup(broken)
    await startLesson(session, lessons, firstShape)
    expect(store.getState().notice).toBe(LESSON_DESIGN_FAILED)
    expect(lessons.getState().progress.active).toBeNull()
    logged.mockRestore()
  })
})

describe('resumeLesson (Review Focus 2)', () => {
  it('goes back to the practice design', async () => {
    const { store, session, lessons } = setup()
    await startLesson(session, lessons, firstShape)
    const practice = store.getState().designId
    await session.repo.save('mine', createEmptyDocument('My robot'))
    store.getState().openDesign('mine', createEmptyDocument('My robot'))
    expect(await resumeLesson(session, lessons)).toBe('resumed')
    expect(store.getState().designId).toBe(practice)
  })

  it('reports a practice design that was deleted', async () => {
    const { store, session, lessons } = setup()
    await startLesson(session, lessons, firstShape)
    await session.repo.remove(store.getState().designId)
    store.getState().openDesign('mine', createEmptyDocument('My robot'))
    expect(await resumeLesson(session, lessons)).toBe('missing')
    expect(store.getState().designId).toBe('mine')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/design-session.test.ts src/learn/start-lesson.test.ts`
Expected: FAIL because the modules are missing.

- [ ] **Step 3: Implement**

`src/app/design-session.ts`:

```ts
import { createEmptyDocument, newId } from '../document/factory'
import type { BloKadeDocument } from '../document/types'
import type { DesignRepository } from '../persistence/repository'
import { ok, type Result } from '../shared/result'
import type { BloKadeStore } from '../store/store'

/** What it takes to switch the open design safely: save the current one first, then remember the new one. */
export interface DesignSession {
  readonly repo: DesignRepository
  readonly store: BloKadeStore
  flushAutosave(): Promise<void>
}

export async function switchToDesign(session: DesignSession, id: string, doc: BloKadeDocument): Promise<void> {
  await session.flushAutosave()
  session.store.getState().openDesign(id, doc)
  await session.repo.setLastOpened(id)
}

/** Saves a new empty design called `name` and opens it. Returns its id. */
export async function openFreshDesign(session: DesignSession, name: string): Promise<string> {
  await session.flushAutosave()
  const id = newId()
  const doc = createEmptyDocument(name)
  await session.repo.save(id, doc)
  await switchToDesign(session, id, doc)
  return id
}

export async function openSavedDesign(session: DesignSession, id: string): Promise<Result<string>> {
  const loaded = await session.repo.load(id)
  if (!loaded.ok) return loaded
  await switchToDesign(session, id, loaded.value)
  return ok(id)
}
```

`src/learn/start-lesson.ts`:

```ts
import { openFreshDesign, openSavedDesign, type DesignSession } from '../app/design-session'
import type { LessonStore } from './lesson-store'
import { lessonDesignName } from './names'
import type { Tutorial } from './types'

export const LESSON_DESIGN_FAILED = "BloKade couldn't make a design for this lesson. Try again in a moment."

export async function startLesson(session: DesignSession, lessons: LessonStore, tutorial: Tutorial): Promise<void> {
  try {
    const designId = await openFreshDesign(session, lessonDesignName(tutorial.title))
    lessons.getState().begin(tutorial.id, designId)
  } catch (error) {
    console.error('Could not start the lesson', error)
    session.store.getState().notify(LESSON_DESIGN_FAILED)
  }
}

/** Opens the active lesson's practice design again. 'missing' when it was deleted or can't be loaded. */
export async function resumeLesson(session: DesignSession, lessons: LessonStore): Promise<'resumed' | 'missing'> {
  const active = lessons.getState().progress.active
  if (!active) return 'missing'
  if (session.store.getState().designId === active.designId) return 'resumed'
  try {
    return (await openSavedDesign(session, active.designId)).ok ? 'resumed' : 'missing'
  } catch (error) {
    console.error('Could not reopen the lesson design', error)
    return 'missing'
  }
}
```

Refactor `src/ui/DesignsDialog.tsx`'s `useDesignActions` to use the session helpers. Behaviour must not change.

- Import `useMemo`, and `openFreshDesign`, `openSavedDesign` and `switchToDesign` from `../app/design-session`.
- Inside the hook, add `const session = useMemo(() => ({ repo, store, flushAutosave }), [repo, store, flushAutosave])`.
- Replace `open`, `createNew` and `openExisting` with:

```ts
  const open = async (id: string, doc: BloKadeDocument): Promise<void> => {
    await switchToDesign(session, id, doc)
    onClose()
  }
  const createNew = async (): Promise<void> => {
    await flushAutosave()
    const names = (await repo.list()).map((d) => d.name)
    await openFreshDesign(session, nextUntitledName(names))
    onClose()
  }
  const openExisting = async (id: string): Promise<void> => {
    const opened = await openSavedDesign(session, id)
    if (opened.ok) onClose()
    else notify(opened.error)
  }
```

`remove`, `duplicate` and `loadFile` keep calling `open`, `openExisting` and `createNew` as before. Remove the `createEmptyDocument` import if it becomes unused (keep `newId`, which `loadFile` uses).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app src/learn src/ui/DesignsDialog.test.tsx && npm run typecheck`
Expected: PASS, including every existing `DesignsDialog` test, unchanged.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: start and resume lessons in their own practice designs"
```

---

### Task 6: Moving to the next step when it's done

**Files:**
- Create: `src/learn/watch-steps.ts`
- Test: `src/learn/watch-steps.test.ts`

**Interfaces:**
- Consumes: `lessonView`, `isStepDone`, `LessonStore`, `currentStepOf` and `BloKadeStore`.
- Produces: `watchSteps(store, lessons, tutorials?): () => void` (returns an unsubscribe function) and the hook `useStepWatcher(store, lessons)`.

- [ ] **Step 1: Write the failing tests**

`src/learn/watch-steps.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createActions } from '../app/actions'
import { createEmptyDocument } from '../document/factory'
import { registry } from '../plugins/index'
import { createBloKadeStore } from '../store/store'
import { createLessonStore } from './lesson-store'
import { shapesOf } from './checks'
import type { Tutorial } from './types'
import { watchSteps } from './watch-steps'

const boxLesson: Tutorial = {
  id: 'boxes', title: 'Boxes', icon: '🟦', intro: 'i',
  steps: [
    { id: 'one', text: 'Add a box', hint: 'h', check: (v) => shapesOf(v, 'box').length >= 1 },
    { id: 'read', text: 'Read this', hint: 'h' },
    { id: 'two', text: 'Add another', hint: 'h', check: (v) => shapesOf(v, 'box').length >= 2 },
  ],
}

function setup() {
  const store = createBloKadeStore({ designId: 'practice', doc: createEmptyDocument() })
  const actions = createActions(store, registry)
  const lessons = createLessonStore(null, [boxLesson])
  lessons.getState().begin('boxes', 'practice')
  const stop = watchSteps(store, lessons, [boxLesson])
  const step = () => lessons.getState().progress.active?.step
  return { store, actions, lessons, stop, step }
}

describe('watchSteps', () => {
  it('moves on when a change makes the step done, and waits on reading steps', () => {
    const { actions, step, stop } = setup()
    expect(step()).toBe(0)
    actions.addShape('box')
    expect(step()).toBe(1)
    actions.addShape('cylinder')
    expect(step()).toBe(1)
    stop()
  })

  it('does not jump ahead from a step that is already done when Kade arrives at it (Review Focus 1)', () => {
    const { actions, lessons, step, stop } = setup()
    actions.addShape('box')
    actions.addShape('box')
    lessons.getState().next()
    expect(step()).toBe(2)
    actions.addShape('cylinder')
    expect(step()).toBe(2)
    lessons.getState().back()
    lessons.getState().back()
    expect(step()).toBe(0)
    actions.addShape('sphere')
    expect(step()).toBe(0)
    stop()
  })

  it('keeps waiting when Kade undoes their work (Review Focus 1)', () => {
    const { store, actions, step, stop } = setup()
    actions.addShape('cylinder')
    actions.undo()
    expect(step()).toBe(0)
    store.getState().apply((d) => d)
    expect(step()).toBe(0)
    stop()
  })

  it('ignores changes in another design (Review Focus 2)', () => {
    const { store, actions, step, stop } = setup()
    store.getState().openDesign('other', createEmptyDocument('Other'))
    actions.addShape('box')
    expect(step()).toBe(0)
    stop()
  })

  it('stops watching when unsubscribed', () => {
    const { actions, step, stop } = setup()
    stop()
    actions.addShape('box')
    expect(step()).toBe(0)
  })
})
```

In the "already done" test, the lesson moves to step 2 with two boxes already in the design. Adding a cylinder must not advance it. Then **Back** twice returns to step 0, which is already done, and adding a sphere must not advance it either.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/learn/watch-steps.test.ts`
Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement `src/learn/watch-steps.ts`**

```ts
import { useEffect } from 'react'
import type { BloKadeStore } from '../store/store'
import { currentStepOf, type LessonStore } from './lesson-store'
import { TUTORIALS } from './tutorials'
import type { Tutorial } from './types'
import { isStepDone, lessonView } from './view'

/**
 * Moves the active lesson on when a change to the design makes the current step's check turn true.
 * A step that is already done when Kade reaches it (e.g. after Back) waits for Next instead.
 */
export function watchSteps(store: BloKadeStore, lessons: LessonStore, tutorials: readonly Tutorial[] = TUTORIALS): () => void {
  let seen: { key: string; done: boolean } | null = null
  const evaluate = (): void => {
    const { progress } = lessons.getState()
    const active = progress.active
    const step = currentStepOf(progress, tutorials)
    if (!active || !step) {
      seen = null
      return
    }
    const view = lessonView(store.getState())
    if (view.designId !== active.designId) return
    const key = `${active.tutorialId}:${active.step}`
    const done = isStepDone(step, view)
    const arriving = seen?.key !== key
    const becameDone = !arriving && done && seen?.done === false
    seen = { key, done }
    if (becameDone) lessons.getState().next()
  }
  const stopStore = store.subscribe(evaluate)
  const stopLessons = lessons.subscribe(evaluate)
  evaluate()
  return () => {
    stopStore()
    stopLessons()
  }
}

export function useStepWatcher(store: BloKadeStore, lessons: LessonStore): void {
  useEffect(() => watchSteps(store, lessons), [store, lessons])
}
```

`seen` is a closure variable that the watcher owns, which is not shared state.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/learn && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/learn
git commit -m "feat: move lessons on when a step is done"
```

---

### Task 7: Finding the highlighted control, the highlight and bold text

**Files:**
- Create: `src/learn/target.ts`, `src/ui/LessonHighlight.tsx`, `src/ui/RichText.tsx`
- Test: `src/learn/target.test.ts`, `src/ui/RichText.test.tsx`

**Interfaces:**
- Produces:
  - `TargetRect { top; left; width; height }`
  - `findTargetRect(testId, doc?): TargetRect | null`
  - `useTargetRect(testId | undefined, intervalMs?)`
  - `LessonHighlight({ rect })`
  - `RichText({ text })`

- [ ] **Step 1: Write the failing tests**

`src/learn/target.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { findTargetRect } from './target'

const box = (top: number, left: number, width: number, height: number) =>
  ({ top, left, width, height, bottom: top + height, right: left + width, x: left, y: top, toJSON: () => ({}) }) as DOMRect

function place(html: string, rects: Record<string, DOMRect>) {
  document.body.innerHTML = html
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const id = this.getAttribute('data-rect') ?? ''
    return rects[id] ?? box(0, 0, 0, 0)
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('findTargetRect (Review Focus 5)', () => {
  it('finds a visible control by its test id', () => {
    place('<button data-testid="add-box" data-rect="b">Box</button>', { b: box(10, 20, 80, 30) })
    expect(findTargetRect('add-box')).toEqual({ top: 10, left: 20, width: 80, height: 30 })
  })

  it('returns null for missing, zero-size or off-screen controls', () => {
    place('<button data-testid="tiny" data-rect="t"></button><button data-testid="far" data-rect="f"></button>',
      { t: box(0, 0, 0, 0), f: box(5000, 10, 40, 20) })
    expect(findTargetRect('nope')).toBeNull()
    expect(findTargetRect('tiny')).toBeNull()
    expect(findTargetRect('far')).toBeNull()
  })

  it('returns null when the control is scrolled out of its panel', () => {
    place('<div style="overflow-y: auto" data-rect="panel"><input data-testid="fit" data-rect="fit"></div>',
      { panel: box(0, 0, 200, 300), fit: box(400, 10, 100, 20) })
    expect(findTargetRect('fit')).toBeNull()
  })

  it('ignores ids that are not plain test ids', () => {
    expect(findTargetRect('a"]; b')).toBeNull()
  })
})
```

`src/ui/RichText.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RichText } from './RichText'

describe('RichText', () => {
  it('makes **text** bold and leaves the rest alone', () => {
    const { container } = render(<p><RichText text="Click **Box**, then **Width**." /></p>)
    expect(container.querySelectorAll('strong')).toHaveLength(2)
    expect(container.textContent).toBe('Click Box, then Width.')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/learn/target.test.ts src/ui/RichText.test.tsx`
Expected: FAIL because the modules are missing.

- [ ] **Step 3: Implement**

`src/learn/target.ts`:

```ts
import { useEffect, useState } from 'react'

export interface TargetRect {
  readonly top: number
  readonly left: number
  readonly width: number
  readonly height: number
}

const TEST_ID = /^[a-z0-9-]+$/

function insideScrollParents(el: Element, rect: DOMRect): boolean {
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    const overflow = getComputedStyle(parent).overflowY
    if (overflow !== 'auto' && overflow !== 'scroll') continue
    const box = parent.getBoundingClientRect()
    if (rect.bottom <= box.top || rect.top >= box.bottom) return false
  }
  return true
}

/** Where a control is on screen, or null when it isn't visible (missing, zero size, off screen or scrolled away). */
export function findTargetRect(testId: string, doc: Document = document): TargetRect | null {
  if (!TEST_ID.test(testId)) return null
  const el = doc.querySelector(`[data-testid="${testId}"]`)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const view = doc.defaultView
  const onScreen = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0
    && (!view || (rect.top < view.innerHeight && rect.left < view.innerWidth))
  return onScreen && insideScrollParents(el, rect) ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null
}

const same = (a: TargetRect | null, b: TargetRect | null): boolean =>
  a === b || (a !== null && b !== null && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height)

/** Follows a control around as panels scroll, open and resize. */
export function useTargetRect(testId: string | undefined, intervalMs = 250): TargetRect | null {
  const [rect, setRect] = useState<TargetRect | null>(null)
  useEffect(() => {
    if (!testId) {
      setRect(null)
      return undefined
    }
    const update = (): void => setRect((previous) => {
      const next = findTargetRect(testId)
      return same(previous, next) ? previous : next
    })
    update()
    const timer = setInterval(update, intervalMs)
    return () => clearInterval(timer)
  }, [testId, intervalMs])
  return rect
}
```

The `for` loop over parents is a plain DOM walk. It mutates no data, only its loop variable.

`src/ui/LessonHighlight.tsx`:

```tsx
import { createPortal } from 'react-dom'
import type { TargetRect } from '../learn/target'

const PAD = 4

/** A pulsing outline around the control a lesson step is about. Clicks pass straight through it. */
export function LessonHighlight({ rect }: { rect: TargetRect }) {
  return createPortal(
    <div className="lesson-highlight" data-testid="lesson-highlight" aria-hidden="true"
      style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + 2 * PAD, height: rect.height + 2 * PAD }} />,
    document.body,
  )
}
```

`src/ui/RichText.tsx`:

```tsx
import { Fragment } from 'react'

/** Shows lesson and help text, where **text** is bold. That is the only markup. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/)
  return <>{parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>))}</>
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/learn src/ui/RichText.test.tsx && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: find and highlight the control a lesson step is about"
```

---

### Task 8: The Lessons panel and the 📘 Learn button

**Files:**
- Create: `src/ui/LessonsPanel.tsx`, `src/ui/LessonStep.tsx`
- Modify: `src/ui/Toolbar.tsx`, `src/ui/Workspace.tsx`, `src/ui/App.css`, `src/ui/Toolbar.test.tsx`
- Test: `src/ui/LessonsPanel.test.tsx`

**Interfaces:**
- Consumes: Tasks 3–7 and `useBloKade`.
- Produces:
  - `LessonsPanel({ lessons, session, tutorials? })`
  - `Toolbar` props gain `learnOpen: boolean` and `onLearn(): void`
  - `Workspace({ deps, lessons? })`, where the optional `lessons` is injected by tests
- Test ids: `learn`, `lessons-panel`, `lessons-close`, `lesson-start-<id>`, `lesson-done-<id>`, `lesson-step`, `lesson-find-it`, `lesson-next`, `lesson-skip`, `lesson-back`, `lesson-hint`, `lesson-hint-text`, `lesson-quit`, `lesson-go-back`, `lesson-restart`, `lesson-finished`, `lessons-list-back` and `lesson-highlight`.

- [ ] **Step 1: Write the failing tests**

`src/ui/LessonsPanel.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createActions } from '../app/actions'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument } from '../document/factory'
import { createLessonStore } from '../learn/lesson-store'
import { shapesOf } from '../learn/checks'
import type { Tutorial } from '../learn/types'
import { createMemoryDesignRepository } from '../persistence/memory-repository'
import { registry } from '../plugins/index'
import { createBloKadeStore } from '../store/store'
import { LessonsPanel } from './LessonsPanel'

const lesson: Tutorial = {
  id: 'boxes', title: 'Boxes', icon: '🟦', intro: 'Make boxes.',
  steps: [
    { id: 'add', text: 'Click **Box**.', target: 'add-box', hint: 'Top left.', check: (v) => shapesOf(v, 'box').length > 0 },
    { id: 'read', text: 'Well done.', hint: 'Just read it.' },
  ],
}

function setup() {
  const repo = createMemoryDesignRepository()
  const store = createBloKadeStore({ designId: 'mine', doc: createEmptyDocument('Mine') })
  const lessons = createLessonStore(null, [lesson])
  const session = { repo, store, flushAutosave: async () => undefined }
  renderWithStore(<LessonsPanel lessons={lessons} session={session} tutorials={[lesson]} />, store)
  return { repo, store, lessons, actions: createActions(store, registry) }
}

describe('LessonsPanel', () => {
  it('lists tutorials and starts one in a practice design', async () => {
    const { store } = setup()
    expect(screen.getByText('Make boxes.')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('lesson-start-boxes'))
    await waitFor(() => expect(store.getState().history.present.name).toBe('Lesson: Boxes'))
    expect(screen.getByTestId('lesson-step')).toHaveTextContent('Click Box.')
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument()
  })

  it('shows Skip until a step is done, then Done and Next, and finishes with a ✓', async () => {
    const { lessons, actions } = setup()
    await userEvent.click(screen.getByTestId('lesson-start-boxes'))
    await screen.findByTestId('lesson-skip')
    expect(screen.getByTestId('lesson-find-it')).toHaveTextContent("Can't see it? Top left.")
    await userEvent.click(screen.getByTestId('lesson-hint'))
    expect(screen.getByTestId('lesson-hint-text')).toHaveTextContent('Top left.')
    act(() => actions.addShape('box'))
    act(() => lessons.getState().back())
    expect(screen.getByText('✓ Done!')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('lesson-next'))
    expect(screen.getByTestId('lesson-step')).toHaveTextContent('Well done.')
    await userEvent.click(screen.getByTestId('lesson-next'))
    expect(screen.getByTestId('lesson-finished')).toHaveTextContent('You finished Boxes!')
    await userEvent.click(screen.getByTestId('lessons-list-back'))
    expect(screen.getByTestId('lesson-done-boxes')).toBeInTheDocument()
  })

  it('pauses in another design and goes back (Review Focus 2)', async () => {
    const { store, repo } = setup()
    await userEvent.click(screen.getByTestId('lesson-start-boxes'))
    const practice = await waitFor(() => {
      const id = store.getState().designId
      expect(id).not.toBe('mine')
      return id
    })
    await repo.save('mine', createEmptyDocument('Mine'))
    act(() => store.getState().openDesign('mine', createEmptyDocument('Mine')))
    expect(screen.getByText('This lesson uses its own design. Go back to it to keep going.')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('lesson-go-back'))
    await waitFor(() => expect(store.getState().designId).toBe(practice))
    expect(screen.getByTestId('lesson-step')).toBeInTheDocument()
  })

  it('offers Start again when the practice design is gone (Review Focus 2)', async () => {
    const { store, repo } = setup()
    await userEvent.click(screen.getByTestId('lesson-start-boxes'))
    await waitFor(() => expect(store.getState().designId).not.toBe('mine'))
    await repo.remove(store.getState().designId)
    act(() => store.getState().openDesign('mine', createEmptyDocument('Mine')))
    await userEvent.click(screen.getByTestId('lesson-go-back'))
    await userEvent.click(await screen.findByTestId('lesson-restart'))
    await waitFor(() => expect(store.getState().history.present.name).toBe('Lesson: Boxes'))
    expect(screen.getByTestId('lesson-step')).toBeInTheDocument()
  })

  it('stops a lesson and closes the panel', async () => {
    const { lessons } = setup()
    await userEvent.click(screen.getByTestId('lesson-start-boxes'))
    await userEvent.click(await screen.findByTestId('lesson-quit'))
    expect(lessons.getState().progress.active).toBeNull()
    await userEvent.click(screen.getByTestId('lessons-close'))
    expect(lessons.getState().panelOpen).toBe(false)
  })
})
```

This test renders the panel without the watcher, so auto-advance doesn't happen here (Task 6 covers that). In the second test, `addShape` makes step 1's check pass. `back()` then re-renders the same step, which is already done, and that shows "✓ Done!" and **Next**.

In `src/ui/Toolbar.test.tsx`, update the render to pass the new props, `learnOpen={false} onLearn={onLearn}` (where `const onLearn = vi.fn()`), and add:

```tsx
  it('opens the lessons', async () => {
    await userEvent.click(screen.getByTestId('learn'))
    expect(onLearn).toHaveBeenCalled()
  })
```

Follow that file's existing setup style. If its setup is a function, add `onLearn` to what it returns.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/LessonsPanel.test.tsx src/ui/Toolbar.test.tsx`
Expected: FAIL because the module is missing and there is no `learn` button.

- [ ] **Step 3: Write `src/ui/LessonStep.tsx`**

```tsx
import { useState } from 'react'
import type { DesignSession } from '../app/design-session'
import type { LessonStore } from '../learn/lesson-store'
import type { ActiveLesson } from '../learn/progress'
import { resumeLesson, startLesson } from '../learn/start-lesson'
import { useTargetRect } from '../learn/target'
import type { Tutorial } from '../learn/types'
import { isStepDone, lessonView } from '../learn/view'
import { useBloKade } from '../store/context'
import { LessonHighlight } from './LessonHighlight'
import { RichText } from './RichText'

interface LessonStepProps {
  lessons: LessonStore
  session: DesignSession
  tutorial: Tutorial
  active: ActiveLesson
}

function PausedLesson({ lessons, session, tutorial }: Omit<LessonStepProps, 'active'>) {
  const [missing, setMissing] = useState(false)
  const goBack = async (): Promise<void> => setMissing((await resumeLesson(session, lessons)) === 'missing')
  return (
    <div className="lesson-paused" role="status">
      <p>This lesson uses its own design. Go back to it to keep going.</p>
      {missing ? (
        <>
          <p className="hint">That lesson design is gone. You can start the lesson again.</p>
          <button type="button" className="tool-button" data-testid="lesson-restart"
            onClick={() => void startLesson(session, lessons, tutorial)}>Start again</button>
        </>
      ) : (
        <button type="button" className="tool-button" data-testid="lesson-go-back" onClick={() => void goBack()}>Go back</button>
      )}
      <button type="button" className="link-button" data-testid="lesson-quit" onClick={() => lessons.getState().quit()}>Stop this lesson</button>
    </div>
  )
}

/** One step of the active lesson: what to do, a highlight on the control, and Back / Skip / Next / Show me. */
export function LessonStep({ lessons, session, tutorial, active }: LessonStepProps) {
  const step = tutorial.steps[active.step]
  const paused = useBloKade((s) => s.designId !== active.designId)
  const done = useBloKade((s) => (step ? isStepDone(step, lessonView(s)) : false))
  const rect = useTargetRect(paused ? undefined : step?.target)
  const [showHint, setShowHint] = useState(false)
  if (!step) return null
  if (paused) return <PausedLesson lessons={lessons} session={session} tutorial={tutorial} />
  const { next, back, quit } = lessons.getState()
  const total = tutorial.steps.length
  const last = active.step + 1 === total
  return (
    <section className="lesson-step" aria-label={tutorial.title}>
      <h3><span aria-hidden="true">{tutorial.icon}</span> {tutorial.title}</h3>
      <p className="hint">Step {active.step + 1} of {total}</p>
      <progress className="lesson-progress" max={total} value={active.step} />
      <p className="lesson-text" data-testid="lesson-step"><RichText text={step.text} /></p>
      {step.target && !rect && <p className="hint" data-testid="lesson-find-it">Can't see it? {step.hint}</p>}
      {done && <p className="lesson-done" role="status">✓ Done!</p>}
      {showHint && <p className="lesson-hint" data-testid="lesson-hint-text">💡 {step.hint}</p>}
      <div className="lesson-actions">
        <button type="button" className="tool-button" data-testid="lesson-back" disabled={active.step === 0} onClick={back}>Back</button>
        {!step.check || done
          ? <button type="button" className="tool-button primary" data-testid="lesson-next" onClick={next}>{last ? 'Finish' : 'Next'}</button>
          : <button type="button" className="tool-button" data-testid="lesson-skip" onClick={next}>Skip</button>}
        <button type="button" className="tool-button" data-testid="lesson-hint" aria-pressed={showHint}
          onClick={() => setShowHint((shown) => !shown)}>💡 Show me</button>
      </div>
      <button type="button" className="link-button" data-testid="lesson-quit" onClick={quit}>Stop this lesson</button>
      {rect && <LessonHighlight rect={rect} />}
    </section>
  )
}
```

- [ ] **Step 4: Write `src/ui/LessonsPanel.tsx`**

```tsx
import { useStore } from 'zustand'
import type { DesignSession } from '../app/design-session'
import type { LessonStore } from '../learn/lesson-store'
import { startLesson } from '../learn/start-lesson'
import { TUTORIALS } from '../learn/tutorials'
import type { Tutorial } from '../learn/types'
import { LessonStep } from './LessonStep'

interface LessonsPanelProps {
  lessons: LessonStore
  session: DesignSession
  tutorials?: readonly Tutorial[]
}

function TutorialList({ lessons, session, tutorials }: Required<LessonsPanelProps>) {
  const done = useStore(lessons, (s) => s.progress.done)
  const focused = useStore(lessons, (s) => s.focused)
  return (
    <ol className="lesson-list">
      {tutorials.map((t) => {
        const finished = done.includes(t.id)
        return (
          <li key={t.id} className={t.id === focused ? 'lesson-item focused' : 'lesson-item'}>
            <span className="lesson-title">
              <span aria-hidden="true">{t.icon}</span> {t.title}
              {finished && <span className="lesson-check" data-testid={`lesson-done-${t.id}`} aria-label="Finished">✓</span>}
            </span>
            <p className="hint">{t.intro}</p>
            <button type="button" className="tool-button" data-testid={`lesson-start-${t.id}`}
              onClick={() => void startLesson(session, lessons, t)}>{finished ? 'Do it again' : 'Start'}</button>
          </li>
        )
      })}
    </ol>
  )
}

function Finished({ lessons, tutorials }: Pick<Required<LessonsPanelProps>, 'lessons' | 'tutorials'>) {
  const finished = useStore(lessons, (s) => s.finished)
  const title = tutorials.find((t) => t.id === finished)?.title ?? 'the lesson'
  return (
    <div className="lesson-finished" data-testid="lesson-finished" role="status">
      <p className="lesson-cheer">🎉 You finished <strong>{title}</strong>!</p>
      <button type="button" className="tool-button" data-testid="lessons-list-back"
        onClick={() => lessons.getState().clearFinished()}>Back to all lessons</button>
    </div>
  )
}

/** The 📘 Lessons column: the tutorial list, the active step, or a 🎉 when one is finished. */
export function LessonsPanel({ lessons, session, tutorials = TUTORIALS }: LessonsPanelProps) {
  const active = useStore(lessons, (s) => s.progress.active)
  const finished = useStore(lessons, (s) => s.finished)
  const tutorial = active ? tutorials.find((t) => t.id === active.tutorialId) : undefined
  return (
    <aside className="lessons-panel panel" aria-label="Lessons" data-testid="lessons-panel">
      <header className="lessons-header">
        <h2 data-help="panel-lessons">📘 Lessons</h2>
        <button type="button" className="icon-button" data-testid="lessons-close" aria-label="Close lessons"
          onClick={() => lessons.getState().closePanel()}>✕</button>
      </header>
      {active && tutorial
        ? <LessonStep key={`${tutorial.id}-${active.step}`} lessons={lessons} session={session} tutorial={tutorial} active={active} />
        : finished
          ? <Finished lessons={lessons} tutorials={tutorials} />
          : <TutorialList lessons={lessons} session={session} tutorials={tutorials} />}
    </aside>
  )
}
```

- [ ] **Step 5: Add the 📘 Learn button and wire the panel in**

`src/ui/Toolbar.tsx`: add `learnOpen: boolean` and `onLearn(): void` to `ToolbarProps` and destructure them. Then put this group right after the 📁 button:

```tsx
      <div className="toolbar-group">
        <button type="button" className="tool-button" data-testid="learn" aria-pressed={learnOpen} onClick={onLearn}>📘 Learn</button>
      </div>
```

`src/ui/Workspace.tsx` changes:
- Import `useStore` from `zustand`, `createLessonStore` and `LessonStore` from `../learn/lesson-store`, `browserStorage` from `../learn/progress`, `useStepWatcher` from `../learn/watch-steps`, `LessonsPanel` from `./LessonsPanel`, and `DesignSession` from `../app/design-session`.
- Change the signature to `export function Workspace({ deps, lessons: injected }: { deps: AppDeps; lessons?: LessonStore })`.
- After `flushAutosave` is created, add:

```tsx
  const [lessons] = useState<LessonStore>(() => injected ?? createLessonStore(browserStorage()))
  const session = useMemo<DesignSession>(() => ({ repo: deps.repo, store, flushAutosave }), [deps.repo, store, flushAutosave])
  useStepWatcher(store, lessons)
  const lessonsOpen = useStore(lessons, (s) => s.panelOpen)
```

- Use `<div className={lessonsOpen ? 'workspace with-lessons' : 'workspace'}>`.
- Pass `learnOpen={lessonsOpen} onLearn={() => lessons.getState().togglePanel()}` to `Toolbar`.
- Render `{lessonsOpen && <LessonsPanel lessons={lessons} session={session} />}` after the right panel.

`src/ui/App.css`, at the end:

```css
.workspace.with-lessons {
  grid-template-columns: 250px 1fr 290px 300px;
  grid-template-areas: 'toolbar toolbar toolbar toolbar' 'left viewport right lessons';
}
.lessons-panel { grid-area: lessons; overflow-y: auto; background: var(--panel); border-left: 1px solid var(--border); }
.lessons-header { display: flex; justify-content: space-between; align-items: center; }
.lesson-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.lesson-item { padding: 8px; border: 1px solid var(--border); border-radius: var(--radius); }
.lesson-item.focused { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); }
.lesson-title { display: flex; gap: 6px; align-items: center; font-weight: 700; }
.lesson-check { margin-left: auto; color: #1a7f37; font-weight: 800; }
.lesson-text { font-size: 1.05rem; line-height: 1.4; }
.lesson-progress { width: 100%; }
.lesson-done { color: #1a7f37; font-weight: 700; }
.lesson-hint { background: #fff8db; padding: 8px; border-radius: var(--radius); }
.lesson-actions { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.tool-button.primary { background: var(--accent); color: var(--accent-ink); }
.link-button { background: none; border: none; color: var(--muted); text-decoration: underline; cursor: pointer; padding: 0; }
.lesson-cheer { font-size: 1.2rem; }
.lesson-highlight {
  position: fixed; z-index: 2000; pointer-events: none;
  border: 3px solid var(--accent); border-radius: var(--radius);
  animation: lesson-pulse 1.2s ease-in-out infinite;
}
@keyframes lesson-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(79, 157, 255, 0.6); }
  50% { box-shadow: 0 0 0 8px rgba(79, 157, 255, 0); }
}
```

If `.tool-button.primary` or `.link-button` already exist, reuse them instead of adding duplicates.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: all PASS, typecheck clean, build OK.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: add the Lessons panel and the Learn button"
```

---

### Task 9: Help texts for every control

**Files:**
- Create: `src/help/types.ts`, `src/help/help-texts.ts`, `src/help/help-patterns.ts`, `src/help/lookup.ts`, `src/app/testing/main-screen.tsx`
- Modify (add `data-help` attributes only): `src/ui/Toolbar.tsx`, `src/ui/ShapePalette.tsx`, `src/ui/SceneTree.tsx`, `src/ui/PropertiesPanel.tsx`, `src/ui/VariablesPanel.tsx`, `src/ui/Toasts.tsx`
- Test: `src/help/lookup.test.ts`, `src/help/coverage.test.tsx`, `src/learn/tutorial-targets.test.tsx`

**Interfaces:**
- Produces:
  - `HelpEntry { tip; card; tryIt?; tutorial? }`
  - `HELP_TEXTS` and `HELP_PATTERNS`
  - `helpKeyOf(element): { key; label; element } | null`
  - `helpFor(key, label?): HelpEntry | null`
  - `NO_HELP: HelpEntry`
  - `renderMainScreen(store, lessons?)` and `sampleStores()` (test helpers)
- `data-help` ids added in this task:
  - `grid-snap` (Toolbar `<select>`);
  - `panel-shapes`, `panel-fit-tools` (ShapePalette `h2`s);
  - `panel-parts` (SceneTree `h2`), `tree-row` (tree row `div`), `tree-mode`, `tree-hide` (the two icon buttons), `tree-rename` (the rename `input`);
  - `panel-properties` (all three PropertiesPanel `h2`s);
  - `panel-variables` (VariablesPanel `h2`);
  - `toast-dismiss` (the Toasts ✕ button).

  Task 8 already added `panel-lessons`.

- [ ] **Step 1: Write the failing tests**

`src/help/lookup.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { HELP_TEXTS } from './help-texts'
import { helpFor, helpKeyOf } from './lookup'

describe('helpFor', () => {
  it('finds exact help', () => {
    expect(helpFor('mode-hole')?.tip).toBe(HELP_TEXTS['mode-hole']?.tip)
  })

  it('fills in names for families of controls', () => {
    expect(helpFor('add-cylinder', 'Cylinder')?.tip).toBe('Adds a Cylinder to your design.')
    expect(helpFor('add-kit-peg-socket', 'Peg & socket')?.tip).toBe('Adds a matched Peg & socket set that fits together.')
    expect(helpFor('param-width', 'Width (mm)')?.tip).toBe('Changes Width (mm). Type a number or a formula, then press Enter.')
    expect(helpFor('mod-radius-0')).not.toBeNull()
    expect(helpFor('mod-spacing-x-1')).not.toBeNull()
    expect(helpFor('align-x-min')).not.toBeNull()
    expect(helpFor('lesson-start-first-shape', 'Start')).not.toBeNull()
  })

  it('has no help for unknown ids', () => {
    expect(helpFor('nope')).toBeNull()
  })

  it('keeps every tip to one short sentence', () => {
    for (const [key, entry] of Object.entries(HELP_TEXTS)) {
      expect(entry.tip.length, key).toBeLessThanOrEqual(110)
      expect(entry.card.length, key).toBeGreaterThan(entry.tip.length - 1)
    }
  })
})

describe('helpKeyOf', () => {
  it('uses the nearest data-help or data-testid, and visible text as the label', () => {
    document.body.innerHTML = `
      <button data-testid="add-box"><span aria-hidden="true">🟦</span>Box</button>
      <label class="field"><span>Width (mm)</span><input data-testid="param-width"></label>
      <h2 data-help="panel-parts">Parts <em id="inner">here</em></h2>`
    const button = document.querySelector('[data-testid="add-box"] span')
    expect(button && helpKeyOf(button)).toMatchObject({ key: 'add-box', label: 'Box' })
    const input = document.querySelector('input')
    expect(input && helpKeyOf(input)).toMatchObject({ key: 'param-width', label: 'Width (mm)' })
    const inner = document.getElementById('inner')
    expect(inner && helpKeyOf(inner)?.key).toBe('panel-parts')
    expect(helpKeyOf(document.body)).toBeNull()
  })
})
```

`src/app/testing/main-screen.tsx`:

```tsx
import { render } from '@testing-library/react'
import { createEmptyDocument, createShapeNode } from '../../document/factory'
import { addModifier } from '../../document/modifiers'
import { addNode } from '../../document/ops'
import type { BloKadeDocument } from '../../document/types'
import type { LessonStore } from '../../learn/lesson-store'
import { StoreProvider } from '../../store/context'
import { createBloKadeStore, type BloKadeStore } from '../../store/store'
import { Workspace } from '../../ui/Workspace'
import { fakeDeps } from './fakes'

/** The whole main screen. Test files must `vi.mock('../viewport/Viewport', …)` (path relative to them) first. */
export function renderMainScreen(store: BloKadeStore, lessons?: LessonStore) {
  return render(<StoreProvider store={store}><Workspace deps={fakeDeps()} lessons={lessons} /></StoreProvider>)
}

function richDoc(): BloKadeDocument {
  const box = createShapeNode({ id: 'b', shapeType: 'box', name: 'Box', params: { width: 20, depth: 20, height: 20 }, color: '#fff' })
  const cyl = createShapeNode({ id: 'c', shapeType: 'cylinder', name: 'Cylinder', params: { diameter: 20, height: 20 }, color: '#fff' })
  const withParts = addNode(addNode({ ...createEmptyDocument('Sample'), variables: [{ name: 'wall', expr: '3' }] }, box), cyl)
  // Order matters: tutorials point at mod-radius-0 (fillet) and mod-count-1 (linearPattern).
  const types = ['fillet', 'linearPattern', 'chamfer', 'circularPattern', 'mirror'] as const
  return types.reduce((d, type) => addModifier(d, 'b', type).doc, withParts)
}

/** Stores that between them show every control on the main screen. */
export function sampleStores(): BloKadeStore[] {
  const one = createBloKadeStore({ designId: 'one', doc: richDoc() })
  one.getState().select(['b'])
  one.getState().setWorkplane({ origin: [0, 0, 20], rotation: [0, 0, 0] })
  one.getState().notify('A message')
  const cylinder = createBloKadeStore({ designId: 'cyl', doc: richDoc() })
  cylinder.getState().select(['c'])
  const two = createBloKadeStore({ designId: 'two', doc: richDoc() })
  two.getState().select(['b', 'c'])
  const empty = createBloKadeStore({ designId: 'empty', doc: createEmptyDocument() })
  return [one, cylinder, two, empty]
}
```

`src/help/coverage.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderMainScreen, sampleStores } from '../app/testing/main-screen'
import { createLessonStore } from '../learn/lesson-store'
import { helpFor, helpKeyOf } from './lookup'

vi.mock('../viewport/Viewport', () => ({ Viewport: () => null }))
afterEach(cleanup)

function missingHelp(): string[] {
  return [...document.querySelectorAll('button, input, select, textarea')].flatMap((el) => {
    const found = helpKeyOf(el)
    const entry = found ? helpFor(found.key, found.label) : null
    return entry ? [] : [el.outerHTML.slice(0, 120)]
  })
}

describe('help coverage', () => {
  it('has help for every control on the main screen', () => {
    for (const store of sampleStores()) {
      renderMainScreen(store)
      expect(missingHelp()).toEqual([])
      cleanup()
    }
  })

  it('has help for every control in the Lessons panel', () => {
    const lessons = createLessonStore(null)
    lessons.getState().openPanel()
    renderMainScreen(sampleStores()[3]!, lessons)
    expect(missingHelp()).toEqual([])
    cleanup()
    lessons.getState().begin('first-shape', 'empty')
    renderMainScreen(sampleStores()[3]!, lessons)
    expect(missingHelp()).toEqual([])
  })
})
```

`src/learn/tutorial-targets.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderMainScreen, sampleStores } from '../app/testing/main-screen'
import { createMemoryDesignRepository } from '../persistence/memory-repository'
import { StoreProvider } from '../store/context'
import { DesignsDialog } from '../ui/DesignsDialog'
import { TUTORIALS } from './tutorials'

vi.mock('../viewport/Viewport', () => ({ Viewport: () => <div data-testid="viewport-canvas" /> }))
afterEach(cleanup)

function renderedIds(): Set<string> {
  return new Set([...document.querySelectorAll('[data-testid]')].map((el) => el.getAttribute('data-testid') ?? ''))
}

describe('tutorial targets', () => {
  it('only point at controls that exist in the app', () => {
    const ids = new Set<string>()
    for (const store of sampleStores()) {
      renderMainScreen(store)
      for (const id of renderedIds()) ids.add(id)
      cleanup()
      render(<StoreProvider store={store}><DesignsDialog repo={createMemoryDesignRepository()} flushAutosave={async () => undefined} onClose={() => undefined} /></StoreProvider>)
      for (const id of renderedIds()) ids.add(id)
      cleanup()
    }
    // Variables a lesson creates have names the sample design doesn't use.
    const dynamic = (target: string) => /^var-(name-var1|expr-wall)$/.test(target)
    const missing = TUTORIALS.flatMap((t) => t.steps.flatMap((s) =>
      s.target && !ids.has(s.target) && !dynamic(s.target) ? [`${t.id}/${s.id} → ${s.target}`] : []))
    expect(missing).toEqual([])
  })
})
```

The sample design has a variable named `wall`, so `var-expr-wall` is rendered. `var-name-var1` isn't, which is why the `dynamic` exception exists; the end-to-end tests in Task 12 cover it for real. The sample's modifier order puts the fillet at index 0 and the row repeat at index 1, matching `mod-radius-0` and `mod-count-1` in the round-repeat tutorial.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/help src/learn/tutorial-targets.test.tsx`
Expected: FAIL because the modules are missing.

- [ ] **Step 3: Write the help types, texts, patterns and lookup**

`src/help/types.ts`:

```ts
export interface HelpEntry {
  /** One short sentence for the hover bubble. */
  readonly tip: string
  /** A few sentences for the ❓ help card. */
  readonly card: string
  /** Something to try, shown on the help card. */
  readonly tryIt?: string
  /** A tutorial that teaches this (opens from "Learn more →"). */
  readonly tutorial?: string
}
```

`src/help/help-texts.ts`:

```ts
import type { HelpEntry } from './types'

/** Help for controls with a fixed data-testid or data-help id. Families like add-* are in help-patterns.ts. */
export const HELP_TEXTS: Readonly<Record<string, HelpEntry>> = {
  // Top bar
  'open-designs': { tip: 'Opens Designs: rename, open, save to a file or start a new design.', card: 'Every design you make is kept in this browser. Designs lets you switch between them, give this one a name, save a copy to a file, or load one back.', tutorial: 'undo-save' },
  undo: { tip: 'Takes back your last change.', card: 'Undo goes back one change each time you click it. Ctrl+Z does the same.', tryIt: 'Delete a part, then click Undo.', tutorial: 'undo-save' },
  redo: { tip: 'Puts back a change you undid.', card: 'Redo does the change again after an Undo. Ctrl+Shift+Z does the same.', tutorial: 'undo-save' },
  group: { tip: 'Joins the selected parts into one. Holes cut the solids in their group.', card: 'Select two or more parts (hold Shift to pick more), then click Group. Holes in a group cut away the solid parts in that group.', tryIt: 'Make a cylinder a hole, select it and a box, then Group.', tutorial: 'holes-groups' },
  ungroup: { tip: 'Splits a group back into its parts.', card: 'Select a group and click Ungroup to change its pieces one by one again.', tutorial: 'holes-groups' },
  duplicate: { tip: 'Makes a copy of the selected parts.', card: 'Duplicate copies the selected parts, right where they are. Move the copy away to see it. Ctrl+D does the same.' },
  delete: { tip: 'Removes the selected parts.', card: 'Delete removes the selected parts. Changed your mind? Click Undo.', tutorial: 'undo-save' },
  'tool-move': { tip: 'Shows arrows to slide the selected part.', card: 'With Move on, drag an arrow in the 3D view to slide the part along it. You can also type exact numbers into Position.', tutorial: 'move-turn-size' },
  'tool-rotate': { tip: 'Shows rings to turn the selected part.', card: 'With Rotate on, drag a ring in the 3D view to turn the part. You can also type angles into Rotation.', tutorial: 'move-turn-size' },
  'tool-size': { tip: 'Shows handles to stretch the selected part.', card: 'With Size on, drag a handle in the 3D view to make the part bigger or smaller. You can also type sizes under Size.', tutorial: 'move-turn-size' },
  workplane: { tip: 'Click this, then click a face to build on it.', card: 'A workplane is where new shapes appear. Click Workplane, then click a face of a part. New shapes will stand on that face.', tryIt: 'Pick the top of a box, then add a cone.', tutorial: 'workplane' },
  'workplane-reset': { tip: 'Builds on the floor again.', card: 'Ground puts the workplane back on the floor grid, where new shapes normally appear.', tutorial: 'workplane' },
  'grid-snap': { tip: 'How far parts jump when you drag them.', card: 'Snap makes dragged parts jump in steps, like 1 mm, so they line up neatly. Pick Off to drag smoothly.' },
  'export-stl': { tip: 'Downloads an STL file for your 3D printer’s slicer.', card: 'STL is the file most slicers open. It holds the shape of everything that isn’t a loose hole.', tutorial: 'ready-to-print' },
  'export-3mf': { tip: 'Downloads a 3MF file, which keeps colours too.', card: '3MF is a newer printer file. Slicers like PrusaSlicer and Bambu Studio open it and keep your colours.', tutorial: 'ready-to-print' },
  'export-step': { tip: 'Downloads a STEP file for other CAD programs.', card: 'STEP keeps exact curves. Use it to open your design in programs like Fusion or FreeCAD. Printers need STL or 3MF.' },
  learn: { tip: 'Opens the lessons: step-by-step guides to BloKade.', card: 'Lessons walk you through BloKade one step at a time. Each lesson uses its own practice design, so your work stays safe.' },
  'help-mode': { tip: 'Help mode: click anything to learn what it does.', card: 'In help mode, clicking a button shows what it does instead of doing it. Press Esc or ❓ again to stop.' },
  // Panel headings
  'panel-shapes': { tip: 'Shapes you can add. Click one to add it.', card: 'Click a shape to add it to your design. It appears in the middle, or on your workplane.', tutorial: 'first-shape' },
  'panel-fit-tools': { tip: 'Parts that fit together: pegs, screws, threads and clips.', card: 'Fit tools make parts that go together after printing. They all leave a little extra room, set by the Fit gap.', tutorial: 'perfect-fit' },
  'panel-parts': { tip: 'Every part in your design. Click one to select it.', card: 'Parts lists everything in your design. Click to select, Shift-click to select more, double-click to rename, and drag a part onto a group to put it inside.' },
  'panel-properties': { tip: 'Settings for the selected part.', card: 'Properties shows the name, size, position and modifiers of the selected part. Select two parts to line them up or check if they overlap.' },
  'panel-variables': { tip: 'Named numbers you can use in any box.', card: 'A variable is a number with a name, like wall = 3. Type its name into any size box, and change it here to change every part that uses it.', tutorial: 'smart-sizes' },
  'panel-lessons': { tip: 'Step-by-step lessons.', card: 'Pick a lesson and press Start. Each step tells you what to do and ticks itself off when you have done it.' },
  // Parts list
  'tree-row': { tip: 'Click to select. Shift-click to select more. Double-click to rename.', card: 'Click a row to select that part. Hold Shift to add more parts. Double-click the name to rename it. Drag it onto a group to move it inside.' },
  'tree-mode': { tip: 'Switches this part between solid and hole.', card: 'A solid is a real part. A hole is empty space that cuts the solids in its group.', tutorial: 'holes-groups' },
  'tree-hide': { tip: 'Hides or shows this part in the 3D view.', card: 'Hidden parts are still in your design and still print. Hiding just gets them out of the way while you work.' },
  'tree-rename': { tip: 'Type a new name, then press Enter.', card: 'Press Enter to keep the new name, or Esc to keep the old one.' },
  'drop-top-level': { tip: 'Drop a part here to take it out of its group.', card: 'Dragging a part here moves it out of its group to the top of the list.' },
  // Properties
  'prop-name': { tip: 'The name of this part.', card: 'Names help you find parts in the Parts list. Type a new one and press Enter.' },
  'mode-solid': { tip: 'Makes this part a real, solid part.', card: 'Solid parts are what gets printed.', tutorial: 'holes-groups' },
  'mode-hole': { tip: 'Turns this part into empty space. Group it with a solid to cut it out.', card: 'A hole cuts away the solid parts in its group. Make a cylinder a hole and group it with a box to drill through the box.', tryIt: 'Add a box and a cylinder, make the cylinder a hole, and Group them.', tutorial: 'holes-groups' },
  'pos-x': { tip: 'How far left or right the part is, in mm.', card: 'x moves the part left (smaller) or right (bigger). 0 is the middle of the grid.', tutorial: 'move-turn-size' },
  'pos-y': { tip: 'How far forward or back the part is, in mm.', card: 'y moves the part toward you (smaller) or away (bigger).', tutorial: 'move-turn-size' },
  'pos-z': { tip: 'How high the part is, in mm.', card: 'z lifts the part up. 0 means it sits on the floor.', tutorial: 'move-turn-size' },
  'rot-x': { tip: 'Tips the part forward or back, in degrees.', card: 'Rotation x turns the part around the left-right line. 90 lays it on its side.', tutorial: 'move-turn-size' },
  'rot-y': { tip: 'Tips the part left or right, in degrees.', card: 'Rotation y turns the part around the front-back line.', tutorial: 'move-turn-size' },
  'rot-z': { tip: 'Spins the part like a turntable, in degrees.', card: 'Rotation z turns the part around the up line, like spinning a top.', tutorial: 'move-turn-size' },
  'add-modifier': { tip: 'Adds a change to this part: round edges, repeat or mirror.', card: 'Modifiers change a part after it is made. They run from top to bottom, and you can turn each one off with its checkbox.', tutorial: 'round-repeat' },
  'check-overlap': { tip: 'Checks if the two selected parts bump into each other.', card: 'Check overlap shows in red where two parts take up the same space. Parts that should slide together must not overlap.', tutorial: 'perfect-fit' },
  // Variables
  fit: { tip: 'Extra room so printed parts slide together. Bigger = looser.', card: 'Fit gap is how much bigger holes are than the parts that go in them. If your printed parts are too tight, make it bigger.', tutorial: 'perfect-fit' },
  'add-variable': { tip: 'Adds a named number you can use in any box.', card: 'After adding one, give it a name like wall. Then type wall into any size box. Change it once, and every part using it changes.', tutorial: 'smart-sizes' },
  // Messages and nudges
  'toast-dismiss': { tip: 'Hides this message.', card: 'Messages go away by themselves after a few seconds. Click ✕ to hide one now.' },
  'nudge-start': { tip: 'Starts the first lesson.', card: 'The first lesson shows you how to add a shape and change its size.', tutorial: 'first-shape' },
  'nudge-hide': { tip: 'Stops showing this tip.', card: 'You can still find every lesson under 📘 Learn in the top bar.' },
  // Lessons panel
  'lessons-close': { tip: 'Closes the lessons. Your place is kept.', card: 'Closing the lessons keeps your place. Click 📘 Learn to come back.' },
  'lesson-next': { tip: 'Goes to the next step.', card: 'Next goes on to the next step of the lesson.' },
  'lesson-skip': { tip: 'Skips this step.', card: 'Skip moves on without doing this step. You can always do the lesson again.' },
  'lesson-back': { tip: 'Goes back one step.', card: 'Back shows the step before this one.' },
  'lesson-hint': { tip: 'Shows a hint for this step.', card: 'Show me gives a longer hint, with where to find the button you need.' },
  'lesson-quit': { tip: 'Stops this lesson.', card: 'Stopping keeps the practice design. Start the lesson again any time.' },
  'lesson-go-back': { tip: 'Opens this lesson’s practice design again.', card: 'Each lesson has its own design. Go back opens it so you can keep going.' },
  'lesson-restart': { tip: 'Starts this lesson again in a new practice design.', card: 'The old practice design is gone, so this makes a fresh one.' },
  'lessons-list-back': { tip: 'Shows all the lessons again.', card: 'Back to all lessons shows the list, with a ✓ next to the ones you finished.' },
}
```

If a tip in this table is longer than 110 characters, shorten it rather than relaxing the test.

`src/help/help-patterns.ts`:

```ts
import type { HelpEntry } from './types'

export interface HelpPattern {
  readonly pattern: RegExp
  entry(label: string, match: RegExpMatchArray): HelpEntry
}

const MOD_TEXT: Readonly<Record<string, HelpEntry>> = {
  enabled: { tip: 'Turns this modifier on or off.', card: 'Untick a modifier to see the part without it. Nothing is lost.' },
  up: { tip: 'Moves this modifier up the list.', card: 'Modifiers run from top to bottom, so the order can change the result.' },
  down: { tip: 'Moves this modifier down the list.', card: 'Modifiers run from top to bottom, so the order can change the result.' },
  delete: { tip: 'Removes this modifier.', card: 'This removes just the modifier. The part stays.' },
  edges: { tip: 'Which edges to round or bevel.', card: 'Pick a group of edges, like Top edges, or "Edges I pick" to click the exact ones.', tutorial: 'round-repeat' },
  pick: { tip: 'Click edges in the 3D view to choose them.', card: 'While picking, click edges in the 3D view to add or remove them. Press Esc or click empty space when done.' },
  axis: { tip: 'Which line the copies go around.', card: 'Repeat in a circle places copies around this line, like spokes on a wheel.' },
  plane: { tip: 'Which side the mirror copy goes to.', card: 'The mirror copy appears on the other side of this flat line.' },
  keep: { tip: 'Keeps the original as well as the mirror copy.', card: 'Untick it to keep only the mirrored part.' },
  radius: { tip: 'How round the edges are, in mm.', card: 'Bigger roundness makes softer edges. Too big for the part shows a warning.', tutorial: 'round-repeat' },
  distance: { tip: 'How big the bevel is, in mm.', card: 'A bevel cuts the edge off at a slant. Bigger cuts more.' },
  count: { tip: 'How many copies in total.', card: 'This counts the original too. 3 means the part and two copies.', tutorial: 'round-repeat' },
  angle: { tip: 'How far around the copies spread, in degrees.', card: '360 spreads them all the way around. 180 spreads them over half a circle.' },
  spacing: { tip: 'The step from one copy to the next, in mm.', card: 'Each copy moves this far from the one before. x is left-right, y is front-back and z is up.' },
  center: { tip: 'The middle of the circle, from the part’s own centre, in mm.', card: 'Copies go around this point. 0, 0, 0 is the middle of the part.' },
}

const ALIGN_AXIS: Readonly<Record<string, string>> = { x: 'left to right', y: 'front to back', z: 'bottom to top' }

/** Families of controls. Checked in order, so more specific patterns come first. */
export const HELP_PATTERNS: readonly HelpPattern[] = [
  { pattern: /^add-kit-.+$/, entry: (label) => ({ tip: `Adds a matched ${label} set that fits together.`, card: `${label} adds parts that are linked by variables, so they stay matched when you change one.`, tutorial: 'perfect-fit' }) },
  { pattern: /^add-.+$/, entry: (label) => ({ tip: `Adds a ${label} to your design.`, card: `Click to add a ${label}. Change its size in Properties on the right.`, tutorial: 'first-shape' }) },
  { pattern: /^param-.+$/, entry: (label) => ({ tip: `Changes ${label}. Type a number or a formula, then press Enter.`, card: `${label} is one of this part's settings. You can type a number, or a formula like wall * 2 that uses your variables.`, tutorial: 'smart-sizes' }) },
  { pattern: /^var-name-.+$/, entry: () => ({ tip: 'The variable’s name. Use it in any size box.', card: 'Names can use letters, numbers and _. Renaming a variable updates every formula that uses it.', tutorial: 'smart-sizes' }) },
  { pattern: /^var-expr-.+$/, entry: () => ({ tip: 'The variable’s value: a number or a formula.', card: 'Change this, and every part that uses the variable changes too.', tutorial: 'smart-sizes' }) },
  { pattern: /^var-delete-.+$/, entry: () => ({ tip: 'Deletes this variable.', card: 'Parts that used it keep their current sizes.' }) },
  { pattern: /^align-([xyz])-(min|center|max)$/, entry: (_label, m) => ({ tip: `Lines the selected parts up ${ALIGN_AXIS[m[1] ?? 'x'] ?? ''}.`, card: 'Line up moves the selected parts so their edges or middles match.' }) },
  { pattern: /^mod-([a-z]+)-(?:[xyz]-)?\d+$/, entry: (_label, m) => MOD_TEXT[m[1] ?? ''] ?? { tip: 'A setting for this modifier.', card: 'Change it and the part updates.' } },
  { pattern: /^lesson-start-.+$/, entry: () => ({ tip: 'Starts this lesson in a new practice design.', card: 'Lessons use their own design, so your work stays safe.' }) },
]
```

`src/help/lookup.ts`:

```ts
import { HELP_PATTERNS } from './help-patterns'
import { HELP_TEXTS } from './help-texts'
import type { HelpEntry } from './types'

export const NO_HELP: HelpEntry = { tip: '', card: 'No help for this yet.' }

const MAX_LABEL = 40

function visibleText(el: Element): string {
  const parts: string[] = []
  const walk = (node: Node): void => {
    if (node instanceof Element && node.getAttribute('aria-hidden') === 'true') return
    if (node.nodeType === Node.TEXT_NODE) parts.push(node.textContent ?? '')
    node.childNodes.forEach(walk)
  }
  walk(el)
  return parts.join('').replace(/\s+/g, ' ').trim()
}

function labelOf(el: HTMLElement): string {
  const fieldLabel = el.closest('label')?.querySelector('span')
  const text = el.getAttribute('aria-label') ?? (fieldLabel ? visibleText(fieldLabel) : visibleText(el))
  return text.slice(0, MAX_LABEL)
}

/** The help id of the control under the pointer: the nearest data-help, else the nearest data-testid. */
export function helpKeyOf(target: Element): { key: string; label: string; element: HTMLElement } | null {
  const el = target.closest<HTMLElement>('[data-help], [data-testid]')
  if (!el) return null
  const key = el.getAttribute('data-help') ?? el.getAttribute('data-testid') ?? ''
  return key ? { key, label: labelOf(el), element: el } : null
}

export function helpFor(key: string, label = ''): HelpEntry | null {
  if (Object.hasOwn(HELP_TEXTS, key)) return HELP_TEXTS[key] ?? null
  for (const p of HELP_PATTERNS) {
    const match = key.match(p.pattern)
    if (match) return p.entry(label || key, match)
  }
  return null
}
```

`helpKeyOf` prefers `data-help` over `data-testid` on the same element. It also takes whichever of the two is nearer. For example, the scene-tree buttons sit inside a `tree-row` with `data-help`, and the buttons carry their own `data-help`.

The `parts.push` in `visibleText` builds a local array, which is fine.

- [ ] **Step 4: Add the `data-help` attributes**

- `Toolbar.tsx`: `<select data-help="grid-snap" aria-label="Grid snap" …>`.
- `ShapePalette.tsx`: `<h2 data-help="panel-shapes">Shapes</h2>` and `<h2 data-help="panel-fit-tools">Fit tools</h2>`.
- `SceneTree.tsx`:
  - `<h2 data-help="panel-parts">Parts</h2>`;
  - the `role="treeitem"` div gets `data-help="tree-row"`;
  - the solid/hole icon button gets `data-help="tree-mode"`;
  - the show/hide icon button gets `data-help="tree-hide"`;
  - the `RenameInput` `<input>` gets `data-help="tree-rename"`.
- `PropertiesPanel.tsx`: each of the three `<h2>Properties</h2>` gets `data-help="panel-properties"`.
- `VariablesPanel.tsx`: `<h2 data-help="panel-variables">Variables</h2>`.
- `Toasts.tsx`: the ✕ button gets `data-help="toast-dismiss"`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS.

If the coverage test lists a control with no help:
- If it has a `data-testid`, add an entry to `HELP_TEXTS` (or extend a pattern) in the same style.
- If it has no id at all, give it a `data-help` id and an entry.

List every addition in your report.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat: write help for every control"
```

---

### Task 10: Tooltips and ❓ help mode

**Files:**
- Create: `src/ui/HelpTooltips.tsx`, `src/ui/HelpMode.tsx`
- Modify: `src/ui/Toolbar.tsx`, `src/ui/Workspace.tsx`, `src/ui/App.css`, `src/ui/Toolbar.test.tsx`
- Test: `src/ui/HelpTooltips.test.tsx`, `src/ui/HelpMode.test.tsx`

**Interfaces:**
- Consumes: `helpKeyOf`, `helpFor`, `NO_HELP`, `currentStepOf` and `RichText`.
- Produces:
  - `TOOLTIP_DELAY_MS = 500`
  - `HelpTooltips({ suppressKey, disabled })`
  - `HelpMode({ active, onExit, onLearnMore })`
  - `Toolbar` props gain `helpMode: boolean` and `onHelpMode(): void`
- Test ids: `help-mode` (it also has `data-help-toggle`), `help-tooltip`, `help-card`, `help-card-close` and `help-card-learn`.

- [ ] **Step 1: Write the failing tests**

`src/ui/HelpTooltips.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HelpTooltips, TOOLTIP_DELAY_MS } from './HelpTooltips'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function setup(props: { suppressKey?: string | null; disabled?: boolean } = {}) {
  render(<>
    <button type="button" data-testid="mode-hole">Hole</button>
    <button type="button" data-testid="mystery">?</button>
    <HelpTooltips suppressKey={props.suppressKey ?? null} disabled={props.disabled ?? false} />
  </>)
}

describe('HelpTooltips', () => {
  it('shows a tip after a short wait and hides it on leave and Esc', () => {
    setup()
    fireEvent.pointerOver(screen.getByText('Hole'))
    expect(screen.queryByTestId('help-tooltip')).toBeNull()
    act(() => vi.advanceTimersByTime(TOOLTIP_DELAY_MS))
    expect(screen.getByTestId('help-tooltip')).toHaveTextContent('Turns this part into empty space.')
    fireEvent.pointerOut(screen.getByText('Hole'), { relatedTarget: null })
    expect(screen.queryByTestId('help-tooltip')).toBeNull()
    fireEvent.focusIn(screen.getByText('Hole'))
    act(() => vi.advanceTimersByTime(TOOLTIP_DELAY_MS))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('help-tooltip')).toBeNull()
  })

  it('shows nothing for controls without help, the highlighted control, or when disabled', () => {
    setup({ suppressKey: 'mode-hole' })
    fireEvent.pointerOver(screen.getByText('?'))
    fireEvent.pointerOver(screen.getByText('Hole'))
    act(() => vi.advanceTimersByTime(TOOLTIP_DELAY_MS * 2))
    expect(screen.queryByTestId('help-tooltip')).toBeNull()
  })

  it('stays quiet while help mode is on', () => {
    setup({ disabled: true })
    fireEvent.pointerOver(screen.getByText('Hole'))
    act(() => vi.advanceTimersByTime(TOOLTIP_DELAY_MS))
    expect(screen.queryByTestId('help-tooltip')).toBeNull()
  })
})
```

`src/ui/HelpMode.test.tsx`:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HelpMode } from './HelpMode'

function setup(active = true) {
  const onAction = vi.fn()
  const onExit = vi.fn()
  const onLearnMore = vi.fn()
  const keydown = vi.fn()
  document.addEventListener('keydown', keydown)
  render(<>
    <button type="button" data-testid="mode-hole" onClick={onAction} onPointerDown={onAction}>Hole</button>
    <button type="button" data-testid="mystery" onClick={onAction}>?</button>
    <button type="button" data-testid="help-mode" data-help-toggle="" onClick={onExit}>❓</button>
    <HelpMode active={active} onExit={onExit} onLearnMore={onLearnMore} />
  </>)
  return { onAction, onExit, onLearnMore, keydown }
}

describe('HelpMode (Review Focus 3)', () => {
  it('shows help instead of doing the action', () => {
    const { onAction } = setup()
    fireEvent.pointerDown(screen.getByText('Hole'))
    fireEvent.click(screen.getByText('Hole'))
    expect(onAction).not.toHaveBeenCalled()
    expect(screen.getByTestId('help-card')).toHaveTextContent('A hole cuts away the solid parts in its group.')
    expect(document.body.classList.contains('help-mode')).toBe(true)
  })

  it('says when there is no help yet', () => {
    setup()
    fireEvent.click(screen.getByText('?'))
    expect(screen.getByTestId('help-card')).toHaveTextContent('No help for this yet.')
  })

  it('opens the matching lesson from Learn more', () => {
    const { onLearnMore } = setup()
    fireEvent.click(screen.getByText('Hole'))
    fireEvent.click(screen.getByTestId('help-card-learn'))
    expect(onLearnMore).toHaveBeenCalledWith('holes-groups')
  })

  it('leaves on Esc without letting the app see the key, and on Close or ❓', () => {
    const { onExit, keydown } = setup()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(keydown).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Hole'))
    fireEvent.click(screen.getByTestId('help-card-close'))
    expect(onExit).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByTestId('help-mode'))
    expect(onExit).toHaveBeenCalledTimes(3)
  })

  it('does nothing when it is off', () => {
    const { onAction } = setup(false)
    fireEvent.click(screen.getByText('Hole'))
    expect(onAction).toHaveBeenCalled()
    expect(screen.queryByTestId('help-card')).toBeNull()
    expect(document.body.classList.contains('help-mode')).toBe(false)
  })
})
```

In `src/ui/Toolbar.test.tsx`, also pass `helpMode={false} onHelpMode={onHelpMode}` and test that clicking `help-mode` calls it.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/HelpTooltips.test.tsx src/ui/HelpMode.test.tsx src/ui/Toolbar.test.tsx`
Expected: FAIL because the modules are missing.

- [ ] **Step 3: Write `src/ui/HelpTooltips.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { helpFor, helpKeyOf } from '../help/lookup'

export const TOOLTIP_DELAY_MS = 500
const TIP_WIDTH = 260
const GAP = 6

interface Tip {
  readonly text: string
  readonly top: number
  readonly left: number
}

function tipFor(target: EventTarget | null, suppressKey: string | null): (() => Tip) | null {
  if (!(target instanceof Element)) return null
  const found = helpKeyOf(target)
  if (!found || found.key === suppressKey) return null
  const entry = helpFor(found.key, found.label)
  if (!entry || !entry.tip) return null
  return () => {
    const r = found.element.getBoundingClientRect()
    return { text: entry.tip, top: r.bottom + GAP, left: Math.max(GAP, Math.min(r.left, window.innerWidth - TIP_WIDTH - GAP)) }
  }
}

/** One-sentence help bubbles on hover or focus, after a short wait. */
export function HelpTooltips({ suppressKey, disabled }: { suppressKey: string | null; disabled: boolean }) {
  const [tip, setTip] = useState<Tip | null>(null)
  useEffect(() => {
    setTip(null)
    if (disabled) return undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const hide = (): void => {
      clearTimeout(timer)
      setTip(null)
    }
    const show = (event: Event): void => {
      hide()
      const make = tipFor(event.target, suppressKey)
      if (make) timer = setTimeout(() => setTip(make()), TOOLTIP_DELAY_MS)
    }
    const onOut = (event: Event): void => {
      if (event instanceof MouseEvent && event.relatedTarget === null) hide()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') hide()
    }
    const listeners: [string, EventListener][] = [
      ['pointerover', show], ['focusin', show], ['pointerout', onOut], ['focusout', hide], ['keydown', onKey as EventListener],
    ]
    for (const [type, fn] of listeners) document.addEventListener(type, fn)
    window.addEventListener('scroll', hide, true)
    return () => {
      hide()
      for (const [type, fn] of listeners) document.removeEventListener(type, fn)
      window.removeEventListener('scroll', hide, true)
    }
  }, [suppressKey, disabled])
  return tip
    ? createPortal(<div className="help-tooltip" role="tooltip" data-testid="help-tooltip" style={{ top: tip.top, left: tip.left }}>{tip.text}</div>, document.body)
    : null
}
```

`show` is wired to both `pointerover` and `focusin`. When the pointer moves onto a control with no help, `show` hides the current bubble, so it never lingers. In jsdom, `fireEvent.pointerOut` creates a `PointerEvent` (a subclass of `MouseEvent`) only if jsdom supports it. If `event instanceof MouseEvent` is false there, check `'relatedTarget' in event` instead and say so in your report.

- [ ] **Step 4: Write `src/ui/HelpMode.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { helpFor, helpKeyOf, NO_HELP } from '../help/lookup'
import type { HelpEntry } from '../help/types'
import { RichText } from './RichText'

const BLOCKED = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu'] as const

interface HelpModeProps {
  active: boolean
  onExit(): void
  onLearnMore(tutorialId: string): void
}

function HelpCard({ entry, onClose, onLearnMore }: { entry: HelpEntry; onClose(): void; onLearnMore(id: string): void }) {
  return (
    <div className="help-card" role="dialog" aria-label="Help" data-testid="help-card">
      <p><RichText text={entry.card} /></p>
      {entry.tryIt && <p className="hint">Try it: {entry.tryIt}</p>}
      <div className="lesson-actions">
        {entry.tutorial && (
          <button type="button" className="tool-button" data-testid="help-card-learn"
            onClick={() => onLearnMore(entry.tutorial ?? '')}>Learn more →</button>
        )}
        <button type="button" className="tool-button" data-testid="help-card-close" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

/** ❓ help mode: clicks show what a control does instead of doing it. Nothing in the design changes. */
export function HelpMode({ active, onExit, onLearnMore }: HelpModeProps) {
  const [card, setCard] = useState<HelpEntry | null>(null)
  useEffect(() => {
    setCard(null)
    if (!active) return undefined
    const block = (event: Event): void => {
      const target = event.target
      if (!(target instanceof Element) || target.closest('.help-card, [data-help-toggle]')) return
      event.preventDefault()
      event.stopPropagation()
      if (event.type !== 'click') return
      const found = helpKeyOf(target)
      setCard((found && helpFor(found.key, found.label)) ?? NO_HELP)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onExit()
    }
    for (const type of BLOCKED) window.addEventListener(type, block, true)
    window.addEventListener('keydown', onKey, true)
    document.body.classList.add('help-mode')
    return () => {
      for (const type of BLOCKED) window.removeEventListener(type, block, true)
      window.removeEventListener('keydown', onKey, true)
      document.body.classList.remove('help-mode')
    }
  }, [active, onExit])
  if (!active || !card) return null
  return <HelpCard entry={card} onClose={onExit} onLearnMore={onLearnMore} />
}
```

The `body` class toggle is the one DOM side effect. It is set in the effect and removed in its cleanup.

- [ ] **Step 5: Wire it into the toolbar and the workspace**

`Toolbar.tsx`: add `helpMode: boolean` and `onHelpMode(): void` to the props. Next to 📘 Learn, inside the same group, add:

```tsx
        <button type="button" className="tool-button" data-testid="help-mode" data-help-toggle="" aria-pressed={helpMode}
          aria-label="Help mode" onClick={onHelpMode}>❓</button>
```

`Workspace.tsx`:
- Import `HelpTooltips`, `HelpMode`, `currentStepOf` and `useCallback`.
- Add:

```tsx
  const [helpMode, setHelpMode] = useState(false)
  const exitHelp = useCallback(() => setHelpMode(false), [])
  const lessonTarget = useStore(lessons, (s) => currentStepOf(s.progress)?.target ?? null)
  const learnMore = useCallback((tutorialId: string) => {
    setHelpMode(false)
    lessons.getState().openPanel(tutorialId)
  }, [lessons])
```

- Pass `helpMode={helpMode} onHelpMode={() => setHelpMode((on) => !on)}` to `Toolbar`.
- Render `<HelpTooltips suppressKey={lessonTarget} disabled={helpMode} />` and `<HelpMode active={helpMode} onExit={exitHelp} onLearnMore={learnMore} />` next to `<Toasts />`.
- While help mode is on, keyboard shortcuts must not run: change `useShortcuts(actions, !showDesigns)` to `useShortcuts(actions, !showDesigns && !helpMode)`.

`App.css`:

```css
.help-tooltip {
  position: fixed; z-index: 2100; max-width: 260px; padding: 6px 8px; border-radius: 6px;
  background: var(--ink); color: #fff; font-size: 0.85rem; pointer-events: none;
}
body.help-mode, body.help-mode * { cursor: help !important; }
.help-card {
  position: fixed; z-index: 2200; left: 50%; top: 20%; transform: translateX(-50%);
  width: min(380px, 92vw); padding: 14px; border-radius: var(--radius);
  background: var(--panel); border: 2px solid var(--accent); box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: all PASS, including the help-coverage test with the new ❓ button.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: add help tooltips and a help mode"
```

---

### Task 11: The "New here?" nudge in empty designs

**Files:**
- Create: `src/ui/EmptyNudge.tsx`
- Modify: `src/ui/Workspace.tsx`, `src/ui/App.css`
- Test: `src/ui/EmptyNudge.test.tsx`

**Interfaces:**
- Consumes: `LessonStore`, `startLesson`, `TUTORIALS` and `DesignSession`.
- Produces: `EmptyNudge({ lessons, onStart })`, with test ids `empty-nudge`, `nudge-start` and `nudge-hide`. Help for these ids is already in `HELP_TEXTS`.

- [ ] **Step 1: Write the failing test**

`src/ui/EmptyNudge.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode } from '../document/ops'
import { createLessonStore } from '../learn/lesson-store'
import { createBloKadeStore } from '../store/store'
import { EmptyNudge } from './EmptyNudge'

function setup() {
  const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
  const lessons = createLessonStore(null)
  const onStart = vi.fn()
  renderWithStore(<EmptyNudge lessons={lessons} onStart={onStart} />, store)
  return { store, lessons, onStart }
}

describe('EmptyNudge', () => {
  it('suggests the first lesson in an empty design', async () => {
    const { onStart } = setup()
    expect(screen.getByTestId('empty-nudge')).toHaveTextContent('New here? Try 📘 Learn → Your first shape')
    await userEvent.click(screen.getByTestId('nudge-start'))
    expect(onStart).toHaveBeenCalled()
  })

  it('hides once there is a part, during a lesson, or for good', async () => {
    const { store, lessons } = setup()
    act(() => store.getState().apply((d) => addNode(d, createShapeNode({ shapeType: 'box', name: 'Box', params: {}, color: '#fff' }))))
    expect(screen.queryByTestId('empty-nudge')).toBeNull()
    act(() => store.getState().undo())
    act(() => lessons.getState().begin('first-shape', 'd'))
    expect(screen.queryByTestId('empty-nudge')).toBeNull()
    act(() => lessons.getState().quit())
    await userEvent.click(screen.getByTestId('nudge-hide'))
    expect(screen.queryByTestId('empty-nudge')).toBeNull()
    expect(lessons.getState().progress.nudgeHidden).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/EmptyNudge.test.tsx`
Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement**

`src/ui/EmptyNudge.tsx`:

```tsx
import { useStore } from 'zustand'
import type { LessonStore } from '../learn/lesson-store'
import { useBloKade } from '../store/context'

/** A friendly pointer to the first lesson, shown in an empty design until Kade says "Don't show again". */
export function EmptyNudge({ lessons, onStart }: { lessons: LessonStore; onStart(): void }) {
  const empty = useBloKade((s) => s.history.present.root.length === 0)
  const hidden = useStore(lessons, (s) => s.progress.nudgeHidden || s.progress.active !== null)
  if (!empty || hidden) return null
  return (
    <div className="empty-nudge" data-testid="empty-nudge" role="note">
      <p>New here? Try <strong>📘 Learn → Your first shape</strong></p>
      <div className="lesson-actions">
        <button type="button" className="tool-button primary" data-testid="nudge-start" onClick={onStart}>Show me</button>
        <button type="button" className="tool-button" data-testid="nudge-hide" onClick={() => lessons.getState().hideNudge()}>Don't show again</button>
      </div>
    </div>
  )
}
```

`Workspace.tsx`: inside `<main className="viewport" …>`, after `<Viewport …/>`, add:

```tsx
        <EmptyNudge lessons={lessons} onStart={() => {
          const first = TUTORIALS[0]
          if (first) void startLesson(session, lessons, first)
        }} />
```

Import `EmptyNudge`, `TUTORIALS` and `startLesson`.

`App.css`:

```css
.empty-nudge {
  position: absolute; top: 16px; left: 50%; transform: translateX(-50%); z-index: 5;
  padding: 10px 14px; border-radius: var(--radius); background: var(--panel); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS. The help-coverage test now also sees `nudge-start` and `nudge-hide` in the empty sample store.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: suggest the first lesson in an empty design"
```

---

### Task 12: End-to-end tests for every tutorial and help mode

**Files:**
- Create: `e2e/lessons.spec.ts`

**Interfaces:**
- Consumes: the test ids from Tasks 8–11 and the existing app test ids.

- [ ] **Step 1: Write `e2e/lessons.spec.ts`**

```ts
import { expect, test, type Page } from '@playwright/test'

async function setField(page: Page, testId: string, value: string) {
  await page.getByTestId(testId).fill(value)
  await page.getByTestId(testId).press('Enter')
}

async function startTutorial(page: Page, id: string) {
  await page.goto('/')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
  await page.getByTestId('learn').click()
  await page.getByTestId(`lesson-start-${id}`).click()
  await expect(page.getByTestId('lesson-step')).toBeVisible()
}

const step = (page: Page) => page.getByTestId('lesson-step')
const next = (page: Page) => page.getByTestId('lesson-next').click()
const finished = (page: Page) => expect(page.getByTestId('lesson-finished')).toBeVisible()
const row = (page: Page, name: string) => page.getByRole('treeitem', { name, exact: true })

test('Your first shape', async ({ page }) => {
  await startTutorial(page, 'first-shape')
  await page.getByTestId('add-box').click()
  await expect(step(page)).toContainText('Width')
  await setField(page, 'param-width', '40')
  await expect(step(page)).toContainText('Look around')
  await next(page)
  await expect(step(page)).toContainText('Esc')
  await page.keyboard.press('Escape')
  await expect(step(page)).toContainText('click the box again')
  await row(page, 'Box').click()
  await finished(page)
})

test('Move, turn and size', async ({ page }) => {
  await startTutorial(page, 'move-turn-size')
  await page.getByTestId('add-cylinder').click()
  await setField(page, 'pos-y', '10')
  await expect(step(page)).toContainText('Type 30')
  await setField(page, 'pos-x', '30')
  await page.getByTestId('tool-rotate').click()
  await setField(page, 'rot-y', '45')
  await page.getByTestId('tool-size').click()
  await setField(page, 'param-height', '40')
  await page.getByTestId('tool-move').click()
  await finished(page)
})

test('Holes and groups', async ({ page }) => {
  await startTutorial(page, 'holes-groups')
  await page.getByTestId('add-box').click()
  await page.getByTestId('add-cylinder').click()
  await page.getByTestId('mode-hole').click()
  await row(page, 'Box').click()
  await row(page, 'Cylinder').click({ modifiers: ['Shift'] })
  await page.getByTestId('group').click()
  await expect(step(page)).toContainText('Ungroup')
  await next(page)
  await finished(page)
})

test('Undo, names and saving', async ({ page }) => {
  await startTutorial(page, 'undo-save')
  await page.getByTestId('add-sphere').click()
  await page.getByTestId('delete').click()
  await page.getByTestId('undo').click()
  await expect(step(page)).toContainText('Redo')
  await page.getByTestId('redo').click()
  await page.getByTestId('undo').click()
  await expect(step(page)).toContainText('📁')
  await page.getByTestId('open-designs').click()
  await setField(page, 'design-name', 'My practice')
  await expect(step(page)).toContainText('Save to file')
  await page.getByRole('button', { name: 'Close' }).click()
  await next(page)
  await finished(page)
})

test('Smart sizes', async ({ page }) => {
  await startTutorial(page, 'smart-sizes')
  await page.getByTestId('add-box').click()
  await page.getByTestId('add-variable').click()
  await setField(page, 'var-name-var1', 'wall')
  await setField(page, 'var-expr-wall', '3')
  await row(page, 'Box').click()
  await setField(page, 'param-width', 'wall * 10')
  await page.getByTestId('add-cylinder').click()
  await setField(page, 'param-diameter', 'wall * 5')
  await expect(step(page)).toContainText('change wall')
  await setField(page, 'var-expr-wall', '4')
  await finished(page)
})

test('Build on a face', async ({ page }) => {
  await startTutorial(page, 'workplane')
  await page.getByTestId('add-box').click()
  await page.getByTestId('workplane').click()
  await expect(step(page)).toContainText('face of the box')
  // The box takes a moment to appear in the 3D view; keep clicking its middle until a face is picked.
  await expect(async () => {
    await page.getByTestId('viewport').click()
    await expect(step(page)).toContainText('Cone', { timeout: 1000 })
  }).toPass({ timeout: 30_000 })
  await page.getByTestId('add-cone').click()
  await page.getByTestId('workplane-reset').click()
  await finished(page)
})

test('Round and repeat', async ({ page }) => {
  await startTutorial(page, 'round-repeat')
  await page.getByTestId('add-box').click()
  await page.getByTestId('add-modifier').selectOption('fillet')
  await setField(page, 'mod-radius-0', '3')
  await page.getByTestId('add-modifier').selectOption('linearPattern')
  await setField(page, 'mod-count-1', '4')
  await page.getByTestId('add-modifier').selectOption('mirror')
  await finished(page)
})

test('Perfect fit', async ({ page }) => {
  await startTutorial(page, 'perfect-fit')
  await page.getByTestId('add-kit-peg-socket').click()
  await next(page)
  await setField(page, 'fit', '0.3')
  await row(page, 'Peg').click()
  await row(page, 'Socket').click({ modifiers: ['Shift'] })
  await page.getByTestId('check-overlap').click()
  await finished(page)
})

test('Ready to print', async ({ page }) => {
  await startTutorial(page, 'ready-to-print')
  await page.getByTestId('add-box').click()
  await next(page)
  await next(page)
  await next(page)
  await finished(page)
})

test('help mode explains a button without pressing it', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('help-mode').click()
  await page.getByTestId('add-box').click()
  await expect(page.getByTestId('help-card')).toContainText('Click to add a Box')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('help-card')).toBeHidden()
  await expect(page.getByRole('treeitem', { name: 'Box' })).toHaveCount(0)
})
```

Notes for these tests:
- The first-shape test presses Esc with the keyboard after **Next**. Focus is then on the Next button, so the app's shortcuts (which ignore typing fields) see the key.
- If a step's wording differs from these `toContainText` strings, check the tutorial file and match the real text. Don't edit tutorial text to fit a test.
- If the app itself misbehaves, report DONE_WITH_CONCERNS with a reproduction instead of patching app code.

- [ ] **Step 2: Run the end-to-end suite**

Run: `npm run e2e`
Expected: 23 passed (the 13 existing tests plus 10 new). Run it a second time to check the new tests aren't flaky.

- [ ] **Step 3: Commit**

```bash
git add e2e/lessons.spec.ts
git commit -m "test: run every tutorial and help mode end to end"
```

---

### Task 13: Docs and final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a "Learning BloKade" section to `README.md`**

Put it at the start of "Using BloKade":

```markdown
### Learning BloKade

- **📘 Learn** (top bar) opens the lessons: nine short step-by-step guides, from "Your first shape" to "Ready to
  print". Each lesson opens its own practice design, so your real designs stay safe. Steps tick themselves off
  when you do them, and every step has **💡 Show me** if you get stuck. Finished lessons get a ✓.
- **Tooltips:** rest the mouse on any button or box for half a second to see what it does.
- **❓ Help mode:** click ❓ in the top bar, then click anything to read what it does (nothing changes while
  help mode is on). Press Esc to stop.

Lesson progress is kept in this browser. In a private window the lessons still work, but they forget your
✓ marks when you close it.
```

- [ ] **Step 2: Run every check**

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
- coverage thresholds are met, with `src/learn/**` and `src/help/**` now included;
- the build succeeds;
- all 23 end-to-end tests pass.

If coverage falls short, report the numbers and the files that pull it down. Don't lower thresholds or add filler tests.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: explain lessons, tooltips and help mode"
```

---

## Milestone 5 Done When

- **📘 Learn** opens a Lessons panel listing nine tutorials, each with a ✓ once finished.
- **Starting a tutorial** opens a fresh `Lesson: <title>` design.
- **Steps:** each step highlights its control and ticks itself off when Kade does it. It never jumps ahead from a step that was already done. Back, Skip and 💡 Show me work.
- **Pausing:** a lesson pauses in other designs and offers Go back, or Start again if its design was deleted.
- **Progress** survives reloads where storage works, and the app runs normally where it doesn't.
- **Tooltips:** every control on the main screen has one, after half a second, except the control a lesson is highlighting.
- **❓ help mode** explains whatever is clicked without changing anything. Esc, ❓ or Close leaves it.
- **Empty designs** suggest the first lesson until Kade picks "Don't show again".
- **Checks pass:** typecheck, unit tests, coverage, build, and 23 end-to-end tests (all nine tutorials played through, plus help mode).
