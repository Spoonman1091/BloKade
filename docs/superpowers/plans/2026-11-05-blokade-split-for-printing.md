# Split for printing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Split for printing screen that opens an STL at full detail, splits it into the fewest pieces that fit the
printer, adds jigsaw tabs or a tongue and groove on bare base along each cut, numbers the pieces underneath, and saves
one STL per piece in a ZIP.

**Architecture:** All mesh work runs on Manifold (`manifold-3d`, WebAssembly) in its own Comlink worker, which keeps
the full-detail model in memory between calls. Pure planning (grid, cut windows) is plain TypeScript in `src/split/`.
The screen follows the 🛠️ My shapes pattern: a full screen opened from the toolbar, with Back to the design.

**Tech Stack:** TypeScript 5.9 strict, React 19, @react-three/fiber, Comlink, `manifold-3d` 3.5.4, `fflate` (already a
dependency), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-05-blokade-split-for-printing-design.md`

## Global Constraints

- Never simplify the model: pieces are the original triangles, cut. File limit is the existing `MAX_STL_BYTES` (50 MB).
- Units reuse the importer's `UNIT_FACTORS`, `sizeInMm`, `fitsBloKade` (`src/app/import-stl.ts`) and the same labels as
  `src/ui/ImportDialog.tsx`.
- All heavy work runs in the split worker; the page never freezes. Cancel stops the work.
- No piece may leave raised detail hanging over an empty pocket: joints only on bare-base stretches of a cut.
- Every piece lies flat (as the model does), fits the printer with a 5 mm margin each side, and is watertight.
- Plain words. Messages (exact):
  - gaps: `This model has gaps in its surface, so it can't be cut cleanly. Open it in Bambu Studio, use Repair, save it, and try again.`
  - no printer: `Pick your printer in the toolbar first, so BloKade knows how big the pieces can be.`
  - too many: `This model would need more than 36 pieces. Try a bigger printer or scale it down first.`
  - no base: `This model doesn't have a flat base, so the pieces get straight cuts. Glue them together.`
  - thin tongue: `The base is too thin for a tongue.`
  - unexpected: `Couldn't split this model. Try again, or open it in Bambu Studio and use Cut there.` (log the error)
  - not STL / too big file / too large size: the importer's existing messages (`src/import/limits.ts`).
- Constants (one block, `src/split/constants.ts`): `MARGIN = 5`, `TAB_LENGTH = 10`, `TAB_TIP = 10`, `TAB_NECK = 6`,
  `TAB_SPACING = 45`, `TONGUE_OUT = 3`, `TONGUE_MIN_BASE = 4`, `BASE_COVERAGE = 0.95`, `BASE_STEP = 0.1`,
  `RAISED_PROBE = 0.2`, `ENGRAVE_DEPTH = 0.6`, `DIGIT_HEIGHT = 8`, `MAX_GRID = 6`, `SCORE_STEP = 1`,
  `BALANCE_WEIGHT = 0.1`, `DEFAULT_FIT_GAP = 0.2`.
- Pin `manifold-3d` like the other dependencies (`^3.5.4`); the `.wasm` must be emitted by `npm run build` (both GitHub
  Pages and Docker serve `dist/`).
- Files small and focused; no `console.log`; immutable updates; match surrounding code.

**Deviations from the spec, decided here:**
- **Whole-model rotation is dropped:** each piece may already turn 90° on its own plate, which covers every case the
  whole-model turn would.
- **Cuts move with a slider per cut** (range = the cut's window) in the settings, and the cut line in the 3D view
  follows live. Dragging the line itself in 3D is left out: sliders are accessible and far simpler, and the spec left
  "how cut lines are dragged" to the builder.
- **Piece numbers are block digits** made from rectangles (seven-segment style), so the worker needs no font. They go
  under the piece (the underside is solid base everywhere), at the centre of the piece's bottom outline.

## Review Focus

1. **An STL saved in inches** (10 × 12 in): choosing Inches scales it to 254 × 305 mm before planning. Test in Task 1.
2. **A model that already fits the plate:** one piece, no cuts, no joints, Save gives one STL. Tests in Tasks 2 and 5.
3. **Another printer or a rectangular plate** (P1S 256 × 256; MK4S 250 × 210): the grid and windows follow, and a
   piece may turn 90° to fit. Test in Task 2.
4. **Opening a second file** replaces the first in the worker (the old Manifold objects are freed) and resets the
   screen. Test in Task 6.
5. **Cancel during Make pieces:** the screen stays usable and can make pieces again. Test in Task 7.

---

## File map

| File | Responsibility |
|---|---|
| `src/split/constants.ts`, `src/split/types.ts` | Constants and shared types |
| `src/split/manifold.ts` | Load the Manifold WebAssembly once (browser worker and Vitest/node) |
| `src/split/model.ts` | STL bytes → welded, scaled, centred Manifold; gap check |
| `src/split/grid.ts` | Pure: fewest pieces, cut windows |
| `src/split/cut-plan.ts` | Base thickness, cut scoring, cut positions |
| `src/split/joints.ts` | Bare stretches, tab and tongue outlines |
| `src/split/digits.ts` | Block-digit outlines |
| `src/split/pieces.ts` | Cutting, joints, numbers, per-piece checks |
| `src/split/save.ts` | Binary STL writer and ZIP |
| `src/split/split.worker.ts`, `src/split/split-api.ts`, `src/split/spawn-split.ts`, `src/split/split-client.ts` | Worker, its API, spawning, page-side client |
| `src/split/test-meshes.ts` | Made-up plates with raised blocks, as STL bytes, for tests |
| `src/ui/SplitScreen.tsx` + `src/ui/split/*.tsx` | The screen, settings, 3D view, map |
| `src/ui/Toolbar.tsx`, `src/ui/Workspace.tsx`, `src/help/help-texts.ts`, `README.md` | Wiring, help, docs |
| `e2e/split.spec.ts`, `e2e/fixtures/chest-plate.stl` | End-to-end |

Shared types (`src/split/types.ts`), used from Task 1 on:
```ts
export interface Plate { readonly width: number; readonly depth: number }            // mm
export interface ModelInfo { readonly size: Vec3; readonly triangleCount: number }  // mm
export type Axis2 = 'x' | 'y'
export interface Cut { readonly axis: Axis2; readonly min: number; readonly max: number; readonly at: number } // model coords, centred
export interface GridPlan { readonly cols: number; readonly rows: number; readonly cuts: readonly Cut[] }
export type JointStyle = 'tabs' | 'tongue' | 'none'
export interface SplitSettings { readonly joint: JointStyle; readonly fitGap: number; readonly numbers: boolean; readonly baseThickness: number | null }
export interface PieceMesh {
  readonly number: number                 // 1-based, row-major from the front-left (−x, −y)
  readonly vertices: Float32Array; readonly triangles: Uint32Array // in assembly position (model coords)
  readonly size: Vec3; readonly fits: boolean
}
export interface PiecesResult { readonly pieces: readonly PieceMesh[]; readonly glueCuts: readonly number[] /* indices into cuts */ }
export type SplitResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string }
```

---

### Task 1: Manifold and opening the model

**Files:**
- Modify: `package.json` (add `manifold-3d`), `vite.config.ts` only if the worker's wasm isn't emitted
- Create: `src/split/constants.ts`, `src/split/types.ts`, `src/split/manifold.ts`, `src/split/model.ts`, `src/split/test-meshes.ts`
- Test: `src/split/model.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // manifold.ts
  export function loadManifold(): Promise<ManifoldToplevel>   // cached; works in a module worker and under Vitest (node)
  // model.ts
  export interface OpenModel { readonly solid: Manifold; readonly info: ModelInfo }
  export function openModel(wasm: ManifoldToplevel, bytes: ArrayBuffer, unit: ImportUnit): SplitResult<OpenModel>
  // test-meshes.ts (tests only)
  export function plateStl(opts: { width: number; depth: number; base: number; raised?: readonly { x: [number, number]; y: [number, number]; height: number }[] }): ArrayBuffer
  ```
  `openModel`: size check first (`MAX_STL_BYTES`), then `parseStl` + `weldMesh` (`src/import/`), scale by
  `UNIT_FACTORS[unit]`, `Manifold.ofMesh` after `mesh.merge()`; a non-`NoError` status → the gaps message. Move so the
  lowest z is 0 and it's centred on x and y. Over `fitsBloKade` → the importer's too-large message.

- [ ] **Step 1: Write the failing tests** (`model.test.ts`, `beforeAll(loadManifold)`):
  - `opens a plate at full detail`: `plateStl({ width: 254, depth: 305, base: 6.4, raised: [{ x: [-20, 20], y: [-40, 40], height: 5 }] })`
    → `info.size` `[254, 305, 11.4]` (to 3 dp), `info.triangleCount` equals the file's triangle count, bounds centred, min z 0.
  - `scales an inch file`: a 10 × 12 × 0.25 plate written in inches, opened with `'inches'` → size `[254, 304.8, 6.35]` (to 2 dp) (Review Focus 1).
  - `refuses a model with gaps`: the plate with one triangle removed → `{ ok: false, message: <gaps message> }`.
  - `refuses a file that isn't an STL` → the importer's `NOT_STL`.
- [ ] **Step 2: Run** `npx vitest run src/split/model.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the files above; `npm install manifold-3d@^3.5.4`.
- [ ] **Step 4: Run** the test, `npm run typecheck`, and `npm run build` (check `dist/` holds the `.wasm` only once the worker imports it in Task 6; here, build must just pass). Expected: PASS.
- [ ] **Step 5: Commit** `feat: open an STL at full detail for splitting`.

### Task 2: Planning the grid

**Files:** Create `src/split/grid.ts`; Test `src/split/grid.test.ts`

**Interfaces:**
- Produces: `export function planGrid(width: number, depth: number, plate: Plate, reserve: number): GridPlan | null`
  (null when more than `MAX_GRID × MAX_GRID` would be needed). `reserve` = joint room per cut edge: `TAB_LENGTH` for
  tabs, `TONGUE_OUT` for tongue, 0 for none.

Algorithm: a piece fits when its extents `(ex, ey)`, each counted as `extent + reserve × (its cut edges on that axis)`,
satisfy `ex ≤ W − 2·MARGIN && ey ≤ D − 2·MARGIN`, or the same turned 90°. Try grids by increasing `cols × rows`
(ties: fewer cuts on the longer axis first, then cols ≤ rows), with cuts evenly spaced; take the first where every
piece fits. Each cut's window `[min, max]` is the range of positions keeping both neighbouring pieces fitting with
the other cuts at their even positions; `at` starts at the even position.

- [ ] **Step 1: Write the failing tests:**
  - chest plate: `planGrid(254, 305, { width: 180, depth: 180 }, 10)` → 2 × 2; x cut window `[-33, 33]`, y cut window `[-7.5, 7.5]`, both `at: 0`.
  - fits already: `planGrid(150, 120, A1mini, 10)` → 1 × 1, no cuts (Review Focus 2).
  - long strip: `planGrid(300, 150, A1mini, 10)` → 2 × 1.
  - turning a piece (MK4S, usable 240 × 200): `planGrid(200, 240, { width: 250, depth: 210 }, 10)` → 1 × 1, because it only fits turned 90° (Review Focus 3).
  - another printer: P1S `planGrid(240, 305, { width: 256, depth: 256 }, 10)` → 1 × 2 (one cut, across y), window `[-83.5, 83.5]` (Review Focus 3).
  - too many: `planGrid(2000, 2000, A1mini, 10)` → `null`.
  - reserve matters: `planGrid(330, 100, A1mini, 0)` → 2 × 1 with window `[-5, 5]`; `planGrid(330, 100, A1mini, 10)` → 3 × 1.
- [ ] **Step 2: Run** `npx vitest run src/split/grid.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `planGrid`.
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit** `feat: plan the fewest pieces that fit the printer`.

### Task 3: Base thickness and where the cuts go

**Files:** Create `src/split/cut-plan.ts`; Test `src/split/cut-plan.test.ts`

**Interfaces:**
- Consumes: `OpenModel` (Task 1), `GridPlan` (Task 2).
- Produces:
  ```ts
  export function findBaseThickness(solid: Manifold): number | null
  export function placeCuts(solid: Manifold, grid: GridPlan, baseThickness: number | null): GridPlan // cuts with `at` chosen
  export function raisedOutline(solid: Manifold, baseThickness: number): CrossSection // slice at base + RAISED_PROBE
  ```
  Base: `A0 = slice(BASE_STEP).area()`; walk up by `BASE_STEP`; the base top is the last height whose slice area is
  `≥ BASE_COVERAGE · A0`; null if that is the model's top (no raised part) **or** the first step already fails.
  Cut score at position c: area of `raisedOutline ∩ strip(c ± 0.5)` (≈ length of raised detail crossed) +
  `BALANCE_WEIGHT · |c − even position|`; candidates every `SCORE_STEP` inside the window; ties → smaller `|c|`, then
  smaller `c`. With no base (null), keep the even positions.

- [ ] **Step 1: Write the failing tests:**
  - base: the 254 × 305 × 6.4 plate with a raised block → `toBeCloseTo(6.4, 1)`; a plain box (no raised part) → `null`; a sphere-like mesh → `null`.
  - avoids detail: plate 254 × 305 × 6.4 with a raised strip `x: [-10, 10]` across the whole depth, A1 mini 2 × 2 → the x cut's `|at| === 11`, and the y cut stays at `0`.
  - stays in window: a raised strip covering the whole x window → `at` within `[min, max]`.
- [ ] **Step 2: Run** `npx vitest run src/split/cut-plan.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit** `feat: find the base and place cuts away from raised detail`.

### Task 4: Joints on bare base

**Files:** Create `src/split/joints.ts`; Test `src/split/joints.test.ts`

**Interfaces:**
- Produces:
  ```ts
  /** Positions along the cut (the other axis) where a joint fits on bare base, both sides of the line. */
  export function bareStretches(base: CrossSection, raised: CrossSection, cut: Cut, along: readonly [number, number], reach: number): readonly (readonly [number, number])[]
  /** Tab outlines centred on the cut, owned alternately by the − and + side (index 0 → − side). */
  export function tabOutlines(cut: Cut, stretches: readonly (readonly [number, number])[]): readonly { readonly owner: -1 | 1; readonly outline: CrossSection }[]
  export function tongueOutline(cut: Cut, stretch: readonly [number, number]): CrossSection
  ```
  A cut crossed by other cuts is handled **segment by segment**: one segment per pair of neighbouring pieces, and
  `along` is that segment's span (between the perpendicular cuts or the model's edge). `base` = the model's
  `slice(BASE_STEP)`; `raised` = Task 3's `raisedOutline`; `along` = the
  span of the cut between its neighbouring cuts/model edges; `reach` = `TAB_LENGTH + 2` for tabs, `TONGUE_OUT + 2`
  for tongue. A point is bare when the square of side `2·reach` around it is inside `base` and doesn't touch `raised`.
  Tabs: dovetail (neck `TAB_NECK` at the cut line, tip `TAB_TIP` at `TAB_LENGTH` out), centres every `TAB_SPACING`
  starting `TAB_SPACING / 3` into each stretch, only where the whole tab fits the stretch. The pocket is the tab
  grown by the Fit gap (`offset(fitGap)` with square/miter joins) — done in Task 5.

- [ ] **Step 1: Write the failing tests:**
  - a bare 305 mm y-cut on the test plate → one stretch inside `[-152.5, 152.5]`, trimmed by `reach` at both ends; ~6 tabs, alternating owners.
  - a raised block covering `y < 0` across the cut → stretches only in `y > 0`.
  - raised detail along the whole cut → no stretches.
  - tab shape: the tip is wider than the neck (`TAB_TIP > TAB_NECK`), area matches the trapezoid within 1 %.
- [ ] **Step 2: Run** `npx vitest run src/split/joints.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit** `feat: joint outlines only on bare base`.

### Task 5: Making the pieces

**Files:** Create `src/split/digits.ts`, `src/split/pieces.ts`; Test `src/split/digits.test.ts`, `src/split/pieces.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  ```ts
  export function digitOutline(n: number, height: number): CrossSection   // block digits, centred, mirrored in x
  export function makePieces(wasm: ManifoldToplevel, model: OpenModel, plan: GridPlan, settings: SplitSettings, plate: Plate, onProgress?: (done: number, total: number) => void): PiecesResult
  ```
  For each grid cell: intersect the model with the cell's box (cut planes at each `at`); for tabs/tongue on every cut
  with bare stretches, extrude the joint outline from z = 0 to `baseThickness` (tongue: centred third of it), union
  it into the owner and subtract its `offset(fitGap)` extrusion (tongue: grown up/down too) from the neighbour. A cut
  with no stretches on any of its segments, or every cut when there's no base or `joint: 'none'`, is straight and
  listed in `glueCuts`. Numbers: `digitOutline(number, DIGIT_HEIGHT)` extruded `ENGRAVE_DEPTH`,
  subtracted at the centre of the piece's bottom slice. `fits` uses Task 2's rule on the piece's real size (turned
  allowed). Free every intermediate Manifold/CrossSection (`.delete()`).

- [ ] **Step 1: Write the failing tests:**
  - `digits.test.ts`: digits 1–36 produce non-empty outlines `DIGIT_HEIGHT` tall; "8" has more area than "1"; mirrored (a "2"'s bottom bar is on the +x side when read from above).
  - `pieces.test.ts` (test plate 254 × 305 × 6.4 with a raised block in one quadrant, A1 mini, tabs, fit 0.2):
    - 4 pieces numbered 1–4, all `fits`, all watertight (`Manifold.ofMesh` of each succeeds);
    - no overlap: every pair's intersection volume `< 0.01` mm³;
    - volume: `|Σ pieces − original| < Σ(cut lengths) × 6.4 × 0.2 × 2 + 4 × engraving volume + 1`;
    - tabs present: each piece touching a bare cut has volume ≠ its plain-cut volume;
    - fallback: a raised strip along the whole x cut → that cut index is in `glueCuts`, and no piece has a tab on it;
    - no base (a plain box mesh, `baseThickness: null`) → straight cuts, all cuts in `glueCuts`;
    - one piece: a 150 × 120 plate → 1 piece, no `glueCuts` (Review Focus 2);
    - tongue on a 3 mm base → returns the thin-tongue message instead (as a `SplitResult` from the worker in Task 6; here `makePieces` throws a typed `SplitProblem` with that message).
- [ ] **Step 2: Run** `npx vitest run src/split/digits.test.ts src/split/pieces.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat: cut the model into numbered pieces with joints`.

### Task 6: Saving, the worker and its client

**Files:** Create `src/split/save.ts`, `src/split/split-api.ts`, `src/split/split.worker.ts`, `src/split/spawn-split.ts`, `src/split/split-client.ts`; Test `src/split/save.test.ts`, `src/split/split-api.test.ts`, `src/split/split.timing.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // save.ts
  export function binaryStl(vertices: Float32Array, triangles: Uint32Array): Uint8Array
  export function zipPieces(name: string, pieces: readonly PieceMesh[]): Uint8Array  // `${name}-${n}.stl`, each moved flat to z=0 and centred
  export function baseName(fileName: string): string  // "Punisher Chest Plate.stl" → "punisher-chest-plate"
  // split-api.ts (what the worker exposes; testable directly in node)
  export interface SplitApi {
    open(bytes: ArrayBuffer, unit: ImportUnit): Promise<SplitResult<ModelInfo & { readonly preview: { vertices: Float32Array; triangles: Uint32Array } }>>
    plan(plate: Plate, settings: SplitSettings): Promise<SplitResult<{ readonly grid: GridPlan; readonly baseThickness: number | null }>>
    pieces(plan: GridPlan, settings: SplitSettings, plate: Plate): Promise<SplitResult<PiecesResult>>
    save(name: string): Promise<SplitResult<Uint8Array>>
  }
  export function createSplitApi(onProgress: (done: number, total: number) => void): SplitApi
  // split-client.ts (page side)
  export interface SplitClient extends SplitApi { onProgress(fn: (done: number, total: number) => void): () => void; cancel(): void; dispose(): void }
  export function createSplitClient(spawn?: () => SplitWorkerHandle): SplitClient
  ```
  `open` frees any previous model first (Review Focus 4). `plan` with no base and `joint !== 'none'` → still ok (the
  screen shows the no-base message from `baseThickness: null`). `null` grid → too-many message. Errors are mapped to
  the exact Global Constraints messages; anything unexpected → the unexpected message, logged. `cancel()` terminates
  the worker and spawns a fresh one; the client keeps the last opened bytes and unit and re-opens them on the next
  call. Large arrays cross with `Comlink.transfer`.

- [ ] **Step 1: Write the failing tests:**
  - `save.test.ts`: `binaryStl` header + count + 50 bytes per triangle; `zipPieces('plate', 4 pieces)` unzips (fflate) to `plate-1.stl … plate-4.stl`, each min z 0, centred; `baseName` cases.
  - `split-api.test.ts`: open → plan → pieces → save on the test plate gives a 4-file ZIP; a second `open` replaces the first (Review Focus 4: plan after it reflects the new size); too-many and gaps messages; progress called with `(k, 4)` for k = 1..4.
  - `split.timing.test.ts` (skipped unless `BLOKADE_TIMING=1`, like the existing timing tests): a ~1,000,000-triangle plate (finely subdivided raised dome) splits into 4 pieces with tabs in `< 30_000` ms.
- [ ] **Step 2: Run** `npx vitest run src/split`. Expected: FAIL.
- [ ] **Step 3: Implement** (worker spawn mirrors `src/geometry/spawn.ts`).
- [ ] **Step 4: Run** the tests, `npm run typecheck`, `npm run build`, and confirm `dist/` contains the Manifold `.wasm`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: split worker, saving pieces as a ZIP`.

### Task 7: The Split for printing screen

**Files:**
- Create: `src/ui/SplitScreen.tsx`, `src/ui/split/SplitSettings.tsx`, `src/ui/split/SplitView.tsx`, `src/ui/split/PieceMap.tsx`, `src/ui/split/useSplit.ts`
- Modify: `src/ui/Toolbar.tsx` (button `data-testid="split-for-printing"` "✂ Split for printing"), `src/ui/Workspace.tsx` (open/close like My shapes), `src/help/help-texts.ts`, `src/ui/App.css`
- Test: `src/ui/SplitScreen.test.tsx`, `src/ui/split/useSplit.test.ts`

**Interfaces:**
- Consumes: `SplitClient` (Task 6); `usePrinter()` (`src/printers/printer-store.ts`).
- `useSplit(client)` holds `{ stage: 'empty' | 'opened' | 'planned' | 'pieces', info, grid, baseThickness, settings, pieces, busy, progress, message }` and the actions `open(file, unit)`, `setSetting`, `moveCut(index, at)` (re-runs nothing heavy: only `pieces` waits for Make pieces), `makePieces()`, `save()`, `cancel()`.
- Test ids (each needs a help entry): `split-open` (file input), `split-units`, `split-joint` (select: Jigsaw tabs / Tongue and groove / None (glue only)), `split-fit-gap`, `split-numbers` (checkbox, on), `split-base` (number, editable), `split-cut-<i>` (range slider per cut, min/max = window), `split-make`, `split-save`, `split-cancel`, `split-progress`, `split-message`, `split-map`, `split-back` ("⬅ Back to my design").
- The 3D view: the model (or pieces spread 4 mm apart, numbered) on the plate outline (`src/viewport/PrinterPlate.tsx`), cut lines as thin red quads following the sliders. Pieces that don't fit show in the misfit colour (`#ff1a1a`); Save is disabled with the reason. The tongue option is disabled with the thin-tongue message under 4 mm base; no base → joint select disabled with the no-base message. No printer → the no-printer message and Make disabled.

- [ ] **Step 1: Write the failing tests** (jsdom, a fake `SplitClient`; mock the 3D view like other screen tests):
  - opening shows size and triangle count; planning shows "4 pieces (2 × 2)"; sliders have the windows' min/max;
  - Make pieces shows progress then the map with 1–4; Save calls `client.save` and downloads `<name>-pieces.zip` (via `downloadBytes`);
  - Cancel during Make pieces calls `client.cancel`, clears busy, and Make pieces works again (Review Focus 5);
  - no printer → message and Make disabled; base 3 mm → Tongue disabled with the message; base null → no-base message;
  - opening a second file resets the stage and pieces;
  - the toolbar button opens the screen and Back returns to the design untouched.
- [ ] **Step 2: Run** `npx vitest run src/ui/SplitScreen.test.tsx src/ui/split`. Expected: FAIL.
- [ ] **Step 3: Implement.** Help entries for every test id above and the toolbar button (plain words, e.g. `split-for-printing`: tip "Cut a model that's too big into pieces that fit your printer.").
- [ ] **Step 4: Run** the full `npx vitest run` (help coverage must pass) and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: Split for printing screen`.

### Task 8: End-to-end, README

**Files:** Create `e2e/split.spec.ts`, `e2e/fixtures/chest-plate.stl` (generated by a small script from `plateStl`, committed, under 2 MB); Modify `README.md`

- [ ] **Step 1: Write the failing e2e test** `splits a chest plate into four pieces`: open the screen, choose the fixture, see "4 pieces", Make pieces, map shows 4, Save → the download is a ZIP holding 4 `.stl` files (unzip in the test with fflate); Back returns to the design.
- [ ] **Step 2: Run** `npx playwright test e2e/split.spec.ts`. Expected: FAIL until the fixture exists, then passes against Tasks 1–7 (if it passes immediately after adding the fixture, that's expected: say so).
- [ ] **Step 3: README:** a short "### Split for printing" section under "Using BloKade": what it's for, full detail (no simplifying), joints only on bare base, Fit gap, one STL per piece in a ZIP.
- [ ] **Step 4: Run** `npx vitest run`, `npm run typecheck`, `npm run build`, `npx playwright test`. Expected: all pass.
- [ ] **Step 5: Commit** `test: e2e for Split for printing; README`.
