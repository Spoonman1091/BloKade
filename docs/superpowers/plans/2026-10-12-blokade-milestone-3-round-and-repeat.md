# BloKade Milestone 3 ("Round & Repeat") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every part and group gets a **modifier stack**. A modifier stack can round or bevel edges (chosen by description, or by clicking edges that are remembered by fingerprint), repeat the part in a row or a circle, and mirror it. Designs can also be exported as **STEP**.

**Architecture:**
- **Document.** Modifiers are plain data on each node (`node.modifiers`, optional), and the schema moves to v3. Their number fields (radius, count, spacing…) are ordinary formula fields keyed `mod.<id>.<field>`, so variables and formulas work on them with no new machinery.
- **Worker.** The Evaluator applies enabled modifiers in order, after the plugin build or group boolean and before the node's transform. The result is cached under a key that includes the modifiers.
- **Edge selection** is pure math on sampled edge points relative to the input shape's bounding box. It never uses OpenCascade edge indices.
- **Picking edges.** The worker sends a list of candidate edges, each with a fingerprint and a polyline. The viewport draws them as clickable lines.

**Tech Stack:** Same as Milestone 2 (TypeScript 5.9 strict, React 19, Vite 8, three.js 0.186 + R3F 9 + drei 10, replicad 1.1 + OpenCascade WASM, Zustand 5, zod 4, Vitest 5, Playwright). No new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-10-11-blokade-design.md`. This plan covers:
- the Milestone 3 row of §9;
- §3: the `Modifier` and `EdgeSelection` types, the evaluation rules, the edge selection and topological naming problem, and caching;
- §4: the scene tree's modifier stack;
- §6: per-object build failure;
- §7: STEP export;
- §8: the E2E "round top edges" flow.

## Global Constraints

- Everything in the Milestone 1 and Milestone 2 plans' Global Constraints still applies:
  - Z-up, millimetres, degrees with Euler XYZ.
  - Plain HTTP, so no `crypto.randomUUID`.
  - Immutable document and store state.
  - No `eval` or `new Function`.
  - Files under 400 lines, functions under 50, nesting at most 4 levels.
  - No `console.log`.
  - Plain-English messages an 11-year-old understands.
  - At least 80% line coverage on non-UI logic.
  - Node lookups use `Object.hasOwn`.
  - Conventional commits ending with `Co-Authored-By: <model name> <noreply@anthropic.com>`.
- **replicad ownership rule**:
  - `translate`, `rotate` and `mirror` **delete their input**.
  - `fuse`, `cut`, `fillet` and `chamfer` **keep their inputs**.
  - Shapes in the Evaluator cache are owned by the cache. Always `clone()` a cached shape before consuming it.
- **Evaluation order** (spec §3): a shape is `build(params)`, then its enabled modifiers in order, then its transform. A group is the union of its solid children minus the union of its hole children, then its enabled modifiers in order, then its transform. Disabled modifiers are skipped. A hole part's modifiers apply before it cuts.
- **Never store OpenCascade edge indices.** Edges are chosen either:
  - by description (`all`, `top`, `bottom`, `vertical`, `horizontal`), computed from sampled edge points against the bounding box of **that modifier's input shape**; or
  - by `EdgeFingerprint`. The midpoint is stored as fractions (0–1) of that same bounding box, together with the sign-normalised unit direction at the midpoint, the edge kind (`line` / `circle` / `other`), and the length as a fraction of the box diagonal. Values are rounded to 4 decimals.
- **Fingerprint matching:**
  - The score is `|Δmid| + (1 − |dir·dir|) + |Δlength|`.
  - It is infinite when the kinds differ.
  - A match must score ≤ **0.1**.
  - Matching is greedy and one-to-one, best score first.
  - Unmatched fingerprints give the modifier the warning: "Lost track of N edge(s) — click Pick edges to choose them again." Matched edges are still applied.
- **Limits**:
  - **10** modifiers per node;
  - pattern `count` 1–**50** (whole numbers);
  - **200** copies at most across one node's stack (the product of pattern counts, ×2 for a mirror that keeps the original);
  - fillet radius and chamfer distance **0.05–500** mm;
  - pattern spacing and center within **±2000** mm;
  - circular `angle` **1–360**°;
  - **100** picked edges per modifier.
  Values typed in, produced by a formula, or found in an imported file are all clamped or validated to these limits.
- **Circular pattern step**: `count` copies spread over `angle`. If `angle` is 360 or more the step is `360 / count`, otherwise `angle / (count − 1)`. The axis passes through `center`, given in the node's local frame.
- **Linear pattern**: copy *i* (0-based) is offset by `spacing × i`. Copy 0 is the original.
- **Mirror** reflects through a plane through the node's local origin: `YZ` flips X, `XZ` flips Y, `XY` flips Z. `keepOriginal` fuses the original with the mirrored copy.
- **Modifier ids** are 8 lowercase hex characters (`newId().slice(0, 8)`) and are unique within their node.
- **Document schema version 3.** The upgrade from v2 adds nothing, because `modifiers` is optional. v1 and v2 designs and files open unchanged.
- **Kid-facing names:** Round edges (fillet), Bevel edges (chamfer), Repeat in a row (linear pattern), Repeat in a circle (circular pattern), Mirror. The section heading is "Modifiers".
- **STEP export** uses replicad `blobSTEP()` on the same fused export shape as STL and 3MF, saved as `<design>.step` with type `model/step`.

## Review Focus

1. **A fillet or chamfer too big for the part, or one put on a shape where it can't work** (a sphere, letters, a seam). Expected: a plain-English problem on that part, with its last mesh kept and dimmed; other parts still build and export keeps working. Pinned in Task 5 (too-big message) and Task 7 (the error is per node and other parts still build).
2. **Huge or stacked patterns** (count 50 × 50, a pattern plus a mirror). Expected: a friendly "too many copies" message before any geometry work starts, with no worker hang. Pinned in Task 6.
3. **Picked edges after the part changes**, for example when the box is resized, swapped for a sphere, or a hole is moved. Expected: edges that still exist stay rounded, and the modifier warns "Lost track of N edges". It never crashes and never rounds random edges. Pinned in Task 4 (matching math) and Task 5 (resize keeps them, sphere loses them).
4. **Modifiers on groups, on holes, and on parts inside groups.** Expected: the evaluation order from spec §3. For example, a row of three holes inside a group cuts three holes, and rounding a group's top edges rounds the combined shape. Pinned in Task 7.
5. **Designs and formulas around modifiers:**
   - v2 designs open; designs with modifiers survive save and reload.
   - A formula on a modifier field follows variable changes.
   - Deleting a modifier removes its formulas; duplicating a part keeps its modifiers.
   - A hand-edited file with a count of 9999 is reported as damaged instead of hanging the engine.
   Pinned in Task 1 (schema and migration) and Task 3 (formulas, deletion, duplicate).

---

## File Map

```
src/
├─ document/
│  ├─ types.ts               # v3: Modifier, EdgeSelection, EdgeFingerprint, ModifierField, limits; FieldKey mod.*
│  ├─ schema.ts              # v3 schema: modifiers with limits; uses FIELD_KEY_PATTERN from fields.ts
│  ├─ factory.ts             # (unchanged API)
│  ├─ modifiers.ts           # NEW labels, createModifier, add/update/remove/move/enable, edge selection ops, clamps
│  └─ fields.ts              # modifier fields: modifierField, readField/writeField for mod.*, FIELD_KEY_PATTERN
├─ persistence/migrate.ts    # MIGRATIONS[2] → v3
├─ geometry/
│  ├─ edge-select.ts         # NEW pure: EdgeInfo, matchesDescription, fingerprintOf, matchFingerprints, selectedEdges
│  ├─ edge-info.ts           # NEW replicad Edge → EdgeInfo, shapeBox, polyline sampling
│  ├─ modifiers.ts           # NEW applyModifiers, modifierInput, ModifierError, copiesMade (fillet/chamfer/patterns/mirror)
│  ├─ edge-candidates.ts     # NEW candidate edges for picking
│  ├─ evaluate.ts            # modifiers in local(), cache keys, warnings, edgeCandidates()
│  ├─ api.ts                 # warnings in rebuild, exportStep, edgeCandidates
│  ├─ client.ts              # exportStep, edgeCandidates
│  └─ types.ts               # BuildResult.warnings, EdgeCandidate, ModifierWarnings, GeometryApi additions
├─ store/store.ts            # modifierWarnings, pickingEdges, edgeCandidates
├─ app/
│  ├─ field-normalizer.ts    # clamps mod.* fields
│  ├─ edge-actions.ts        # NEW start/stop picking, togglePickedEdge
│  ├─ useEdgeCandidates.ts   # NEW fetches candidate edges while picking
│  ├─ actions.ts             # spreads edge actions; Esc also stops edge picking
│  ├─ export.ts              # 'step' format
│  └─ testing/fakes.ts       # fake exportStep / edgeCandidates
├─ persistence/design-file.ts# fileNameFor accepts 'step'
├─ viewport/
│  ├─ edge-points.ts         # NEW flat number[] → [x,y,z][] for drei Line
│  ├─ EdgeOverlay.tsx        # NEW clickable candidate edges
│  ├─ NodeMesh.tsx           # passive while picking edges
│  └─ Viewport.tsx           # overlay, hint, hide handles while picking
└─ ui/
   ├─ ModifierStack.tsx      # NEW list + add select
   ├─ ModifierCard.tsx       # NEW card: enable, reorder, delete, warning
   ├─ ModifierFields.tsx     # NEW per-type fields, edge choice, pick button
   ├─ modifier-icons.ts      # NEW icons + option lists
   ├─ PropertiesPanel.tsx    # renders ModifierStack
   ├─ SceneTree.tsx          # modifier icons per node
   ├─ Toolbar.tsx            # ⬇ STEP
   ├─ Workspace.tsx          # useEdgeCandidates, onToggleEdge
   └─ App.css
e2e/round-repeat.spec.ts     # NEW
```

---

### Task 1: Document v3 — modifier types, schema and migration

**Files:**
- Modify: `src/document/types.ts`, `src/document/schema.ts`, `src/persistence/migrate.ts`
- Test: `src/document/schema.test.ts`, `src/persistence/migrate.test.ts`, `src/persistence/design-file.test.ts`, `src/document/factory.test.ts`

**Interfaces:**
- Produces, in `src/document/types.ts`:
  - **Types:**
    - `ModifierType`, `EdgeWhich`, `EdgeKind`, `EdgeFingerprint`, `EdgeSelection`
    - `FilletModifier`, `ChamferModifier`, `LinearPatternModifier`, `CircularPatternModifier`, `MirrorModifier`, `Modifier`
    - `PatternAxis`, `MirrorPlane`, `ModifierField`
  - **Fields:**
    - `NodeBase.modifiers?: readonly Modifier[]`
    - `FieldKey` gains `` `mod.${string}` ``
    - `schemaVersion: 3`
  - **Constants:**
    - `CURRENT_SCHEMA_VERSION = 3`
    - `MAX_MODIFIERS = 10`, `MAX_PATTERN_COUNT = 50`, `MAX_COPIES = 200`, `MAX_PICKED_EDGES = 100`
    - `MIN_EDGE_SIZE = 0.05`, `MAX_EDGE_SIZE = 500`, `MAX_OFFSET = 2000`
    - `MIN_PATTERN_ANGLE = 1`, `MAX_PATTERN_ANGLE = 360`

- [ ] **Step 1: Update the tests first**

`src/document/factory.test.ts`: no change is needed if it compares against `CURRENT_SCHEMA_VERSION`. If it hard-codes `2`, change that to `3`.

`src/document/schema.test.ts`: in the "rejects an unknown schema version" test, change `schemaVersion: 3` to `schemaVersion: 4`. Then add:

```ts
  const fillet = { id: 'ab12cd34', type: 'fillet', enabled: true, radius: 2, edges: { by: 'description', which: 'top' } }

  it('accepts parts with modifiers and formulas on modifier fields', () => {
    const shape = {
      ...box('a'),
      modifiers: [
        fillet,
        { id: 'ef56ab78', type: 'linearPattern', enabled: false, count: 3, spacing: [25, 0, 0] },
        { id: '0011aabb', type: 'circularPattern', enabled: true, count: 6, axis: 'z', angle: 360, center: [0, 0, 0] },
        { id: '22334455', type: 'mirror', enabled: true, plane: 'YZ', keepOriginal: true },
        {
          id: '66778899', type: 'chamfer', enabled: true, distance: 1,
          edges: { by: 'picked', fingerprints: [{ kind: 'line', mid: [0.5, 0, 1], dir: [1, 0, 0], length: 0.5774 }] },
        },
      ],
      formulas: { 'mod.ab12cd34.radius': 'wall / 2', 'mod.ef56ab78.spacing.0': 'wall * 10' },
    }
    expect(validateDocument(docWith([shape], ['a'])).ok).toBe(true)
  })

  it('rejects modifiers that would hang or break the engine (Review Focus 5)', () => {
    const withMods = (modifiers: unknown[]) => docWith([{ ...box('a'), modifiers }], ['a'])
    expect(errorOf(withMods([{ id: 'ef56ab78', type: 'linearPattern', enabled: true, count: 9999, spacing: [1, 0, 0] }]))).toContain('damaged')
    expect(errorOf(withMods([{ ...fillet, radius: 0 }]))).toContain('damaged')
    expect(errorOf(withMods([{ ...fillet, type: 'explode' }]))).toContain('damaged')
    expect(errorOf(withMods(Array.from({ length: 11 }, (_, i) => ({ ...fillet, id: `0000000${i.toString(16)}` }))))).toContain('damaged')
    expect(errorOf(withMods([fillet, fillet]))).toContain('two modifiers with the same id')
  })

  it('rejects formulas on unknown modifier fields', () => {
    const shape = { ...box('a'), modifiers: [fillet], formulas: { 'mod.ab12cd34.colour': '1' } }
    expect(errorOf(docWith([shape], ['a']))).toContain('damaged')
  })
```

`src/persistence/migrate.test.ts`: change the "passes current documents through" test to use `schemaVersion: 3`. Change the v1 upgrade expectation to `schemaVersion: 3` (the other fields stay as they are). Then add:

```ts
  it('upgrades version 2 designs without changing them', () => {
    expect(migrateDocument({ schemaVersion: 2, name: 'x', variables: [] })).toEqual({
      ok: true, value: { schemaVersion: 3, name: 'x', variables: [] },
    })
  })
```

`src/persistence/design-file.test.ts`: in the Milestone 1 test, change `expect(result.value.schemaVersion).toBe(2)` to `toBe(3)`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/document src/persistence`
Expected: FAIL. The version is still 2 and `modifiers` gets stripped or rejected.

- [ ] **Step 3: Extend `src/document/types.ts`**

Change `FieldKey`:

```ts
/**
 * A field that can hold a formula: `param.<name>`, `position.<0|1|2>`, `rotation.<0|1|2>`, or a modifier
 * number `mod.<modifierId>.<field>` (vector fields end in `.0`/`.1`/`.2`).
 * The field itself always keeps a plain number: the last value its formula worked out.
 */
export type FieldKey = `param.${string}` | `position.${0 | 1 | 2}` | `rotation.${0 | 1 | 2}` | `mod.${string}`
```

Add `modifiers` to `NodeBase`:

```ts
  /** Changes applied after the part is built, in order (round edges, repeat, mirror…). Missing means none. */
  readonly modifiers?: readonly Modifier[]
```

Add these below `SceneNode`:

```ts
export type ModifierType = 'fillet' | 'chamfer' | 'linearPattern' | 'circularPattern' | 'mirror'
export type EdgeWhich = 'all' | 'top' | 'bottom' | 'vertical' | 'horizontal'
export type EdgeKind = 'line' | 'circle' | 'other'
export type PatternAxis = 'x' | 'y' | 'z'
export type MirrorPlane = 'XY' | 'XZ' | 'YZ'
/** Number fields a modifier can have; `spacing` and `center` are vectors (axis 0/1/2). */
export type ModifierField = 'radius' | 'distance' | 'count' | 'angle' | 'spacing' | 'center'

/** Where an edge sat on its part, relative to the part's bounding box, so it can be found again after resizing. */
export interface EdgeFingerprint {
  readonly kind: EdgeKind
  /** Edge midpoint as fractions (0–1) of the bounding box on each axis. */
  readonly mid: Vec3
  /** Unit direction at the midpoint; the first non-zero component is positive. */
  readonly dir: Vec3
  /** Length as a fraction of the bounding-box diagonal. */
  readonly length: number
}

export type EdgeSelection =
  | { readonly by: 'description'; readonly which: EdgeWhich }
  | { readonly by: 'picked'; readonly fingerprints: readonly EdgeFingerprint[] }

interface ModifierBase {
  /** 8 hex characters, unique within its part. */
  readonly id: string
  readonly enabled: boolean
}

export interface FilletModifier extends ModifierBase {
  readonly type: 'fillet'
  readonly radius: number
  readonly edges: EdgeSelection
}

export interface ChamferModifier extends ModifierBase {
  readonly type: 'chamfer'
  readonly distance: number
  readonly edges: EdgeSelection
}

export interface LinearPatternModifier extends ModifierBase {
  readonly type: 'linearPattern'
  readonly count: number
  readonly spacing: Vec3
}

export interface CircularPatternModifier extends ModifierBase {
  readonly type: 'circularPattern'
  readonly count: number
  readonly axis: PatternAxis
  /** Total angle the copies spread over; 360 means all the way round. */
  readonly angle: number
  /** A point on the rotation axis, in the part's own frame. */
  readonly center: Vec3
}

export interface MirrorModifier extends ModifierBase {
  readonly type: 'mirror'
  readonly plane: MirrorPlane
  readonly keepOriginal: boolean
}

export type Modifier = FilletModifier | ChamferModifier | LinearPatternModifier | CircularPatternModifier | MirrorModifier
```

Change `schemaVersion: 2` to `schemaVersion: 3`. Then update the constants:

```ts
export const CURRENT_SCHEMA_VERSION = 3
// …existing constants…
export const MAX_MODIFIERS = 10
export const MAX_PATTERN_COUNT = 50
/** Most copies one part's modifiers may make in total (pattern counts multiplied, ×2 for a mirror that keeps the original). */
export const MAX_COPIES = 200
export const MAX_PICKED_EDGES = 100
export const MIN_EDGE_SIZE = 0.05
export const MAX_EDGE_SIZE = 500
export const MAX_OFFSET = 2000
export const MIN_PATTERN_ANGLE = 1
export const MAX_PATTERN_ANGLE = 360
```

- [ ] **Step 4: Update `src/document/schema.ts`**

Leave the `FIELD_KEY` constant in this file for now; Task 3 moves it into `fields.ts`. Extend it:

```ts
const FIELD_KEY =
  /^(?:param\.[A-Za-z0-9_]+|position\.[0-2]|rotation\.[0-2]|mod\.[a-f0-9]{8}\.(?:radius|distance|count|angle|(?:spacing|center)\.[0-2]))$/
```

Add the import:

```ts
import {
  MAX_EDGE_SIZE, MAX_FIT, MAX_MODIFIERS, MAX_OFFSET, MAX_PATTERN_ANGLE, MAX_PATTERN_COUNT, MAX_PICKED_EDGES,
  MAX_TEXT_PARAM_LENGTH, MAX_VARIABLES, MIN_EDGE_SIZE, MIN_PATTERN_ANGLE, type BloKadeDocument,
} from './types'
```

Add these above `base`:

```ts
const fingerprint = z.object({
  kind: z.enum(['line', 'circle', 'other']),
  mid: vec3,
  dir: vec3,
  length: z.number().min(0),
})
const edgeSelection = z.discriminatedUnion('by', [
  z.object({ by: z.literal('description'), which: z.enum(['all', 'top', 'bottom', 'vertical', 'horizontal']) }),
  z.object({ by: z.literal('picked'), fingerprints: z.array(fingerprint).max(MAX_PICKED_EDGES) }),
])
const offset = z.number().min(-MAX_OFFSET).max(MAX_OFFSET)
const offsetVec = z.tuple([offset, offset, offset])
const edgeSize = z.number().min(MIN_EDGE_SIZE).max(MAX_EDGE_SIZE)
const count = z.number().int().min(1).max(MAX_PATTERN_COUNT)
const modifierBase = { id: z.string().regex(/^[a-f0-9]{8}$/), enabled: z.boolean() }
const modifier = z.discriminatedUnion('type', [
  z.object({ ...modifierBase, type: z.literal('fillet'), radius: edgeSize, edges: edgeSelection }),
  z.object({ ...modifierBase, type: z.literal('chamfer'), distance: edgeSize, edges: edgeSelection }),
  z.object({ ...modifierBase, type: z.literal('linearPattern'), count, spacing: offsetVec }),
  z.object({
    ...modifierBase, type: z.literal('circularPattern'), count, axis: z.enum(['x', 'y', 'z']),
    angle: z.number().min(MIN_PATTERN_ANGLE).max(MAX_PATTERN_ANGLE), center: offsetVec,
  }),
  z.object({ ...modifierBase, type: z.literal('mirror'), plane: z.enum(['XY', 'XZ', 'YZ']), keepOriginal: z.boolean() }),
])
```

Add `modifiers: z.array(modifier).max(MAX_MODIFIERS).optional(),` to `base`. Change `schemaVersion: z.literal(2)` to `z.literal(3)`.

Add a refinement next to `checkTree` and `checkVariables`, and call it from `documentSchema`'s `superRefine`:

```ts
/** Modifier ids are unique within each part (fields and formulas are keyed by them). */
function checkModifierIds(doc: DocShape, ctx: z.RefinementCtx): void {
  for (const node of Object.values(doc.nodes)) {
    const ids = (node.modifiers ?? []).map((m) => m.id)
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', message: `Part "${node.name}" has two modifiers with the same id` })
    }
  }
}
```

```ts
export const documentSchema = documentShape.superRefine((doc, ctx) => {
  checkTree(doc, ctx)
  checkVariables(doc, ctx)
  checkModifierIds(doc, ctx)
})
```

- [ ] **Step 5: Add the 2 → 3 migration to `src/persistence/migrate.ts`**

```ts
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // Version 2 (Milestone 2) adds design variables and the `fit` gap.
  1: (doc) => ({ ...doc, variables: [], settings: { ...asRecord(doc.settings), fit: DEFAULT_FIT } }),
  // Version 3 (Milestone 3) adds optional modifiers; older parts simply have none.
  2: (doc) => ({ ...doc }),
}
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS and typecheck clean. If some other test hard-codes schema version 2, update it to 3 and list it in your report. If zod's inferred type for `modifiers` doesn't match `BloKadeDocument` at `validateDocument`'s `ok(parsed.data)`, use a minimal type-level fix (`ok(parsed.data as BloKadeDocument)` is acceptable) and say so in your report.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: add modifiers to the design model (schema v3)"
```

---

### Task 2: Modifier operations

**Files:**
- Create: `src/document/modifiers.ts`
- Test: `src/document/modifiers.test.ts`

**Interfaces:**
- Consumes:
  - `newId` from `factory.ts`
  - `updateNode` and `DocumentOpError` from `ops.ts`
  - The Task 1 types and constants
- Produces:
  - `MODIFIER_TYPES: readonly ModifierType[]` and `MODIFIER_LABELS: Record<ModifierType, string>`
  - `modifiersOf(node): readonly Modifier[]` and `createModifier(type, id): Modifier`
  - `addModifier(doc, nodeId, type): { doc; modifierId }`
  - `updateModifier(doc, nodeId, modifierId, fn)`, `removeModifier(doc, nodeId, modifierId)`, `moveModifier(doc, nodeId, modifierId, delta: -1 | 1)`, `setModifierEnabled(doc, nodeId, modifierId, enabled)`
  - Edge selection:
    - `setEdgeSelection(doc, nodeId, modifierId, selection)`
    - `setPickedEdges(doc, nodeId, modifierId, fingerprints)`
    - `togglePicked(list, fingerprint): EdgeFingerprint[]`
    - `sameFingerprint(a, b): boolean`
  - Modifier changes:
    - `setPatternAxis(doc, nodeId, modifierId, axis)`
    - `setMirror(doc, nodeId, modifierId, { plane?, keepOriginal? })`
    - `clampModifierField(field: ModifierField, value: number): number`

- [ ] **Step 1: Write the failing test `src/document/modifiers.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from './factory'
import {
  addModifier, clampModifierField, createModifier, modifiersOf, moveModifier, removeModifier, sameFingerprint,
  setEdgeSelection, setMirror, setModifierEnabled, setPatternAxis, setPickedEdges, togglePicked, updateModifier,
} from './modifiers'
import { addNode, DocumentOpError } from './ops'
import type { BloKadeDocument, EdgeFingerprint } from './types'

const setup = (): BloKadeDocument =>
  addNode(createEmptyDocument(), createShapeNode({ id: 'b', shapeType: 'box', name: 'Box', params: {}, color: '#f00' }))
const mods = (doc: BloKadeDocument) => {
  const node = doc.nodes.b
  return node ? modifiersOf(node) : []
}
const fp = (x: number): EdgeFingerprint => ({ kind: 'line', mid: [x, 0, 1], dir: [1, 0, 0], length: 0.5 })

describe('modifier operations', () => {
  it('adds modifiers with friendly defaults and unique 8-character ids', () => {
    const first = addModifier(setup(), 'b', 'fillet')
    const second = addModifier(first.doc, 'b', 'fillet')
    expect(first.modifierId).toMatch(/^[a-f0-9]{8}$/)
    expect(second.modifierId).not.toBe(first.modifierId)
    expect(mods(second.doc)[0]).toEqual({ id: first.modifierId, type: 'fillet', enabled: true, radius: 2, edges: { by: 'description', which: 'top' } })
  })

  it('has defaults for every type', () => {
    expect(createModifier('chamfer', 'aaaaaaaa')).toMatchObject({ distance: 1, edges: { by: 'description', which: 'top' } })
    expect(createModifier('linearPattern', 'aaaaaaaa')).toMatchObject({ count: 3, spacing: [25, 0, 0] })
    expect(createModifier('circularPattern', 'aaaaaaaa')).toMatchObject({ count: 6, axis: 'z', angle: 360, center: [0, 0, 0] })
    expect(createModifier('mirror', 'aaaaaaaa')).toMatchObject({ plane: 'YZ', keepOriginal: true })
  })

  it('stops at 10 modifiers per part', () => {
    const full = Array.from({ length: 10 }).reduce<BloKadeDocument>((d) => addModifier(d, 'b', 'mirror').doc, setup())
    expect(() => addModifier(full, 'b', 'mirror')).toThrow('up to 10 modifiers')
  })

  it('reorders, toggles and removes modifiers', () => {
    const a = addModifier(setup(), 'b', 'fillet')
    const b = addModifier(a.doc, 'b', 'mirror')
    const moved = moveModifier(b.doc, 'b', b.modifierId, -1)
    expect(mods(moved).map((m) => m.type)).toEqual(['mirror', 'fillet'])
    expect(moveModifier(moved, 'b', b.modifierId, -1)).toBe(moved)
    expect(mods(setModifierEnabled(moved, 'b', a.modifierId, false))[1]?.enabled).toBe(false)
    const removed = removeModifier(moved, 'b', b.modifierId)
    expect(mods(removed).map((m) => m.type)).toEqual(['fillet'])
    expect(removeModifier(removed, 'b', a.modifierId).nodes.b?.modifiers).toBeUndefined()
  })

  it('explains missing parts and modifiers', () => {
    expect(() => addModifier(setup(), 'nope', 'fillet')).toThrow(DocumentOpError)
    expect(() => removeModifier(setup(), 'b', 'deadbeef')).toThrow('That modifier no longer exists.')
    const a = addModifier(setup(), 'b', 'fillet')
    expect(() => updateModifier(a.doc, 'b', a.modifierId, (m) => ({ ...m, id: 'other123' }))).toThrow(DocumentOpError)
  })

  it('changes edge choices only on Round and Bevel edges', () => {
    const a = addModifier(setup(), 'b', 'fillet')
    const bottom = setEdgeSelection(a.doc, 'b', a.modifierId, { by: 'description', which: 'bottom' })
    expect(mods(bottom)[0]).toMatchObject({ edges: { by: 'description', which: 'bottom' } })
    const picked = setPickedEdges(bottom, 'b', a.modifierId, [fp(0.5)])
    expect(mods(picked)[0]).toMatchObject({ edges: { by: 'picked', fingerprints: [fp(0.5)] } })
    expect(() => setPickedEdges(a.doc, 'b', a.modifierId, Array.from({ length: 101 }, (_, i) => fp(i / 101)))).toThrow('up to 100')
    const m = addModifier(setup(), 'b', 'mirror')
    expect(() => setEdgeSelection(m.doc, 'b', m.modifierId, { by: 'description', which: 'all' })).toThrow(DocumentOpError)
  })

  it('changes pattern axes and mirror settings', () => {
    const c = addModifier(setup(), 'b', 'circularPattern')
    expect(mods(setPatternAxis(c.doc, 'b', c.modifierId, 'x'))[0]).toMatchObject({ axis: 'x' })
    const m = addModifier(setup(), 'b', 'mirror')
    expect(mods(setMirror(m.doc, 'b', m.modifierId, { plane: 'XY', keepOriginal: false }))[0]).toMatchObject({ plane: 'XY', keepOriginal: false })
  })

  it('toggles picked edges by fingerprint', () => {
    expect(togglePicked([fp(0.1)], fp(0.5))).toEqual([fp(0.1), fp(0.5)])
    expect(togglePicked([fp(0.1), fp(0.5)], { ...fp(0.5), mid: [0.5004, 0, 1] })).toEqual([fp(0.1)])
    expect(sameFingerprint(fp(0.1), { ...fp(0.1), kind: 'circle' })).toBe(false)
  })

  it('clamps modifier numbers to safe ranges', () => {
    expect(clampModifierField('radius', 0)).toBe(0.05)
    expect(clampModifierField('distance', 9000)).toBe(500)
    expect(clampModifierField('count', 2.6)).toBe(3)
    expect(clampModifierField('count', 9999)).toBe(50)
    expect(clampModifierField('count', -4)).toBe(1)
    expect(clampModifierField('angle', 720)).toBe(360)
    expect(clampModifierField('spacing', -1e9)).toBe(-2000)
    expect(clampModifierField('center', 12.5)).toBe(12.5)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/document/modifiers.test.ts`
Expected: FAIL, "Failed to resolve import "./modifiers"".

- [ ] **Step 3: Write `src/document/modifiers.ts`**

```ts
import { newId } from './factory'
import { DocumentOpError, updateNode } from './ops'
import {
  MAX_EDGE_SIZE, MAX_MODIFIERS, MAX_OFFSET, MAX_PATTERN_ANGLE, MAX_PATTERN_COUNT, MAX_PICKED_EDGES, MIN_EDGE_SIZE,
  MIN_PATTERN_ANGLE,
  type BloKadeDocument, type EdgeFingerprint, type EdgeSelection, type MirrorPlane, type Modifier, type ModifierField,
  type ModifierType, type NodeId, type PatternAxis, type SceneNode,
} from './types'

export const MODIFIER_TYPES: readonly ModifierType[] = ['fillet', 'chamfer', 'linearPattern', 'circularPattern', 'mirror']

/** Kid-facing names, used in the panel and in error messages. */
export const MODIFIER_LABELS: Readonly<Record<ModifierType, string>> = {
  fillet: 'Round edges',
  chamfer: 'Bevel edges',
  linearPattern: 'Repeat in a row',
  circularPattern: 'Repeat in a circle',
  mirror: 'Mirror',
}

export const modifiersOf = (node: SceneNode): readonly Modifier[] => node.modifiers ?? []

export function createModifier(type: ModifierType, id: string): Modifier {
  switch (type) {
    case 'fillet': return { id, type, enabled: true, radius: 2, edges: { by: 'description', which: 'top' } }
    case 'chamfer': return { id, type, enabled: true, distance: 1, edges: { by: 'description', which: 'top' } }
    case 'linearPattern': return { id, type, enabled: true, count: 3, spacing: [25, 0, 0] }
    case 'circularPattern': return { id, type, enabled: true, count: 6, axis: 'z', angle: 360, center: [0, 0, 0] }
    case 'mirror': return { id, type, enabled: true, plane: 'YZ', keepOriginal: true }
  }
}

const withModifiers = (node: SceneNode, modifiers: readonly Modifier[]): SceneNode =>
  ({ ...node, modifiers: modifiers.length > 0 ? modifiers : undefined })

function nodeOf(doc: BloKadeDocument, id: NodeId): SceneNode {
  const node = Object.hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined
  if (!node) throw new DocumentOpError('That part no longer exists.')
  return node
}

function freshId(taken: readonly Modifier[]): string {
  const id = newId().slice(0, 8)
  return taken.some((m) => m.id === id) ? freshId(taken) : id
}

export function addModifier(doc: BloKadeDocument, nodeId: NodeId, type: ModifierType): { doc: BloKadeDocument; modifierId: string } {
  const current = modifiersOf(nodeOf(doc, nodeId))
  if (current.length >= MAX_MODIFIERS) throw new DocumentOpError(`A part can have up to ${MAX_MODIFIERS} modifiers.`)
  const modifier = createModifier(type, freshId(current))
  return { doc: updateNode(doc, nodeId, (node) => withModifiers(node, [...modifiersOf(node), modifier])), modifierId: modifier.id }
}

function requireModifier(node: SceneNode, modifierId: string): Modifier {
  const found = modifiersOf(node).find((m) => m.id === modifierId)
  if (!found) throw new DocumentOpError('That modifier no longer exists.')
  return found
}

export function updateModifier(
  doc: BloKadeDocument, nodeId: NodeId, modifierId: string, fn: (modifier: Modifier) => Modifier,
): BloKadeDocument {
  return updateNode(doc, nodeId, (node) => {
    const before = requireModifier(node, modifierId)
    const after = fn(before)
    if (after.id !== before.id || after.type !== before.type) throw new DocumentOpError("A modifier's id and type can't change.")
    return after === before ? node : withModifiers(node, modifiersOf(node).map((m) => (m.id === modifierId ? after : m)))
  })
}

export function removeModifier(doc: BloKadeDocument, nodeId: NodeId, modifierId: string): BloKadeDocument {
  return updateNode(doc, nodeId, (node) => {
    requireModifier(node, modifierId)
    return withModifiers(node, modifiersOf(node).filter((m) => m.id !== modifierId))
  })
}

export function moveModifier(doc: BloKadeDocument, nodeId: NodeId, modifierId: string, delta: -1 | 1): BloKadeDocument {
  const list = modifiersOf(nodeOf(doc, nodeId))
  const from = list.findIndex((m) => m.id === modifierId)
  if (from === -1) throw new DocumentOpError('That modifier no longer exists.')
  const to = from + delta
  if (to < 0 || to >= list.length) return doc
  const reordered = list.map((m, i) => (i === from ? list[to] : i === to ? list[from] : m)).filter((m): m is Modifier => m !== undefined)
  return updateNode(doc, nodeId, (node) => withModifiers(node, reordered))
}

export const setModifierEnabled = (doc: BloKadeDocument, nodeId: NodeId, modifierId: string, enabled: boolean): BloKadeDocument =>
  updateModifier(doc, nodeId, modifierId, (m) => (m.enabled === enabled ? m : { ...m, enabled }))

export function setEdgeSelection(doc: BloKadeDocument, nodeId: NodeId, modifierId: string, edges: EdgeSelection): BloKadeDocument {
  return updateModifier(doc, nodeId, modifierId, (m) => {
    if (m.type !== 'fillet' && m.type !== 'chamfer') throw new DocumentOpError('Only Round edges and Bevel edges use edges.')
    return { ...m, edges }
  })
}

export function setPickedEdges(
  doc: BloKadeDocument, nodeId: NodeId, modifierId: string, fingerprints: readonly EdgeFingerprint[],
): BloKadeDocument {
  if (fingerprints.length > MAX_PICKED_EDGES) throw new DocumentOpError(`You can pick up to ${MAX_PICKED_EDGES} edges.`)
  return setEdgeSelection(doc, nodeId, modifierId, { by: 'picked', fingerprints })
}

const FINGERPRINT_TOLERANCE = 1e-3
const close = (a: readonly number[], b: readonly number[]): boolean =>
  a.every((v, i) => Math.abs(v - (b[i] ?? Number.NaN)) <= FINGERPRINT_TOLERANCE)

export const sameFingerprint = (a: EdgeFingerprint, b: EdgeFingerprint): boolean =>
  a.kind === b.kind && close(a.mid, b.mid) && close(a.dir, b.dir) && Math.abs(a.length - b.length) <= FINGERPRINT_TOLERANCE

/** Adds the edge if it isn't picked yet, otherwise removes it. */
export function togglePicked(list: readonly EdgeFingerprint[], fingerprint: EdgeFingerprint): EdgeFingerprint[] {
  return list.some((f) => sameFingerprint(f, fingerprint))
    ? list.filter((f) => !sameFingerprint(f, fingerprint))
    : [...list, fingerprint]
}

export function setPatternAxis(doc: BloKadeDocument, nodeId: NodeId, modifierId: string, axis: PatternAxis): BloKadeDocument {
  return updateModifier(doc, nodeId, modifierId, (m) => {
    if (m.type !== 'circularPattern') throw new DocumentOpError('Only Repeat in a circle has an axis.')
    return { ...m, axis }
  })
}

export function setMirror(
  doc: BloKadeDocument, nodeId: NodeId, modifierId: string, change: { plane?: MirrorPlane; keepOriginal?: boolean },
): BloKadeDocument {
  return updateModifier(doc, nodeId, modifierId, (m) => {
    if (m.type !== 'mirror') throw new DocumentOpError('Only Mirror has a plane.')
    return { ...m, plane: change.plane ?? m.plane, keepOriginal: change.keepOriginal ?? m.keepOriginal }
  })
}

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

/** Keeps modifier numbers in ranges the geometry engine can handle quickly. */
export function clampModifierField(field: ModifierField, value: number): number {
  switch (field) {
    case 'radius':
    case 'distance': return clamp(value, MIN_EDGE_SIZE, MAX_EDGE_SIZE)
    case 'count': return clamp(Math.round(value), 1, MAX_PATTERN_COUNT)
    case 'angle': return clamp(value, MIN_PATTERN_ANGLE, MAX_PATTERN_ANGLE)
    case 'spacing':
    case 'center': return clamp(value, -MAX_OFFSET, MAX_OFFSET)
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/document && npm run typecheck`
Expected: PASS and typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/document
git commit -m "feat: add modifier operations"
```

---

### Task 3: Formulas on modifier fields

**Files:**
- Modify: `src/document/fields.ts`, `src/document/schema.ts`, `src/app/field-normalizer.ts`
- Test: `src/document/fields.test.ts`, `src/document/formula-ops.test.ts`, `src/app/field-normalizer.test.ts`, `src/document/ops.test.ts`

**Interfaces:**
- Consumes: Task 1 types, plus `clampModifierField` and `addModifier` from Task 2.
- Produces:
  - `FIELD_KEY_PATTERN: RegExp`, which `schema.ts` now uses instead of its own copy.
  - `modifierField(modifierId, field, axis?): FieldKey` and `modifierFieldOf(key): ModifierField | null`.
  - `readField` and `writeField` now support `mod.<id>.<field>[.<axis>]`. That means `setFieldInput`, `recomputeFormulas`, `formulaErrors` and `dropStaleFormulas` work on modifier fields with no other changes.

- [ ] **Step 1: Write the failing tests**

Add to `src/document/fields.test.ts`. Extend its imports with `modifierField`, `modifierFieldOf`, `isFieldKey`, `readField`, `writeField` and `withFormula` (from `./fields`), plus `dropStaleFormulas` if it isn't already there.

```ts
describe('modifier fields', () => {
  const withMods = {
    ...box,
    modifiers: [
      { id: 'aaaaaaaa', type: 'fillet', enabled: true, radius: 2, edges: { by: 'description', which: 'top' } },
      { id: 'bbbbbbbb', type: 'linearPattern', enabled: true, count: 3, spacing: [25, 0, 0] },
    ] as const,
  }

  it('builds and recognises modifier field keys', () => {
    expect(modifierField('aaaaaaaa', 'radius')).toBe('mod.aaaaaaaa.radius')
    expect(modifierField('bbbbbbbb', 'spacing', 2)).toBe('mod.bbbbbbbb.spacing.2')
    expect(isFieldKey('mod.aaaaaaaa.radius')).toBe(true)
    expect(isFieldKey('mod.aaaaaaaa.spacing')).toBe(false)
    expect(isFieldKey('mod.aaaaaaaa.radius.1')).toBe(false)
    expect(modifierFieldOf('mod.bbbbbbbb.spacing.0')).toBe('spacing')
    expect(modifierFieldOf('param.width')).toBeNull()
  })

  it('reads and writes modifier numbers immutably', () => {
    expect(readField(withMods, 'mod.aaaaaaaa.radius')).toBe(2)
    expect(readField(withMods, 'mod.bbbbbbbb.spacing.0')).toBe(25)
    expect(readField(withMods, 'mod.aaaaaaaa.count')).toBeUndefined()
    expect(readField(withMods, 'mod.cccccccc.radius')).toBeUndefined()
    const next = writeField(withMods, 'mod.bbbbbbbb.spacing.1', 7)
    expect(next.modifiers?.[1]).toMatchObject({ spacing: [25, 7, 0] })
    expect(withMods.modifiers[1].spacing).toEqual([25, 0, 0])
    expect(writeField(withMods, 'mod.aaaaaaaa.radius', 2)).toBe(withMods)
  })

  it('forgets formulas of a removed modifier (Review Focus 5)', () => {
    const before = withFormula(withMods, 'mod.aaaaaaaa.radius', 'wall')
    const after = { ...before, modifiers: before.modifiers?.filter((m) => m.id !== 'aaaaaaaa') }
    expect(dropStaleFormulas(before, after).formulas).toBeUndefined()
  })
})
```

Add to `src/document/formula-ops.test.ts`. Import `addModifier` from `./modifiers` and `modifierField` from `./fields`.

```ts
describe('formulas on modifiers (Review Focus 5)', () => {
  it('works out a modifier number from a variable and follows changes', () => {
    const { doc, modifierId } = addModifier(setup(), 'b', 'linearPattern')
    const key = modifierField(modifierId, 'count')
    const withFormula = setFieldInput(doc, 'b', key, 'wall + 1', clampSizes)
    expect(withFormula.nodes.b?.modifiers?.[0]).toMatchObject({ count: 4 })
    const changed = recomputeFormulas({ ...withFormula, variables: [{ name: 'wall', expr: '5' }] }, clampSizes)
    expect(changed.nodes.b?.modifiers?.[0]).toMatchObject({ count: 6 })
  })
})
```

Add to `src/app/field-normalizer.test.ts`:

```ts
  it('clamps modifier numbers', () => {
    const withMod = { ...box, modifiers: [{ id: 'aaaaaaaa', type: 'linearPattern', enabled: true, count: 3, spacing: [25, 0, 0] }] as const }
    expect(normalize(withMod, 'mod.aaaaaaaa.count', 9999)).toBe(50)
    expect(normalize(withMod, 'mod.aaaaaaaa.spacing.0', -1e9)).toBe(-2000)
  })
```

Add to `src/document/ops.test.ts`:

```ts
  it('duplicating a part keeps its modifiers (Review Focus 5)', () => {
    const doc = addModifier(addNode(createEmptyDocument(), createShapeNode({ id: 'b', shapeType: 'box', name: 'Box', params: {}, color: '#f00' })), 'b', 'mirror').doc
    const { doc: copied, newIds } = duplicateNodes(doc, ['b'])
    expect(copied.nodes[newIds[0] ?? '']?.modifiers).toEqual(doc.nodes.b?.modifiers)
  })
```

Import `addModifier` from `./modifiers` in ops.test.ts. If `ops.test.ts` imports cause a cycle warning (`modifiers.ts` imports `ops.ts`), that is fine: the test file only imports it.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/document src/app/field-normalizer.test.ts`
Expected: FAIL. `modifierField` is missing, and modifier keys aren't recognised.

- [ ] **Step 3: Extend `src/document/fields.ts`**

Replace the key parsing section, from `FIELD_KEY` through `parseKey`, and the `readField`/`writeField` functions with the code below. Keep `formulaOf`, `formulaEntries`, `withFormula`, `UNCHANGED_EPSILON`, `sameValue` and `dropStaleFormulas` as they are.

```ts
import type { FieldKey, Modifier, ModifierField, SceneNode, Vec3 } from './types'

/** Every formula-capable field key. The schema uses this too, so files can't hold formulas for unknown fields. */
export const FIELD_KEY_PATTERN =
  /^(?:param\.([A-Za-z0-9_]+)|(position|rotation)\.([0-2])|mod\.([a-f0-9]{8})\.(radius|distance|count|angle|spacing|center)(?:\.([0-2]))?)$/

type Axis = 0 | 1 | 2
const VECTOR_FIELDS: ReadonlySet<ModifierField> = new Set(['spacing', 'center'])

type ParsedKey =
  | { readonly param: string }
  | { readonly part: 'position' | 'rotation'; readonly axis: Axis }
  | { readonly mod: string; readonly field: ModifierField; readonly axis?: Axis }

export const paramField = (name: string): FieldKey => `param.${name}`
export const positionField = (axis: Axis): FieldKey => `position.${axis}`
export const rotationField = (axis: Axis): FieldKey => `rotation.${axis}`
export const modifierField = (modifierId: string, field: ModifierField, axis?: Axis): FieldKey =>
  axis === undefined ? `mod.${modifierId}.${field}` : `mod.${modifierId}.${field}.${axis}`

function parseKey(key: string): ParsedKey | null {
  const match = FIELD_KEY_PATTERN.exec(key)
  if (!match) return null
  if (match[1]) return { param: match[1] }
  if (match[2]) return { part: match[2] as 'position' | 'rotation', axis: Number(match[3]) as Axis }
  const field = match[5] as ModifierField
  const axis = match[6] === undefined ? undefined : (Number(match[6]) as Axis)
  // Vector fields need an axis; single numbers must not have one.
  if (VECTOR_FIELDS.has(field) !== (axis !== undefined)) return null
  return { mod: match[4] ?? '', field, axis }
}

export const isFieldKey = (key: string): key is FieldKey => parseKey(key) !== null

export function modifierFieldOf(key: string): ModifierField | null {
  const parsed = parseKey(key)
  return parsed && 'mod' in parsed ? parsed.field : null
}

const withAxis = (v: Vec3, axis: Axis, value: number): Vec3 =>
  [axis === 0 ? value : v[0], axis === 1 ? value : v[1], axis === 2 ? value : v[2]]

function modifierNumber(m: Modifier, field: ModifierField, axis?: Axis): number | undefined {
  switch (field) {
    case 'radius': return m.type === 'fillet' ? m.radius : undefined
    case 'distance': return m.type === 'chamfer' ? m.distance : undefined
    case 'count': return m.type === 'linearPattern' || m.type === 'circularPattern' ? m.count : undefined
    case 'angle': return m.type === 'circularPattern' ? m.angle : undefined
    case 'spacing': return m.type === 'linearPattern' && axis !== undefined ? m.spacing[axis] : undefined
    case 'center': return m.type === 'circularPattern' && axis !== undefined ? m.center[axis] : undefined
  }
}

function withModifierNumber(m: Modifier, field: ModifierField, axis: Axis | undefined, value: number): Modifier {
  if (field === 'radius' && m.type === 'fillet') return { ...m, radius: value }
  if (field === 'distance' && m.type === 'chamfer') return { ...m, distance: value }
  if (field === 'count' && (m.type === 'linearPattern' || m.type === 'circularPattern')) return { ...m, count: value }
  if (field === 'angle' && m.type === 'circularPattern') return { ...m, angle: value }
  if (field === 'spacing' && m.type === 'linearPattern' && axis !== undefined) return { ...m, spacing: withAxis(m.spacing, axis, value) }
  if (field === 'center' && m.type === 'circularPattern' && axis !== undefined) return { ...m, center: withAxis(m.center, axis, value) }
  return m
}

const findModifier = (node: SceneNode, id: string): Modifier | undefined => (node.modifiers ?? []).find((m) => m.id === id)

/** The number a field holds, or undefined if this part has no such number field. */
export function readField(node: SceneNode, key: FieldKey): number | undefined {
  const parsed = parseKey(key)
  if (!parsed) return undefined
  if ('part' in parsed) return node.transform[parsed.part][parsed.axis]
  if ('mod' in parsed) {
    const modifier = findModifier(node, parsed.mod)
    return modifier ? modifierNumber(modifier, parsed.field, parsed.axis) : undefined
  }
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
  if ('mod' in parsed) {
    const modifiers = (node.modifiers ?? []).map((m) => (m.id === parsed.mod ? withModifierNumber(m, parsed.field, parsed.axis, value) : m))
    return { ...node, modifiers }
  }
  return node.kind === 'shape' ? { ...node, params: { ...node.params, [parsed.param]: value } } : node
}
```

Delete the old `FIELD_KEY` constant, `ParsedKey` type and `parseKey` from fields.ts. `isFieldKey` now checks the axis rule as well.

- [ ] **Step 4: Use the shared pattern in `src/document/schema.ts`**

Delete its local `FIELD_KEY` constant, add `import { FIELD_KEY_PATTERN, isFieldKey } from './fields'`, and change the `formulas` record so its key uses the shared pattern and the axis rule:

```ts
  formulas: z.record(z.string().regex(FIELD_KEY_PATTERN).refine(isFieldKey), z.string().max(MAX_FORMULA_LENGTH)).optional(),
```

- [ ] **Step 5: Clamp modifier fields in `src/app/field-normalizer.ts`**

```ts
import { modifierFieldOf } from '../document/fields'
import { clampModifierField } from '../document/modifiers'
```

Add this as the first line inside the returned function:

```ts
    const modField = modifierFieldOf(key)
    if (modField) return clampModifierField(modField, value)
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS and typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: let modifier numbers hold formulas"
```

---

### Task 4: Choosing edges (pure math)

**Files:**
- Create: `src/geometry/edge-select.ts`
- Test: `src/geometry/edge-select.test.ts`

**Interfaces:**
- Consumes:
  - `Box` and `boxSize` (from `src/document/box.ts`)
  - `EdgeFingerprint`, `EdgeKind`, `EdgeSelection` and `EdgeWhich` (from Task 1)
- Produces:
  - `interface EdgeInfo { kind; samples: readonly Vec3[]; tangent: Vec3; length }`, where `samples` are the points at 0, ¼, ½, ¾ and 1 of the edge
  - `MATCH_THRESHOLD = 0.1`
  - `edgeTolerance(box): number` and `midOf(info): Vec3`
  - `matchesDescription(info, which, box): boolean`
  - `fingerprintOf(info, box): EdgeFingerprint`
  - `fingerprintScore(a, b): number`
  - `matchFingerprints(fingerprints, infos, box): { matched: ReadonlySet<number>; lost: number }`
  - `selectedEdges(selection, infos, box): { indices: ReadonlySet<number>; lost: number }`

- [ ] **Step 1: Write the failing test `src/geometry/edge-select.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import type { Box } from '../document/box'
import type { Vec3 } from '../document/types'
import {
  fingerprintOf, fingerprintScore, matchesDescription, matchFingerprints, MATCH_THRESHOLD, selectedEdges, type EdgeInfo,
} from './edge-select'

/** A straight edge from a to b, sampled like edge-info.ts does. */
function line(a: Vec3, b: Vec3): EdgeInfo {
  const at = (t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  return { kind: 'line', samples: [0, 0.25, 0.5, 0.75, 1].map(at), tangent: [(b[0] - a[0]) / length, (b[1] - a[1]) / length, (b[2] - a[2]) / length], length }
}

/** The 12 edges of an axis-aligned box from min to max. */
function cubeEdges(min: Vec3, max: Vec3): EdgeInfo[] {
  const [x0, y0, z0] = min
  const [x1, y1, z1] = max
  const ring = (z: number): EdgeInfo[] => [
    line([x0, y0, z], [x1, y0, z]), line([x1, y0, z], [x1, y1, z]), line([x1, y1, z], [x0, y1, z]), line([x0, y1, z], [x0, y0, z]),
  ]
  const posts = [line([x0, y0, z0], [x0, y0, z1]), line([x1, y0, z0], [x1, y0, z1]), line([x1, y1, z0], [x1, y1, z1]), line([x0, y1, z0], [x0, y1, z1])]
  return [...ring(z0), ...ring(z1), ...posts]
}

const cubeBox: Box = { min: [-10, -10, 0], max: [10, 10, 20] }
const cube = cubeEdges(cubeBox.min, cubeBox.max)
const indices = (set: ReadonlySet<number>) => [...set].sort((a, b) => a - b)

describe('edges by description', () => {
  it('finds top, bottom, upright and flat edges of a box', () => {
    const which = (w: 'top' | 'bottom' | 'vertical' | 'horizontal' | 'all') =>
      indices(selectedEdges({ by: 'description', which: w }, cube, cubeBox).indices)
    expect(which('bottom')).toEqual([0, 1, 2, 3])
    expect(which('top')).toEqual([4, 5, 6, 7])
    expect(which('vertical')).toEqual([8, 9, 10, 11])
    expect(which('horizontal')).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(which('all')).toHaveLength(12)
  })

  it('treats a circle lying on the top as a top edge', () => {
    const circle: EdgeInfo = {
      kind: 'circle', samples: [[5, 0, 20], [0, 5, 20], [-5, 0, 20], [0, -5, 20], [5, 0, 20]], tangent: [-1, 0, 0], length: 31.4,
    }
    expect(matchesDescription(circle, 'top', cubeBox)).toBe(true)
    expect(matchesDescription(circle, 'vertical', cubeBox)).toBe(false)
  })

  it('never chooses collapsed edges, like the poles of a sphere', () => {
    const pole: EdgeInfo = { kind: 'other', samples: Array.from({ length: 5 }, (): Vec3 => [0, 0, 20]), tangent: [0, 0, 0], length: 0 }
    expect(matchesDescription(pole, 'top', cubeBox)).toBe(false)
    expect(matchesDescription(pole, 'all', cubeBox)).toBe(false)
  })
})

describe('edge fingerprints (Review Focus 3)', () => {
  it('records position relative to the box, with a tidy direction', () => {
    const top = cube[4]
    if (!top) throw new Error('missing edge')
    expect(fingerprintOf(top, cubeBox)).toEqual({ kind: 'line', mid: [0.5, 0, 1], dir: [1, 0, 0], length: 0.5774 })
    const reversed = line([10, -10, 20], [-10, -10, 20])
    expect(fingerprintOf(reversed, cubeBox).dir).toEqual([1, 0, 0])
  })

  it('finds the same edges after the part is resized', () => {
    const picked = [cube[4], cube[6]].map((e) => fingerprintOf(e as EdgeInfo, cubeBox))
    const bigBox: Box = { min: [-20, -10, 0], max: [20, 10, 10] }
    const result = matchFingerprints(picked, cubeEdges(bigBox.min, bigBox.max), bigBox)
    expect(indices(result.matched)).toEqual([4, 6])
    expect(result.lost).toBe(0)
  })

  it('reports edges that are gone and never matches one edge twice', () => {
    const picked = [cube[4], cube[4]].map((e) => fingerprintOf(e as EdgeInfo, cubeBox))
    expect(matchFingerprints(picked, cube, cubeBox)).toEqual({ matched: new Set([4]), lost: 1 })
    expect(matchFingerprints(picked, [], cubeBox).lost).toBe(2)
  })

  it('never matches edges of a different kind or far away', () => {
    const fp = fingerprintOf(cube[4] as EdgeInfo, cubeBox)
    expect(fingerprintScore(fp, { ...fp, kind: 'circle' })).toBe(Number.POSITIVE_INFINITY)
    expect(fingerprintScore(fp, { ...fp, mid: [0.5, 1, 1] })).toBeGreaterThan(MATCH_THRESHOLD)
  })

  it('handles flat parts without dividing by zero', () => {
    const flat: Box = { min: [0, 0, 0], max: [10, 10, 0] }
    const fp = fingerprintOf(line([0, 0, 0], [10, 0, 0]), flat)
    expect(fp.mid).toEqual([0.5, 0, 0.5])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/geometry/edge-select.test.ts`
Expected: FAIL, "Failed to resolve import "./edge-select"".

- [ ] **Step 3: Write `src/geometry/edge-select.ts`**

```ts
import { boxSize, type Box } from '../document/box'
import type { EdgeFingerprint, EdgeKind, EdgeSelection, EdgeWhich, Vec3 } from '../document/types'

/** Plain-number facts about one edge, read from OpenCascade by edge-info.ts. */
export interface EdgeInfo {
  readonly kind: EdgeKind
  /** Points at 0, ¼, ½, ¾ and 1 of the way along the edge. */
  readonly samples: readonly Vec3[]
  /** Unit direction at the midpoint. */
  readonly tangent: Vec3
  readonly length: number
}

/** Highest score that still counts as "the same edge". */
export const MATCH_THRESHOLD = 0.1

const diagonal = (box: Box): number => Math.hypot(...boxSize(box))
export const edgeTolerance = (box: Box): number => Math.max(1e-4, diagonal(box) * 1e-4)
export const midOf = (info: EdgeInfo): Vec3 => info.samples[2] ?? info.samples[0] ?? [0, 0, 0]

const round4 = (v: number): number => {
  const r = Math.round(v * 1e4) / 1e4
  return Object.is(r, -0) ? 0 : r
}
const roundVec = (v: Vec3): Vec3 => [round4(v[0]), round4(v[1]), round4(v[2])]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const distance = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

export function matchesDescription(info: EdgeInfo, which: EdgeWhich, box: Box): boolean {
  const tol = edgeTolerance(box)
  // Collapsed edges (a sphere's poles) can't be rounded and would make OpenCascade fail.
  if (info.length <= tol) return false
  const zs = info.samples.map((p) => p[2])
  switch (which) {
    case 'all': return true
    case 'top': return zs.every((z) => z >= box.max[2] - tol)
    case 'bottom': return zs.every((z) => z <= box.min[2] + tol)
    case 'vertical': return info.kind === 'line' && Math.abs(info.tangent[2]) > 0.999
    case 'horizontal': return Math.max(...zs) - Math.min(...zs) <= tol
  }
}

/** Flips a direction so its first clearly non-zero component is positive (edges have no "forwards"). */
function canonical(dir: Vec3): Vec3 {
  const first = dir.find((c) => Math.abs(c) > 1e-6) ?? 0
  return first < 0 ? [-dir[0], -dir[1], -dir[2]] : dir
}

export function fingerprintOf(info: EdgeInfo, box: Box): EdgeFingerprint {
  const size = boxSize(box)
  const mid = midOf(info)
  const fraction = (i: 0 | 1 | 2): number => (size[i] > 1e-9 ? (mid[i] - box.min[i]) / size[i] : 0.5)
  return {
    kind: info.kind,
    mid: roundVec([fraction(0), fraction(1), fraction(2)]),
    dir: roundVec(canonical(info.tangent)),
    length: round4(info.length / Math.max(diagonal(box), 1e-9)),
  }
}

export function fingerprintScore(a: EdgeFingerprint, b: EdgeFingerprint): number {
  if (a.kind !== b.kind) return Number.POSITIVE_INFINITY
  return distance(a.mid, b.mid) + (1 - Math.abs(dot(a.dir, b.dir))) + Math.abs(a.length - b.length)
}

interface Pair { readonly f: number; readonly e: number; readonly score: number }

/** Finds each remembered edge among the current edges: best matches first, each edge used at most once. */
export function matchFingerprints(
  fingerprints: readonly EdgeFingerprint[], infos: readonly EdgeInfo[], box: Box,
): { matched: ReadonlySet<number>; lost: number } {
  const current = infos.map((info) => fingerprintOf(info, box))
  const pairs: Pair[] = fingerprints
    .flatMap((fp, f) => current.map((c, e) => ({ f, e, score: fingerprintScore(fp, c) })))
    .filter((p) => p.score <= MATCH_THRESHOLD)
    .sort((a, b) => a.score - b.score)
  const used = pairs.reduce(
    (acc, p) => (acc.f.has(p.f) || acc.e.has(p.e) ? acc : { f: new Set([...acc.f, p.f]), e: new Set([...acc.e, p.e]) }),
    { f: new Set<number>(), e: new Set<number>() },
  )
  return { matched: used.e, lost: fingerprints.length - used.f.size }
}

export function selectedEdges(
  selection: EdgeSelection, infos: readonly EdgeInfo[], box: Box,
): { indices: ReadonlySet<number>; lost: number } {
  if (selection.by === 'picked') {
    const { matched, lost } = matchFingerprints(selection.fingerprints, infos, box)
    return { indices: matched, lost }
  }
  const indices = new Set(infos.flatMap((info, i) => (matchesDescription(info, selection.which, box) ? [i] : [])))
  return { indices, lost: 0 }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/geometry/edge-select.test.ts && npm run typecheck`
Expected: PASS (8 tests) and typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/geometry/edge-select.ts src/geometry/edge-select.test.ts
git commit -m "feat: choose edges by description or remembered fingerprint"
```

---

### Task 5: Rounding and bevelling edges with replicad

**Files:**
- Create: `src/geometry/edge-info.ts`, `src/geometry/modifiers.ts`
- Test: `src/geometry/modifiers.test.ts`

**Interfaces:**
- Consumes: `edge-select.ts` (Task 4), `MODIFIER_LABELS` (Task 2), and the Task 1 types and constants.
- Produces:
  - In `edge-info.ts`:
    - `edgeInfo(edge: Edge): EdgeInfo`
    - `edgeInfos(shape: Shape3D): EdgeInfo[]`
    - `shapeBox(shape: Shape3D): Box`
    - `edgePolyline(edge: Edge): number[]`, which returns flat xyz with 2 points for a line and 17 otherwise
  - In `modifiers.ts`:
    - `class ModifierError extends Error`
    - `interface ModifiedShape { shape: Shape3D; warnings: Readonly<Record<string, string>> }`
    - `applyModifiers(input, modifiers): ModifiedShape`, which **consumes `input`** and returns a new shape
    - `modifierInput(input, modifiers, modifierId): Shape3D`, which consumes `input`
    - `copiesMade(modifiers): number`
  - This task implements fillet and chamfer. Task 6 adds patterns and mirror to the same switch; until then they throw `ModifierError('… is coming soon.')`.

- [ ] **Step 1: Write the failing test `src/geometry/modifiers.test.ts`**

```ts
import { measureVolume, type Shape3D } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { createModifier } from '../document/modifiers'
import type { EdgeSelection, Modifier } from '../document/types'
import { createCadToolkit } from '../plugins/cad'
import { edgeInfos, shapeBox } from './edge-info'
import { fingerprintOf, matchesDescription } from './edge-select'
import { applyModifiers, ModifierError } from './modifiers'
import { initTestOC } from './testing/oc-node'

beforeAll(initTestOC)

const cad = () => createCadToolkit()
const round = (radius: number, edges: EdgeSelection = { by: 'description', which: 'top' }): Modifier =>
  ({ ...createModifier('fillet', 'aaaaaaaa'), radius, edges } as Modifier)
const bevel = (distance: number, edges: EdgeSelection = { by: 'description', which: 'top' }): Modifier =>
  ({ ...createModifier('chamfer', 'bbbbbbbb'), distance, edges } as Modifier)

function volumeOf(shape: Shape3D): number {
  try {
    return measureVolume(shape)
  } finally {
    shape.delete()
  }
}

function errorOf(run: () => unknown): ModifierError {
  try { run() } catch (error) { if (error instanceof ModifierError) return error }
  throw new Error('expected a ModifierError')
}

describe('Round edges and Bevel edges', () => {
  it('rounds the top edges of a box and leaves the bottom square', () => {
    const { shape, warnings } = applyModifiers(cad().box(20, 20, 20), [round(2)])
    expect(warnings).toEqual({})
    const [[, , z0]] = shape.boundingBox.bounds
    expect(z0).toBeCloseTo(0, 5)
    const v = volumeOf(shape)
    expect(v).toBeGreaterThan(7900)
    expect(v).toBeLessThan(7990)
  })

  it('bevels the top edges', () => {
    const v = volumeOf(applyModifiers(cad().box(20, 20, 20), [bevel(2)]).shape)
    expect(v).toBeGreaterThan(7800)
    expect(v).toBeLessThan(7900)
  })

  it('still rounds after the part is resized', () => {
    expect(volumeOf(applyModifiers(cad().box(40, 20, 10), [round(2)]).shape)).toBeLessThan(8000)
  })

  it('rounds every edge of a cylinder', () => {
    expect(volumeOf(applyModifiers(cad().cylinder(20, 20), [round(2, { by: 'description', which: 'all' })]).shape))
      .toBeLessThan(Math.PI * 100 * 20)
  })

  it('explains a rounding that is too big for the part (Review Focus 1)', () => {
    expect(errorOf(() => applyModifiers(cad().box(20, 20, 20), [round(15)])).message)
      .toBe('Round edges: 15 mm is too big for these edges. Try a smaller size.')
  })

  it('does nothing, with a hint, when no edge matches', () => {
    const { shape, warnings } = applyModifiers(cad().sphere(20), [round(2)])
    expect(warnings).toEqual({ aaaaaaaa: 'No edges match, so this does nothing yet.' })
    expect(volumeOf(shape)).toBeCloseTo((4 / 3) * Math.PI * 1000, 0)
  })

  it('keeps picked edges after resizing and warns about lost ones (Review Focus 3)', () => {
    const source = cad().box(20, 20, 20)
    const box = shapeBox(source)
    const topEdges = edgeInfos(source).filter((info) => matchesDescription(info, 'top', box)).map((info) => fingerprintOf(info, box))
    source.delete()
    expect(topEdges).toHaveLength(4)
    const picked: EdgeSelection = { by: 'picked', fingerprints: topEdges.slice(0, 2) }
    const kept = applyModifiers(cad().box(40, 20, 10), [round(2, picked)])
    expect(kept.warnings).toEqual({})
    expect(volumeOf(kept.shape)).toBeLessThan(8000)
    const lost = applyModifiers(cad().sphere(20), [round(2, picked)])
    expect(lost.warnings.aaaaaaaa).toBe('Lost track of 2 edges — click Pick edges to choose them again.')
    lost.shape.delete()
  })

  it('skips disabled modifiers', () => {
    expect(volumeOf(applyModifiers(cad().box(20, 20, 20), [{ ...round(2), enabled: false } as Modifier]).shape)).toBeCloseTo(8000, 3)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/geometry/modifiers.test.ts`
Expected: FAIL, because the modules are missing.

- [ ] **Step 3: Write `src/geometry/edge-info.ts`**

```ts
import type { Edge, Shape3D } from 'replicad'
import type { Box } from '../document/box'
import type { EdgeKind, Vec3 } from '../document/types'
import type { EdgeInfo } from './edge-select'

const SAMPLE_AT = [0, 0.25, 0.5, 0.75, 1] as const
const POLYLINE_STEPS = 16
const KINDS: Readonly<Record<string, EdgeKind>> = { LINE: 'line', CIRCLE: 'circle' }

interface VectorLike { readonly x: number; readonly y: number; readonly z: number; delete(): void }

/** Copies a replicad Vector into plain numbers and frees it. */
function read(v: VectorLike): Vec3 {
  const out: Vec3 = [v.x, v.y, v.z]
  v.delete()
  return out
}

function unit(v: Vec3): Vec3 {
  const length = Math.hypot(...v)
  return length > 1e-12 ? [v[0] / length, v[1] / length, v[2] / length] : [0, 0, 0]
}

export function edgeInfo(edge: Edge): EdgeInfo {
  return {
    kind: KINDS[edge.geomType] ?? 'other',
    samples: SAMPLE_AT.map((t) => read(edge.pointAt(t))),
    tangent: unit(read(edge.tangentAt(0.5))),
    length: edge.length,
  }
}

/** Facts about every edge of a shape, in replicad's edge order. Frees the edge wrappers. */
export function edgeInfos(shape: Shape3D): EdgeInfo[] {
  return shape.edges.map((edge) => {
    try {
      return edgeInfo(edge)
    } finally {
      edge.delete()
    }
  })
}

/** Points along an edge for drawing it: 2 for a straight edge, more for a curve. Flat x,y,z numbers. */
export function edgePolyline(edge: Edge): number[] {
  const steps = edge.geomType === 'LINE' ? 1 : POLYLINE_STEPS
  return Array.from({ length: steps + 1 }, (_, i) => read(edge.pointAt(i / steps))).flat()
}

export function shapeBox(shape: Shape3D): Box {
  const [[x0, y0, z0], [x1, y1, z1]] = shape.boundingBox.bounds
  return { min: [x0, y0, z0], max: [x1, y1, z1] }
}
```

If replicad's `Vector` type has no `delete()` in its typings, keep the `VectorLike` structural type as written. It compiles against any object with `x/y/z/delete`. Confirm with the first test that `pointAt(0.5)` on a 20 mm box edge gives its midpoint, which shows `pointAt` takes 0–1 along the edge. If it instead takes the raw curve parameter, map `t` through the curve's first and last parameters and say so in your report.

- [ ] **Step 4: Write `src/geometry/modifiers.ts` (fillet and chamfer for now)**

```ts
import type { Edge, Shape3D } from 'replicad'
import { MODIFIER_LABELS } from '../document/modifiers'
import { MAX_COPIES, type ChamferModifier, type FilletModifier, type Modifier } from '../document/types'
import { edgeInfos, read as readVector, shapeBox } from './edge-info'
import { edgeTolerance, midOf, selectedEdges } from './edge-select'

/** A modifier problem in plain words; the Evaluator turns it into the part's warning badge. */
export class ModifierError extends Error {
  override name = 'ModifierError'
}

export interface ModifiedShape {
  readonly shape: Shape3D
  /** Non-fatal notes by modifier id, such as edges that couldn't be found again. */
  readonly warnings: Readonly<Record<string, string>>
}

interface Applied {
  readonly shape: Shape3D
  readonly warning: string | null
}

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)

function lostWarning(lost: number): string | null {
  if (lost === 0) return null
  return `Lost track of ${lost} ${plural(lost, 'edge', 'edges')} — click Pick edges to choose ${plural(lost, 'it', 'them')} again.`
}

/** Rounds or bevels the chosen edges. Does not consume `shape`; always returns a new shape. */
function roundEdges(shape: Shape3D, modifier: FilletModifier | ChamferModifier): Applied {
  const box = shapeBox(shape)
  const infos = edgeInfos(shape)
  const { indices, lost } = selectedEdges(modifier.edges, infos, box)
  if (indices.size === 0) return { shape: shape.clone(), warning: lostWarning(lost) ?? 'No edges match, so this does nothing yet.' }
  const mids = [...indices].flatMap((i) => (infos[i] ? [midOf(infos[i])] : []))
  const tol = edgeTolerance(box)
  const size = modifier.type === 'fillet' ? modifier.radius : modifier.distance
  const pick = (edge: Edge): number | null => {
    const m = readVector(edge.pointAt(0.5))
    return mids.some((p) => Math.hypot(p[0] - m[0], p[1] - m[1], p[2] - m[2]) <= tol) ? size : null
  }
  try {
    const out = modifier.type === 'fillet' ? shape.fillet(pick) : shape.chamfer(pick)
    return { shape: out, warning: lostWarning(lost) }
  } catch {
    throw new ModifierError(`${MODIFIER_LABELS[modifier.type]}: ${size} mm is too big for these edges. Try a smaller size.`)
  }
}

/** Applies one modifier without consuming `shape`. */
function applyOne(shape: Shape3D, modifier: Modifier): Applied {
  try {
    switch (modifier.type) {
      case 'fillet':
      case 'chamfer': return roundEdges(shape, modifier)
      default: throw new ModifierError(`${MODIFIER_LABELS[modifier.type]} is coming soon.`)
    }
  } catch (error) {
    if (error instanceof ModifierError) throw error
    throw new ModifierError(`${MODIFIER_LABELS[modifier.type]} couldn't be applied. Try different settings.`)
  }
}

/** How many copies a stack makes: pattern counts multiplied, ×2 for a mirror that keeps the original. */
export function copiesMade(modifiers: readonly Modifier[]): number {
  return modifiers.reduce((n, m) => {
    if (m.type === 'linearPattern' || m.type === 'circularPattern') return n * m.count
    return m.type === 'mirror' && m.keepOriginal ? n * 2 : n
  }, 1)
}

function applyOrFree(shape: Shape3D, modifier: Modifier): Applied {
  try {
    return applyOne(shape, modifier)
  } catch (error) {
    shape.delete()
    throw error
  }
}

/** Applies the enabled modifiers in order. Consumes `input`; the caller owns the result. */
export function applyModifiers(input: Shape3D, modifiers: readonly Modifier[]): ModifiedShape {
  const enabled = modifiers.filter((m) => m.enabled)
  const copies = copiesMade(enabled)
  if (copies > MAX_COPIES) {
    input.delete()
    throw new ModifierError(`These modifiers make ${copies} copies. BloKade can make up to ${MAX_COPIES} at once — use smaller counts.`)
  }
  return enabled.reduce<ModifiedShape>((acc, modifier) => {
    const applied = applyOrFree(acc.shape, modifier)
    acc.shape.delete()
    return { shape: applied.shape, warnings: applied.warning ? { ...acc.warnings, [modifier.id]: applied.warning } : acc.warnings }
  }, { shape: input, warnings: {} })
}

/** The shape a modifier works on: the enabled modifiers before it applied. Consumes `input`. */
export function modifierInput(input: Shape3D, modifiers: readonly Modifier[], modifierId: string): Shape3D {
  const index = modifiers.findIndex((m) => m.id === modifierId)
  return applyModifiers(input, index === -1 ? modifiers : modifiers.slice(0, index)).shape
}
```

Export `read` from `edge-info.ts`: change `function read` to `export function read`.

`replicad`'s `fillet` and `chamfer` take a function `(edge) => radius | null`, and **keep** their input. The edge passed to `pick` belongs to replicad; do not delete it. If replicad's fillet on a cylinder with `all` fails because of the seam edge, exclude edges whose five samples are collinear and parallel to Z *and* whose `kind` is `line` *and* that lie on the bounding cylinder. Do this only if the test fails, and report it. The expected outcome is that OpenCascade skips seam edges.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/geometry && npm run typecheck`
Expected: PASS and typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/geometry
git commit -m "feat: round and bevel chosen edges"
```

---

### Task 6: Repeat in a row, repeat in a circle, mirror

**Files:**
- Modify: `src/geometry/modifiers.ts`
- Test: `src/geometry/modifiers.test.ts`

**Interfaces:**
- Consumes: the Task 5 `applyOne` switch.
- Produces: the `linearPattern`, `circularPattern` and `mirror` cases in `applyOne`. The "coming soon" default is removed.

- [ ] **Step 1: Add the failing tests to `src/geometry/modifiers.test.ts`**

```ts
const row = (count: number, spacing: [number, number, number], id = 'cccccccc'): Modifier =>
  ({ ...createModifier('linearPattern', id), count, spacing } as Modifier)
const circle = (count: number, angle: number, center: [number, number, number]): Modifier =>
  ({ ...createModifier('circularPattern', 'dddddddd'), count, angle, center } as Modifier)
const mirror = (plane: 'XY' | 'XZ' | 'YZ', keepOriginal: boolean): Modifier =>
  ({ ...createModifier('mirror', 'eeeeeeee'), plane, keepOriginal } as Modifier)

function boundsOf(shape: Shape3D): number[] {
  const [[x0], [x1]] = shape.boundingBox.bounds
  return [Math.round(x0 * 1000) / 1000, Math.round(x1 * 1000) / 1000]
}

describe('Repeat and Mirror', () => {
  it('repeats in a row', () => {
    const { shape } = applyModifiers(cad().box(20, 20, 20), [row(3, [30, 0, 0])])
    expect(boundsOf(shape)).toEqual([-10, 70])
    expect(volumeOf(shape)).toBeCloseTo(24000, 0)
  })

  it('repeats in a circle around a center point', () => {
    const { shape } = applyModifiers(cad().box(20, 20, 20), [circle(4, 360, [-30, 0, 0])])
    expect(boundsOf(shape)).toEqual([-70, 10])
    expect(volumeOf(shape)).toBeCloseTo(32000, 0)
  })

  it('spreads copies over part of a circle', () => {
    const { shape } = applyModifiers(cad().box(2, 2, 2), [circle(3, 180, [-30, 0, 0])])
    expect(boundsOf(shape)).toEqual([-61, 1])
    shape.delete()
  })

  it('mirrors, keeping or replacing the original', () => {
    const kept = applyModifiers(cad().box(20, 20, 20), [row(2, [30, 0, 0]), mirror('YZ', true)]).shape
    expect(boundsOf(kept)).toEqual([-40, 40])
    expect(volumeOf(kept)).toBeCloseTo(24000, 0)
    const replaced = applyModifiers(cad().box(20, 20, 20), [row(2, [30, 0, 0]), mirror('YZ', false)]).shape
    expect(boundsOf(replaced)).toEqual([-40, 10])
    replaced.delete()
  })

  it('refuses stacks that make too many copies before doing any work (Review Focus 2)', () => {
    const started = Date.now()
    const error = errorOf(() => applyModifiers(cad().box(2, 2, 2), [row(50, [3, 0, 0]), row(50, [0, 3, 0], 'ffffffff')]))
    expect(error.message).toBe('These modifiers make 2500 copies. BloKade can make up to 200 at once — use smaller counts.')
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('counts a mirror that keeps the original as two copies', () => {
    expect(() => applyModifiers(cad().box(2, 2, 2), [row(50, [3, 0, 0]), row(3, [0, 3, 0], 'ffffffff'), mirror('XY', true)]))
      .toThrow('make 300 copies')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/geometry/modifiers.test.ts`
Expected: FAIL with "Repeat in a row is coming soon."

- [ ] **Step 3: Add the patterns and mirror to `src/geometry/modifiers.ts`**

Extend the type import with `CircularPatternModifier`, `LinearPatternModifier`, `MirrorModifier`, `PatternAxis` and `Vec3`. Then add:

```ts
const AXIS_DIRECTION: Readonly<Record<PatternAxis, [number, number, number]>> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }

/** Fuses shapes into one. Consumes every shape it is given. */
function fuseAll(shapes: readonly Shape3D[]): Shape3D {
  const [first, ...rest] = shapes
  if (!first) throw new ModifierError('There was nothing to repeat.')
  return rest.reduce((acc, next) => {
    try {
      return acc.fuse(next)
    } finally {
      acc.delete()
      next.delete()
    }
  }, first)
}

const scaled = (v: Vec3, k: number): [number, number, number] => [v[0] * k, v[1] * k, v[2] * k]

function linearPattern(shape: Shape3D, m: LinearPatternModifier): Shape3D {
  return fuseAll(Array.from({ length: m.count }, (_, i) => (i === 0 ? shape.clone() : shape.clone().translate(scaled(m.spacing, i)))))
}

/** Degrees between neighbouring copies: all the way round shares 360° evenly; less spreads over the angle. */
export function circularStep(m: CircularPatternModifier): number {
  if (m.count <= 1) return 0
  return m.angle >= 360 ? 360 / m.count : m.angle / (m.count - 1)
}

function circularPattern(shape: Shape3D, m: CircularPatternModifier): Shape3D {
  const step = circularStep(m)
  const center: [number, number, number] = [m.center[0], m.center[1], m.center[2]]
  return fuseAll(Array.from({ length: m.count }, (_, i) =>
    (i === 0 ? shape.clone() : shape.clone().rotate(step * i, center, AXIS_DIRECTION[m.axis]))))
}

function mirrored(shape: Shape3D, m: MirrorModifier): Shape3D {
  const flipped = shape.clone().mirror(m.plane, [0, 0, 0])
  return m.keepOriginal ? fuseAll([shape.clone(), flipped]) : flipped
}
```

Replace the `switch` in `applyOne`:

```ts
    switch (modifier.type) {
      case 'fillet':
      case 'chamfer': return roundEdges(shape, modifier)
      case 'linearPattern': return { shape: linearPattern(shape, modifier), warning: null }
      case 'circularPattern': return { shape: circularPattern(shape, modifier), warning: null }
      case 'mirror': return { shape: mirrored(shape, modifier), warning: null }
    }
```

The `default` branch is gone because TypeScript checks that the switch covers every type. If `noFallthroughCasesInSwitch` or the "not all code paths return" check complains, keep the exhaustive switch as written. The `try` around it still returns from every case.

`translate`, `rotate` and `mirror` consume their receiver, which is why each copy starts from `shape.clone()`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/geometry && npm run typecheck`
Expected: PASS and typecheck clean. `modifiers.ts` must stay under 400 lines.

- [ ] **Step 5: Commit**

```bash
git add src/geometry
git commit -m "feat: repeat parts in a row or circle and mirror them"
```

---

### Task 7: Modifiers in the Evaluator, the worker API and STEP export

**Files:**
- Create: `src/geometry/edge-candidates.ts`
- Modify: `src/geometry/evaluate.ts`, `src/geometry/api.ts`, `src/geometry/types.ts`, `src/geometry/client.ts`, `src/app/testing/fakes.ts`
- Test: `src/geometry/evaluate.test.ts`, `src/geometry/api.test.ts`, `src/geometry/client.test.ts`

**Interfaces:**
- Consumes: `applyModifiers`, `modifierInput` and `ModifierError` (Tasks 5–6); `edgeInfo`, `edgePolyline` and `shapeBox` (Task 5); `selectedEdges` and `fingerprintOf` (Task 4); `modifiersOf` (Task 2).
- Produces:
  - In `geometry/types.ts`:
    - `interface EdgeCandidate { fingerprint: EdgeFingerprint; points: readonly number[]; picked: boolean }`
    - `type ModifierWarnings = Readonly<Record<NodeId, Readonly<Record<string, string>>>>`
    - `BuildResult.warnings?: ModifierWarnings`
    - `GeometryApi.exportStep(doc, ids?)` and `GeometryApi.edgeCandidates(doc, nodeId, modifierId)`
  - `Evaluator`:
    - `local()` applies modifiers.
    - `warnings(): ModifierWarnings` gives the nodes built this pass.
    - `edgeCandidates(doc, id, modifierId): EdgeCandidate[]`
  - `GeometryClient.exportStep` and `GeometryClient.edgeCandidates`
  - Fakes for both.

- [ ] **Step 1: Write the failing tests**

Add to `src/geometry/evaluate.test.ts`. Import `addModifier` and `setEdgeSelection` from `../document/modifiers`, and `updateModifier` too if you use it. Also import `modifierField` and `writeField` from `../document/fields`.

```ts
describe('Evaluator modifiers', () => {
  const withModifier = (doc: BloKadeDocument, id: string, type: 'fillet' | 'linearPattern' | 'mirror') => addModifier(doc, id, type)

  it('applies modifiers to a part before placing it', () => {
    const base = addNode(createEmptyDocument(), shape('a', 'box', { width: 20, depth: 20, height: 20 }, [100, 0, 0]))
    const { doc } = withModifier(base, 'a', 'fillet')
    const ev = newEvaluator()
    expect(measureVolume(ev.local(doc, 'a'))).toBeLessThan(8000)
    expect(ev.placed(doc, 'a').boundingBox.center[0]).toBeCloseTo(100, 3)
  })

  it('rounds the combined shape of a group (Review Focus 4)', () => {
    const { doc } = withModifier(boxWithHole(), 'g', 'fillet')
    const plain = 8000 - Math.PI * 25 * 20
    expect(measureVolume(newEvaluator().local(doc, 'g'))).toBeLessThan(plain)
  })

  it('a row of holes inside a group cuts every hole (Review Focus 4)', () => {
    const parts = [shape('box', 'box', { width: 100, depth: 20, height: 20 }), shape('hole', 'cylinder', { diameter: 6, height: 40 }, [-30, 0, -10])]
    const grouped = groupNodes(setMode(parts.reduce((d, n) => addNode(d, n), createEmptyDocument()), ['hole'], 'hole'), ['box', 'hole'], 'g').doc
    const { doc, modifierId } = withModifier(grouped, 'hole', 'linearPattern')
    const spaced = updateNode(doc, 'hole', (n) => writeField(n, modifierField(modifierId, 'spacing', 0), 30))
    expect(measureVolume(newEvaluator().local(spaced, 'g'))).toBeCloseTo(40000 - 3 * Math.PI * 9 * 20, 0)
  })

  it('turns a modifier problem into a build error for that part only (Review Focus 1)', () => {
    const base = [shape('a', 'box', { width: 20, depth: 20, height: 20 }), shape('b', 'box', { width: 10, depth: 10, height: 10 }, [50, 0, 0])]
      .reduce((d, n) => addNode(d, n), createEmptyDocument())
    const { doc, modifierId } = withModifier(base, 'a', 'fillet')
    const tooBig = updateNode(doc, 'a', (n) => writeField(n, modifierField(modifierId, 'radius'), 15))
    const ev = newEvaluator()
    expect(buildError(() => ev.local(tooBig, 'a')).message).toContain('too big for these edges')
    expect(measureVolume(ev.local(tooBig, 'b'))).toBeCloseTo(1000, 3)
  })

  it('reports modifier warnings for the parts built in this pass', () => {
    const base = addNode(createEmptyDocument(), shape('s', 'sphere', { diameter: 20 }))
    const { doc, modifierId } = withModifier(base, 's', 'fillet')
    const ev = newEvaluator()
    ev.beginPass()
    ev.local(doc, 's')
    ev.endPass()
    expect(ev.warnings()).toEqual({ s: { [modifierId]: 'No edges match, so this does nothing yet.' } })
    ev.beginPass()
    ev.local(doc, 's')
    expect(ev.warnings()).toEqual({ s: { [modifierId]: 'No edges match, so this does nothing yet.' } })
  })

  it('reuses the cached result until a modifier changes', () => {
    const { doc, modifierId } = withModifier(addNode(createEmptyDocument(), shape('a', 'box', { width: 20, depth: 20, height: 20 })), 'a', 'fillet')
    const ev = newEvaluator()
    const first = ev.local(doc, 'a')
    expect(ev.local(doc, 'a')).toBe(first)
    const changed = setEdgeSelection(doc, 'a', modifierId, { by: 'description', which: 'bottom' })
    expect(ev.local(changed, 'a')).not.toBe(first)
  })

  it('lists the edges a Round edges modifier can pick, marking the chosen ones', () => {
    const { doc, modifierId } = withModifier(addNode(createEmptyDocument(), shape('a', 'box', { width: 20, depth: 20, height: 20 })), 'a', 'fillet')
    const candidates = newEvaluator().edgeCandidates(doc, 'a', modifierId)
    expect(candidates).toHaveLength(12)
    expect(candidates.filter((c) => c.picked)).toHaveLength(4)
    expect(candidates[0]?.points).toHaveLength(6)
    expect(candidates.find((c) => c.picked)?.fingerprint.mid[2]).toBe(1)
  })

  it('refuses edge picking for modifiers that have no edges', () => {
    const { doc, modifierId } = withModifier(addNode(createEmptyDocument(), shape('a', 'box', { width: 20, depth: 20, height: 20 })), 'a', 'mirror')
    expect(buildError(() => newEvaluator().edgeCandidates(doc, 'a', modifierId)).message).toContain('Only Round edges and Bevel edges')
  })
})
```

Add to `src/geometry/api.test.ts`. Reuse that file's existing `setup` or `api` helper; if it has none, build one with `createGeometryApi(new Evaluator(registry, createCadToolkit()))`.

```ts
  it('exports STEP', async () => {
    const doc = addNode(createEmptyDocument(), createShapeNode({ id: 'a', shapeType: 'box', name: 'Box', params: {}, color: '#f00' }))
    const bytes = await api.exportStep(doc)
    expect(new TextDecoder().decode(bytes.slice(0, 12))).toBe('ISO-10303-21')
  })

  it('includes modifier warnings in a rebuild', async () => {
    const base = addNode(createEmptyDocument(), createShapeNode({ id: 's', shapeType: 'sphere', name: 'Ball', params: {}, color: '#f00' }))
    const { doc, modifierId } = addModifier(base, 's', 'fillet')
    const result = await api.rebuild(doc)
    expect(result.warnings).toEqual({ s: { [modifierId]: 'No edges match, so this does nothing yet.' } })
  })

  it('explains edge-picking problems in plain words', async () => {
    const doc = addNode(createEmptyDocument(), createShapeNode({ id: 'a', shapeType: 'box', name: 'Box', params: {}, color: '#f00' }))
    await expect(api.edgeCandidates(doc, 'a', 'deadbeef')).rejects.toThrow('Only Round edges and Bevel edges')
  })
```

Add to `src/geometry/client.test.ts`. Mirror that file's existing export test, using its helper to build a client from a fake API.

```ts
  it('forwards STEP export and edge candidates to the worker', async () => {
    const step = new ArrayBuffer(3)
    const client = new GeometryClient(() => ({
      api: fakeGeometryApi({ exportStep: async () => step, edgeCandidates: async () => [] }),
      terminate: () => undefined,
    }))
    await expect(client.exportStep(createEmptyDocument())).resolves.toBe(step)
    await expect(client.edgeCandidates(createEmptyDocument(), 'a', 'deadbeef')).resolves.toEqual([])
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/geometry`
Expected: FAIL. Modifiers are ignored, and `exportStep`/`edgeCandidates` are missing.

- [ ] **Step 3: Extend `src/geometry/types.ts`**

```ts
import type { BloKadeDocument, EdgeFingerprint, NodeId } from '../document/types'
```

```ts
/** Non-fatal modifier notes by part and modifier id (for example "Lost track of 2 edges"). */
export type ModifierWarnings = Readonly<Record<NodeId, Readonly<Record<string, string>>>>

/** One edge Kade can click while picking edges: where it is and whether it's chosen now. */
export interface EdgeCandidate {
  readonly fingerprint: EdgeFingerprint
  /** Flat x,y,z points along the edge, in the part's own frame. */
  readonly points: readonly number[]
  readonly picked: boolean
}
```

In `BuildResult`, add `readonly warnings?: ModifierWarnings`. In `GeometryApi`, add:

```ts
  exportStep(doc: BloKadeDocument, ids?: readonly NodeId[]): Promise<ArrayBuffer>
  edgeCandidates(doc: BloKadeDocument, nodeId: NodeId, modifierId: string): Promise<EdgeCandidate[]>
```

- [ ] **Step 4: Write `src/geometry/edge-candidates.ts`**

```ts
import type { Shape3D } from 'replicad'
import type { EdgeSelection } from '../document/types'
import { edgeInfo, edgePolyline, shapeBox } from './edge-info'
import { fingerprintOf, selectedEdges } from './edge-select'
import type { EdgeCandidate } from './types'

/** Every edge of `shape` as a clickable candidate, marking the ones `selection` chooses now. Does not consume `shape`. */
export function findEdgeCandidates(shape: Shape3D, selection: EdgeSelection): EdgeCandidate[] {
  const box = shapeBox(shape)
  const read = shape.edges.map((edge) => {
    try {
      return { info: edgeInfo(edge), points: edgePolyline(edge) }
    } finally {
      edge.delete()
    }
  })
  const { indices } = selectedEdges(selection, read.map((r) => r.info), box)
  return read.map((r, i) => ({ fingerprint: fingerprintOf(r.info, box), points: r.points, picked: indices.has(i) }))
}
```

- [ ] **Step 5: Apply modifiers in `src/geometry/evaluate.ts`**

Add these imports:

```ts
import { modifiersOf } from '../document/modifiers'
import type { Modifier } from '../document/types'
import { findEdgeCandidates } from './edge-candidates'
import { applyModifiers, ModifierError, modifierInput } from './modifiers'
import type { EdgeCandidate, ModifierWarnings } from './types'
```

Add this helper next to `messageOf`:

```ts
const enabledModifiers = (node: SceneNode): readonly Modifier[] => modifiersOf(node).filter((m) => m.enabled)
```

Then change the class:
- Add two fields: `private readonly warningCache = new Map<string, Readonly<Record<string, string>>>()` and `private passWarnings = new Map<NodeId, Readonly<Record<string, string>>>()`.
- `beginPass` also resets `this.passWarnings = new Map()`.
- `endPass` also calls `this.warningCache.delete(key)` for every evicted key.
- Replace `local`, add `warnings` and `edgeCandidates`, and add the private helpers shown below.
- Change `placedKey` to use `localKey`.

```ts
  local(doc: BloKadeDocument, id: NodeId): Shape3D {
    const node = this.nodeOf(doc, id)
    const base = this.base(doc, node)
    const modifiers = enabledModifiers(node)
    if (modifiers.length === 0) return base
    const key = this.localKey(doc, node)
    const shape = this.entry(key, () => this.modified(base, modifiers, key, node.id))
    const found = this.warningCache.get(key)
    if (found && Object.keys(found).length > 0) this.passWarnings.set(node.id, found)
    return shape
  }

  /** Modifier notes for the parts built since beginPass(). */
  warnings(): ModifierWarnings {
    return Object.fromEntries(this.passWarnings)
  }

  edgeCandidates(doc: BloKadeDocument, id: NodeId, modifierId: string): EdgeCandidate[] {
    const node = this.nodeOf(doc, id)
    const target = modifiersOf(node).find((m) => m.id === modifierId)
    if (!target || (target.type !== 'fillet' && target.type !== 'chamfer')) {
      throw new NodeBuildError('Only Round edges and Bevel edges can pick edges.', id)
    }
    const input = this.asBuildError(id, () => modifierInput(this.base(doc, node).clone(), modifiersOf(node), modifierId))
    try {
      return findEdgeCandidates(input, target.edges)
    } finally {
      input.delete()
    }
  }

  private base(doc: BloKadeDocument, node: SceneNode): Shape3D {
    return node.kind === 'shape' ? this.shapeLocal(node) : this.groupLocal(doc, node)
  }

  private modified(base: Shape3D, modifiers: readonly Modifier[], key: string, id: NodeId): Shape3D {
    const result = this.asBuildError(id, () => applyModifiers(base.clone(), modifiers))
    this.warningCache.set(key, result.warnings)
    return result.shape
  }

  private asBuildError<T>(id: NodeId, run: () => T): T {
    try {
      return run()
    } catch (error) {
      if (error instanceof ModifierError) throw new NodeBuildError(error.message, id)
      throw error
    }
  }

  private localKey(doc: BloKadeDocument, node: SceneNode): string {
    const base = node.kind === 'shape' ? this.shapeKey(node) : this.groupKey(doc, node)
    const modifiers = enabledModifiers(node)
    return modifiers.length > 0 ? `${base}|mods:${JSON.stringify(modifiers)}` : base
  }

  private placedKey(doc: BloKadeDocument, node: SceneNode): string {
    return `${this.localKey(doc, node)}@${node.transform.position.join(',')}/${node.transform.rotation.join(',')}`
  }
```

The old `local` dispatched to `shapeLocal` or `groupLocal`; that logic is now in `base`. `this.entry` caches the modified shape under `localKey`, and the plugin build or group boolean stays cached under its own key, so changing only a modifier re-runs only the modifiers.

- [ ] **Step 6: Extend `src/geometry/api.ts`**

In `rebuild`, return the warnings as well:

```ts
function rebuild(evaluator: Evaluator, doc: BloKadeDocument): BuildResult {
  evaluator.beginPass()
  try {
    const nodes = Object.fromEntries(doc.root.map((id) => [id, buildNode(evaluator, doc, id)]))
    return { nodes, warnings: evaluator.warnings() }
  } finally {
    evaluator.endPass()
  }
}
```

In the object returned by `createGeometryApi`, add:

```ts
    exportStep: async (doc, ids) => {
      const shape = exportShape(evaluator, doc, ids)
      try {
        return await shape.blobSTEP().arrayBuffer()
      } finally {
        shape.delete()
      }
    },
    edgeCandidates: async (doc, nodeId, modifierId) => {
      try {
        return evaluator.edgeCandidates(doc, nodeId, modifierId)
      } catch (error) {
        if (error instanceof NodeBuildError) throw new Error(error.message)
        console.error('Unexpected edge-picking failure', error)
        throw new Error(UNEXPECTED)
      }
    },
```

- [ ] **Step 7: Extend `src/geometry/client.ts` and `src/app/testing/fakes.ts`**

`client.ts`: add `EdgeCandidate` to the type import from `./types`, then add these methods:

```ts
  exportStep(doc: BloKadeDocument, ids?: readonly NodeId[]): Promise<ArrayBuffer> {
    return this.call((api) => api.exportStep(doc, ids))
  }

  edgeCandidates(doc: BloKadeDocument, nodeId: NodeId, modifierId: string): Promise<EdgeCandidate[]> {
    return this.call((api) => api.edgeCandidates(doc, nodeId, modifierId))
  }
```

`fakes.ts`: add these to `fakeGeometryApi`'s defaults:

```ts
    exportStep: async () => new TextEncoder().encode('ISO-10303-21;').buffer as ArrayBuffer,
    edgeCandidates: async () => [],
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS and typecheck clean. `evaluate.ts` must stay under 400 lines.

- [ ] **Step 9: Commit**

```bash
git add src
git commit -m "feat: build modifiers in the geometry worker and export STEP"
```

---

### Task 8: Store state and actions for picking edges

**Files:**
- Create: `src/app/edge-actions.ts`, `src/app/useEdgeCandidates.ts`
- Modify: `src/store/store.ts`, `src/app/actions.ts`
- Test: `src/store/store.test.ts`, `src/app/edge-actions.test.ts`, `src/app/useEdgeCandidates.test.tsx`, `src/app/actions.test.ts`

**Interfaces:**
- Consumes: `EdgeCandidate` and `ModifierWarnings` (Task 7); `modifiersOf`, `setPickedEdges` and `togglePicked` (Task 2).
- Produces:
  - Store fields: `modifierWarnings: ModifierWarnings`, `pickingEdges: EdgePicking | null` (where `EdgePicking = { nodeId; modifierId }`), and `edgeCandidates: readonly EdgeCandidate[] | null`.
  - Store setters: `setPickingEdges(p)`, which clears the candidates and stops workplane picking, and `setEdgeCandidates(c)`.
  - `setPickingWorkplane(true)` clears `pickingEdges`.
  - `applyBuild` stores `result.warnings ?? {}`.
  - `openDesign` resets all of these.
  - `createEdgeActions(store): EdgeActions`, with `startPickingEdges(nodeId, modifierId)`, `stopPickingEdges()` and `togglePickedEdge(fingerprint)`.
  - `Actions` gains those three.
  - `cancel` stops edge picking first.
  - `useEdgeCandidates(store, client)`.

- [ ] **Step 1: Write the failing tests**

Add to `src/store/store.test.ts`:

```ts
  it('keeps modifier warnings from the latest build', () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    store.getState().applyBuild('d', { nodes: {}, warnings: { a: { aaaaaaaa: 'Lost track of 1 edge' } } })
    expect(store.getState().modifierWarnings).toEqual({ a: { aaaaaaaa: 'Lost track of 1 edge' } })
    store.getState().applyBuild('d', { nodes: {} })
    expect(store.getState().modifierWarnings).toEqual({})
  })

  it('picks edges or a workplane, never both, and forgets both for another design', () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    store.getState().setPickingWorkplane(true)
    store.getState().setPickingEdges({ nodeId: 'a', modifierId: 'aaaaaaaa' })
    expect(store.getState()).toMatchObject({ pickingWorkplane: false, pickingEdges: { nodeId: 'a', modifierId: 'aaaaaaaa' }, edgeCandidates: null })
    store.getState().setEdgeCandidates([])
    store.getState().setPickingWorkplane(true)
    expect(store.getState()).toMatchObject({ pickingWorkplane: true, pickingEdges: null, edgeCandidates: null })
    store.getState().setPickingEdges({ nodeId: 'a', modifierId: 'aaaaaaaa' })
    store.getState().openDesign('other', createEmptyDocument())
    expect(store.getState()).toMatchObject({ pickingEdges: null, edgeCandidates: null, modifierWarnings: {} })
  })
```

`src/app/edge-actions.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addModifier, setPickedEdges } from '../document/modifiers'
import { addNode } from '../document/ops'
import type { EdgeFingerprint } from '../document/types'
import { createBloKadeStore } from '../store/store'
import { createEdgeActions } from './edge-actions'

const fp = (x: number): EdgeFingerprint => ({ kind: 'line', mid: [x, 0, 1], dir: [1, 0, 0], length: 0.5 })

function setup() {
  const base = addNode(createEmptyDocument(), createShapeNode({ id: 'b', shapeType: 'box', name: 'Box', params: {}, color: '#f00' }))
  const { doc, modifierId } = addModifier(base, 'b', 'fillet')
  const store = createBloKadeStore({ designId: 'd', doc })
  const edges = () => {
    const m = store.getState().history.present.nodes.b?.modifiers?.[0]
    return m && (m.type === 'fillet' || m.type === 'chamfer') ? m.edges : undefined
  }
  return { store, actions: createEdgeActions(store), modifierId, edges }
}

describe('edge picking actions', () => {
  it('starts and stops picking', () => {
    const { store, actions, modifierId } = setup()
    actions.startPickingEdges('b', modifierId)
    expect(store.getState().pickingEdges).toEqual({ nodeId: 'b', modifierId })
    actions.stopPickingEdges()
    expect(store.getState().pickingEdges).toBeNull()
  })

  it('starts from the edges the description chooses, then toggles one', () => {
    const { store, actions, modifierId, edges } = setup()
    actions.startPickingEdges('b', modifierId)
    store.getState().setEdgeCandidates([
      { fingerprint: fp(0.1), points: [], picked: true },
      { fingerprint: fp(0.5), points: [], picked: true },
      { fingerprint: fp(0.9), points: [], picked: false },
    ])
    actions.togglePickedEdge(fp(0.5))
    expect(edges()).toEqual({ by: 'picked', fingerprints: [fp(0.1)] })
    actions.togglePickedEdge(fp(0.9))
    expect(edges()).toEqual({ by: 'picked', fingerprints: [fp(0.1), fp(0.9)] })
  })

  it('does nothing when not picking', () => {
    const { store, actions } = setup()
    const before = store.getState().history.present
    actions.togglePickedEdge(fp(0.5))
    expect(store.getState().history.present).toBe(before)
  })

  it('keeps the existing picks when already picking by hand', () => {
    const { store, actions, modifierId, edges } = setup()
    store.getState().apply((d) => setPickedEdges(d, 'b', modifierId, [fp(0.3)]))
    actions.startPickingEdges('b', modifierId)
    actions.togglePickedEdge(fp(0.7))
    expect(edges()).toEqual({ by: 'picked', fingerprints: [fp(0.3), fp(0.7)] })
  })
})
```

`src/app/useEdgeCandidates.test.tsx`:

```tsx
// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addModifier, removeModifier } from '../document/modifiers'
import { addNode } from '../document/ops'
import type { EdgeCandidate } from '../geometry/types'
import { createBloKadeStore } from '../store/store'
import { useEdgeCandidates } from './useEdgeCandidates'

const candidate: EdgeCandidate = { fingerprint: { kind: 'line', mid: [0.5, 0, 1], dir: [1, 0, 0], length: 0.5 }, points: [0, 0, 0, 1, 0, 0], picked: true }

function setup(edgeCandidates = vi.fn(async () => [candidate])) {
  const base = addNode(createEmptyDocument(), createShapeNode({ id: 'b', shapeType: 'box', name: 'Box', params: {}, color: '#f00' }))
  const { doc, modifierId } = addModifier(base, 'b', 'fillet')
  const store = createBloKadeStore({ designId: 'd', doc })
  renderHook(() => useEdgeCandidates(store, { edgeCandidates }))
  return { store, modifierId, edgeCandidates }
}

describe('useEdgeCandidates', () => {
  it('fetches candidate edges while picking and again after the design changes', async () => {
    const { store, modifierId, edgeCandidates } = setup()
    store.getState().setPickingEdges({ nodeId: 'b', modifierId })
    await waitFor(() => expect(store.getState().edgeCandidates).toEqual([candidate]))
    store.getState().apply((d) => ({ ...d, name: 'Changed' }))
    await waitFor(() => expect(edgeCandidates).toHaveBeenCalledTimes(2))
  })

  it('stops picking when the modifier is deleted', async () => {
    const { store, modifierId } = setup()
    store.getState().setPickingEdges({ nodeId: 'b', modifierId })
    store.getState().apply((d) => removeModifier(d, 'b', modifierId))
    await waitFor(() => expect(store.getState().pickingEdges).toBeNull())
  })

  it('explains a failure and stops picking', async () => {
    const { store, modifierId } = setup(vi.fn(async () => { throw new Error('This part has a problem.') }))
    store.getState().setPickingEdges({ nodeId: 'b', modifierId })
    await waitFor(() => expect(store.getState().notice).toBe('This part has a problem.'))
    expect(store.getState().pickingEdges).toBeNull()
  })
})
```

Add to `src/app/actions.test.ts`:

```ts
  it('Escape stops edge picking first, then workplane picking, then deselects', () => {
    const { store, actions } = setup()
    store.getState().setPickingEdges({ nodeId: 'a', modifierId: 'aaaaaaaa' })
    actions.cancel()
    expect(store.getState().pickingEdges).toBeNull()
    expect(typeof actions.togglePickedEdge).toBe('function')
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/store src/app`
Expected: FAIL, because the new store fields and modules are missing.

- [ ] **Step 3: Extend `src/store/store.ts`**

Add these imports: `import type { BuildResult, EdgeCandidate, ModifierWarnings } from '../geometry/types'`. This replaces the existing `BuildResult` import.

```ts
/** The Round edges / Bevel edges modifier whose edges Kade is clicking. */
export interface EdgePicking {
  readonly nodeId: NodeId
  readonly modifierId: string
}
```

Add to `BloKadeState`:

```ts
  readonly modifierWarnings: ModifierWarnings
  readonly pickingEdges: EdgePicking | null
  /** Edges to show while picking; null until the worker has listed them. */
  readonly edgeCandidates: readonly EdgeCandidate[] | null
  setPickingEdges(picking: EdgePicking | null): void
  setEdgeCandidates(candidates: readonly EdgeCandidate[] | null): void
```

Initial values: `modifierWarnings: {}`, `pickingEdges: null`, `edgeCandidates: null`. Setters:

```ts
    setPickingEdges: (pickingEdges) =>
      set((s) => ({ pickingEdges, edgeCandidates: null, pickingWorkplane: pickingEdges ? false : s.pickingWorkplane })),
    setEdgeCandidates: (edgeCandidates) => set({ edgeCandidates }),
```

Change `setPickingWorkplane` to:

```ts
    setPickingWorkplane: (pickingWorkplane) =>
      set((s) => ({ pickingWorkplane, ...(pickingWorkplane ? { pickingEdges: null, edgeCandidates: null } : {}) })),
```

`openDesign` also resets `modifierWarnings: {}`, `pickingEdges: null` and `edgeCandidates: null`. `applyBuild` becomes:

```ts
      set((s) => ({ ...mergeBuild(s.meshes, result), modifierWarnings: result.warnings ?? {}, engineReady: true }))
```

- [ ] **Step 4: Write `src/app/edge-actions.ts`**

```ts
import { modifiersOf, setPickedEdges, togglePicked } from '../document/modifiers'
import type { EdgeFingerprint, NodeId } from '../document/types'
import type { BloKadeStore } from '../store/store'

export interface EdgeActions {
  startPickingEdges(nodeId: NodeId, modifierId: string): void
  stopPickingEdges(): void
  /** Adds or removes one edge from the Round/Bevel modifier being picked. */
  togglePickedEdge(fingerprint: EdgeFingerprint): void
}

export function createEdgeActions(store: BloKadeStore): EdgeActions {
  const state = () => store.getState()
  return {
    startPickingEdges: (nodeId, modifierId) => state().setPickingEdges({ nodeId, modifierId }),
    stopPickingEdges: () => state().setPickingEdges(null),
    togglePickedEdge: (fingerprint) => {
      const { pickingEdges, edgeCandidates, history } = state()
      if (!pickingEdges) return
      const nodes = history.present.nodes
      const node = Object.hasOwn(nodes, pickingEdges.nodeId) ? nodes[pickingEdges.nodeId] : undefined
      const modifier = node ? modifiersOf(node).find((m) => m.id === pickingEdges.modifierId) : undefined
      if (!modifier || (modifier.type !== 'fillet' && modifier.type !== 'chamfer')) return
      // The first click by hand starts from the edges the description ("Top edges"…) was choosing.
      const current = modifier.edges.by === 'picked'
        ? modifier.edges.fingerprints
        : (edgeCandidates ?? []).filter((c) => c.picked).map((c) => c.fingerprint)
      state().apply((doc) => setPickedEdges(doc, pickingEdges.nodeId, pickingEdges.modifierId, togglePicked(current, fingerprint)))
    },
  }
}
```

- [ ] **Step 5: Write `src/app/useEdgeCandidates.ts`**

```ts
import { useEffect } from 'react'
import { modifiersOf } from '../document/modifiers'
import type { GeometryClient } from '../geometry/client'
import type { BloKadeStore } from '../store/store'

const NO_EDGES = "BloKade couldn't find this part's edges. Try again."

function pickingStillValid(store: BloKadeStore): boolean {
  const { pickingEdges, history } = store.getState()
  if (!pickingEdges) return false
  const nodes = history.present.nodes
  const node = Object.hasOwn(nodes, pickingEdges.nodeId) ? nodes[pickingEdges.nodeId] : undefined
  const modifier = node ? modifiersOf(node).find((m) => m.id === pickingEdges.modifierId) : undefined
  return modifier?.type === 'fillet' || modifier?.type === 'chamfer'
}

/** While Kade is picking edges, asks the worker for the clickable edges (again after every design change). */
export function useEdgeCandidates(store: BloKadeStore, client: Pick<GeometryClient, 'edgeCandidates'>): void {
  useEffect(() => {
    const refresh = (): void => {
      const { pickingEdges, history } = store.getState()
      if (!pickingEdges) return
      if (!pickingStillValid(store)) {
        store.getState().setPickingEdges(null)
        return
      }
      const stillCurrent = (): boolean => store.getState().pickingEdges === pickingEdges && store.getState().history.present === history.present
      client.edgeCandidates(history.present, pickingEdges.nodeId, pickingEdges.modifierId).then(
        (candidates) => { if (stillCurrent()) store.getState().setEdgeCandidates(candidates) },
        (error: unknown) => {
          if (!stillCurrent()) return
          store.getState().setPickingEdges(null)
          store.getState().notify(error instanceof Error && error.message ? error.message : NO_EDGES)
        },
      )
    }
    refresh()
    return store.subscribe((next, prev) => {
      if (next.pickingEdges !== prev.pickingEdges || (next.pickingEdges && next.history.present !== prev.history.present)) refresh()
    })
  }, [store, client])
}
```

- [ ] **Step 6: Wire the actions into `src/app/actions.ts`**

```ts
import { createEdgeActions, type EdgeActions } from './edge-actions'
```

Change the declaration to `export interface Actions extends EdgeActions {`, keeping its members unchanged. In `createActions`, spread `...createEdgeActions(store),` at the top of the returned object, and change `cancel`:

```ts
    cancel: () => {
      const s = state()
      if (s.pickingEdges) s.setPickingEdges(null)
      else if (s.pickingWorkplane) s.setPickingWorkplane(false)
      else s.select([])
    },
```

If `src/app/shortcuts.test.ts` builds a mock with `satisfies Actions`, add `startPickingEdges`, `stopPickingEdges` and `togglePickedEdge` mocks there.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS and typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "feat: track modifier warnings and edge picking in the store"
```

---

### Task 9: The modifier stack in the Properties panel and the scene tree

**Files:**
- Create: `src/ui/modifier-icons.ts`, `src/ui/ModifierStack.tsx`, `src/ui/ModifierCard.tsx`, `src/ui/ModifierFields.tsx`
- Modify: `src/ui/PropertiesPanel.tsx`, `src/ui/SceneTree.tsx`, `src/ui/App.css`
- Test: `src/ui/ModifierStack.test.tsx`, `src/ui/SceneTree.test.tsx`

**Interfaces:**
- Consumes:
  - Task 2's ops and labels.
  - From Task 3: `modifierField`, `formulaOf`, and `setFieldInput` through PropertiesPanel's `setField`.
  - From Task 8: store `modifierWarnings` and `pickingEdges` / `setPickingEdges`.
  - `ValueField`.
- Produces: `ModifierStack({ node, errors, setField })`, rendered under Placement for a single selected part. Test ids, where `<i>` is the 0-based position in the stack:
  - `add-modifier` (select)
  - `modifier-<i>`
  - `mod-enabled-<i>`, `mod-up-<i>`, `mod-down-<i>`, `mod-delete-<i>`
  - `mod-warning-<i>`
  - `mod-radius-<i>`, `mod-distance-<i>`
  - `mod-edges-<i>` (select), `mod-pick-<i>`, `mod-picked-<i>`
  - `mod-count-<i>`
  - `mod-spacing-x|y|z-<i>`
  - `mod-angle-<i>`, `mod-axis-<i>` (select), `mod-center-x|y|z-<i>`
  - `mod-plane-<i>` (select), `mod-keep-<i>` (checkbox)
  - Scene tree: `tree-mods-<nodeId>`

- [ ] **Step 1: Write the failing test `src/ui/ModifierStack.test.tsx`**

```tsx
// @vitest-environment jsdom
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createActions } from '../app/actions'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument } from '../document/factory'
import { registry } from '../plugins/index'
import { createBloKadeStore } from '../store/store'
import { PropertiesPanel } from './PropertiesPanel'

function setup() {
  const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
  const actions = createActions(store, registry)
  renderWithStore(<PropertiesPanel registry={registry} />, store)
  act(() => actions.addShape('box'))
  const mods = () => {
    const id = store.getState().selection[0]
    return (id ? store.getState().history.present.nodes[id]?.modifiers : undefined) ?? []
  }
  return { store, mods }
}

async function setField(testId: string, text: string) {
  await userEvent.clear(screen.getByTestId(testId))
  await userEvent.type(screen.getByTestId(testId), `${text}{Enter}`)
}

describe('ModifierStack', () => {
  it('adds a Round edges modifier and changes its size', async () => {
    const { mods } = setup()
    await userEvent.selectOptions(screen.getByTestId('add-modifier'), 'fillet')
    expect(mods()).toMatchObject([{ type: 'fillet', radius: 2 }])
    await setField('mod-radius-0', '3')
    expect(mods()[0]).toMatchObject({ radius: 3 })
    await setField('mod-radius-0', '9999')
    expect(mods()[0]).toMatchObject({ radius: 500 })
  })

  it('takes formulas in modifier fields', async () => {
    const { store, mods } = setup()
    act(() => store.getState().apply((d) => ({ ...d, variables: [{ name: 'n', expr: '4' }] })))
    await userEvent.selectOptions(screen.getByTestId('add-modifier'), 'linearPattern')
    await setField('mod-count-0', 'n + 1')
    expect(mods()[0]).toMatchObject({ count: 5 })
    expect(screen.getByTestId('mod-count-0-value')).toHaveTextContent('= 5')
    await setField('mod-spacing-y-0', '12')
    expect(mods()[0]).toMatchObject({ spacing: [25, 12, 0] })
  })

  it('switches, reorders and deletes modifiers', async () => {
    const { mods } = setup()
    await userEvent.selectOptions(screen.getByTestId('add-modifier'), 'fillet')
    await userEvent.selectOptions(screen.getByTestId('add-modifier'), 'mirror')
    await userEvent.click(screen.getByTestId('mod-enabled-0'))
    expect(mods()[0]).toMatchObject({ enabled: false })
    await userEvent.click(screen.getByTestId('mod-up-1'))
    expect(mods().map((m) => m.type)).toEqual(['mirror', 'fillet'])
    expect(screen.getByTestId('mod-up-0')).toBeDisabled()
    await userEvent.click(screen.getByTestId('mod-delete-0'))
    expect(mods().map((m) => m.type)).toEqual(['fillet'])
  })

  it('chooses edges by description, and starts picking edges by hand', async () => {
    const { store, mods } = setup()
    await userEvent.selectOptions(screen.getByTestId('add-modifier'), 'chamfer')
    await userEvent.selectOptions(screen.getByTestId('mod-edges-0'), 'bottom')
    expect(mods()[0]).toMatchObject({ edges: { by: 'description', which: 'bottom' } })
    await userEvent.click(screen.getByTestId('mod-pick-0'))
    expect(store.getState().pickingEdges).toMatchObject({ modifierId: mods()[0]?.id })
    expect(screen.getByTestId('mod-pick-0')).toHaveTextContent('Done picking')
    await userEvent.click(screen.getByTestId('mod-pick-0'))
    expect(store.getState().pickingEdges).toBeNull()
  })

  it('edits circle and mirror settings', async () => {
    const { mods } = setup()
    await userEvent.selectOptions(screen.getByTestId('add-modifier'), 'circularPattern')
    await userEvent.selectOptions(screen.getByTestId('mod-axis-0'), 'x')
    await setField('mod-angle-0', '90')
    await setField('mod-center-x-0', '-30')
    expect(mods()[0]).toMatchObject({ axis: 'x', angle: 90, center: [-30, 0, 0] })
    await userEvent.selectOptions(screen.getByTestId('add-modifier'), 'mirror')
    await userEvent.selectOptions(screen.getByTestId('mod-plane-1'), 'XY')
    await userEvent.click(screen.getByTestId('mod-keep-1'))
    expect(mods()[1]).toMatchObject({ plane: 'XY', keepOriginal: false })
  })

  it('shows warnings from the last build', async () => {
    const { store, mods } = setup()
    await userEvent.selectOptions(screen.getByTestId('add-modifier'), 'fillet')
    const nodeId = store.getState().selection[0] ?? ''
    act(() => store.getState().applyBuild('d', { nodes: {}, warnings: { [nodeId]: { [mods()[0]?.id ?? '']: 'Lost track of 1 edge' } } }))
    expect(screen.getByTestId('mod-warning-0')).toHaveTextContent('Lost track of 1 edge')
  })
})
```

Add to `src/ui/SceneTree.test.tsx`. Reuse its setup; import `addModifier` from `../document/modifiers`.

```tsx
  it('shows the modifiers a part has', () => {
    const { store } = setup()
    const id = store.getState().history.present.root[0]
    if (!id) throw new Error('needs a part')
    act(() => store.getState().apply((d) => addModifier(d, id, 'fillet').doc))
    expect(screen.getByTestId(`tree-mods-${id}`)).toHaveAttribute('title', 'Round edges')
  })
```

If SceneTree's `setup()` starts with an empty design, add one part with `actions.addShape('box')` or `addNode` before the modifier, following the pattern the file already uses.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/ModifierStack.test.tsx src/ui/SceneTree.test.tsx`
Expected: FAIL. `add-modifier` and `tree-mods-*` are not found.

- [ ] **Step 3: Write `src/ui/modifier-icons.ts`**

```ts
import type { EdgeWhich, MirrorPlane, ModifierType, PatternAxis } from '../document/types'

export const MODIFIER_ICONS: Readonly<Record<ModifierType, string>> = {
  fillet: '◠',
  chamfer: '◿',
  linearPattern: '⋯',
  circularPattern: '✲',
  mirror: '⇋',
}

export const EDGE_OPTIONS: readonly { value: EdgeWhich; label: string }[] = [
  { value: 'top', label: 'Top edges' },
  { value: 'bottom', label: 'Bottom edges' },
  { value: 'vertical', label: 'Upright edges' },
  { value: 'horizontal', label: 'Flat edges' },
  { value: 'all', label: 'All edges' },
]

export const PLANE_OPTIONS: readonly { value: MirrorPlane; label: string }[] = [
  { value: 'YZ', label: 'Left ↔ right' },
  { value: 'XZ', label: 'Front ↔ back' },
  { value: 'XY', label: 'Top ↕ bottom' },
]

export const AXIS_OPTIONS: readonly { value: PatternAxis; label: string }[] = [
  { value: 'z', label: 'Up (Z)' },
  { value: 'x', label: 'Left–right (X)' },
  { value: 'y', label: 'Front–back (Y)' },
]
```

- [ ] **Step 4: Write `src/ui/ModifierFields.tsx`**

```tsx
import { formulaOf, modifierField } from '../document/fields'
import { setEdgeSelection, setMirror, setPatternAxis } from '../document/modifiers'
import type { ChamferModifier, EdgeWhich, FieldKey, FilletModifier, Modifier, ModifierField, SceneNode, Vec3 } from '../document/types'
import { useBloKade } from '../store/context'
import { AXIS_OPTIONS, EDGE_OPTIONS, PLANE_OPTIONS } from './modifier-icons'
import { ValueField } from './ValueField'

export interface ModifierFieldsProps {
  node: SceneNode
  modifier: Modifier
  index: number
  errors: Readonly<Record<string, string>>
  setField(key: FieldKey, text: string): void
}

const AXES = [['x', 0], ['y', 1], ['z', 2]] as const

function NumberInput({ node, modifier, index, errors, setField, field, label, value }: ModifierFieldsProps & {
  field: ModifierField; label: string; value: number
}) {
  const key = modifierField(modifier.id, field)
  return <ValueField label={label} value={value} formula={formulaOf(node, key)} error={errors[key]}
    testId={`mod-${field}-${index}`} onCommit={(text) => setField(key, text)} />
}

function VectorInput({ node, modifier, index, errors, setField, field, label, value }: ModifierFieldsProps & {
  field: 'spacing' | 'center'; label: string; value: Vec3
}) {
  return (
    <>
      <h4>{label}</h4>
      <div className="field-row">
        {AXES.map(([axis, i]) => {
          const key = modifierField(modifier.id, field, i)
          return <ValueField key={axis} label={axis} value={value[i]} formula={formulaOf(node, key)} error={errors[key]}
            testId={`mod-${field}-${axis}-${index}`} onCommit={(text) => setField(key, text)} />
        })}
      </div>
    </>
  )
}

function EdgeChoice({ node, modifier, index }: { node: SceneNode; modifier: FilletModifier | ChamferModifier; index: number }) {
  const apply = useBloKade((s) => s.apply)
  const picking = useBloKade((s) => s.pickingEdges)
  const setPicking = useBloKade((s) => s.setPickingEdges)
  const active = picking?.nodeId === node.id && picking.modifierId === modifier.id
  const value = active || modifier.edges.by === 'picked' ? 'picked' : modifier.edges.which
  const choose = (next: string): void => {
    if (next === 'picked') {
      setPicking({ nodeId: node.id, modifierId: modifier.id })
      return
    }
    apply((d) => setEdgeSelection(d, node.id, modifier.id, { by: 'description', which: next as EdgeWhich }))
    if (active) setPicking(null)
  }
  return (
    <>
      <label className="field">
        <span>Which edges</span>
        <select data-testid={`mod-edges-${index}`} value={value} onChange={(e) => choose(e.target.value)}>
          {EDGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          <option value="picked">Edges I pick</option>
        </select>
      </label>
      <button type="button" className="tool-button" data-testid={`mod-pick-${index}`} aria-pressed={active}
        onClick={() => setPicking(active ? null : { nodeId: node.id, modifierId: modifier.id })}>
        {active ? 'Done picking' : '👆 Pick edges'}
      </button>
      {modifier.edges.by === 'picked' && (
        <p className="hint" data-testid={`mod-picked-${index}`}>
          {modifier.edges.fingerprints.length} {modifier.edges.fingerprints.length === 1 ? 'edge' : 'edges'} picked
        </p>
      )}
    </>
  )
}

export function ModifierFields(props: ModifierFieldsProps) {
  const { node, modifier: m, index } = props
  const apply = useBloKade((s) => s.apply)
  switch (m.type) {
    case 'fillet':
      return <><NumberInput {...props} field="radius" label="Roundness (mm)" value={m.radius} /><EdgeChoice node={node} modifier={m} index={index} /></>
    case 'chamfer':
      return <><NumberInput {...props} field="distance" label="Bevel size (mm)" value={m.distance} /><EdgeChoice node={node} modifier={m} index={index} /></>
    case 'linearPattern':
      return <><NumberInput {...props} field="count" label="How many" value={m.count} /><VectorInput {...props} field="spacing" label="Step between copies (mm)" value={m.spacing} /></>
    case 'circularPattern':
      return (
        <>
          <NumberInput {...props} field="count" label="How many" value={m.count} />
          <NumberInput {...props} field="angle" label="Spread over (°)" value={m.angle} />
          <label className="field">
            <span>Turn around</span>
            <select data-testid={`mod-axis-${index}`} value={m.axis}
              onChange={(e) => apply((d) => setPatternAxis(d, node.id, m.id, e.target.value as typeof m.axis))}>
              {AXIS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <VectorInput {...props} field="center" label="Center (mm, from the part's middle)" value={m.center} />
        </>
      )
    case 'mirror':
      return (
        <>
          <label className="field">
            <span>Flip</span>
            <select data-testid={`mod-plane-${index}`} value={m.plane}
              onChange={(e) => apply((d) => setMirror(d, node.id, m.id, { plane: e.target.value as typeof m.plane }))}>
              {PLANE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="checkbox-field">
            <input type="checkbox" data-testid={`mod-keep-${index}`} checked={m.keepOriginal}
              onChange={(e) => apply((d) => setMirror(d, node.id, m.id, { keepOriginal: e.target.checked }))} />
            Keep the original too
          </label>
        </>
      )
  }
}
```

The `mod-<field>-<index>` test-id pattern means the size fields are `mod-radius-<i>`, `mod-distance-<i>`, `mod-count-<i>` and `mod-angle-<i>`. The vector fields are `mod-spacing-x-<i>` and `mod-center-x-<i>`.

- [ ] **Step 5: Write `src/ui/ModifierCard.tsx`**

```tsx
import { MODIFIER_LABELS } from '../document/modifiers'
import { ModifierFields, type ModifierFieldsProps } from './ModifierFields'
import { MODIFIER_ICONS } from './modifier-icons'

interface ModifierCardProps extends ModifierFieldsProps {
  last: boolean
  warning?: string
  onEnabled(enabled: boolean): void
  onMove(delta: -1 | 1): void
  onRemove(): void
}

export function ModifierCard(props: ModifierCardProps) {
  const { modifier: m, index, last, warning } = props
  const label = MODIFIER_LABELS[m.type]
  return (
    <li className="modifier-card" data-testid={`modifier-${index}`}>
      <div className="modifier-head">
        <label className="modifier-title">
          <input type="checkbox" data-testid={`mod-enabled-${index}`} checked={m.enabled} aria-label={`Use ${label}`}
            onChange={(e) => props.onEnabled(e.target.checked)} />
          <span aria-hidden="true">{MODIFIER_ICONS[m.type]}</span> {label}
        </label>
        <button type="button" className="icon-button" data-testid={`mod-up-${index}`} aria-label={`Move ${label} up`}
          disabled={index === 0} onClick={() => props.onMove(-1)}>↑</button>
        <button type="button" className="icon-button" data-testid={`mod-down-${index}`} aria-label={`Move ${label} down`}
          disabled={last} onClick={() => props.onMove(1)}>↓</button>
        <button type="button" className="icon-button" data-testid={`mod-delete-${index}`} aria-label={`Delete ${label}`}
          onClick={props.onRemove}>🗑</button>
      </div>
      {warning && <p className="field-error" data-testid={`mod-warning-${index}`}>⚠ {warning}</p>}
      {m.enabled && <ModifierFields {...props} />}
    </li>
  )
}
```

- [ ] **Step 6: Write `src/ui/ModifierStack.tsx`**

```tsx
import { addModifier, MODIFIER_LABELS, MODIFIER_TYPES, modifiersOf, moveModifier, removeModifier, setModifierEnabled } from '../document/modifiers'
import type { FieldKey, ModifierType, SceneNode } from '../document/types'
import { useBloKade } from '../store/context'
import { ModifierCard } from './ModifierCard'
import { MODIFIER_ICONS } from './modifier-icons'

interface ModifierStackProps {
  node: SceneNode
  errors: Readonly<Record<string, string>>
  setField(key: FieldKey, text: string): void
}

/** Round edges, repeat and mirror for one part, applied top to bottom. */
export function ModifierStack({ node, errors, setField }: ModifierStackProps) {
  const apply = useBloKade((s) => s.apply)
  const warnings = useBloKade((s) => (Object.hasOwn(s.modifierWarnings, node.id) ? s.modifierWarnings[node.id] : undefined))
  const modifiers = modifiersOf(node)
  const add = (type: ModifierType): void => apply((d) => addModifier(d, node.id, type).doc)
  return (
    <div className="modifier-stack">
      <h3>Modifiers</h3>
      {modifiers.length === 0 && <p className="hint">Round its edges, repeat it, or mirror it.</p>}
      <ol className="modifier-list">
        {modifiers.map((m, index) => (
          <ModifierCard key={m.id} node={node} modifier={m} index={index} last={index === modifiers.length - 1}
            warning={warnings && Object.hasOwn(warnings, m.id) ? warnings[m.id] : undefined}
            errors={errors} setField={setField}
            onEnabled={(enabled) => apply((d) => setModifierEnabled(d, node.id, m.id, enabled))}
            onMove={(delta) => apply((d) => moveModifier(d, node.id, m.id, delta))}
            onRemove={() => apply((d) => removeModifier(d, node.id, m.id))} />
        ))}
      </ol>
      <select className="add-modifier" data-testid="add-modifier" aria-label="Add a modifier" value=""
        onChange={(e) => { if (e.target.value) add(e.target.value as ModifierType) }}>
        <option value="">+ Add a modifier…</option>
        {MODIFIER_TYPES.map((t) => <option key={t} value={t}>{MODIFIER_ICONS[t]} {MODIFIER_LABELS[t]}</option>)}
      </select>
    </div>
  )
}
```

- [ ] **Step 7: Render it in `src/ui/PropertiesPanel.tsx` and the scene tree**

In `PropertiesPanel.tsx`, import `ModifierStack` and render it after `Placement` in the single-part view:

```tsx
      <ModifierStack key={`mods-${node.id}`} node={node} errors={nodeErrors} setField={setField} />
```

In `SceneTree.tsx` `TreeItem`, import `modifiersOf` and `MODIFIER_LABELS` from `../document/modifiers`, and `MODIFIER_ICONS` from `./modifier-icons`. Before the `{error && …badge…}` line, add:

```tsx
        {modifiersOf(node).length > 0 && (
          <span className="tree-mods" data-testid={`tree-mods-${id}`}
            title={modifiersOf(node).map((m) => MODIFIER_LABELS[m.type]).join(', ')}>
            {modifiersOf(node).filter((m) => m.enabled).map((m) => MODIFIER_ICONS[m.type]).join('')}
          </span>
        )}
```

Add to `src/ui/App.css`:

```css
.modifier-list { list-style: none; margin: 6px 0; padding: 0; }
.modifier-card { border: 1px solid var(--line, #d5dbe5); border-radius: 8px; padding: 6px 8px; margin-bottom: 6px; }
.modifier-head { display: flex; align-items: center; gap: 4px; }
.modifier-title { flex: 1; display: flex; align-items: center; gap: 6px; font-weight: 600; }
.modifier-stack h4 { margin: 6px 0 2px; font-size: 0.8rem; color: var(--muted); }
.add-modifier { width: 100%; margin-top: 4px; }
.checkbox-field { display: flex; align-items: center; gap: 6px; margin: 4px 0; }
.tree-mods { margin-left: 4px; color: var(--muted); font-size: 0.85rem; }
```

Use the border variable the stylesheet already defines. If `--line` doesn't exist, use whatever variable the panel borders use.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS and typecheck clean. Each new `.tsx` file stays under 400 lines, and each component function under 50 lines. If `ModifierFields` goes over, split the circle and mirror cases into their own small components in the same file.

- [ ] **Step 9: Commit**

```bash
git add src/ui
git commit -m "feat: show and edit each part's modifier stack"
```

---

### Task 10: Clicking edges in the 3D view

**Files:**
- Create: `src/viewport/edge-points.ts`, `src/viewport/EdgeOverlay.tsx`
- Modify: `src/viewport/NodeMesh.tsx`, `src/viewport/Viewport.tsx`, `src/ui/Workspace.tsx`, `src/ui/App.css`
- Test: `src/viewport/edge-points.test.ts`

**Interfaces:**
- Consumes:
  - From Task 8: store `pickingEdges`, `edgeCandidates` and `setPickingEdges`, plus `Actions.togglePickedEdge` and `useEdgeCandidates`.
  - `worldMatrix` from Milestone 1.
- Produces:
  - `pointsOf(flat: readonly number[]): [number, number, number][]`
  - `EdgeOverlay({ onToggle })`
  - `Viewport({ registry, onToggleEdge })`
  - `NodeMesh({ …, passive? })`

- [ ] **Step 1: Write the failing test `src/viewport/edge-points.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { pointsOf } from './edge-points'

describe('pointsOf', () => {
  it('groups flat numbers into points and drops a trailing partial point', () => {
    expect(pointsOf([0, 0, 0, 1, 2, 3])).toEqual([[0, 0, 0], [1, 2, 3]])
    expect(pointsOf([0, 0, 0, 1, 2])).toEqual([[0, 0, 0]])
    expect(pointsOf([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/viewport/edge-points.test.ts`
Expected: FAIL, because the module is missing.

- [ ] **Step 3: Write `src/viewport/edge-points.ts`**

```ts
/** Flat x,y,z numbers → points for drei's <Line>. */
export function pointsOf(flat: readonly number[]): [number, number, number][] {
  return Array.from({ length: Math.floor(flat.length / 3) }, (_, i) => [flat[i * 3] ?? 0, flat[i * 3 + 1] ?? 0, flat[i * 3 + 2] ?? 0])
}
```

- [ ] **Step 4: Write `src/viewport/EdgeOverlay.tsx`**

```tsx
import { Line } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useMemo } from 'react'
import { worldMatrix } from '../document/transform-math'
import type { EdgeFingerprint } from '../document/types'
import { useBloKade } from '../store/context'
import { pointsOf } from './edge-points'

const PICKED = '#ff8a00'
const CANDIDATE = '#2f80ed'

/** While picking edges: every edge of the part as a thick line; clicking one adds or removes it. */
export function EdgeOverlay({ onToggle }: { onToggle(fingerprint: EdgeFingerprint): void }) {
  const picking = useBloKade((s) => s.pickingEdges)
  const candidates = useBloKade((s) => s.edgeCandidates)
  const doc = useBloKade((s) => s.history.present)
  const matrix = useMemo(
    () => (picking && Object.hasOwn(doc.nodes, picking.nodeId) ? worldMatrix(doc, picking.nodeId) : null),
    [doc, picking],
  )
  if (!picking || !candidates || !matrix) return null
  return (
    <group matrix={matrix} matrixAutoUpdate={false}>
      {candidates.map((c, i) => (
        <Line key={i} points={pointsOf(c.points)} color={c.picked ? PICKED : CANDIDATE} lineWidth={c.picked ? 6 : 4}
          onClick={(event: ThreeEvent<MouseEvent>) => {
            event.stopPropagation()
            onToggle(c.fingerprint)
          }} />
      ))}
    </group>
  )
}
```

- [ ] **Step 5: Make parts passive while picking (`src/viewport/NodeMesh.tsx`)**

Add a prop:

```ts
  /** Set while picking edges: clicks pass through to the edge lines and don't select the part. */
  passive?: boolean
```

Destructure `passive`, and make it the first line of `handleClick`, before `event.stopPropagation()`:

```ts
    if (passive) return
```

- [ ] **Step 6: Wire it into `src/viewport/Viewport.tsx`**

- Change the props to `{ registry, onToggleEdge }: { registry: PluginRegistry; onToggleEdge(fingerprint: EdgeFingerprint): void }`. Import `EdgeFingerprint` and `EdgeOverlay`.
- Read `const pickingEdges = useBloKade((s) => s.pickingEdges)` and `const setPickingEdges = useBloKade((s) => s.setPickingEdges)`.
- At the start of `onPointerMissed`, add `if (pickingEdges) { setPickingEdges(null); return }`.
- Pass `passive={pickingEdges !== null}` to every `NodeMesh`.
- Render `<EdgeOverlay onToggle={onToggleEdge} />` after the meshes.
- Render `TransformHandles` only when `!pickingEdges`.
- Add this hint next to the workplane hint:

```tsx
      {pickingEdges && <div className="viewport-hint" role="status">Click edges to choose them. Click empty space or press Esc when you're done.</div>}
```

- [ ] **Step 7: Wire it into `src/ui/Workspace.tsx`**

Add `useEdgeCandidates(store, deps.client)` next to `useGeometrySync`, and change the viewport line to:

```tsx
        <Viewport registry={deps.registry} onToggleEdge={actions.togglePickedEdge} />
```

- [ ] **Step 8: Run tests, typecheck and build**

Run: `npx vitest run && npm run typecheck && npm run build`
Expected: all PASS; typecheck and build are clean. If drei's `Line` `onClick` event type differs, use the type its props declare and note it in your report.

- [ ] **Step 9: Commit**

```bash
git add src
git commit -m "feat: pick edges to round by clicking them"
```

The controller checks this in a browser:
- Add a box and Round edges, then press 👆 Pick edges. Blue edge lines appear, and the top four are orange.
- Clicking a side edge turns it orange, and the box gets rounded there after the rebuild. Clicking an orange edge removes it.
- Esc or clicking empty space stops picking.
- Resize the box: the picked edges stay rounded.

---

### Task 11: STEP export button

**Files:**
- Modify: `src/app/export.ts`, `src/persistence/design-file.ts`, `src/ui/Toolbar.tsx`
- Test: `src/app/export.test.ts`, `src/ui/Toolbar.test.tsx`

**Interfaces:**
- Consumes: `GeometryClient.exportStep` (Task 7).
- Produces:
  - `ExportFormat = 'stl' | '3mf' | 'step'`
  - `fileNameFor(doc, 'step')`
  - Toolbar button `export-step`

- [ ] **Step 1: Write the failing tests**

Add to `src/app/export.test.ts`, following the shape of its existing STL test:

```ts
  it('exports STEP with the design name', async () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument('Robot Arm') })
    const download = vi.fn()
    const exportStep = vi.fn(async () => new ArrayBuffer(4))
    await exportDesign({ client: { exportStl: vi.fn(), export3mf: vi.fn(), exportStep }, store, format: 'step', download })
    expect(exportStep).toHaveBeenCalled()
    expect(download).toHaveBeenCalledWith(expect.any(ArrayBuffer), 'robot-arm.step', 'model/step')
  })
```

Add to `src/ui/Toolbar.test.tsx`:

```tsx
  it('exports STEP', async () => {
    const { onExport } = setup()
    await userEvent.click(screen.getByTestId('export-step'))
    expect(onExport).toHaveBeenCalledWith('step')
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/export.test.ts src/ui/Toolbar.test.tsx`
Expected: FAIL, because `'step'` is not supported yet.

- [ ] **Step 3: Implement**

`src/persistence/design-file.ts`: widen the parameter to `extension: 'blokade' | 'stl' | '3mf' | 'step'`.

`src/app/export.ts`:

```ts
export type ExportFormat = 'stl' | '3mf' | 'step'

const MIME: Record<ExportFormat, string> = { stl: 'model/stl', '3mf': 'model/3mf', step: 'model/step' }
```

Change the `client` type to `Pick<GeometryClient, 'exportStl' | 'export3mf' | 'exportStep'>`, and choose the call with:

```ts
    const exporters: Record<ExportFormat, () => Promise<ArrayBuffer>> = {
      stl: () => input.client.exportStl(doc, ids),
      '3mf': () => input.client.export3mf(doc, ids),
      step: () => input.client.exportStep(doc, ids),
    }
    const data = await exporters[input.format]()
```

If other tests in `export.test.ts` pass a client without `exportStep`, add `exportStep: vi.fn()` to them.

`src/ui/Toolbar.tsx`: after the 3MF button, add:

```tsx
        <button type="button" className="tool-button" data-testid="export-step" title="STEP: for other CAD programs" onClick={() => onExport('step')}>⬇ STEP</button>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: all PASS and typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: export designs as STEP"
```

---

### Task 12: End-to-end tests for Round & Repeat

**Files:**
- Create: `e2e/round-repeat.spec.ts`

**Interfaces:**
- Consumes these test ids from Tasks 9–11: `add-modifier`, `mod-radius-0`, `mod-edges-0`, `mod-count-0`, `mod-spacing-x-0`, `modifier-0`, `export-stl`, `export-step`, `param-width`, `param-diameter`, `mode-hole`, `group`, and the tree items.

- [ ] **Step 1: Write `e2e/round-repeat.spec.ts`**

```ts
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

async function setField(page: Page, testId: string, value: string) {
  await page.getByTestId(testId).fill(value)
  await page.getByTestId(testId).press('Enter')
}

async function downloadBytes(page: Page, testId: string): Promise<Buffer> {
  const downloading = page.waitForEvent('download')
  await page.getByTestId(testId).click()
  return readFile(await (await downloading).path())
}

/** Smallest and largest X over every vertex of a binary STL. */
function stlXRange(bytes: Buffer): [number, number] {
  const triangles = bytes.readUInt32LE(80)
  const xs = Array.from({ length: triangles * 3 }, (_, i) => {
    const triangle = Math.floor(i / 3)
    return bytes.readFloatLE(84 + triangle * 50 + 12 + (i % 3) * 12)
  })
  return [Math.min(...xs), Math.max(...xs)]
}

test('box with a hole, grouped, top edges rounded, exported (spec §8 flow)', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('add-box').click()
  await setField(page, 'param-width', '30')
  await page.getByTestId('add-cylinder').click()
  await setField(page, 'param-diameter', '10')
  await page.getByTestId('mode-hole').click()
  await page.getByRole('treeitem', { name: 'Box' }).click()
  await page.getByRole('treeitem', { name: 'Cylinder' }).click({ modifiers: ['Shift'] })
  await page.getByTestId('group').click()
  await page.getByRole('treeitem', { name: 'Group' }).click()

  await page.getByTestId('add-modifier').selectOption('fillet')
  await setField(page, 'mod-radius-0', '1')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
  await expect(page.getByTestId('mod-warning-0')).toHaveCount(0)

  const bytes = await downloadBytes(page, 'export-stl')
  const triangles = bytes.readUInt32LE(80)
  expect(triangles).toBeGreaterThan(200)
  expect(bytes.length).toBe(84 + triangles * 50)
})

test('repeat a box in a row of three', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('add-box').click()
  await page.getByTestId('add-modifier').selectOption('linearPattern')
  await setField(page, 'mod-count-0', '3')
  await setField(page, 'mod-spacing-x-0', '25')
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()

  await expect(async () => {
    const [x0, x1] = stlXRange(await downloadBytes(page, 'export-stl'))
    expect(x0).toBeCloseTo(-10, 1)
    expect(x1).toBeCloseTo(60, 1)
  }).toPass({ timeout: 20_000 })
})

test('export STEP for other CAD programs', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('add-box').click()
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()
  const bytes = await downloadBytes(page, 'export-step')
  expect(bytes.subarray(0, 12).toString('ascii')).toBe('ISO-10303-21')
})

test('modifiers survive a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('add-box').click()
  await page.getByTestId('add-modifier').selectOption('chamfer')
  await page.getByTestId('mod-edges-0').selectOption('bottom')
  await page.waitForTimeout(1500) // autosave runs 1 s after the last change
  await page.reload()
  await page.getByRole('treeitem', { name: 'Box' }).click()
  await expect(page.getByTestId('modifier-0')).toContainText('Bevel edges')
  await expect(page.getByTestId('mod-edges-0')).toHaveValue('bottom')
})
```

- [ ] **Step 2: Run the end-to-end suite**

Run: `npm run e2e`
Expected: 9 passed (5 from earlier milestones and 4 new).

If a selector differs from the real UI, check the component source and make the smallest change to the test. If the app itself is wrong, don't patch it here: report DONE_WITH_CONCERNS with a reproduction.

- [ ] **Step 3: Commit**

```bash
git add e2e/round-repeat.spec.ts
git commit -m "test: add end-to-end Round & Repeat flows"
```

---

### Task 13: Docs and final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a "Round & repeat" section to `README.md`**

Put it under "Smart sizes":

```markdown
### Round & repeat

Select a part (or a group) and use **+ Add a modifier…** under Properties. Modifiers run top to bottom; use
↑ ↓ to change the order, the tick box to switch one off, and 🗑 to remove it.

- **◠ Round edges / ◿ Bevel edges:** pick *Top edges*, *Bottom edges*, *Upright edges*, *Flat edges* or
  *All edges*. To choose exact edges, press **👆 Pick edges** and click them in the 3D view (orange = chosen).
  BloKade remembers where they were, so they stay rounded when you resize the part. If an edge disappears,
  the modifier says "Lost track of an edge" and you can pick again.
- **⋯ Repeat in a row:** how many copies, and the step between them.
- **✲ Repeat in a circle:** how many copies, how far round (360° = all the way), which way to turn, and the
  center to turn around (measured from the part's middle).
- **⇋ Mirror:** flip left↔right, front↔back or top↕bottom, keeping the original or not.

Every modifier number takes formulas too, like `holes + 1`.

**⬇ STEP** saves the design for other CAD programs (Fusion 360, FreeCAD, Onshape…).
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
- Typecheck is clean.
- All unit tests pass.
- Coverage meets the thresholds.
- The build succeeds.
- All 9 end-to-end tests pass.

If coverage falls short, report the numbers and the files that pull it down. Don't lower thresholds and don't add filler tests.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: explain modifiers and STEP export"
```

---

## Milestone 3 Done When

- Any part or group can carry up to 10 modifiers. You can add, switch off, reorder and delete them from the Properties panel, and the scene tree shows their icons.
- **Round edges and Bevel edges:**
  - They work by description (top, bottom, upright, flat, all) and keep working after resizing.
  - They also work on edges picked by clicking. Picked edges are remembered by fingerprint and survive resizing.
  - Lost edges get a warning.
  - A rounding that is too big gets a plain-English message on that part only.
- **Repeat and Mirror:**
  - Repeat in a row and Repeat in a circle make up to 50 copies each. A stack is capped at 200 copies in total, and over that the part shows a friendly message.
  - Mirror flips across any of the three planes, and can keep or replace the original.
- **Formulas:** every modifier number accepts a formula.
- **Saved designs:**
  - Version 1 and 2 designs open unchanged.
  - Designs with modifiers survive reload and file save/load.
  - Files with modifier values that would hang the engine are refused as damaged.
- **Export:** STL, 3MF and STEP all export the modified shapes.
- **Checks:** typecheck, unit tests, coverage thresholds, the build and all 9 end-to-end tests pass.
