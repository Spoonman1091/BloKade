# More shapes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ten TinkerCAD-style shapes (Roof, Round roof, Tube, Half sphere, Pyramid, Polygon, Paraboloid, Star,
Heart, Icosahedron) in a collapsible More shapes palette section.

**Architecture:** Each shape is a built-in plugin in `src/plugins/builtin/` with `palette: 'more'`. The cad toolkit
gains smooth curves in outlines (cubic Bézier steps) and a triangles-to-solid command for the icosahedron. The
palette gets a More shapes section whose open state is remembered per browser, and drawn pictures for the new
shapes, widened from the existing kit picture.

**Tech Stack:** TypeScript 5.9 strict, React 19, Zustand 5, replicad/OpenCascade (worker), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-01-blokade-more-shapes-design.md`

## Global Constraints

- Every shape is centred on X and Y and sits on z = 0, sizes in mm; existing shape ids and params never change.
- Defaults and size handles exactly as the spec's table (copied into each task below).
- Every new shape at its default size passes Check print with no findings; if not, fix the shape, never the checks.
- Words Kade sees: plain labels ("Sides", "Points", "Wall thickness", "Inner diameter"), no jargon.
- Problem messages (exact): tube `The wall is too thick for this tube. Make it less than ${d/2} mm.` (d/2 rounded
  to 2 decimals); star `The inner diameter must be smaller than the diameter.`
- Emoji icons: roof 🏠, round-roof 🌉, tube 🧻, half-sphere 🌗, pyramid 🗻, polygon 🛑, paraboloid 🥚, star ⭐,
  heart ❤️, icosahedron 🎲.
- Palette order: roof, round-roof, tube, half-sphere, pyramid, polygon, paraboloid, star, heart, icosahedron.
- More shapes starts open on a first visit, then remembers its state; storage that throws never breaks it.
- Not in scope: Scribble, adding commands to Kade's coding toolkit (`src/kade/toolkit.ts`), a lesson.
- Files stay small and match the surrounding code; no `console.log`; immutable updates.

**Deviations from the spec, decided here:**
- Pyramid is the intersection of two roofs (one along X, one along Y), not the triangles command. Triangles leave
  a seam across the base that Round edges can't handle; two roofs give clean flat faces. The triangles command is
  still added, for the icosahedron.
- Curves are real smooth curves (cubic Bézier steps), not fine polylines. Polyline facets meet at a few degrees, and
  Round edges ("All edges") fails on such edges; joins between tangent-matched Bézier steps count as seams
  (`src/geometry/edge-seams.ts`, under 1e-3 rad) and are skipped.

## Review Focus

1. A new shape switched to **Hole** and grouped with a box: must cut and build. Test in Task 4 (covers all ten).
2. **Round edges** on a new shape: Bottom edges at 0.5 mm on all ten, and All edges at 0.5 mm on all but the
   pyramid, must build. Test in Task 4 (covers all ten).
3. **Extreme counts:** Polygon with 3 and 12 sides, Star with 3 and 12 points, Tube with a 0.4 mm wall must build.
   Tests in Tasks 5 and 6.
4. **Dragging the Star's size handle** keeps the inner diameter in proportion, so the star still builds. Test in Task 6.
5. **Storage that throws** when reading or saving the More shapes state: the section still opens and closes. Test
   in Task 3.

---

## File map

| File | Responsibility |
|---|---|
| `src/plugins/cad-types.ts`, `src/plugins/cad.ts` | `OutlineStep` curves in outlines; `polyhedron` command |
| `src/plugins/types.ts`, `src/plugins/registry.ts`, `src/plugins/index.ts` | `palette: 'more'`; build order |
| `src/plugins/builtin/shape-profile.ts` | Outline helpers shared by the new shapes (name ends in `-profile.ts` so the plugin glob skips it) |
| `src/plugins/builtin/<id>.ts` × 10 | One plugin per shape |
| `src/ui/more-shapes-store.ts` | Open/closed state, remembered per browser |
| `src/ui/ShapePalette.tsx` | The More shapes section |
| `src/ui/PalettePicture.tsx` (replaces `KitPicture.tsx`), `src/ui/shape-pictures.tsx` | Drawn palette pictures |
| `src/help/help-texts.ts`, `README.md`, `e2e/more-shapes.spec.ts` | Help, docs, end-to-end |

---

### Task 1: Smooth curves in outlines

**Files:**
- Modify: `src/plugins/cad-types.ts`, `src/plugins/cad.ts`
- Test: `src/plugins/cad-curves.test.ts` (create)

**Interfaces:**
- Produces:
  ```ts
  /** A cubic Bézier from the previous point: two control points, then the end point. */
  export interface CurveStep { readonly curve: readonly [Point2, Point2, Point2] }
  export type OutlineStep = Point2 | CurveStep
  // revolve, extrudeSide and prism now take readonly OutlineStep[] (Point2[] still works unchanged).
  // The first step must be a Point2 (the start).
  ```

- [ ] **Step 1: Write the failing tests** in `src/plugins/cad-curves.test.ts` (use `initTestOC`, `measureVolume`):
  - `revolves a quarter-ellipse curve into a dome`: `cad.revolve([[0, 0], [10, 0], { curve: [[10, 5.522847], [5.522847, 10], [0, 10]] }])`
    → volume within 0.5 % of `(2 / 3) * Math.PI * 100 * 10`; bounds z max `toBeCloseTo(10, 3)`.
  - `pushes a curved outline up with prism`: half-disc `[[-10, 0], [10, 0], { curve: [[10, 5.522847], [5.522847, 10], [0, 10]] }, { curve: [[-5.522847, 10], [-10, 5.522847], [-10, 0]] }]`, height 2
    → volume within 0.5 % of `Math.PI * 100 / 2 * 2`.
  - `rejects a curve that crosses the spin line`: revolve with a control point at x = −1 throws
    `'A spin outline must stay on the right of the center line (x ≥ 0).'`
  - `still takes plain point outlines`: `cad.prism([[0, 0], [10, 0], [0, 10]], 1)` volume `toBeCloseTo(50, 3)`.

- [ ] **Step 2: Run** `npx vitest run src/plugins/cad-curves.test.ts`. Expected: FAIL (curve steps not accepted / type errors).

- [ ] **Step 3: Implement.** Add `CurveStep`/`OutlineStep` to `cad-types.ts`; change the three signatures and their
  doc comments. In `cad.ts`, `profileDrawing` draws a `Point2` with `lineTo` and a `CurveStep` with
  `cubicBezierCurveTo(end, c1, c2)`; `cleanProfile` drops repeated *points* only (a curve step is never dropped); the
  revolve x ≥ 0 check also looks at curve control and end points. A curve that ends on the start point closes the
  outline itself: don't add a zero-length closing line (the half-disc test and the round roof end this way). Keep the "needs at least 3 different points"
  rule counting steps. Fix any other `CadToolkit` implementers that stop compiling (`npm run typecheck`).

- [ ] **Step 4: Run** the new test, then `npx vitest run src/plugins src/kade`. Expected: PASS.

- [ ] **Step 5: Commit** `feat: smooth curves in cad outlines`.

### Task 2: Solid from triangles

**Files:**
- Modify: `src/plugins/cad-types.ts`, `src/plugins/cad.ts`
- Test: `src/plugins/cad-polyhedron.test.ts` (create)

**Interfaces:**
- Consumes: `meshSolid(vertices: ArrayLike<number>, triangles: ArrayLike<number>): Shape3D` from `src/geometry/mesh-solid.ts`.
- Produces:
  ```ts
  export type Point3 = readonly [number, number, number]
  /** A solid from flat triangles (corner indices, wound the same way round). */
  polyhedron(points: readonly Point3[], triangles: readonly (readonly [number, number, number])[]): Shape3D
  ```

- [ ] **Step 1: Write the failing tests:**
  - `builds a tetrahedron`: points `[[0,0,0],[10,0,0],[0,10,0],[0,0,10]]`, triangles `[[0,2,1],[0,1,3],[1,2,3],[0,3,2]]`
    → volume `toBeCloseTo(1000 / 6, 3)`.
  - `turns an inside-out tetrahedron the right way`: every triangle reversed → same volume.
  - `explains triangles that don't close up`: drop the last triangle → throws (whatever plain-words message
    `meshSolid` gives for an open mesh; assert `toThrow()` with no OpenCascade text, i.e. not matching `/Standard_|BRep/`).

- [ ] **Step 2: Run** `npx vitest run src/plugins/cad-polyhedron.test.ts`. Expected: FAIL (`polyhedron` missing).

- [ ] **Step 3: Implement** `polyhedron` in `cad.ts` by flattening points and indices into the arrays `meshSolid` takes.

- [ ] **Step 4: Run** the test. Expected: PASS. `npm run typecheck` clean.

- [ ] **Step 5: Commit** `feat: polyhedron command in the cad toolkit`.

### Task 3: More shapes palette section

**Files:**
- Modify: `src/plugins/types.ts` (palette union), `src/plugins/registry.ts` (zod enum), `src/ui/ShapePalette.tsx`, `src/ui/App.css`, `src/help/help-texts.ts`
- Create: `src/ui/more-shapes-store.ts`, `src/ui/PalettePicture.tsx` (move `KitPicture.tsx` here and delete it)
- Test: `src/ui/more-shapes-store.test.ts`, `src/ui/ShapePalette.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  // types.ts: readonly palette?: 'shapes' | 'more' | 'fit' | 'hidden'
  // more-shapes-store.ts
  export const MORE_SHAPES_KEY = 'blokade.moreShapes.v1'
  export function loadMoreShapesOpen(storage: KeyValueStorage | null): boolean   // true unless saved closed; never throws
  export function saveMoreShapesOpen(storage: KeyValueStorage | null, open: boolean): void // never throws
  export interface MoreShapesState { readonly open: boolean; toggle(): void }
  export function createMoreShapesStore(storage: KeyValueStorage | null): StoreApi<MoreShapesState>
  export const moreShapesStore: StoreApi<MoreShapesState>   // uses browserStorage()
  // PalettePicture.tsx
  export function palettePicture(id: string, emoji: string): ReactNode  // drawing for a known id, else the emoji
  // ShapePalette gains an optional prop: moreShapes?: StoreApi<MoreShapesState> (default moreShapesStore)
  ```
  Kade's own shapes (`src/kade/definition.ts`, `meta.ts`) keep `'shapes' | 'fit' | 'hidden'`: `'more'` is for built-ins.

- [ ] **Step 1: Write the failing tests.**
  - `more-shapes-store.test.ts`: starts open with empty storage; `toggle()` closes and saves, and a new store on the
    same storage starts closed; a storage whose `getItem` and `setItem` throw still starts open and toggles.
  - `ShapePalette.test.tsx`: with a registry of fake plugins `plain` (no palette), `extra` (`palette: 'more'`),
    `fitty` (`'fit'`): region `More shapes` lists `['add-extra']`, Shapes lists `['add-plain']`; clicking
    `more-shapes-toggle` hides the `add-extra` button and sets `aria-expanded="false"`; clicking again shows it.
    No More shapes region when no plugin has `palette: 'more'`. Peg & socket still shows `svg.palette-picture`.
    Pass `moreShapes={createMoreShapesStore(null)}` so tests don't share state.

- [ ] **Step 2: Run** `npx vitest run src/ui/more-shapes-store.test.ts src/ui/ShapePalette.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement.** Store follows `src/printers/printer-store.ts` / `printers.ts` (`loadPrinter`, `savePrinter`).
  Section: `<section className="panel" aria-label="More shapes">` between Shapes and Fit tools, heading
  `<h2><button type="button" data-testid="more-shapes-toggle" aria-expanded={open}>{open ? '▾' : '▸'} More shapes</button></h2>`
  (style the button to look like a heading), grid only while open. Buttons use `palettePicture(p.id, p.icon)`;
  kits use `palettePicture(k.id, k.icon)`. Help entry
  `'more-shapes-toggle': { tip: 'Shows or hides more shapes.', card: 'More shapes has roofs, tubes, stars, hearts and more. Click the heading to open or close it.' }`.

- [ ] **Step 4: Run** the tests, then the whole suite `npx vitest run` (help coverage must pass). Expected: PASS.

- [ ] **Step 5: Commit** `feat: More shapes palette section that remembers if it's open`.

### Task 4: Roof, Round roof and Pyramid, plus checks for every new shape

**Files:**
- Create: `src/plugins/builtin/roof.ts`, `round-roof.ts`, `pyramid.ts`, `src/plugins/builtin/shape-profile.ts`
- Modify: `src/plugins/index.ts` (`BUILTIN_ORDER`: insert the ten new ids, in the global order, after `'text'`),
  `src/plugins/builtin/builtin.test.ts`, `src/geometry/print-check.test.ts`
- Test: `src/plugins/builtin/more-shapes.test.ts` (create)

**Interfaces:**
- Consumes: `OutlineStep`, `CurveStep` (Task 1); `palette: 'more'` (Task 3).
- Produces in `shape-profile.ts`:
  ```ts
  /** k for a quarter ellipse drawn as one cubic Bézier. */
  export const QUARTER = 0.5522847498
  /** Quarter ellipse from (cx + rx, cy) to (cx, cy + ry) — negative rx goes left. */
  export function quarterEllipse(cx: number, cy: number, rx: number, ry: number): CurveStep
  ```

Shapes (labels in quotes, defaults, size handles):
- **roof** "Roof" 🏠: Length 20 (`length`, x), Width 20 (`width`, y), Height 20 (`height`, z). `extrudeSide([[-L/2,0],[L/2,0],[0,H]], W)`.
- **round-roof** "Round roof" 🌉: Length 20 (x), Width 20 (y), Height 10 (z). `extrudeSide` of base line plus two
  quarter ellipses (rx = L/2, ry = H) meeting at the top `[0, H]`.
- **pyramid** "Pyramid" 🗻: Width 20 (`width`, x), Depth 20 (`depth`, y), Height 20 (`height`, z). Intersection of a
  roof across X (width W, pushed along Y by D) and the same across Y (rotate 90° about Z); free the two roofs.

- [ ] **Step 1: Write the failing tests** in `more-shapes.test.ts` (defaults via `defaultParams`):
  - volumes: roof `4000` (to 1 dp); round-roof within 0.5 % of `Math.PI * 10 * 10 / 2 * 20`; pyramid `toBeCloseTo(8000 / 3, 1)`.
  - bounds for each: `[[-10, -10, 0], [10, 10, H]]` with H = 20, 10, 20 (to 3 dp).
  - In `builtin.test.ts`, extend the registry order list with the three ids at their places.
  - In `print-check.test.ts` add, over `registry.list().filter((p) => p.palette === 'more')`:
    - `has no print problems on a default %s` → `toEqual({ status: 'checked', floating: null, thin: null, overhang: null, thinFinished: true })`;
    - `cuts a default %s as a hole into a block` → group of `box('host', 40, 40, 30)` and the shape as `mode: 'hole'`
      returns `status: 'checked'` (no throw);
    - `rounds the bottom edges of a default %s` → part with modifier `{ ...createModifier('fillet', 'aaaaaaaa'), radius: 0.5, edges: { by: 'description', which: 'bottom' } }` builds via `new Evaluator(registry, createCadToolkit()).local(doc, 'p')`;
    - `rounds all edges of a default %s` → same with `which: 'all'`, skipping `pyramid`.

- [ ] **Step 2: Run** `npx vitest run src/plugins/builtin src/geometry/print-check.test.ts`. Expected: FAIL (no such shapes).

- [ ] **Step 3: Implement** `shape-profile.ts` and the three plugins (`version: 1`, `palette: 'more'`, `min` like
  existing mm params where sensible). Match `wedge.ts` style.

- [ ] **Step 4: Run** the same tests. Expected: PASS. If Check print reports anything, change the shape, not the thresholds.

- [ ] **Step 5: Commit** `feat: Roof, Round roof and Pyramid shapes`.

### Task 5: Tube, Half sphere and Paraboloid

**Files:**
- Create: `src/plugins/builtin/tube.ts`, `half-sphere.ts`, `paraboloid.ts`
- Modify: `src/plugins/builtin/builtin.test.ts`, `src/plugins/builtin/more-shapes.test.ts`

Shapes:
- **tube** "Tube" 🧻: Diameter 20 (`diameter`, x and y), Height 20 (`height`, z), Wall thickness 2 (`wall`, min 0.4).
  Cylinder minus a cylinder of diameter `d − 2·wall`, the hole 2 mm taller and starting 1 mm below. Throw the global
  tube message when `wall ≥ d / 2`.
- **half-sphere** "Half sphere" 🌗: Diameter 20 (x, y), Height 10 (z). `revolve([[0,0],[R,0], quarterEllipse(0,0,R,H)])`.
- **paraboloid** "Paraboloid" 🥚: Diameter 20 (x, y), Height 20 (z). `revolve` of `[0,0]`, `[R,0]` and one curve: the
  parabola is the quadratic Bézier `(R,0) → control (R/2, H) → (0, H)`, as a cubic with controls
  `[R - R/3, 2H/3]` and `[R/3, H]`.

- [ ] **Step 1: Write the failing tests:** volumes tube `Math.PI * (100 - 64) * 20` (to 1 dp), half-sphere within
  0.5 % of `(2 / 3) * Math.PI * 100 * 10`, paraboloid within 0.5 % of `Math.PI * 100 * 20 / 2`; bounds
  `[[-10,-10,0],[10,10,H]]`; tube with `wall: 10` throws `'The wall is too thick for this tube. Make it less than 10 mm.'`;
  tube with `wall: 0.4` builds (Review Focus 3); registry order list extended.

- [ ] **Step 2: Run** `npx vitest run src/plugins/builtin src/geometry/print-check.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the three plugins.

- [ ] **Step 4: Run** the same tests (Task 4's print-check tests now cover these three too). Expected: PASS.

- [ ] **Step 5: Commit** `feat: Tube, Half sphere and Paraboloid shapes`.

### Task 6: Polygon, Star and Heart

**Files:**
- Create: `src/plugins/builtin/polygon.ts`, `star.ts`, `heart.ts`
- Modify: `src/plugins/builtin/shape-profile.ts`, `builtin.test.ts`, `more-shapes.test.ts`
- Test: `src/viewport/sizing.test.ts` (add one case)

**Interfaces:** adds to `shape-profile.ts`:
```ts
export function polygonOutline(sides: number, diameter: number): Point2[]            // flat side at the front (−Y)
export function starOutline(points: number, diameter: number, inner: number): Point2[] // a point at the back (+Y)
export function heartOutline(width: number, length: number): OutlineStep[]           // point at the front (−Y)
```

Shapes (`whole` params use the existing `'whole'` type):
- **polygon** "Polygon" 🛑: Sides 6 (`sides`, whole, min 3, max 12), Diameter 20 (`diameter`, x and y; corner to
  corner), Height 10 (`height`, z). Corner k at angle `−90° + 180°/n + k·360°/n`.
- **star** "Star" ⭐: Points 5 (`points`, whole, 3–12), Diameter 20 (`diameter`, x and y), Inner diameter 10
  (`inner`), Height 5 (`height`, z). `alsoScales: { inner: 'x' }`. Outer corners at `90° + k·360°/n`, inner corners
  halfway between. Throw the global star message when `inner ≥ diameter`.
- **heart** "Heart" ❤️: Width 20 (`width`, x), Length 18 (`length`, y), Height 5 (`height`, z). Right half in units
  of (W/2, L/2), then mirrored for the left half (reverse order, negate x):
  start `(0, −1)`; curve `(0.35, −0.65) (1, −0.1) → (1, 0.35)`; curve `(1, 0.75) (0.78, 1) → (0.5, 1)`;
  curve `(0.22, 1) (0.1, 0.8) → (0, 0.7)`. The joins at `(1, 0.35)` and `(0.5, 1)` are smooth; the dip and the
  point are 90° corners, so Round edges works.

- [ ] **Step 1: Write the failing tests:**
  - polygon defaults: volume `toBeCloseTo((3 * Math.sqrt(3) / 2) * 100 * 10, 1)`; bounds x `±10`, y `±10 * Math.sqrt(3) / 2`.
  - polygon with 3 and 12 sides builds (Review Focus 3); a pentagon's max y is `10` and min y `−10 * Math.cos(Math.PI / 5)`.
  - star defaults: volume `toBeCloseTo(5 * 10 * 5 * Math.sin(Math.PI / 5) * 5, 1)`; max y `10`; star with 3 and 12
    points builds; `inner: 20` throws `'The inner diameter must be smaller than the diameter.'`
  - heart defaults: bounds `[[-10, -9, 0], [10, 9, 5]]` (to 2 dp).
  - `sizing.test.ts`: `paramsFromScale(star, defaults, [2, 2, 1])` gives `diameter: 40, inner: 20` (Review Focus 4).
  - registry order list extended.

- [ ] **Step 2: Run** `npx vitest run src/plugins/builtin src/viewport/sizing.test.ts src/geometry/print-check.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the helpers and three plugins.

- [ ] **Step 4: Run** the same tests. Expected: PASS.

- [ ] **Step 5: Commit** `feat: Polygon, Star and Heart shapes`.

### Task 7: Icosahedron

**Files:**
- Create: `src/plugins/builtin/icosahedron.ts`
- Modify: `src/plugins/builtin/shape-profile.ts`, `builtin.test.ts`, `more-shapes.test.ts`

**Interfaces:** consumes `polyhedron` (Task 2).

- **icosahedron** "Icosahedron" 🎲: Diameter 20 (`diameter`, x, y and z; corner to corner). Corners, with φ = golden
  ratio, scaled so each is `diameter / 2` from the centre:
  `(-1,φ,0) (1,φ,0) (-1,-φ,0) (1,-φ,0) (0,-1,φ) (0,1,φ) (0,-1,-φ) (0,1,-φ) (φ,0,-1) (φ,0,1) (-φ,0,-1) (-φ,0,1)`;
  triangles `[0,11,5] [0,5,1] [0,1,7] [0,7,10] [0,10,11] [1,5,9] [5,11,4] [11,10,2] [10,7,6] [7,1,8] [3,9,4] [3,4,2] [3,2,6] [3,6,8] [3,8,9] [4,9,5] [2,4,11] [6,2,10] [8,6,7] [9,8,1]`.
  Rotate so face `[3,9,4]`'s centre points straight down (−Z), then move up so the lowest point is z = 0. Centred
  on X and Y (the solid's centre stays on the Z axis).

- [ ] **Step 1: Write the failing tests:** with edge `a = 10 / Math.sin(2 * Math.PI / 5)`: volume
  `toBeCloseTo((5 / 12) * (3 + Math.sqrt(5)) * a ** 3, 1)`; min z `0` and max z
  `toBeCloseTo(2 * (Math.sqrt(3) / 12) * (3 + Math.sqrt(5)) * a, 2)` (it lies on a face); the bottom is flat:
  exactly 3 of `icosahedronOnFace(20).points` have `Math.abs(z) < 1e-9`, and their mean x and y are 0 (to 6 dp);
  registry order list extended.

- [ ] **Step 2: Run** `npx vitest run src/plugins/builtin src/geometry/print-check.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** (helper `icosahedronOnFace(diameter): { points: Point3[]; triangles: … }` in `shape-profile.ts`).

- [ ] **Step 4: Run** the same tests. Expected: PASS (Task 4's tests now cover all ten).

- [ ] **Step 5: Commit** `feat: Icosahedron shape`.

### Task 8: Pictures, help, README and end-to-end

**Files:**
- Create: `src/ui/shape-pictures.tsx`, `e2e/more-shapes.spec.ts`
- Modify: `src/ui/PalettePicture.tsx`, `src/help/help-texts.ts`, `README.md`, `src/ui/ShapePalette.test.tsx`

- [ ] **Step 1: Write the failing tests.**
  - `ShapePalette.test.tsx`: with the real registry, every `add-<id>` in More shapes contains `svg.palette-picture`,
    and the region lists the ten ids in the global order.
  - `src/help/lookup.test.ts`: `helpFor('add-tube')?.card` contains `'cups'`; every one of the ten `add-<id>` keys
    is in `HELP_TEXTS` (`Object.hasOwn`).
  - `e2e/more-shapes.spec.ts`:
    - `adds every new shape and exports it`: click each `add-<id>`, then export an STL (retry with `toPass` as in
      `e2e/perfect-fit.spec.ts`) with more than 100 triangles, and `getByLabel(/^Problem/)` has count 0.
    - `remembers when More shapes is closed`: click `more-shapes-toggle`, `add-roof` hidden; reload; still hidden;
      click again; visible.

- [ ] **Step 2: Run** `npx vitest run src/ui/ShapePalette.test.tsx src/help` and `npx playwright test e2e/more-shapes.spec.ts`. Expected: the unit tests FAIL. The e2e tests may already pass, since Tasks 3–7 built what they check.

- [ ] **Step 3: Implement.**
  - Drawings: one small SVG per shape in the style of the peg picture (24×24 viewBox, `width/height="1em"`,
    `className="palette-picture"`, `aria-hidden`, fixed fills that read on light and dark panels, a darker stroke),
    shown slightly from the front so the shape is recognisable. Register all ten in `PalettePicture.tsx`.
  - Help texts (tip / card, `tutorial` omitted), one per shape, saying what it's good for:
    roof "houses, ridges, stands"; round-roof "tunnels, arches, mailbox tops"; tube "cups, pen holders and wheels";
    half-sphere "buttons, domes and eyes"; pyramid "pyramids, spikes and roofs"; polygon "hexagon tiles, nuts and
    signs"; paraboloid "rocket noses and bullet tips"; star "ornaments and badges"; heart "gifts and keychains";
    icosahedron "dice and gems".
  - README: after the `**Text:**` bullet in "Using BloKade", add
    `- **More shapes:** roofs, round roofs, tubes, half spheres, pyramids, polygons, paraboloids, stars, hearts and icosahedrons. Click **More shapes** to open or close the list.`

- [ ] **Step 4: Run** `npx vitest run`, `npm run typecheck`, `npm run build`, `npx playwright test`. Expected: all pass.

- [ ] **Step 5: Commit** `feat: pictures, help and README for More shapes`.
