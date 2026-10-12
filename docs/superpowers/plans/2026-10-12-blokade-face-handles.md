# BloKade Face Handles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ⤢ Size gizmo with TinkerCAD-style handles: drag a side, the top or a bottom corner of a shape, and the opposite side stays put.

**Architecture:** Three pure modules hold all the logic and get unit tests:
- `face-handles.ts`: which handles a shape gets, and how a drag turns into new size settings.
- `handle-drag.ts`: turns the pointer into a distance along a handle's track.
- `size-drag.ts`: works out the live preview, the position shift that keeps the far side still, and the edited part.

A React Three Fiber component, `SizeHandles.tsx`, and its hook, `useSizeDrag.ts`, draw the handles and run the drag. `TransformHandles` renders them in place of `TransformControls` when the tool is Size. Help texts, two lessons and the README get updated to match.

**Tech Stack:** React 19, @react-three/fiber 9, @react-three/drei 10, three 0.186, Zustand 5, Vitest 5 (Node; jsdom per file), Playwright on port 5199.

**Spec:** `docs/superpowers/specs/2026-10-12-blokade-face-handles-design.md`

## Global Constraints

- **Earlier rules still apply:**
  - Z-up, mm, degrees.
  - An immutable document and store. Mutating three.js objects for a live preview is allowed, as `TransformHandles` already does.
  - Files under 400 lines, functions under 50 lines, nesting at most 4 levels.
  - No `console.log`.
  - `Object.hasOwn` for record lookups.
  - TypeScript strict with `noUncheckedIndexedAccess`, `noUnusedLocals` and `noUnusedParameters`.
- **Commits:** conventional commits ending with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never stage `docs/superpowers/.DS_Store`.
- **No new dependencies.**
- **Handles replace the Size gizmo.** With the tool set to `size`, `TransformControls` is never rendered.
- **The handle set (spec §2):**

  | Handles | Where | Shown when |
  |---|---|---|
  | `x-`, `x+` | side faces | `plugin.size.x` is set |
  | `y-`, `y+` | side faces | `plugin.size.y` is set |
  | `z+` | top | `plugin.size.z` is set |
  | `corner-x±y±` | the four bottom corners | both `plugin.size.x` and `plugin.size.y` are set |

  No handles on groups, on shapes without `size`, or on parts with an enabled `linearPattern`, `circularPattern` or `mirror` modifier.
- **Look:**
  - Handles are about `HANDLE_PX = 10` px on screen at any zoom.
  - They draw on top of the shape (`depthTest: false`): white with a dark border, and the accent colour `#4f9dff` when hot.
- **The opposite side stays put.**
  - A side or top handle keeps the opposite face still.
  - A corner keeps the opposite bottom corner still.
  - Alt on a corner scales all sizes by one factor, keeping the bottom corner still.
- **Snapping and limits:**
  - Sizes snap to `doc.settings.gridSnap` when it is above 0. Shift turns snapping off.
  - The smallest size is one grid step, or `FREE_MIN_SIZE = 0.1` mm when snapping is off. It is also never below the setting's own `min`.
  - The biggest size is the setting's `max`, or `MAX_MM` (2000). At the cap the readout says `Biggest size: N mm`.
- **Readout text:** `Width 42 mm`, or `Width 42 mm × Depth 30 mm` for a corner. It uses each setting's `label`.
- **Tooltips:**
  - Side or top handle: `Drag to change the Width.`
  - Corner: `Drag to change the Width and Depth. Hold Alt to keep the shape's proportions.`
  - Shown after `TOOLTIP_DELAY_MS` (500 ms).
- **Ending a drag:**
  - One drag is one `apply`, so one undo step.
  - Esc cancels the drag and nothing is written.
  - Every key pressed during a drag is swallowed, so design shortcuts don't run.
- **Help mode:**
  - It already blocks pointer presses, so handles can't be dragged.
  - Hovering a handle sets `data-help` on the canvas to `size-handle` or `size-corner`, so clicking shows that card.
- **Copies hint.** A selected part with copies or a mirror shows the viewport hint `This part has copies or a mirror image. Type its sizes in Properties instead.`
- **Testing a 3D component.** There is no React Three Fiber test renderer, and adding one would be a new dependency. So the spec's "component test (`SizeHandles`)" is covered two ways:
  - unit tests of the pure `size-drag.ts`, for commit, undo, formulas and the anchor;
  - Playwright, for rendering, Esc, keys and help mode.

  For Playwright, the canvas carries `data-size-handles`, a JSON map of handle id to `[x, y]` canvas pixels.
- **Kid-facing writing style (spec §1 of the learn spec):**
  - Short sentences and everyday words.
  - Controls named in **bold** in lesson and help text.
  - No blame.
  - `**text**` is the only markup.

## Review Focus

1. **Keys pressed mid-drag** (Delete, Ctrl+Z, M, S, Esc).
   - Expected: the design and tool are untouched, and Esc cancels the drag without deselecting.
   - Pinned in Task 4 by the e2e tests "keys pressed during a drag do not change the design" and "Esc during a drag puts the part back and keeps it selected".
2. **A rotated part.**
   - Expected: the opposite face stays put in world space.
   - Pinned in Task 3: "keeps the far side still on a turned part".
3. **The camera looking straight down a handle's track** (for example a top handle seen from above, or a corner seen edge-on).
   - Expected: the drag simply doesn't move that frame; never NaN or a jump.
   - Pinned in Task 2 (`closestOnAxis` and `hitPlaneZ` return null) and Task 4 (`useSizeDrag` ignores null points).
4. **A part with copies or a mirror.**
   - Expected: no handles, and the hint tells Kade to type sizes instead.
   - Pinned in Task 3 (`sizeHintFor`, `resizesByHandle`).
5. **Letting go of the mouse outside the 3D view.**
   - Expected: the drag still ends, the change is committed, and the readout clears.
   - Pinned in Task 4: "letting go outside the 3D view still finishes the drag".

---

## File Map

| File | Task | Job |
|---|---|---|
| `src/viewport/face-handles.ts` (new) | 1 | `SizeHandle`, `handlesFor`, `dragToScale`, `handleTip`, `FREE_MIN_SIZE`. |
| `src/viewport/face-handles.test.ts` (new) | 1 | Unit tests. |
| `src/viewport/handle-drag.ts` (new) | 2 | `Ray`, `PointerSpot`, `pointerRay`, `toLocalRay`, `closestOnAxis`, `hitPlaneZ`, `trackPoint`, `movedSince`, `screenScale`. |
| `src/viewport/handle-drag.test.ts` (new) | 2 | Unit tests. |
| `src/viewport/measure.ts` | 3 | Export `formatMm` (was the private `mm`). |
| `src/viewport/size-drag.ts` (new) | 3 | `SizeDragStart`, `SizeDragFrame`, `anchorShift`, `sizeDragFrame`, `sizeText`, `finishSizeDrag`, `resizesByHandle`, `sizeHintFor`, `COPIES_HINT`. |
| `src/viewport/size-drag.test.ts` (new) | 3 | Unit tests, including store undo and formulas. |
| `src/viewport/useSizeDrag.ts` (new) | 4 | The drag lifecycle: window listeners, orbit off, preview, commit and cancel. |
| `src/viewport/SizeHandles.tsx` (new) | 4 | Handle cubes, hover, tooltip, `data-help`, `data-size-handles`. |
| `src/viewport/TransformHandles.tsx` | 4 | Size mode renders `SizeHandles`; move and rotate are unchanged. |
| `src/viewport/Viewport.tsx` | 4 | Shows the copies hint. |
| `src/ui/App.css` | 4 | `.size-handle-tip` style. |
| `e2e/size-handles.spec.ts` (new) | 4 | End-to-end tests. |
| `src/help/help-texts.ts` | 5 | `size-handle`, `size-corner`, `tool-size`, `mode-hole`, `tree-mode`. |
| `src/help/lookup.test.ts` | 5 | New help keys. |
| `src/learn/tutorials/move-turn-size.ts` | 5 | The `taller` step text. |
| `src/learn/tutorials/holes-groups.ts` | 5 | The intro. |
| `README.md` | 5 | The shortcut table. |

`src/viewport/sizing.ts` (`paramsFromScale`) stays as it is and is now used by `size-drag.ts`.

---

## Task 1: Which handles a shape gets, and what a drag does to its sizes

**Files:**
- Create: `src/viewport/face-handles.ts`
- Test: `src/viewport/face-handles.test.ts`

**Interfaces:**
- Consumes:
  - `Box` and `Axis` from `src/document/box.ts`;
  - `ParamValue` and `Vec3` from `src/document/types.ts`;
  - `MAX_MM` from `src/plugins/params.ts`;
  - `ShapePlugin` and `isNumberSpec` from `src/plugins/types.ts`.
- Produces:
  - `type HandleKind = 'side' | 'top' | 'corner'`
  - `interface SizeHandle { id: string; kind: HandleKind; dir: Vec3; position: Vec3 }`. `dir` holds −1, 0 or +1 per axis; `position` is in the part's own frame.
  - `FREE_MIN_SIZE = 0.1`
  - `handlesFor(plugin: ShapePlugin, box: Box): readonly SizeHandle[]`. The order is `x-, x+, y-, y+, z+, corner-x-y-, corner-x-y+, corner-x+y-, corner-x+y+`, skipping any that don't apply.
  - `interface SizeDragInput { plugin; params; box; handle; moved: Vec3; snap: number; keepProportions: boolean }`
  - `interface SizeChange { key: string; label: string; value: number }`
  - `interface SizeDragResult { scale: Vec3; changes: readonly SizeChange[]; biggest: number | null }`
  - `dragToScale(input: SizeDragInput): SizeDragResult`
  - `handleTip(plugin: ShapePlugin, handle: SizeHandle): string`

- [ ] **Step 1: Write the failing test**

Create `src/viewport/face-handles.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Box } from '../document/box'
import type { ParamValue, Vec3 } from '../document/types'
import { registry } from '../plugins/index'
import type { ShapePlugin } from '../plugins/types'
import { dragToScale, handlesFor, handleTip, type SizeHandle } from './face-handles'

const plugin = (id: string): ShapePlugin => {
  const found = registry.get(id)
  if (!found) throw new Error(id)
  return found
}
const BOX: Box = { min: [-10, -10, 0], max: [10, 10, 20] }
const SIZES = { width: 20, depth: 20, height: 20 }

const handle = (id: string, p: ShapePlugin = plugin('box')): SizeHandle => {
  const found = handlesFor(p, BOX).find((h) => h.id === id)
  if (!found) throw new Error(id)
  return found
}

interface Extra {
  readonly params?: Readonly<Record<string, ParamValue>>
  readonly snap?: number
  readonly keepProportions?: boolean
}
const drag = (id: string, moved: Vec3, extra: Extra = {}) => dragToScale({
  plugin: plugin('box'), params: extra.params ?? SIZES, box: BOX, handle: handle(id), moved,
  snap: extra.snap ?? 1, keepProportions: extra.keepProportions ?? false,
})

describe('handlesFor', () => {
  it('gives a box four sides, a top and four bottom corners', () => {
    expect(handlesFor(plugin('box'), BOX).map((h) => h.id)).toEqual([
      'x-', 'x+', 'y-', 'y+', 'z+', 'corner-x-y-', 'corner-x-y+', 'corner-x+y-', 'corner-x+y+',
    ])
  })

  it('puts each handle on its face or corner', () => {
    expect(handle('x+').position).toEqual([10, 0, 10])
    expect(handle('y-').position).toEqual([0, -10, 10])
    expect(handle('z+').position).toEqual([0, 0, 20])
    expect(handle('corner-x-y+').position).toEqual([-10, 10, 0])
    expect(handle('corner-x+y-').dir).toEqual([1, -1, 0])
  })

  it('gives a shape that only sizes its depth just the top handle', () => {
    expect(handlesFor(plugin('screw-hole'), BOX).map((h) => h.id)).toEqual(['z+'])
  })

  it('gives a snap clip its width sides and a top, but no corners', () => {
    expect(handlesFor(plugin('snap-clip'), BOX).map((h) => h.id)).toEqual(['y-', 'y+', 'z+'])
  })

  it('gives no handles to a shape without sizes', () => {
    expect(handlesFor({ ...plugin('box'), size: {} }, BOX)).toEqual([])
  })
})

describe('dragToScale', () => {
  it('grows one side by how far the handle moved', () => {
    const r = drag('x+', [12, 0, 0])
    expect(r.scale).toEqual([1.6, 1, 1])
    expect(r.changes).toEqual([{ key: 'width', label: 'Width', value: 32 }])
    expect(r.biggest).toBeNull()
  })

  it('grows the minus side when it is dragged the minus way', () => {
    expect(drag('x-', [-5, 0, 0]).changes[0]?.value).toBe(25)
  })

  it('snaps the new size to the grid', () => {
    expect(drag('x+', [12.4, 0, 0]).changes[0]?.value).toBe(32)
  })

  it('does not snap when snapping is off', () => {
    expect(drag('x+', [12.4, 0, 0], { snap: 0 }).changes[0]?.value).toBe(32.4)
  })

  it('leaves an off-grid size alone until the handle moves', () => {
    const r = drag('x+', [0, 0, 0], { params: { ...SIZES, width: 20.3 } })
    expect(r.scale).toEqual([1, 1, 1])
    expect(r.changes[0]?.value).toBe(20.3)
  })

  it('stops at one grid step instead of turning inside out', () => {
    expect(drag('x+', [-50, 0, 0]).changes[0]?.value).toBe(1)
  })

  it('stops at 0.1 mm when snapping is off', () => {
    expect(drag('x+', [-50, 0, 0], { snap: 0 }).changes[0]?.value).toBe(0.1)
  })

  it('stops at the biggest size and says so', () => {
    const r = drag('x+', [5000, 0, 0])
    expect(r.changes[0]?.value).toBe(2000)
    expect(r.biggest).toBe(2000)
  })

  it('changes the height from the top handle', () => {
    expect(drag('z+', [0, 0, 5]).changes).toEqual([{ key: 'height', label: 'Height', value: 25 }])
  })

  it('changes width and depth together from a corner', () => {
    const r = drag('corner-x+y+', [10, 5, 0])
    expect(r.changes).toEqual([
      { key: 'width', label: 'Width', value: 30 },
      { key: 'depth', label: 'Depth', value: 25 },
    ])
    expect(r.scale).toEqual([1.5, 1.25, 1])
  })

  it('keeps the proportions from a corner with Alt', () => {
    const r = drag('corner-x+y+', [10, 5, 0], { keepProportions: true })
    expect(r.scale).toEqual([1.5, 1.5, 1.5])
    expect(r.changes.map((c) => c.value)).toEqual([30, 30, 30])
  })

  it('ignores Alt on a side handle', () => {
    expect(drag('x+', [10, 0, 0], { keepProportions: true }).scale).toEqual([1.5, 1, 1])
  })

  it('grows a shared size on every axis it covers', () => {
    const cylinder = plugin('cylinder')
    const r = dragToScale({
      plugin: cylinder, params: { diameter: 20, height: 20 }, box: BOX, handle: handle('x+', cylinder),
      moved: [10, 0, 0], snap: 1, keepProportions: false,
    })
    expect(r.changes).toEqual([{ key: 'diameter', label: 'Diameter', value: 30 }])
    expect(r.scale).toEqual([1.5, 1.5, 1])
  })

  it('uses the bigger change when a corner drags one shared size two ways', () => {
    const cylinder = plugin('cylinder')
    const r = dragToScale({
      plugin: cylinder, params: { diameter: 20, height: 20 }, box: BOX, handle: handle('corner-x+y+', cylinder),
      moved: [10, 2, 0], snap: 1, keepProportions: false,
    })
    expect(r.changes).toEqual([{ key: 'diameter', label: 'Diameter', value: 30 }])
  })
})

describe('handleTip', () => {
  it('names the size a side handle changes', () => {
    expect(handleTip(plugin('box'), handle('x+'))).toBe('Drag to change the Width.')
    expect(handleTip(plugin('box'), handle('z+'))).toBe('Drag to change the Height.')
  })

  it('names both sizes on a corner and mentions Alt', () => {
    expect(handleTip(plugin('box'), handle('corner-x-y-')))
      .toBe("Drag to change the Width and Depth. Hold Alt to keep the shape's proportions.")
  })

  it('names a shared size once', () => {
    const cylinder = plugin('cylinder')
    expect(handleTip(cylinder, handle('corner-x-y-', cylinder)))
      .toBe("Drag to change the Diameter. Hold Alt to keep the shape's proportions.")
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/viewport/face-handles.test.ts`
Expected: FAIL with "Failed to resolve import "./face-handles"".

- [ ] **Step 3: Write the implementation**

Create `src/viewport/face-handles.ts`:

```ts
import type { Axis, Box } from '../document/box'
import type { ParamValue, Vec3 } from '../document/types'
import { MAX_MM } from '../plugins/params'
import { isNumberSpec, type ShapePlugin } from '../plugins/types'

export type HandleKind = 'side' | 'top' | 'corner'

/** A size handle on a part, in the part's own frame. */
export interface SizeHandle {
  readonly id: string
  readonly kind: HandleKind
  /** −1, 0 or +1 per axis: which way the handle's face points. 0 means the handle doesn't change that axis. */
  readonly dir: Vec3
  readonly position: Vec3
}

export interface SizeDragInput {
  readonly plugin: ShapePlugin
  readonly params: Readonly<Record<string, ParamValue>>
  /** The part's box in its own frame when the drag started. */
  readonly box: Box
  readonly handle: SizeHandle
  /** How far the pointer moved along the handle's track since the drag started, in the part's own frame. */
  readonly moved: Vec3
  /** Grid step to snap sizes to; 0 means no snapping. */
  readonly snap: number
  /** Alt on a corner: change every size by the same factor. */
  readonly keepProportions: boolean
}

export interface SizeChange {
  readonly key: string
  readonly label: string
  readonly value: number
}

export interface SizeDragResult {
  /** Factor per axis, about the part's own origin; 1 for axes the drag doesn't change. */
  readonly scale: Vec3
  /** The size settings the drag changes, with their new values, in x, y, z order. */
  readonly changes: readonly SizeChange[]
  /** The biggest size, when a size stopped there. */
  readonly biggest: number | null
}

/** Smallest size, in mm, when snapping is off. */
export const FREE_MIN_SIZE = 0.1

const AXES = [0, 1, 2] as const
const AXIS_NAMES = ['x', 'y', 'z'] as const
const SIGNS = [-1, 1] as const
const signName = (sign: number): string => (sign > 0 ? '+' : '-')

const sizeKey = (plugin: ShapePlugin, axis: Axis): string | undefined => plugin.size?.[AXIS_NAMES[axis]]
const mid = (box: Box, axis: Axis): number => (box.min[axis] + box.max[axis]) / 2
const at = (box: Box, axis: Axis, sign: number): number => (sign > 0 ? box.max[axis] : box.min[axis])

function sideHandles(plugin: ShapePlugin, box: Box): SizeHandle[] {
  return ([0, 1] as const).flatMap((axis) => (sizeKey(plugin, axis) === undefined ? [] : SIGNS.map((sign) => ({
    id: `${AXIS_NAMES[axis]}${signName(sign)}`,
    kind: 'side' as const,
    dir: (axis === 0 ? [sign, 0, 0] : [0, sign, 0]) as Vec3,
    position: (axis === 0 ? [at(box, 0, sign), mid(box, 1), mid(box, 2)] : [mid(box, 0), at(box, 1, sign), mid(box, 2)]) as Vec3,
  }))))
}

function topHandle(plugin: ShapePlugin, box: Box): SizeHandle[] {
  return sizeKey(plugin, 2) === undefined ? [] : [{ id: 'z+', kind: 'top', dir: [0, 0, 1], position: [mid(box, 0), mid(box, 1), box.max[2]] }]
}

function cornerHandles(plugin: ShapePlugin, box: Box): SizeHandle[] {
  if (sizeKey(plugin, 0) === undefined || sizeKey(plugin, 1) === undefined) return []
  return SIGNS.flatMap((sx) => SIGNS.map((sy) => ({
    id: `corner-x${signName(sx)}y${signName(sy)}`,
    kind: 'corner' as const,
    dir: [sx, sy, 0] as Vec3,
    position: [at(box, 0, sx), at(box, 1, sy), box.min[2]] as Vec3,
  })))
}

/** The handles a part gets: one per side face and the top for each size it has, and bottom corners when it has x and y. */
export function handlesFor(plugin: ShapePlugin, box: Box): readonly SizeHandle[] {
  return [...sideHandles(plugin, box), ...topHandle(plugin, box), ...cornerHandles(plugin, box)]
}

/** Each size setting once, in x, y, z order. */
function sizeKeys(plugin: ShapePlugin, axes: readonly Axis[] = AXES): readonly string[] {
  return [...new Set(axes.flatMap((axis) => sizeKey(plugin, axis) ?? []))]
}

const labelOf = (plugin: ShapePlugin, key: string): string =>
  (Object.hasOwn(plugin.params, key) ? plugin.params[key]?.label : undefined) ?? key

function numberAt(params: Readonly<Record<string, ParamValue>>, key: string): number | null {
  const value = Object.hasOwn(params, key) ? params[key] : undefined
  return typeof value === 'number' && value > 0 ? value : null
}

/** The factor the pointer asks for on each dragged size, keeping the bigger change when two axes share one. */
function wantedFactors({ plugin, box, handle, moved }: SizeDragInput): Readonly<Record<string, number>> {
  return AXES.reduce<Readonly<Record<string, number>>>((acc, axis) => {
    const key = sizeKey(plugin, axis)
    const size = box.max[axis] - box.min[axis]
    if (handle.dir[axis] === 0 || key === undefined || size <= 0) return acc
    const factor = (size + handle.dir[axis] * moved[axis]) / size
    const current = Object.hasOwn(acc, key) ? acc[key] : undefined
    return current === undefined || Math.abs(factor - 1) > Math.abs(current - 1) ? { ...acc, [key]: factor } : acc
  }, {})
}

/** Alt on a corner: every size gets the bigger of the dragged factors. */
function proportional(plugin: ShapePlugin, wanted: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
  const values = Object.values(wanted)
  if (values.length === 0) return wanted
  const factor = Math.max(...values)
  return Object.fromEntries(sizeKeys(plugin).map((key) => [key, factor]))
}

interface Limits {
  readonly min: number
  readonly max: number
}

function limitsOf(plugin: ShapePlugin, key: string, snap: number): Limits {
  const spec = Object.hasOwn(plugin.params, key) ? plugin.params[key] : undefined
  const number = spec && isNumberSpec(spec) ? spec : undefined
  return { min: Math.max(snap > 0 ? snap : FREE_MIN_SIZE, number?.min ?? 0), max: number?.max ?? MAX_MM }
}

const round2 = (v: number): number => Math.round(v * 100) / 100

interface Settled {
  readonly change: SizeChange
  readonly capped: boolean
}

function settleKey(input: SizeDragInput, key: string, factor: number, snap: number): Settled | null {
  const old = numberAt(input.params, key)
  if (old === null) return null
  const change = (value: number): SizeChange => ({ key, label: labelOf(input.plugin, key), value })
  if (factor === 1) return { change: change(old), capped: false }
  const limits = limitsOf(input.plugin, key, snap)
  const wanted = old * factor
  const snapped = snap > 0 ? round2(Math.round(wanted / snap) * snap) : round2(wanted)
  return { change: change(Math.min(Math.max(snapped, limits.min), limits.max)), capped: snapped > limits.max }
}

/** New values for each size. With Alt, the first size snaps and the others follow its factor exactly. */
function settleAll(input: SizeDragInput, factors: Readonly<Record<string, number>>, together: boolean): readonly Settled[] {
  const keys = sizeKeys(input.plugin).filter((key) => Object.hasOwn(factors, key))
  const factorOf = (key: string): number => factors[key] ?? 1
  const [lead, ...rest] = keys
  if (!together || lead === undefined) return keys.flatMap((key) => settleKey(input, key, factorOf(key), input.snap) ?? [])
  const first = settleKey(input, lead, factorOf(lead), input.snap)
  const old = numberAt(input.params, lead)
  if (!first || old === null) return []
  const factor = first.change.value / old
  return [first, ...rest.flatMap((key) => settleKey(input, key, factor, 0) ?? [])]
}

/** Turns a handle drag into new size settings and the matching scale per axis. */
export function dragToScale(input: SizeDragInput): SizeDragResult {
  const together = input.keepProportions && input.handle.kind === 'corner'
  const wanted = wantedFactors(input)
  const settled = settleAll(input, together ? proportional(input.plugin, wanted) : wanted, together)
  const valueOf = Object.fromEntries(settled.map((s) => [s.change.key, s.change.value]))
  const axisScale = (axis: Axis): number => {
    const key = sizeKey(input.plugin, axis)
    const old = key === undefined ? null : numberAt(input.params, key)
    const next = key !== undefined && Object.hasOwn(valueOf, key) ? valueOf[key] : undefined
    return old === null || next === undefined ? 1 : next / old
  }
  const capped = settled.find((s) => s.capped)
  return {
    scale: [axisScale(0), axisScale(1), axisScale(2)],
    changes: settled.map((s) => s.change),
    biggest: capped ? capped.change.value : null,
  }
}

/** The hover tip for a handle, using the size settings' own labels. */
export function handleTip(plugin: ShapePlugin, handle: SizeHandle): string {
  const dragged = AXES.filter((axis) => handle.dir[axis] !== 0)
  const names = sizeKeys(plugin, dragged).map((key) => labelOf(plugin, key)).join(' and ')
  const tip = `Drag to change the ${names}.`
  return handle.kind === 'corner' ? `${tip} Hold Alt to keep the shape's proportions.` : tip
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/viewport/face-handles.test.ts`
Expected: PASS (22 tests).

Then run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/viewport/face-handles.ts src/viewport/face-handles.test.ts
git commit -m "feat: work out size handles and what dragging them does

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 2: Turning the pointer into a place on a handle's track

**Files:**
- Create: `src/viewport/handle-drag.ts`
- Test: `src/viewport/handle-drag.test.ts`

**Interfaces:**
- Consumes:
  - `SizeHandle` from Task 1 (`src/viewport/face-handles.ts`);
  - `transformToMatrix` from `src/document/transform-math.ts`;
  - `Axis` from `src/document/box.ts`.
- Produces:
  - `interface Ray { origin: Vec3; direction: Vec3 }`. `direction` is a unit vector.
  - `interface PointerSpot { clientX: number; clientY: number; shiftKey: boolean; altKey: boolean }`. A DOM `PointerEvent` satisfies it.
  - `pointerRay(spot: PointerSpot, element: { getBoundingClientRect(): Rect }, camera: Camera): Ray`
  - `toLocalRay(ray: Ray, transform: Transform): Ray`
  - `closestOnAxis(ray: Ray, through: Vec3, axis: Axis): number | null`
  - `hitPlaneZ(ray: Ray, z: number): readonly [number, number] | null`
  - `trackPoint(handle: SizeHandle, ray: Ray): Vec3 | null`. Its input is a local ray, and so is its output point. Null when the camera looks straight along the track.
  - `movedSince(from: Vec3, to: Vec3): Vec3`
  - `screenScale(distance: number, fovDegrees: number, viewportHeightPx: number, px: number): number`

- [ ] **Step 1: Write the failing test**

Create `src/viewport/handle-drag.test.ts`:

```ts
import { PerspectiveCamera } from 'three'
import { describe, expect, it } from 'vitest'
import type { Vec3 } from '../document/types'
import type { SizeHandle } from './face-handles'
import { closestOnAxis, hitPlaneZ, movedSince, pointerRay, screenScale, toLocalRay, trackPoint, type Ray } from './handle-drag'

const SIDE: SizeHandle = { id: 'x+', kind: 'side', dir: [1, 0, 0], position: [10, 0, 10] }
const TOP: SizeHandle = { id: 'z+', kind: 'top', dir: [0, 0, 1], position: [0, 0, 20] }
const CORNER: SizeHandle = { id: 'corner-x+y+', kind: 'corner', dir: [1, 1, 0], position: [10, 10, 0] }
const expectClose = (actual: readonly number[] | null, expected: readonly number[]): void => {
  expect(actual).not.toBeNull()
  expected.forEach((v, i) => expect(actual?.[i]).toBeCloseTo(v, 6))
}

describe('pointerRay', () => {
  it('points straight ahead from the middle of the view', () => {
    const camera = new PerspectiveCamera(45, 1, 0.5, 5000)
    camera.position.set(0, 0, 100)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()
    const element = { getBoundingClientRect: () => ({ left: 50, top: 20, width: 200, height: 200 }) }
    const ray = pointerRay({ clientX: 150, clientY: 120, shiftKey: false, altKey: false }, element, camera)
    expectClose(ray.origin, [0, 0, 100])
    expectClose(ray.direction, [0, 0, -1])
  })
})

describe('toLocalRay', () => {
  it('moves and turns a ray into the part’s own frame', () => {
    const ray: Ray = { origin: [10, 0, 5], direction: [1, 0, 0] }
    const local = toLocalRay(ray, { position: [10, 0, 0], rotation: [0, 0, 90] })
    expectClose(local.origin, [0, 0, 5])
    expectClose(local.direction, [0, -1, 0])
  })
})

describe('closestOnAxis', () => {
  it('finds how far along the axis the pointer is', () => {
    expect(closestOnAxis({ origin: [5, -100, 0], direction: [0, 1, 0] }, [0, 0, 0], 0)).toBeCloseTo(5, 6)
  })

  it('gives up when the ray runs along the axis', () => {
    expect(closestOnAxis({ origin: [0, 0, 50], direction: [1, 0, 0] }, [0, 0, 0], 0)).toBeNull()
  })
})

describe('hitPlaneZ', () => {
  it('finds where the ray meets the flat plane', () => {
    expectClose(hitPlaneZ({ origin: [0, 0, 10], direction: [0.6, 0, -0.8] }, 0), [7.5, 0])
  })

  it('gives up when the ray runs along the plane or away from it', () => {
    expect(hitPlaneZ({ origin: [0, 0, 10], direction: [1, 0, 0] }, 0)).toBeNull()
    expect(hitPlaneZ({ origin: [0, 0, 10], direction: [0, 0, 1] }, 0)).toBeNull()
  })
})

describe('trackPoint', () => {
  it('slides a side handle along its axis', () => {
    expectClose(trackPoint(SIDE, { origin: [15, -100, 10], direction: [0, 1, 0] }), [5, 0, 0])
  })

  it('slides the top handle up and down', () => {
    expectClose(trackPoint(TOP, { origin: [-100, 0, 27], direction: [1, 0, 0] }), [0, 0, 7])
  })

  it('slides a corner across the bottom', () => {
    expectClose(trackPoint(CORNER, { origin: [12, 13, 50], direction: [0, 0, -1] }), [12, 13, 0])
  })

  it('gives up when the camera looks straight down the top handle’s track', () => {
    expect(trackPoint(TOP, { origin: [0, 0, 100], direction: [0, 0, -1] })).toBeNull()
  })

  it('gives up when the camera looks at a corner edge-on', () => {
    expect(trackPoint(CORNER, { origin: [0, -100, 0], direction: [0, 1, 0] })).toBeNull()
  })
})

describe('movedSince and screenScale', () => {
  it('measures the move between two track points', () => {
    const from: Vec3 = [5, 0, 0]
    expect(movedSince(from, [12, 0, 0])).toEqual([7, 0, 0])
  })

  it('sizes a handle so it looks the same on screen at any distance', () => {
    expect(screenScale(100, 90, 200, 10)).toBeCloseTo(10, 6)
    expect(screenScale(200, 90, 200, 10)).toBeCloseTo(20, 6)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/viewport/handle-drag.test.ts`
Expected: FAIL with "Failed to resolve import "./handle-drag"".

- [ ] **Step 3: Write the implementation**

Create `src/viewport/handle-drag.ts`:

```ts
import { MathUtils, Raycaster, Vector2, Vector3, type Camera } from 'three'
import type { Axis } from '../document/box'
import { transformToMatrix } from '../document/transform-math'
import type { Transform, Vec3 } from '../document/types'
import type { SizeHandle } from './face-handles'

/** A start point and a unit direction. */
export interface Ray {
  readonly origin: Vec3
  readonly direction: Vec3
}

/** The parts of a pointer event a drag needs. A DOM PointerEvent has all of them. */
export interface PointerSpot {
  readonly clientX: number
  readonly clientY: number
  readonly shiftKey: boolean
  readonly altKey: boolean
}

interface Rect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/** Below this, a ray counts as running along the line or plane it should cross. */
const PARALLEL = 1e-6
const UNIT: readonly Vec3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]

const vec = (v: Vector3): Vec3 => [v.x, v.y, v.z]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

/** The ray from the camera through the pointer. */
export function pointerRay(spot: PointerSpot, element: { getBoundingClientRect(): Rect }, camera: Camera): Ray {
  const r = element.getBoundingClientRect()
  const ndc = new Vector2(((spot.clientX - r.left) / r.width) * 2 - 1, -((spot.clientY - r.top) / r.height) * 2 + 1)
  const raycaster = new Raycaster()
  raycaster.setFromCamera(ndc, camera)
  return { origin: vec(raycaster.ray.origin), direction: vec(raycaster.ray.direction) }
}

/** The same ray in a part's own frame. */
export function toLocalRay(ray: Ray, transform: Transform): Ray {
  const inverse = transformToMatrix(transform).invert()
  return {
    origin: vec(new Vector3(...ray.origin).applyMatrix4(inverse)),
    direction: vec(new Vector3(...ray.direction).transformDirection(inverse)),
  }
}

/** How far along `axis` (from `through`) the point nearest the ray is, or null when the ray runs along that line. */
export function closestOnAxis(ray: Ray, through: Vec3, axis: Axis): number | null {
  const u = UNIT[axis] ?? [1, 0, 0]
  const b = dot(u, ray.direction)
  const denom = 1 - b * b
  if (denom < PARALLEL) return null
  const w = sub(through, ray.origin)
  return (b * dot(ray.direction, w) - dot(u, w)) / denom
}

/** Where the ray meets the flat plane at height `z`, or null when it runs along the plane or away from it. */
export function hitPlaneZ(ray: Ray, z: number): readonly [number, number] | null {
  const dz = ray.direction[2]
  if (Math.abs(dz) < PARALLEL) return null
  const t = (z - ray.origin[2]) / dz
  if (t < 0) return null
  return [ray.origin[0] + t * ray.direction[0], ray.origin[1] + t * ray.direction[1]]
}

const draggedAxis = (handle: SizeHandle): Axis => (handle.dir[0] !== 0 ? 0 : handle.dir[1] !== 0 ? 1 : 2)

/**
 * The pointer's place on a handle's track, in the part's own frame. Side and top handles slide along their
 * axis; corners slide across the bottom. Null when the camera looks straight along the track.
 */
export function trackPoint(handle: SizeHandle, ray: Ray): Vec3 | null {
  if (handle.kind === 'corner') {
    const hit = hitPlaneZ(ray, handle.position[2])
    return hit ? [hit[0], hit[1], 0] : null
  }
  const axis = draggedAxis(handle)
  const s = closestOnAxis(ray, handle.position, axis)
  if (s === null) return null
  return [axis === 0 ? s : 0, axis === 1 ? s : 0, axis === 2 ? s : 0]
}

export const movedSince = (from: Vec3, to: Vec3): Vec3 => sub(to, from)

/** The world size that looks `px` pixels tall at `distance` from a perspective camera. */
export function screenScale(distance: number, fovDegrees: number, viewportHeightPx: number, px: number): number {
  return (2 * distance * Math.tan(MathUtils.degToRad(fovDegrees) / 2) * px) / viewportHeightPx
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/viewport/handle-drag.test.ts`
Expected: PASS (13 tests).

Then run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/viewport/handle-drag.ts src/viewport/handle-drag.test.ts
git commit -m "feat: follow the pointer along a size handle's track

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 3: The drag preview, the far side staying put, and the edited part

**Files:**
- Modify: `src/viewport/measure.ts` (rename the private `mm` to the exported `formatMm`)
- Create: `src/viewport/size-drag.ts`
- Test: `src/viewport/size-drag.test.ts`

**Interfaces:**
- Consumes:
  - Task 1: `dragToScale`, `SizeDragResult`, `SizeHandle`, `handlesFor`;
  - Task 2: `movedSince`;
  - `paramsFromScale(plugin, params, scale)` from `src/viewport/sizing.ts`;
  - `keepUnchanged` and `transformToMatrix` from `src/document/transform-math.ts`;
  - `ToolMode` from `src/store/store.ts`.
- Produces:
  - `interface SizeDragStart { node: ShapeNode; plugin: ShapePlugin; box: Box; handle: SizeHandle; from: Vec3 }`
  - `interface SizeDragModifiers { snap: number; keepProportions: boolean }`
  - `interface SizeDragFrame { scale: Vec3; position: Vec3; text: string }`
  - `anchorShift(box: Box, handle: SizeHandle, scale: Vec3): Vec3`. The result is in the part's own frame.
  - `sizeText(result: SizeDragResult): string`
  - `sizeDragFrame(start: SizeDragStart, to: Vec3, mods: SizeDragModifiers): SizeDragFrame`
  - `finishSizeDrag(start: SizeDragStart, frame: SizeDragFrame): ShapeNode | null`
  - `resizesByHandle(node: SceneNode): boolean`
  - `sizeHintFor(doc: BloKadeDocument, selection: readonly NodeId[], tool: ToolMode): string | null`
  - `COPIES_HINT`
  - `formatMm(value: number): string` from `measure.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/viewport/size-drag.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Box } from '../document/box'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode, updateNode } from '../document/ops'
import type { Modifier, ShapeNode, Vec3 } from '../document/types'
import { registry } from '../plugins/index'
import type { ShapePlugin } from '../plugins/types'
import { createBloKadeStore } from '../store/store'
import { handlesFor } from './face-handles'
import {
  anchorShift, COPIES_HINT, finishSizeDrag, resizesByHandle, sizeDragFrame, sizeHintFor, sizeText, type SizeDragStart,
} from './size-drag'

const BOX: Box = { min: [-10, -10, 0], max: [10, 10, 20] }
const CENTRED: Box = { min: [-10, -10, -10], max: [10, 10, 10] }
const FREE = { snap: 0, keepProportions: false }
const ORIGIN: Vec3 = [0, 0, 0]

const boxPlugin = (): ShapePlugin => {
  const found = registry.get('box')
  if (!found) throw new Error('box')
  return found
}
const part = (extra: Partial<Pick<ShapeNode, 'formulas' | 'modifiers'>> & { rotation?: Vec3 } = {}): ShapeNode => ({
  ...createShapeNode({
    shapeType: 'box', name: 'Box', params: { width: 20, depth: 20, height: 20 }, color: '#ff6b6b', id: 'b',
    rotation: extra.rotation ?? [0, 0, 0],
  }),
  ...(extra.formulas ? { formulas: extra.formulas } : {}),
  ...(extra.modifiers ? { modifiers: extra.modifiers } : {}),
})
const startFor = (node: ShapeNode, id: string, box: Box = BOX): SizeDragStart => {
  const handle = handlesFor(boxPlugin(), box).find((h) => h.id === id)
  if (!handle) throw new Error(id)
  return { node, plugin: boxPlugin(), box, handle, from: ORIGIN }
}
const expectClose = (actual: readonly number[], expected: readonly number[]): void =>
  expected.forEach((v, i) => expect(actual[i]).toBeCloseTo(v, 6))

describe('anchorShift', () => {
  it('moves the part so the far side of a side handle stays put', () => {
    const start = startFor(part(), 'x+')
    expect(anchorShift(BOX, start.handle, [1.5, 1, 1])).toEqual([5, 0, 0])
    expect(anchorShift(BOX, startFor(part(), 'x-').handle, [1.5, 1, 1])).toEqual([-5, 0, 0])
  })

  it('keeps the bottom down when the top handle grows the part', () => {
    expect(anchorShift(BOX, startFor(part(), 'z+').handle, [1, 1, 1.5])).toEqual([0, 0, 0])
  })

  it('keeps the bottom corner and the bottom still when Alt scales a centred part', () => {
    expect(anchorShift(CENTRED, startFor(part(), 'corner-x+y+', CENTRED).handle, [1.5, 1.5, 1.5])).toEqual([5, 5, 5])
  })

  it('grows a linked axis the drag did not touch evenly', () => {
    expect(anchorShift(BOX, startFor(part(), 'x+').handle, [1.5, 1.5, 1])).toEqual([5, 0, 0])
  })
})

describe('sizeDragFrame', () => {
  it('previews the new size and the moved position', () => {
    const frame = sizeDragFrame(startFor(part(), 'x+'), [10, 0, 0], FREE)
    expect(frame).toEqual({ scale: [1.5, 1, 1], position: [5, 0, 0], text: 'Width 30 mm' })
  })

  it('keeps the far side still on a turned part', () => {
    const frame = sizeDragFrame(startFor(part({ rotation: [0, 0, 90] }), 'x+'), [10, 0, 0], FREE)
    expectClose(frame.position, [0, 5, 0])
  })

  it('shows both sizes for a corner', () => {
    expect(sizeDragFrame(startFor(part(), 'corner-x+y+'), [10, 5, 0], FREE).text).toBe('Width 30 mm × Depth 25 mm')
  })

  it('says when a size hit its biggest value', () => {
    expect(sizeText({ scale: [100, 1, 1], changes: [{ key: 'width', label: 'Width', value: 2000 }], biggest: 2000 }))
      .toBe('Biggest size: 2000 mm')
  })
})

describe('finishSizeDrag', () => {
  it('returns nothing when the drag changed nothing', () => {
    const start = startFor(part(), 'x+')
    expect(finishSizeDrag(start, sizeDragFrame(start, ORIGIN, FREE))).toBeNull()
  })

  it('writes the new size and position as one undo step', () => {
    const store = createBloKadeStore({ designId: 'd', doc: addNode(createEmptyDocument(), part()) })
    const start = startFor(part(), 'x+')
    const edited = finishSizeDrag(start, sizeDragFrame(start, [10, 0, 0], FREE))
    if (!edited) throw new Error('nothing changed')
    store.getState().apply((d) => updateNode(d, 'b', () => edited))
    expect(store.getState().history.present.nodes.b).toMatchObject({ params: { width: 30 }, transform: { position: [5, 0, 0] } })
    store.getState().undo()
    expect(store.getState().history.present.nodes.b).toMatchObject({ params: { width: 20 }, transform: { position: [0, 0, 0] } })
  })

  it('drops the formula of the size it changed and keeps the others', () => {
    const withFormulas = part({ formulas: { 'param.width': 'wall * 2', 'param.height': 'tall' } })
    const doc = addNode(createEmptyDocument(), withFormulas)
    const start = startFor(withFormulas, 'x+')
    const edited = finishSizeDrag(start, sizeDragFrame(start, [10, 0, 0], FREE))
    if (!edited) throw new Error('nothing changed')
    expect(updateNode(doc, 'b', () => edited).nodes.b?.formulas).toEqual({ 'param.height': 'tall' })
  })
})

describe('parts with copies or a mirror', () => {
  const pattern: Modifier = { id: 'abcdef12', enabled: true, type: 'linearPattern', count: 3, spacing: [30, 0, 0] }
  const fillet: Modifier = { id: 'abcdef13', enabled: true, type: 'fillet', radius: 1, edges: { by: 'description', which: 'all' } }

  it('get no handles, but rounded edges are fine', () => {
    expect(resizesByHandle(part())).toBe(true)
    expect(resizesByHandle(part({ modifiers: [fillet] }))).toBe(true)
    expect(resizesByHandle(part({ modifiers: [pattern] }))).toBe(false)
    expect(resizesByHandle(part({ modifiers: [{ ...pattern, enabled: false }] }))).toBe(true)
  })

  it('show a hint in Size mode only', () => {
    const doc = addNode(createEmptyDocument(), part({ modifiers: [pattern] }))
    expect(sizeHintFor(doc, ['b'], 'size')).toBe(COPIES_HINT)
    expect(sizeHintFor(doc, ['b'], 'move')).toBeNull()
    expect(sizeHintFor(addNode(createEmptyDocument(), part()), ['b'], 'size')).toBeNull()
    expect(sizeHintFor(doc, [], 'size')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/viewport/size-drag.test.ts`
Expected: FAIL with "Failed to resolve import "./size-drag"".

- [ ] **Step 3: Export `formatMm` from `measure.ts`**

In `src/viewport/measure.ts`, replace:

```ts
const mm = (value: number): string => {
```

with:

```ts
/** A length rounded to 0.1 mm, without a minus sign on zero. */
export const formatMm = (value: number): string => {
```

Then replace the two uses in `formatMeasurement`: `m.size.map(mm)` becomes `m.size.map(formatMm)`, and `mm(m.nearest.distance)` becomes `formatMm(m.nearest.distance)`.

- [ ] **Step 4: Write `size-drag.ts`**

Create `src/viewport/size-drag.ts`:

```ts
import { Vector3 } from 'three'
import type { Box } from '../document/box'
import { keepUnchanged, transformToMatrix } from '../document/transform-math'
import type { BloKadeDocument, NodeId, SceneNode, ShapeNode, Vec3 } from '../document/types'
import type { ShapePlugin } from '../plugins/types'
import type { ToolMode } from '../store/store'
import { dragToScale, type SizeDragResult, type SizeHandle } from './face-handles'
import { movedSince } from './handle-drag'
import { formatMm } from './measure'
import { paramsFromScale } from './sizing'

export interface SizeDragStart {
  readonly node: ShapeNode
  readonly plugin: ShapePlugin
  /** The part's box in its own frame when the drag started. */
  readonly box: Box
  readonly handle: SizeHandle
  /** Where the pointer was on the handle's track (see trackPoint). */
  readonly from: Vec3
}

export interface SizeDragModifiers {
  /** Grid step to snap sizes to; 0 means no snapping (Shift held, or snapping off). */
  readonly snap: number
  /** Alt held: a corner keeps the shape's proportions. */
  readonly keepProportions: boolean
}

export interface SizeDragFrame {
  /** Factor per axis to show the part at while dragging, about its own origin. */
  readonly scale: Vec3
  /** Where the part sits so the far side stays put. */
  readonly position: Vec3
  /** The live size text. */
  readonly text: string
}

export const COPIES_HINT = 'This part has copies or a mirror image. Type its sizes in Properties instead.'

/** Modifiers that change a part's outline, so handles on its box would be in the wrong place. */
const OUTLINE_CHANGERS: ReadonlySet<string> = new Set(['linearPattern', 'circularPattern', 'mirror'])

const round6 = (v: number): number => {
  const r = Math.round(v * 1e6) / 1e6
  return Object.is(r, -0) ? 0 : r
}

/** Size handles follow the part's box, which copies and mirror images change. */
export const resizesByHandle = (node: SceneNode): boolean =>
  node.kind === 'shape' && !(node.modifiers ?? []).some((m) => m.enabled && OUTLINE_CHANGERS.has(m.type))

/** The hint shown in the 3D view when the Size tool can't put handles on the selected part. */
export function sizeHintFor(doc: BloKadeDocument, selection: readonly NodeId[], tool: ToolMode): string | null {
  const [id] = selection
  if (tool !== 'size' || selection.length !== 1 || id === undefined || !doc.root.includes(id)) return null
  const node = Object.hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined
  return node && node.kind === 'shape' && !resizesByHandle(node) ? COPIES_HINT : null
}

/** How far the part moves, in its own frame, so the side opposite the handle stays where it was. */
export function anchorShift(box: Box, handle: SizeHandle, scale: Vec3): Vec3 {
  // `+ 0` turns -0 (from 0 × a negative number) into 0.
  const shift = (axis: 0 | 1 | 2): number => anchorOn(box, handle, scale, axis) + 0
  return [shift(0), shift(1), shift(2)]
}

/** The face or corner that must stay still on one axis decides the shift; a linked axis grows about the origin. */
function anchorOn(box: Box, handle: SizeHandle, scale: Vec3, axis: 0 | 1 | 2): number {
  const s = scale[axis]
  const d = handle.dir[axis]
  if (s === 1) return 0
  if (d > 0) return box.min[axis] * (1 - s)
  if (d < 0) return box.max[axis] * (1 - s)
  return axis === 2 && handle.kind === 'corner' ? box.min[2] * (1 - s) : 0
}

function rotate(v: Vec3, rotation: Vec3): Vec3 {
  const p = new Vector3(...v).applyMatrix4(transformToMatrix({ position: [0, 0, 0], rotation }))
  return [p.x, p.y, p.z]
}

/** "Width 30 mm", "Width 30 mm × Depth 25 mm", or "Biggest size: 2000 mm". */
export function sizeText(result: SizeDragResult): string {
  if (result.biggest !== null) return `Biggest size: ${formatMm(result.biggest)} mm`
  return result.changes.map((c) => `${c.label} ${formatMm(c.value)} mm`).join(' × ')
}

/** The live preview for the pointer at `to` on the handle's track. */
export function sizeDragFrame(start: SizeDragStart, to: Vec3, mods: SizeDragModifiers): SizeDragFrame {
  const { node, plugin, box, handle } = start
  const result = dragToScale({
    plugin, params: node.params, box, handle, moved: movedSince(start.from, to),
    snap: mods.snap, keepProportions: mods.keepProportions,
  })
  const shift = rotate(anchorShift(box, handle, result.scale), node.transform.rotation)
  const [x, y, z] = node.transform.position
  return { scale: result.scale, position: [x + shift[0], y + shift[1], z + shift[2]], text: sizeText(result) }
}

/** The part after the drag, or null when the drag changed nothing. */
export function finishSizeDrag(start: SizeDragStart, frame: SizeDragFrame): ShapeNode | null {
  if (frame.scale.every((s) => s === 1)) return null
  const { node, plugin } = start
  const position: Vec3 = [round6(frame.position[0]), round6(frame.position[1]), round6(frame.position[2])]
  return {
    ...node,
    params: paramsFromScale(plugin, node.params, frame.scale),
    transform: { position: keepUnchanged(node.transform.position, position), rotation: node.transform.rotation },
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/viewport`
Expected: PASS. That covers `size-drag.test.ts` (13 tests) plus the existing `measure.test.ts` and `drag-feedback.test.ts`, which are unchanged.

Then run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/viewport/measure.ts src/viewport/size-drag.ts src/viewport/size-drag.test.ts
git commit -m "feat: keep the far side still while a size handle is dragged

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 4: Drawing and dragging the handles in the 3D view

**Files:**
- Create: `src/viewport/useSizeDrag.ts`
- Create: `src/viewport/SizeHandles.tsx`
- Modify: `src/viewport/TransformHandles.tsx` (full replacement below)
- Modify: `src/viewport/Viewport.tsx` (the copies hint)
- Modify: `src/ui/App.css` (append `.size-handle-tip`)
- Test: `e2e/size-handles.spec.ts`

**Interfaces:**
- Consumes:
  - Task 1: `handlesFor`, `handleTip`, `SizeHandle`;
  - Task 2: `pointerRay`, `toLocalRay`, `trackPoint`, `screenScale`, `PointerSpot`;
  - Task 3: `sizeDragFrame`, `finishSizeDrag`, `resizesByHandle`, `sizeHintFor`, `SizeDragStart`, `SizeDragFrame`;
  - `meshBox(positions, matrix)` from `src/viewport/bounds.ts`;
  - `TOOLTIP_DELAY_MS` from `src/ui/HelpTooltips.tsx`;
  - `updateNode` from `src/document/ops.ts`;
  - `useBloKade` and `useBloKadeStore` from `src/store/context`.
- Produces:
  - `SizeHandles({ node, plugin, displayed, target, onMeasure })`
  - `useSizeDrag(node, plugin, box, target, onMeasure): { frame, activeHandle, begin(handle, spot) }`
  - On the canvas element:
    - `data-size-handles`: a JSON map of handle id to `[x, y]` in canvas pixels;
    - `data-help`: `size-handle` or `size-corner` while a handle is hovered.
  - The tooltip element has `data-testid="size-handle-tip"`.

- [ ] **Step 1: Write the failing e2e test**

Create `e2e/size-handles.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test'

type Spots = Record<string, readonly [number, number]>

const canvas = (page: Page) => page.locator('.viewport canvas').first()
const value = async (page: Page, testId: string): Promise<number> => Number(await page.getByTestId(testId).inputValue())

async function pagePoint(page: Page, id: string): Promise<{ x: number; y: number }> {
  await expect(canvas(page)).toHaveAttribute('data-size-handles', /"x\+"/)
  const spots = JSON.parse((await canvas(page).getAttribute('data-size-handles')) ?? '{}') as Spots
  const spot = spots[id]
  const box = await canvas(page).boundingBox()
  if (!spot || !box) throw new Error(`No handle ${id}`)
  return { x: box.x + spot[0], y: box.y + spot[1] }
}

async function boxWithHandles(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
  await page.getByTestId('add-box').click()
  await expect(page.getByTestId('param-width')).toHaveValue('20')
  await page.getByTestId('tool-size').click()
}

/** Presses on the +x handle and drags it outward by the on-screen gap between the two x handles. */
async function dragWider(page: Page, finish: (page: Page) => Promise<void>): Promise<void> {
  const left = await pagePoint(page, 'x-')
  const right = await pagePoint(page, 'x+')
  await page.mouse.move(right.x, right.y)
  await page.mouse.down()
  await page.mouse.move(right.x + (right.x - left.x), right.y + (right.y - left.y), { steps: 8 })
  await finish(page)
}

test('dragging a side handle grows that side only, and one undo puts it back', async ({ page }) => {
  await boxWithHandles(page)
  await dragWider(page, async (p) => {
    await expect(p.getByTestId('measurement')).toContainText('Width')
    await p.mouse.up()
  })
  const width = await value(page, 'param-width')
  expect(width).toBeGreaterThan(30)
  expect((await value(page, 'pos-x')) - width / 2).toBeCloseTo(-10, 1)
  await expect(page.getByTestId('measurement')).toBeHidden()
  await page.getByTestId('undo').click()
  await expect(page.getByTestId('param-width')).toHaveValue('20')
  await expect(page.getByTestId('pos-x')).toHaveValue('0')
})

test('Esc during a drag puts the part back and keeps it selected', async ({ page }) => {
  await boxWithHandles(page)
  await dragWider(page, async (p) => {
    await p.keyboard.press('Escape')
    await p.mouse.up()
  })
  await expect(page.getByTestId('param-width')).toHaveValue('20')
  await expect(page.getByTestId('measurement')).toBeHidden()
})

test('keys pressed during a drag do not change the design', async ({ page }) => {
  await boxWithHandles(page)
  await dragWider(page, async (p) => {
    await p.keyboard.press('Delete')
    await p.keyboard.press('m')
    await p.mouse.up()
  })
  await expect(page.getByTestId('param-width')).toBeVisible()
  expect(await value(page, 'param-width')).toBeGreaterThan(30)
  await expect(page.getByTestId('tool-size')).toHaveAttribute('aria-pressed', 'true')
})

test('letting go outside the 3D view still finishes the drag', async ({ page }) => {
  await boxWithHandles(page)
  await dragWider(page, async (p) => {
    const view = await canvas(p).boundingBox()
    if (!view) throw new Error('no 3D view')
    // Keep going right, past the edge of the 3D view into the properties panel, then let go there.
    await p.mouse.move(view.x + view.width + 20, (await pagePoint(p, 'x+')).y, { steps: 4 })
    await p.mouse.up()
  })
  await expect(page.getByTestId('measurement')).toBeHidden()
  expect(await value(page, 'param-width')).toBeGreaterThan(30)
})

test('a handle shows a tip, and in help mode it explains itself without dragging', async ({ page }) => {
  await boxWithHandles(page)
  const right = await pagePoint(page, 'x+')
  await page.mouse.move(right.x, right.y)
  await page.mouse.move(right.x + 1, right.y)
  await expect(page.getByTestId('size-handle-tip')).toHaveText('Drag to change the Width.')

  await page.getByTestId('help-mode').click()
  await page.mouse.move(right.x, right.y)
  await page.mouse.down()
  await page.mouse.move(right.x + 80, right.y, { steps: 5 })
  await page.mouse.up()
  await expect(page.getByTestId('param-width')).toHaveValue('20')

  await page.mouse.move(right.x, right.y)
  await page.mouse.move(right.x + 1, right.y)
  await page.mouse.click(right.x + 1, right.y)
  await expect(page.getByTestId('help-card')).toContainText('The other side stays put')
  await page.keyboard.press('Escape')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test e2e/size-handles.spec.ts --reporter=line`
Expected: FAIL. The canvas never gets `data-size-handles`; the first `toHaveAttribute` times out in every test.

- [ ] **Step 3: Write `useSizeDrag.ts`**

Create `src/viewport/useSizeDrag.ts`:

```ts
import { useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import type { Object3D } from 'three'
import type { Box } from '../document/box'
import { updateNode } from '../document/ops'
import type { ShapeNode } from '../document/types'
import type { ShapePlugin } from '../plugins/types'
import { useBloKade, useBloKadeStore } from '../store/context'
import type { SizeHandle } from './face-handles'
import { pointerRay, toLocalRay, trackPoint, type PointerSpot } from './handle-drag'
import { finishSizeDrag, sizeDragFrame, type SizeDragFrame, type SizeDragStart } from './size-drag'

/** The camera controls (OrbitControls, made default in Viewport). Only `enabled` matters here. */
interface Toggleable {
  enabled: boolean
}

export interface SizeDragControls {
  /** The live preview while dragging, or null. */
  readonly frame: SizeDragFrame | null
  /** The id of the handle being dragged, or null. */
  readonly activeHandle: string | null
  begin(handle: SizeHandle, spot: PointerSpot): void
}

function showFrame(target: Object3D, frame: SizeDragFrame): void {
  target.scale.set(...frame.scale)
  target.position.set(...frame.position)
}

function resetTarget(target: Object3D, node: ShapeNode): void {
  target.scale.set(1, 1, 1)
  target.position.set(...node.transform.position)
}

/** Listens on the window while a handle is dragged, so letting go anywhere ends the drag. */
function listen(handlers: { move(e: PointerEvent): void; up(): void; cancel(): void; key(e: KeyboardEvent): void }): () => void {
  const pairs: [keyof WindowEventMap, EventListener, boolean][] = [
    ['pointermove', handlers.move as EventListener, false],
    ['pointerup', handlers.up, false],
    ['pointercancel', handlers.cancel, false],
    ['blur', handlers.cancel, false],
    ['keydown', handlers.key as EventListener, true],
  ]
  for (const [type, fn, capture] of pairs) window.addEventListener(type, fn, capture)
  return () => {
    for (const [type, fn, capture] of pairs) window.removeEventListener(type, fn, capture)
  }
}

/** Runs one handle drag: live preview, one undo step on release, nothing written on Esc. */
export function useSizeDrag(
  node: ShapeNode, plugin: ShapePlugin, box: Box, target: Object3D, onMeasure: (text: string | null) => void,
): SizeDragControls {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as Toggleable | null
  const store = useBloKadeStore()
  const gridSnap = useBloKade((s) => s.history.present.settings.gridSnap)
  const [start, setStart] = useState<SizeDragStart | null>(null)
  const [frame, setFrame] = useState<SizeDragFrame | null>(null)
  const last = useRef<SizeDragFrame | null>(null)
  const pointOn = (handle: SizeHandle, spot: PointerSpot) =>
    trackPoint(handle, toLocalRay(pointerRay(spot, gl.domElement, camera), node.transform))

  useEffect(() => {
    if (!start) return undefined
    const finish = (commit: boolean): void => {
      const edited = commit && last.current ? finishSizeDrag(start, last.current) : null
      setStart(null)
      if (edited) store.getState().apply((d) => updateNode(d, node.id, () => edited))
    }
    const stop = listen({
      move: (event) => {
        const to = pointOn(start.handle, event)
        if (!to) return
        const next = sizeDragFrame(start, to, { snap: event.shiftKey ? 0 : gridSnap, keepProportions: event.altKey })
        last.current = next
        showFrame(target, next)
        setFrame(next)
        onMeasure(next.text)
      },
      up: () => finish(true),
      cancel: () => finish(false),
      // Every key is swallowed while dragging, so design shortcuts can't change the part under the pointer.
      key: (event) => {
        event.preventDefault()
        event.stopPropagation()
        if (event.key === 'Escape') finish(false)
      },
    })
    return () => {
      stop()
      if (controls) controls.enabled = true
      resetTarget(target, node)
      last.current = null
      setFrame(null)
      onMeasure(null)
    }
  // pointOn reads gl, camera and node, which are listed.
  }, [start, gl, camera, controls, gridSnap, node, target, store, onMeasure])

  const begin = (handle: SizeHandle, spot: PointerSpot): void => {
    const from = pointOn(handle, spot)
    if (!from) return
    // OrbitControls saw this press first; turning it off now stops it from spinning the camera as the mouse moves.
    if (controls) controls.enabled = false
    setStart({ node, plugin, box, handle, from })
  }
  return { frame, activeHandle: start?.handle.id ?? null, begin }
}
```

- [ ] **Step 4: Write `SizeHandles.tsx`**

Create `src/viewport/SizeHandles.tsx`:

```tsx
import { Html } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { MathUtils, Matrix4, PerspectiveCamera, Vector3, type Group, type Object3D } from 'three'
import type { Box } from '../document/box'
import type { ShapeNode, Vec3 } from '../document/types'
import type { ShapePlugin } from '../plugins/types'
import type { DisplayedMesh } from '../store/merge-build'
import { TOOLTIP_DELAY_MS } from '../ui/HelpTooltips'
import { meshBox } from './bounds'
import { handlesFor, handleTip, type SizeHandle } from './face-handles'
import { screenScale, type PointerSpot } from './handle-drag'
import { useSizeDrag } from './useSizeDrag'

const HANDLE_PX = 10
const BORDER_COLOR = '#1d2433'
const HANDLE_COLOR = '#ffffff'
const HOT_COLOR = '#4f9dff'
const FACE_SIZE = 0.72
const FALLBACK_FOV = 45
const ON_TOP = 1000
const IDENTITY = new Matrix4()
const NO_SCALE: Vec3 = [1, 1, 1]

const scaled = (p: Vec3, s: Vec3): Vec3 => [p[0] * s[0], p[1] * s[1], p[2] * s[2]]
const radians = (r: Vec3): Vec3 => [MathUtils.degToRad(r[0]), MathUtils.degToRad(r[1]), MathUtils.degToRad(r[2])]

interface HandleCubeProps {
  readonly handle: SizeHandle
  readonly at: Vec3
  readonly hot: boolean
  onOver(handle: SizeHandle): void
  onOut(handle: SizeHandle): void
  onDown(handle: SizeHandle, spot: PointerSpot): void
}

/** One handle: a white square with a dark border, the same size on screen at any zoom, drawn on top of the part. */
function HandleCube({ handle, at, hot, onOver, onOut, onDown }: HandleCubeProps) {
  const ref = useRef<Group>(null)
  const camera = useThree((s) => s.camera)
  const height = useThree((s) => s.size.height)
  useFrame(() => {
    const group = ref.current
    if (!group) return
    const fov = camera instanceof PerspectiveCamera ? camera.fov : FALLBACK_FOV
    const distance = group.getWorldPosition(new Vector3()).distanceTo(camera.position)
    group.scale.setScalar(screenScale(distance, fov, height, HANDLE_PX))
  })
  const down = (event: ThreeEvent<PointerEvent>): void => {
    if (event.button !== 0) return
    event.stopPropagation()
    onDown(handle, event.nativeEvent)
  }
  return (
    <group ref={ref} position={at} userData={{ sizeHandle: handle.id }}
      onPointerOver={(e) => { e.stopPropagation(); onOver(handle) }} onPointerOut={() => onOut(handle)}
      onPointerDown={down} onClick={(e) => e.stopPropagation()}>
      <mesh renderOrder={ON_TOP}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={BORDER_COLOR} depthTest={false} transparent />
      </mesh>
      <mesh renderOrder={ON_TOP + 1} scale={FACE_SIZE}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={hot ? HOT_COLOR : HANDLE_COLOR} depthTest={false} transparent />
      </mesh>
    </group>
  )
}

/** Hover state, the delayed tip, and the canvas's data-help so ❓ help mode can explain the handle. */
function useHover(dragging: boolean) {
  const gl = useThree((s) => s.gl)
  const [hovered, setHovered] = useState<SizeHandle | null>(null)
  const [tip, setTip] = useState<string | null>(null)
  useEffect(() => {
    setTip(null)
    const el = gl.domElement
    if (!hovered) {
      delete el.dataset.help
      el.style.cursor = ''
      return undefined
    }
    el.dataset.help = hovered.kind === 'corner' ? 'size-corner' : 'size-handle'
    el.style.cursor = 'grab'
    if (dragging) return undefined
    const timer = setTimeout(() => setTip(hovered.id), TOOLTIP_DELAY_MS)
    return () => clearTimeout(timer)
  }, [hovered, dragging, gl])
  useEffect(() => () => {
    delete gl.domElement.dataset.help
    gl.domElement.style.cursor = ''
  }, [gl])
  const out = (handle: SizeHandle): void => setHovered((current) => (current?.id === handle.id ? null : current))
  return { hovered: hovered?.id ?? null, tip, over: setHovered, out }
}

/** Writes each handle's spot on the canvas as data-size-handles, so end-to-end tests can find them. */
function useHandleSpots(group: RefObject<Group | null>): void {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const last = useRef('')
  useFrame(() => {
    const children: readonly Object3D[] = group.current?.children ?? []
    const spots = Object.fromEntries(children.flatMap((child) => {
      const id: unknown = child.userData.sizeHandle
      if (typeof id !== 'string') return []
      const ndc = child.getWorldPosition(new Vector3()).project(camera)
      return [[id, [Math.round(((ndc.x + 1) / 2) * size.width), Math.round(((1 - ndc.y) / 2) * size.height)]]]
    }))
    const text = JSON.stringify(spots)
    if (text === last.current) return
    last.current = text
    gl.domElement.dataset.sizeHandles = text
  })
  useEffect(() => () => {
    delete gl.domElement.dataset.sizeHandles
  }, [gl])
}

interface HandlesProps {
  readonly node: ShapeNode
  readonly plugin: ShapePlugin
  readonly box: Box
  readonly target: Object3D
  onMeasure(text: string | null): void
}

function Handles({ node, plugin, box, target, onMeasure }: HandlesProps) {
  const group = useRef<Group>(null)
  const handles = useMemo(() => handlesFor(plugin, box), [plugin, box])
  const drag = useSizeDrag(node, plugin, box, target, onMeasure)
  const hover = useHover(drag.activeHandle !== null)
  useHandleSpots(group)
  const scale = drag.frame?.scale ?? NO_SCALE
  const tipHandle = hover.tip ? handles.find((h) => h.id === hover.tip) : undefined
  return (
    <group ref={group} position={drag.frame?.position ?? node.transform.position} rotation={radians(node.transform.rotation)}>
      {handles.map((h) => (
        <HandleCube key={h.id} handle={h} at={scaled(h.position, scale)} hot={h.id === hover.hovered || h.id === drag.activeHandle}
          onOver={hover.over} onOut={hover.out} onDown={drag.begin} />
      ))}
      {tipHandle && (
        <Html position={scaled(tipHandle.position, scale)} style={{ pointerEvents: 'none' }}>
          <div className="help-tooltip size-handle-tip" role="tooltip" data-testid="size-handle-tip">{handleTip(plugin, tipHandle)}</div>
        </Html>
      )}
    </group>
  )
}

interface SizeHandlesProps {
  readonly node: ShapeNode
  readonly plugin: ShapePlugin
  readonly displayed: DisplayedMesh
  /** The three.js object drawn for the part; it is stretched live while dragging. */
  readonly target: Object3D
  onMeasure(text: string | null): void
}

/** TinkerCAD-style size handles: drag a side, the top or a bottom corner, and the far side stays put. */
export function SizeHandles({ node, plugin, displayed, target, onMeasure }: SizeHandlesProps) {
  const box = useMemo(() => meshBox(displayed.mesh.positions, IDENTITY), [displayed.mesh])
  return box ? <Handles node={node} plugin={plugin} box={box} target={target} onMeasure={onMeasure} /> : null
}
```

The white cube is drawn at `FACE_SIZE` of the dark cube, after it, so a dark border shows around the white face.

- [ ] **Step 5: Replace `TransformHandles.tsx`**

Replace the whole of `src/viewport/TransformHandles.tsx` with:

```tsx
import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { MathUtils, Vector3, type Object3D } from 'three'
import { updateNode } from '../document/ops'
import { keepUnchanged, transformFromParts } from '../document/transform-math'
import type { SceneNode, Transform } from '../document/types'
import type { PluginRegistry } from '../plugins/registry'
import { useBloKade, useBloKadeStore } from '../store/context'
import { meshBox, topLevelBoxes } from './bounds'
import { dragFeedback } from './drag-feedback'
import { axesOf } from './object-snap'
import { resizesByHandle } from './size-drag'
import { SizeHandles } from './SizeHandles'
import { useShiftHeld } from './useShiftHeld'

const ROTATION_SNAP = MathUtils.degToRad(15)
const CONTROL_MODES = { move: 'translate', rotate: 'rotate' } as const

const sameTransform = (a: Transform, b: Transform): boolean =>
  a.position.every((v, i) => v === b.position[i]) && a.rotation.every((v, i) => v === b.rotation[i])

// `axis` is public at runtime on TransformControls but declared private in three-stdlib's types.
const draggedAxis = (c: unknown): string | null => {
  const a = (c as { axis?: unknown } | null)?.axis
  return typeof a === 'string' ? a : null
}

/** The finished move or turn as a transform, or null when nothing moved. */
function readDrag(target: Object3D, old: Transform): Transform | null {
  const dragged = transformFromParts(
    [target.position.x, target.position.y, target.position.z],
    [target.rotation.x, target.rotation.y, target.rotation.z],
  )
  // Rounding must not count as a change, or untouched fields would lose their formulas.
  const transform: Transform = {
    position: keepUnchanged(old.position, dragged.position),
    rotation: keepUnchanged(old.rotation, dragged.rotation),
  }
  return sameTransform(transform, old) ? null : transform
}

/** The three.js object drawn for a part, found by name once its mesh is in the scene. */
function useSceneObject(id: string | null, meshes: unknown): Object3D | null {
  const scene = useThree((s) => s.scene)
  const [target, setTarget] = useState<Object3D | null>(null)
  useEffect(() => {
    setTarget(id ? scene.getObjectByName(id) ?? null : null)
  }, [id, scene, meshes])
  return target
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
  const shiftHeld = useShiftHeld()
  const controls = useRef<ComponentRef<typeof TransformControls>>(null)

  const selectedId = selection.length === 1 ? selection[0] : undefined
  const id = selectedId && doc.root.includes(selectedId) ? selectedId : null
  const node = id && Object.hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined
  const others = useMemo(() => topLevelBoxes(doc, meshes).filter((b) => b.id !== id), [doc, meshes, id])
  const target = useSceneObject(id, meshes)

  // A drag cut short by unmounting (selection or tool change) must not leave the measurement stuck on screen.
  useEffect(() => () => onMeasure(null), [onMeasure])

  if (!node || !target) return null
  const displayed = Object.hasOwn(meshes, node.id) ? meshes[node.id] : undefined

  if (tool === 'size') {
    const plugin = node.kind === 'shape' ? registry.get(node.shapeType) : undefined
    return node.kind === 'shape' && plugin && displayed && resizesByHandle(node)
      ? <SizeHandles node={node} plugin={plugin} displayed={displayed} target={target} onMeasure={onMeasure} />
      : null
  }

  const onObjectChange = (): void => {
    target.updateMatrixWorld()
    const box = displayed ? meshBox(displayed.mesh.positions, target.matrixWorld) : null
    if (!box) return
    // Shift means "free": no grid snap and no object snap.
    const feedback = dragFeedback(box, others, tool === 'move' && !shiftHeld ? axesOf(draggedAxis(controls.current)) : null)
    if (feedback.offset.some((v) => v !== 0)) target.position.add(new Vector3(...feedback.offset))
    onMeasure(feedback.text)
  }
  const commit = (): void => {
    onMeasure(null)
    const transform = readDrag(target, node.transform)
    if (transform) store.getState().apply((d) => updateNode(d, node.id, (n): SceneNode => ({ ...n, transform })))
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

- [ ] **Step 6: Show the copies hint in `Viewport.tsx`**

In `src/viewport/Viewport.tsx`:

1. Add the import, sorted with the others:

   ```tsx
   import { sizeHintFor } from './size-drag'
   ```

2. Below `const pickingEdges = useBloKade((s) => s.pickingEdges)`, add:

   ```tsx
   const tool = useBloKade((s) => s.tool)
   const sizeHint = sizeHintFor(doc, selection, tool)
   ```

3. After the `{pickingEdges && <div className="viewport-hint" …>…</div>}` line, add:

   ```tsx
   {sizeHint && !picking && !pickingEdges && <div className="viewport-hint" role="status" data-testid="size-hint">{sizeHint}</div>}
   ```

- [ ] **Step 7: Style the tip**

Append to `src/ui/App.css`:

```css
/* The size-handle tip sits inside drei's <Html>, so it is placed next to the handle, not fixed to the window. */
.help-tooltip.size-handle-tip { position: absolute; top: 12px; left: 12px; width: max-content; }
```

- [ ] **Step 8: Run all the tests**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: PASS. Every unit test passes, including Tasks 1–3.

Run: `npx playwright test e2e/size-handles.spec.ts --reporter=line`
Expected: PASS (5 tests).

Run: `npm run e2e`
Expected: all specs pass. In particular, `e2e/lessons.spec.ts` "Move, turn and size" still types the height.

If a size-handles test is flaky because the pointer lands between frames, add `await page.waitForTimeout(100)` after `page.mouse.down()` in `dragWider`, and say so in the report.

- [ ] **Step 9: Commit**

```bash
git add src/viewport/useSizeDrag.ts src/viewport/SizeHandles.tsx src/viewport/TransformHandles.tsx src/viewport/Viewport.tsx src/ui/App.css e2e/size-handles.spec.ts
git commit -m "feat: drag a face or corner to resize, like TinkerCAD

The Size tool now shows handles on each side, the top and the bottom
corners instead of the scale gizmo. The far side stays put, sizes snap
to the grid (Shift for free), Alt on a corner keeps proportions, Esc
cancels, and one drag is one undo step.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 5: Help, lessons and README

**Files:**
- Modify: `src/help/help-texts.ts`
- Modify: `src/help/lookup.test.ts`
- Modify: `src/learn/tutorials/move-turn-size.ts`
- Modify: `src/learn/tutorials/holes-groups.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes:
  - the `data-help` keys `size-handle` and `size-corner` set by Task 4;
  - `helpFor(key)` from `src/help/lookup.ts`.
- Produces: help entries for `size-handle` and `size-corner`.

- [ ] **Step 1: Write the failing test**

Add to the end of `src/help/lookup.test.ts`, inside its top-level `describe` if there is one, or else as a new `describe`. Reuse the file's existing imports of `describe`, `expect`, `it` and `helpFor`, and add any that are missing.

```ts
describe('size handle help', () => {
  it('explains side handles and corners', () => {
    expect(helpFor('size-handle')?.card).toContain('The other side stays put')
    expect(helpFor('size-corner')?.card).toContain('Hold **Alt**')
    expect(helpFor('size-corner')?.tutorial).toBe('move-turn-size')
  })

  it('tells Kade how to cut part of a shape away', () => {
    expect(helpFor('mode-hole')?.card).toContain('cut part of a shape away')
    expect(helpFor('tree-mode')?.card).toContain('cut part of a shape away')
    expect(helpFor('tool-size')?.card).toContain('The other side stays put')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/help/lookup.test.ts`
Expected: FAIL. `helpFor('size-handle')` is undefined, and the existing cards lack the new sentences.

- [ ] **Step 3: Update the help texts**

In `src/help/help-texts.ts`:

1. Replace the `'tool-size'` entry with:

   ```ts
   'tool-size': { tip: 'Shows handles to stretch the selected part.', card: 'With Size on, drag a white handle on the part. The other side stays put. Drag a bottom corner to change the width and depth together. Hold **Alt** to keep the shape’s proportions. You can also type sizes under Size.', tutorial: 'move-turn-size' },
   ```

2. Directly after the `'tool-size'` line, add the two new entries:

   ```ts
   'size-handle': { tip: 'Drag to make the part bigger or smaller on this side.', card: 'Drag a white handle to change one size. The other side stays put. Sizes snap to the grid. Hold **Shift** while dragging to turn that off.', tutorial: 'move-turn-size' },
   'size-corner': { tip: 'Drag to change the width and depth together.', card: 'Drag a bottom corner to change the width and depth together. The opposite corner stays put. Hold **Alt** to keep the shape’s proportions.', tutorial: 'move-turn-size' },
   ```

3. In the `'tree-mode'` entry, change `card` to:

   ```ts
   card: 'A solid is a real part. A hole is empty space that cuts the solids in its group. To cut part of a shape away, put a hole where you want the gap, select both, and click **Group**.'
   ```

4. In the `'mode-hole'` entry, change `card` to:

   ```ts
   card: 'A hole cuts away the solid parts in its group. Make a cylinder a hole and group it with a box to drill through the box. To cut part of a shape away, put a hole where you want the gap, select both, and click **Group**.'
   ```

Keep every other field of those entries (`tip`, `tryIt`, `tutorial`) unchanged.

- [ ] **Step 4: Update the two lessons**

In `src/learn/tutorials/move-turn-size.ts`, change the `taller` step's `text` to:

```ts
text: 'Make it taller: drag the white handle on top, or type **40** into **Height**.',
```

In `src/learn/tutorials/holes-groups.ts`, change `intro` to:

```ts
intro: 'Turn a part into a hole and use it to cut another part. A hole is how you cut part of a shape away, like making an L from a block.',
```

- [ ] **Step 5: Update the README**

In `README.md`, replace the shortcut row:

```markdown
| M / R / S | Move / rotate / size handles |
```

with:

```markdown
| M / R / S | Move / rotate / size handles (with Size, drag a white handle; the other side stays put) |
| Alt (while dragging a corner) | Keep the shape's proportions |
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/help src/learn`
Expected: PASS, including the new lookup tests and the existing `coverage.test.tsx` and tutorial tests.

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass. `build` prints only the existing chunk-size warning.

Run: `npm run e2e`
Expected: all specs pass.

- [ ] **Step 7: Commit**

```bash
git add src/help/help-texts.ts src/help/lookup.test.ts src/learn/tutorials/move-turn-size.ts src/learn/tutorials/holes-groups.ts README.md
git commit -m "docs: explain size handles and cutting a shape with a hole

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
