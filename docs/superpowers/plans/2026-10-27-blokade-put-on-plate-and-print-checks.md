# Put on plate and Print checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A one-click "Put on plate" (button, `D` key, and a button in the red fit-warning bar) and an on-demand "Check print" that reports floating pieces, thin walls and overhangs with coloured highlights.

**Architecture:** Put on plate is a pure document op (`src/document/plate.ts`) fed by the on-screen mesh boxes, like Line up. Print check runs in the geometry worker on the fused export shape: floating pieces come from the shape's separate solids; overhangs and thin walls come from pure triangle analysis (`src/geometry/print-analysis.ts`) that needs no OpenCascade. The result is stored with the document it was checked against and shown only while that document is current, like the overlap check.

**Tech Stack:** React 19, TypeScript 5.9 strict (`noUncheckedIndexedAccess`), Zustand 5, @react-three/fiber 9, replicad/OpenCascade in a Comlink worker, Vitest, Playwright (port 5199).

**Spec:** `docs/superpowers/specs/2026-10-27-blokade-put-on-plate-and-print-checks-design.md`

## Global Constraints

- Neither feature blocks saving or exporting.
- Text Kade sees uses no jargon ("manifold", "normals", "degrees from vertical" are banned).
- Print check runs in the geometry worker, never on the main thread.
- Put on plate touches only the selection (or, from the warning bar, only the parts off the plate). Nothing rotates or resizes. One undo step; no undo step if nothing moves.
- Thresholds, in one constants block in `src/geometry/print-analysis.ts`:
  `FLOAT_GAP = 0.05` mm, `OVERHANG_COS = Math.cos(Math.PI / 4)`, `PLATE_TOUCH = 0.05` mm, `MIN_OVERHANG_AREA = 4` mm², `THIN_WALL = 0.8` mm, `VERY_THIN_WALL = 0.4` mm, `THIN_TIME_LIMIT_MS = 5000`.
- Highlight colours: floating purple, thin walls yellow, overhangs orange; all distinct from `MISFIT_COLOR` (`#ff1a1a`) and the selection colour. Highlights use `raycast={() => null}`.
- Every new control needs a `help-texts.ts` entry matched by `data-help` or `data-testid` (the help coverage test enforces it).
- Positions written by Put on plate are tidied like `src/document/align.ts` (round to 1e-6, no `-0`).
- Immutable updates only; files small and focused; match surrounding comment density and naming.
- e2e: after committing a `ValueField`, wait with `toHaveValue` / `expect.poll` before typing the next value.

## Review Focus

1. A rounded box, sphere, cone, ring or text sitting on the plate must report **no** overhang — test in Task 3 (`print-check.test.ts`, "default shapes on the plate are all clear").
2. A lid resting exactly on a box (touching faces) is one piece, not floating — test in Task 3 ("touching parts are not floating").
3. An outer box wall triangle must not "see" the opposite wall of a 20 mm box as thin, and coplanar/adjacent triangles at distance ~0 must not count — test in Task 2 ("a 20 mm box has no thin walls").
4. A check result must disappear as soon as the design changes, and a stale result from an older design must never be stored — test in Task 4 ("ignores a result for a design that changed meanwhile").
5. `D` while typing in a field must not move parts — test in Task 1b ("D in a text field does nothing").

---

### Task 1: `putOnPlate` document op

**Files:**
- Create: `src/document/plate.ts`
- Test: `src/document/plate.test.ts`

**Interfaces:**
- Consumes: `Box` from `src/document/box.ts`; `updateNode` from `src/document/ops.ts`; `rootAncestorOf` from `src/document/tree.ts`; `Printer` from `src/printers/printers.ts`.
- Produces: `putOnPlate(doc: BloKadeDocument, boxes: Readonly<Record<NodeId, Box>>, ids: readonly NodeId[], printer: Printer | null): BloKadeDocument`

- [ ] **Step 1: Write the failing tests** in `plate.test.ts`, building documents with `createShapeNode`/`addNode`/`groupNodes` as `overlap.test.ts` does, and passing plain boxes:
  - "drops a raised part to the floor": box min z 10 → position z decreases by 10.
  - "lifts a sunken part to the floor": box min z −5 → z +5.
  - "pulls a part back inside each edge of the A1 mini": box x [85,105] → x shifts −15; y [−100,−80] → +10; checks all four edges.
  - "centres a part wider than the plate on that axis": box x [0,200] on 180 plate → its centre moves to x 0; y untouched if inside.
  - "only drops without a printer": `printer = null`, box x [500,520], min z 3 → only z changes.
  - "moves a whole group when a child is selected", and duplicates (child + its group) move once.
  - "moves selected holes too".
  - "skips parts with no box (hidden or not built)".
  - "returns the same document when nothing moves" (`toBe(doc)`).
  - "writes tidy numbers": a delta like 0.1+0.2 gives 0.3, and never `-0`.

- [ ] **Step 2: Run** `npx vitest run src/document/plate.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement `putOnPlate`** in `plate.ts`. Map ids through `rootAncestorOf`, dedupe, keep roots that have a box. Per part: `dz = -box.min[2]`; with a printer, per axis (half = size/2): if `max - min > 2*half` → `delta = -(min+max)/2`; else if `min < -half` → `-half - min`; else if `max > half` → `half - max`; else 0. Skip the `updateNode` when all deltas are 0. Reuse a tidy helper (export `tidy` from `align.ts` rather than copying it).

- [ ] **Step 4: Run** the same command — Expected: PASS. Then `npm run typecheck`.

- [ ] **Step 5: Commit** `git commit -m "feat: putOnPlate document op"`

### Task 1b: Put on plate button, `D` key and warning-bar button

**Files:**
- Create: `src/app/put-on-plate.ts`, `src/app/put-on-plate.test.ts`, `src/ui/PutOnPlateButton.tsx`
- Modify: `src/app/actions.ts` (add `putOnPlate(): void` to `Actions`), `src/app/shortcuts.ts` (+ its test), `src/ui/PropertiesPanel.tsx`, `src/viewport/Viewport.tsx` (warning bar), `src/help/help-texts.ts`, `README.md`, relevant existing UI tests

**Interfaces:**
- Consumes: `putOnPlate` (Task 1); `topLevelBoxes` (`src/viewport/bounds.ts`); `printerStore` / `printerById` (`src/printers/`); `misfits` result ids (`usePlateFit` → `fit.misfitIds`).
- Produces:
  - `putSelectionOnPlate(store: BloKadeStore, printer: Printer | null): void`
  - `putOnPlateIds(store: BloKadeStore, ids: readonly NodeId[], printer: Printer | null): void`
  - `Actions.putOnPlate()` (reads the current printer from `printerStore`)
  - `ShortcutAction` gains `'putOnPlate'`; plain `d` maps to it (Ctrl/Cmd+D stays duplicate).

- [ ] **Step 1: Write failing tests**
  - `put-on-plate.test.ts`: with a real store and a fake `meshes` entry, "puts the selection on the plate as one undo step" (z becomes 0, `history.past` grows by 1, `undo` restores); "does nothing with no selection" (history unchanged).
  - `shortcuts.test.ts`: `matchShortcut({key:'d', …no modifiers})` → `'putOnPlate'`; with `ctrlKey` → `'duplicate'`; "D in a text field does nothing" (target `{tagName:'INPUT'}` → null).
  - `PropertiesPanel` test: with one part selected, `getByTestId('put-on-plate')` exists; with 2 selected it exists; with none it doesn't.
  - `Viewport`/warning test (wherever the warning bar is unit-tested; else e2e in Task 5 covers it): the bar shows `data-testid="fit-put-on-plate"` only when a misfit is off the plate (not when only too tall).

- [ ] **Step 2: Run** `npx vitest run src/app src/ui/PropertiesPanel.test.tsx` — Expected: the new tests FAIL.

- [ ] **Step 3: Implement**
  - `put-on-plate.ts`: build boxes from `topLevelBoxes(history.present, meshes)` exactly as `align-selection.ts` does; call `apply((doc) => putOnPlate(doc, boxes, ids, printer))`.
  - `PutOnPlateButton`: `<button className="tool-button" data-testid="put-on-plate" title="Put on plate (D)">⬇ Put on plate</button>`, rendered in the single-part properties view (below Position) and in the multi-select view (above Line up).
  - Warning bar: `usePlateFit` additionally returns `offPlateIds: ReadonlySet<NodeId>`; when non-empty the bar shows `<button data-testid="fit-put-on-plate" data-help="fit-put-on-plate">Put on plate</button>` calling `putOnPlateIds(store, [...offPlateIds], printer)`.
  - Help texts: `'put-on-plate'` (tip "Drops the part onto the plate." / card "Puts the picked parts down on the plate, and back inside its edges if they hang off. Press D for the same thing.") and `'fit-put-on-plate'` (tip "Brings parts that hang off back onto the plate." / card along the same lines).
  - README: a **Put on plate** bullet in the features list next to the Printer line, and `| D | Put on plate |` in the shortcut table.

- [ ] **Step 4: Run** `npm test` and `npm run typecheck` — Expected: all pass (including the help coverage test).

- [ ] **Step 5: Commit** `git commit -m "feat: Put on plate button, D key and warning-bar button"`

### Task 2: Triangle analysis for overhangs and thin walls

**Files:**
- Create: `src/geometry/print-analysis.ts`, `src/geometry/print-analysis.test.ts`

**Interfaces:**
- Consumes: plain arrays only (no OpenCascade): `vertices: ArrayLike<number>`, `triangles: ArrayLike<number>` (as returned by replicad `shape.mesh()`).
- Produces:
  - the constants block from Global Constraints (exported)
  - `interface TriangleSoup { readonly vertices: ArrayLike<number>; readonly triangles: ArrayLike<number> }`
  - `overhangTriangles(soup: TriangleSoup, plateZ: number): { readonly picked: readonly number[]; readonly area: number }` — triangle indices facing down beyond 45° and not within `PLATE_TOUCH` of `plateZ` (all three vertices above `plateZ + PLATE_TOUCH`).
  - `thinTriangles(soup: TriangleSoup, now?: () => number): { readonly picked: readonly number[]; readonly veryThin: boolean; readonly finished: boolean }`
  - `pickedMesh(soup: TriangleSoup, picked: readonly number[]): MeshData` — un-indexed copy of those triangles with flat face normals and empty `edges`.

- [ ] **Step 1: Write failing tests** using hand-built soups (a helper that makes an axis-aligned box soup with outward-wound triangles):
  - "a box on the plate has no overhang"; "a box raised 5 mm reports its bottom" (area = width×depth); "a T-shape's arms overhang" (two boxes' soups concatenated: stem 10×10×20, bar 40×10×5 resting on it → area 400, the bar's whole underside, since a plain soup isn't fused; the stem's bottom at the plate is not counted).
  - "a 45° slope does not count, a 30°-from-flat underside does".
  - "a 20 mm box has no thin walls"; "a 0.5 mm plate is thin, not very thin"; "a 0.3 mm plate is very thin".
  - "stops the thin check when out of time": `now` returns 0 then 6000 → `finished: false`.
  - "pickedMesh copies only the picked triangles" (positions length = 9 × picked count).

- [ ] **Step 2: Run** `npx vitest run src/geometry/print-analysis.test.ts` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement.** Use each triangle's face normal from the cross product of its edges (not vertex normals). Overhang: `n.z < -OVERHANG_COS`. Thin walls — the algorithm the tests don't pin:
  - Build a uniform grid (cell size 1 mm, keyed by `"i,j,k"` in a `Map`) of triangle indices by each triangle's bounding box.
  - For each triangle, start at its centroid moved 1e-4 mm inward along `-n`; the ray is the segment of length `THIN_WALL` along `-n`.
  - Test only triangles in the cells the segment's bounding box covers. A hit counts when the hit triangle faces along the ray (`dot(n_hit, dir) > 0`, i.e. the ray leaves the solid), at distance `> 1e-3`. Use Möller–Trumbore.
  - Nearest such hit `< THIN_WALL` marks the triangle; `< VERY_THIN_WALL` sets `veryThin`.
  - Check `now()` every 500 triangles; past `THIN_TIME_LIMIT_MS` return `finished: false` with what was found so far.

- [ ] **Step 4: Run** the same command — Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "feat: overhang and thin-wall triangle analysis"`

### Task 3: `printCheck` in the geometry worker

**Files:**
- Create: `src/geometry/print-check.ts`, `src/geometry/print-check.test.ts`
- Modify: `src/geometry/types.ts`, `src/geometry/api.ts` (export `exportShape`, add `printCheck`), `src/geometry/geometry.worker.ts`, `src/geometry/client.ts` (+ `client.test.ts` if it lists methods)

**Interfaces:**
- Consumes: Task 2's exports; `exportShape(evaluator, doc)` from `api.ts`; `EXPORT_QUALITY` from `tessellate.ts`.
- Produces, in `types.ts`:
  ```ts
  export interface PrintIssue { readonly amount: number; readonly mesh: MeshData } // floating: piece count; overhang: mm²
  export interface ThinIssue { readonly veryThin: boolean; readonly mesh: MeshData }
  export type PrintCheckResult =
    | { readonly status: 'nothing' }
    | { readonly status: 'checked'; readonly floating: PrintIssue | null; readonly thin: ThinIssue | null;
        readonly overhang: PrintIssue | null; readonly thinFinished: boolean }
  ```
  `GeometryApi.printCheck(doc: BloKadeDocument): Promise<PrintCheckResult>` and `GeometryClient.printCheck(doc)`.
  `findPrintProblems(evaluator: Evaluator, doc: BloKadeDocument): PrintCheckResult` in `print-check.ts`.

- [ ] **Step 1: Write failing tests** in `print-check.test.ts` with `initTestOC` and a real `Evaluator`, as `overlap.test.ts` does:
  - "a box on the plate is all clear" (`floating`, `thin`, `overhang` all null; `thinFinished` true).
  - "a box floating 5 mm above another is one floating piece" (`floating.amount` 1).
  - "touching parts are not floating" (box at z 0, box at z 20 on top).
  - "a T-shape overhangs".
  - "default shapes on the plate are all clear": sphere, cone, ring, text, and a box with the round-edges modifier, each alone at z = 0 (positioned so their lowest point is on 0), report `overhang: null`. If any fails, tune `MIN_OVERHANG_AREA` (and record the value in the commit message) rather than special-casing shapes.
  - "a 0.5 mm plate is thin".
  - "no solid parts gives nothing" (only a hole, or empty doc → `{status:'nothing'}`).
  - "a part that can't build gives the friendly message": rejects with "Fix the part that can't build first, then check again."

- [ ] **Step 2: Run** `npx vitest run src/geometry/print-check.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `findPrintProblems`.**
  - Build with `exportShape`; map its "nothing to export" `ExportError` to `{status:'nothing'}` and its "has a problem" error to a `PrintCheckError("Fix the part that can't build first, then check again.")`. Always `delete()` the fused shape in `finally`.
  - Floating: iterate the fused shape's solids (replicad `shape.solids` on a compound, or `iterTopo(shape.wrapped, 'solid')`); a solid whose `boundingBox.bounds[0][2]` is more than `FLOAT_GAP` above the fused shape's lowest z is floating; its highlight mesh is its `toMeshData`.
  - Overhang and thin: `shape.mesh(EXPORT_QUALITY)` → Task 2 functions with `plateZ` = fused lowest z; overhang reported only when `area >= MIN_OVERHANG_AREA`.
  - In `api.ts`, `printCheck: (doc) => withShapes(doc, () => …)`, turning `PrintCheckError` into `Error(message)` and logging anything else then throwing `UNEXPECTED`, exactly like `overlap`. Wire through the worker and client like `overlap`.

- [ ] **Step 4: Run** `npx vitest run src/geometry` and `npm run typecheck` — Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "feat: print check in the geometry worker"`

### Task 4: Check print button, panel and highlights

**Files:**
- Create: `src/app/check-print.ts` (+ test), `src/printers/print-messages.ts` (+ test), `src/store/print-check.ts` (+ test), `src/ui/PrintCheckPanel.tsx` (+ test), `src/viewport/PrintCheckMeshes.tsx`
- Modify: `src/store/store.ts` (state `printCheck: PrintCheckView | null`, `setPrintCheck`, `printChecking: boolean`, `setPrintChecking`; reset on new design like `overlap`), `src/ui/Toolbar.tsx`, `src/ui/Workspace.tsx`, `src/viewport/Viewport.tsx`, `src/help/help-texts.ts`, `README.md`, `src/ui/App.css`

**Interfaces:**
- Consumes: `GeometryClient.printCheck` (Task 3); `usePrinter()`.
- Produces:
  - `interface PrintCheckView { readonly doc: BloKadeDocument; readonly result: PrintCheckResult }`
  - `visiblePrintCheck(view: PrintCheckView | null, present: BloKadeDocument): PrintCheckResult | null` (only when `view.doc === present`)
  - `checkPrint(store: BloKadeStore, client: Pick<GeometryClient, 'printCheck'>): Promise<void>`
  - `printMessages(result: PrintCheckResult, printer: Printer | null): readonly { kind: 'floating' | 'thin' | 'overhang' | 'unfinished' | 'clear' | 'nothing'; text: string }[]`

- [ ] **Step 1: Write failing tests**
  - `print-messages.test.ts`, exact copy from the spec:
    - floating 1: "**1 piece is floating** above the plate. It would print in mid-air and fall over. Move it down so it touches the plate or another part."; floating 3: "**3 pieces are floating** above the plate. …" (same tail).
    - thin: "**Some walls are very thin** (less than 0.8 mm). They may print broken or not at all. Make them thicker."; with `veryThin`: "**Some walls are very thin** (less than 0.8 mm, and some less than 0.4 mm, too thin to print). They may print broken or not at all. Make them thicker."
    - overhang: "**Some parts hang over empty space** (shown in orange). They need supports: turn on **Supports** in Bambu Studio, or turn the part so it rests on a flat side, or give the underside a slope."
    - unfinished (`thinFinished` false): "Couldn't finish the thin-wall check; the design is very detailed."
    - order is floating, thin, overhang, unfinished.
    - clear: "✅ Looks ready to print on the Bambu Lab A1 mini." / with `null` printer "✅ Looks ready to print."
    - nothing: "There's nothing to check. Add a solid shape."
  - `print-check.test.ts` (store): `visiblePrintCheck` hides after an edit.
  - `check-print.test.ts`: stores the result for the current doc; "ignores a result for a design that changed meanwhile"; a rejection becomes a notice with its message (fallback "Couldn't check this design. Try again, or export it and check it in Bambu Studio."); `printChecking` is true while waiting and false after.
  - `PrintCheckPanel.test.tsx`: renders the messages with `RichText` in `data-testid="print-check-result"` (`role="status"`) and nothing when no visible result.
  - `Toolbar.test.tsx`: `data-testid="check-print"` exists, reads "Checking…" and is disabled while `printChecking`.

- [ ] **Step 2: Run** `npx vitest run src/printers src/store src/app src/ui` — Expected: new tests FAIL.

- [ ] **Step 3: Implement.** Follow `check-overlap.ts`, `OverlapCheck.tsx` and `OverlapMesh.tsx` as the patterns. The **🔍 Check print** button goes right after the Printer picker in `Toolbar.tsx` (`data-help="check-print"`), taking an `onCheckPrint` prop wired in `Workspace.tsx` to `checkPrint(store, deps.client)`. `PrintCheckPanel` sits at the top of the right-hand column above Properties, with a ✕ close button that calls `setPrintCheck(null)`; each line shows a colour swatch matching its highlight. `PrintCheckMeshes` draws the floating, thin and overhang meshes with `meshBasicMaterial`, transparent, `depthTest={false}`, `renderOrder` like `OverlapMesh`, `raycast={() => null}`. Help texts for `check-print` and `print-check-result`; README paragraph under the Printer bullet.

- [ ] **Step 4: Run** `npm test` and `npm run typecheck` — Expected: all pass.

- [ ] **Step 5: Commit** `git commit -m "feat: Check print button, results panel and highlights"`

### Task 5: End-to-end and full verification

**Files:**
- Create: `e2e/print-check.spec.ts`
- Modify: `e2e/printer-plate.spec.ts` (warning-bar button)

**Interfaces:**
- Consumes: test ids `put-on-plate`, `fit-put-on-plate`, `check-print`, `print-check-result`, `pos-x`, `pos-z`, `add-box`.

- [ ] **Step 1: Write the tests**
  - `print-check.spec.ts`: add two boxes; set the second's `pos-z` to 30 (wait with `toHaveValue`); press `check-print`; `print-check-result` contains "1 piece is floating". Press `put-on-plate`; press `check-print`; it contains "Looks ready to print on the Bambu Lab A1 mini".
  - Same file: select a box, press `d` on the canvas (not in a field) after raising it → `pos-z` becomes 0.
  - `printer-plate.spec.ts`: move a box to `pos-x` 200; press `fit-put-on-plate`; the warning disappears and `pos-x` reads 80.

- [ ] **Step 2: Run** `npx playwright test e2e/print-check.spec.ts e2e/printer-plate.spec.ts` — Expected: PASS (they exercise finished code; if one fails, debug the code, not the test).

- [ ] **Step 3: Full verification:** `npm run typecheck && npm test && npm run build && npm run e2e` — Expected: all green.

- [ ] **Step 4: Commit** `git commit -m "test: e2e for Put on plate and Check print"`
