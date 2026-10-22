# STL Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kade can import an STL file as an ordinary part that can be moved, sized, cut with holes, saved and exported.

**Architecture:**
- **Reading the file (geometry worker):** the STL is read, welded, simplified if too detailed, checked for gaps,
  and centred. This happens in the geometry worker, so the page never freezes.
- **Storing it:** the triangles go into a new `models` map on the document, keyed by a hash of the triangles. The
  part is a normal shape node of the hidden `imported` shape type, with `width`/`depth`/`height` settings.
- **Building it:** the Evaluator builds an imported part by stretching the stored triangles to those sizes and
  turning them into an OpenCascade solid. From then on, holes, groups, patterns and export work unchanged.

**Tech Stack:** TypeScript 5.9 strict, React 19, replicad + OpenCascade (geometry worker, Comlink), Zustand, zod 4,
Vitest, Playwright. New dependency: `meshoptimizer` (exact version `1.2.0`, MIT).

**Spec:** `docs/superpowers/specs/2026-10-22-blokade-stl-import-design.md`

## Global Constraints

- STL only: binary and ASCII. No other formats.
- Files over 50 MB are refused before reading: "This file is too big for BloKade (over 50 MB)."
- Unreadable or not an STL: "BloKade couldn't read this file. Is it an STL?"
- No triangles: "This file has no shape in it."
- Simplified: "This model was very detailed, so BloKade simplified it to {N} triangles. It will look a little smoother." `{N}` is the triangle count after simplifying, written with a thousands separator (`toLocaleString('en-US')`).
- Gaps: "This model has gaps in its surface, so holes might not cut it properly."
- Too large: "This is bigger than BloKade allows (2000 mm). Try another unit." The **Import** button is disabled while it shows.
- Units: mm (default, factor 1), cm (10), inches (25.4).
- Importing is one undo step. The new part is solid, selected, named after the file without `.stl`, centred on the workplane origin, and sits on the floor.
- Fillet and chamfer are not offered for an imported part or for a group that contains one.
- Imported parts (and groups containing one) draw only sharp edges: where faces meet at more than 30°.
- Kid-facing copy: short sentences, no blame, controls in **bold**, `**text**` is the only markup.
- Commit trailer, exactly: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never stage `docs/superpowers/.DS_Store`.
- Script and package versions are pinned exactly. No floating ranges for the new dependency: `"meshoptimizer": "1.2.0"`.

## Review Focus

1. **The same file imported twice, then one copy deleted.** Expected: one stored model, and the other part still builds. (Task 3 test "importing the same model twice stores it once".)
2. **Undo after the model was dropped from a save.** Delete the imported part, wait for autosave (which drops the unused model), then undo. Expected: the part comes back and builds, because the in-memory history still holds the model, and the next save keeps it. (Task 3 test "drops a model only from the saved copy".)
3. **A binary STL whose 80-byte header starts with `solid`.** Many exporters (SolidWorks among them) do this. Expected: it's read as binary, not as text. (Task 2 test "reads a binary file whose header starts with solid".)
4. **A large detailed file (about 200,000 triangles).** Expected: the page stays responsive while it's read, and the dialog says it was simplified. (Task 2 test "simplifies a detailed model to the limit"; Task 5 runs it in the worker.)
5. **Cutting a model that has gaps.** Expected: the group shows a friendly build problem, never a crash or a stuck worker. (Task 4 test "a model with gaps fails to cut with a friendly problem".)

---

## File Structure

| File | Job |
|---|---|
| `src/geometry/mesh-solid.ts` (new) | Triangles → OpenCascade solid (synchronous). |
| `src/geometry/feature-edges.ts` (new) | Sharp-edge lines for a display mesh. |
| `src/import/limits.ts` (new) | Import limits and messages. |
| `src/import/stl.ts` (new) | Reading binary and ASCII STL. |
| `src/import/prepare.ts` (new) | Parse → weld → simplify → gap check → centre → size. |
| `src/import/simplify.ts` (new) | Wrapper around `meshoptimizer`. |
| `src/document/models.ts` (new) | Model encoding, ids, adding an imported part, in-use and cleanup helpers. |
| `src/plugins/builtin/imported.ts` (new) | The hidden `imported` shape: its settings and size mapping. |
| `src/document/types.ts`, `schema.ts`, `src/persistence/migrate.ts` | `models` on the document, schema version 5. |
| `src/geometry/evaluate.ts`, `api.ts`, `types.ts`, `client.ts`, `geometry.worker.ts` | Building imported parts, `prepareStl` on the worker. |
| `src/app/import-stl.ts`, `src/app/useStlImport.ts` (new) | Units, limits, and the import flow. |
| `src/ui/ImportDialog.tsx` (new), `ShapePalette.tsx`, `Workspace.tsx`, `ModifierStack.tsx`, `PropertiesPanel.tsx` | The UI. |
| `src/help/help-texts.ts`, `README.md`, `e2e/stl-import.spec.ts`, `e2e/fixtures/*.stl` | Help, docs and end-to-end tests. |

---

### Task 1: Triangles to a solid, and the timing check

**Files:**
- Create: `src/geometry/mesh-solid.ts`, `src/geometry/mesh-solid.test.ts`, `src/geometry/mesh-solid.timing.test.ts`
- Create: `src/geometry/testing/meshes.ts` (test meshes, shared by later tasks)

**Interfaces:**
- Produces:
  - `meshSolid(vertices: ArrayLike<number>, triangles: ArrayLike<number>): Shape3D`. Throws `Error('This model has no shape in it.')` for zero triangles.
  - Test helpers in `testing/meshes.ts`: `cubeMesh(size: number): { vertices: number[]; triangles: number[] }` (12 triangles, centred on x/y, z from 0); `openCubeMesh(size: number)` (the same, without its top two triangles); `sphereMesh(diameter: number, segments: number, rings: number)` (a UV sphere, closed, with `2 * segments * (rings - 1)` triangles).
  - A measured value for `MAX_IMPORT_TRIANGLES`, recorded in the ledger and used by Task 2.

- [ ] **Step 1: Write the failing tests** in `mesh-solid.test.ts` (with `beforeAll(initTestOC)`):

```ts
it('turns a closed mesh into a solid of the right size', () => {
  const { vertices, triangles } = cubeMesh(10)
  const solid = meshSolid(vertices, triangles)
  expect(measureVolume(solid)).toBeCloseTo(1000, 3)
  expect(shapeBox(solid)).toEqual({ min: [-5, -5, 0], max: [5, 5, 10] })   // shapeBox from ./edge-info, compare with toBeCloseTo per value if needed
})

it('can be cut by an ordinary shape', () => {
  const solid = meshSolid(...Object.values(cubeMesh(20)) as [number[], number[]])
  const hole = createCadToolkit().cylinder(10, 40).translateZ(-10)
  expect(measureVolume(solid.cut(hole))).toBeCloseTo(8000 - Math.PI * 25 * 20, 0)
})

it('refuses an empty mesh', () => {
  expect(() => meshSolid([], [])).toThrow('This model has no shape in it.')
})
```

- [ ] **Step 2: Run** `npx vitest run src/geometry/mesh-solid.test.ts`. Expected: FAIL, `meshSolid` is not defined.

- [ ] **Step 3: Implement `meshSolid`** as replicad's own `importSTL` does it, but synchronously:
  - write a binary STL of the triangles to OpenCascade's virtual file system (`getOC().FS.writeFile`) under a unique name;
  - read it with `StlAPI_Reader` into a `TopoDS_Shell`, and unlink the file in a `finally`;
  - merge flat neighbours with `ShapeUpgrade_UnifySameDomain(shell, true, true, false)`;
  - make a solid with `BRepBuilderAPI_MakeSolid`, and return it wrapped with replicad's `cast`.
  - Free every OpenCascade object you create, the way `src/geometry/modifiers.ts` and `edge-seams.ts` do.

- [ ] **Step 4: Run the tests again.** Expected: 3 pass.

- [ ] **Step 5: The timing check** (the spec's §3). Write `mesh-solid.timing.test.ts`, guarded with `describe.skipIf(!process.env.BLOKADE_TIMING)`.
  - For each of 10,000, 20,000 and 40,000 triangles, build a `sphereMesh(40, …)` with about that many triangles.
  - Time `meshSolid` plus one `.cut()` with a 10 mm cylinder through its middle, and `console.info` the milliseconds.

  Run: `BLOKADE_TIMING=1 npx vitest run src/geometry/mesh-solid.timing.test.ts`

  Rule: `MAX_IMPORT_TRIANGLES` is the largest of the three whose build-plus-cut took under 3000 ms; if none did, it's 5,000. Record a ledger line: `Task 1: timing <10k ms>/<20k ms>/<40k ms> → MAX_IMPORT_TRIANGLES = <value>`.

- [ ] **Step 6: Commit**

```bash
git add src/geometry/mesh-solid.ts src/geometry/mesh-solid.test.ts src/geometry/mesh-solid.timing.test.ts src/geometry/testing/meshes.ts
git commit -m "feat: turn imported triangles into a solid

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Reading and preparing an STL

**Files:**
- Create: `src/import/limits.ts`, `src/import/stl.ts`, `src/import/simplify.ts`, `src/import/prepare.ts`
- Test: `src/import/stl.test.ts`, `src/import/prepare.test.ts`
- Modify: `package.json` (add `"meshoptimizer": "1.2.0"` to dependencies), `package-lock.json`

**Interfaces:**
- Consumes: `weldMesh`, `countOpenEdges` from `src/geometry/weld.ts`; the test meshes from Task 1.
- Produces:
  - `limits.ts`:
    - `MAX_STL_BYTES = 50 * 1024 * 1024`;
    - `MAX_IMPORT_TRIANGLES` (Task 1's value);
    - `MAX_MODELS = 20`;
    - the message constants `TOO_BIG_FILE`, `NOT_STL`, `NO_TRIANGLES`, `HAS_GAPS_NOTE`, `TOO_LARGE_SIZE` with the exact copy from Global Constraints;
    - `simplifiedNote(count: number): string`.
  - `stl.ts`:
    - `class StlError extends Error` (its message is always one of the messages above);
    - `parseStl(buffer: ArrayBuffer): { vertices: Float32Array; triangles: Uint32Array }`, where vertices are unwelded, 9 floats per triangle.
  - `simplify.ts`: `simplifyMesh(vertices: Float32Array, triangles: Uint32Array, maxTriangles: number): Promise<{ vertices: Float32Array; triangles: Uint32Array }>`.
  - `prepare.ts`:

```ts
export interface PreparedModel {
  readonly vertices: Float32Array   // welded, in the file's units, centred on x/y, min z = 0
  readonly triangles: Uint32Array
  readonly size: Vec3               // width, depth, height in the file's units
  readonly triangleCount: number
  readonly simplified: boolean
  readonly hasGaps: boolean
}
export type PrepareResult = { readonly ok: true; readonly model: PreparedModel } | { readonly ok: false; readonly message: string }
export function prepareStl(buffer: ArrayBuffer, maxTriangles?: number): Promise<PrepareResult>   // never throws
```

- [ ] **Step 1: Write the failing tests.**

`stl.test.ts`. Build the inputs in the test with small helpers that write binary and ASCII STL from `cubeMesh`.

```ts
it('reads a binary STL', () => expect(parseStl(binaryStl(cubeMesh(10))).triangles.length).toBe(36))
it('reads an ASCII STL', () => expect(parseStl(asciiStl(cubeMesh(10))).vertices.length).toBe(108))
it('reads a binary file whose header starts with solid', () => {
  expect(parseStl(binaryStl(cubeMesh(10), 'solid exported by CAD')).triangles.length).toBe(36)
})
it('refuses something that is not an STL', () => {
  expect(() => parseStl(new TextEncoder().encode('hello there').buffer)).toThrow(NOT_STL)
})
it('refuses an STL with no triangles', () => {
  expect(() => parseStl(binaryStl({ vertices: [], triangles: [] }))).toThrow(NO_TRIANGLES)
})
```

A buffer is binary when `84 + 50 × (uint32 at byte 80) === byteLength`; otherwise it's parsed as ASCII.

`prepare.test.ts`:

```ts
it('welds, centres and measures a model', async () => {
  const result = await prepareStl(binaryStl(shifted(cubeMesh(10), [100, 50, 7])))
  expect(result).toMatchObject({ ok: true, model: { size: [10, 10, 10], triangleCount: 12, simplified: false, hasGaps: false } })
  // vertices: min x/y = -5, max x/y = 5, min z = 0, and 8 welded vertices
})
it('notices gaps', async () => {
  expect(await prepareStl(binaryStl(openCubeMesh(10)))).toMatchObject({ ok: true, model: { hasGaps: true } })
})
it('simplifies a detailed model to the limit', async () => {
  const result = await prepareStl(binaryStl(sphereMesh(40, 128, 64)), 2000)
  expect(result.ok && result.model.simplified).toBe(true)
  expect(result.ok && result.model.triangleCount).toBeLessThanOrEqual(2000)
})
it('turns a bad file into a message', async () => {
  expect(await prepareStl(new ArrayBuffer(10))).toEqual({ ok: false, message: NOT_STL })
})
it('refuses a file over 50 MB without reading it', async () => {
  expect(await prepareStl(new ArrayBuffer(MAX_STL_BYTES + 1))).toEqual({ ok: false, message: TOO_BIG_FILE })
})
```

- [ ] **Step 2: Run** `npx vitest run src/import`. Expected: FAIL, modules missing.

- [ ] **Step 3: Install the dependency and implement.**
  - Run `npm install --save-exact meshoptimizer@1.2.0`.
  - **`simplifyMesh`:**
    - `await MeshoptSimplifier.ready`;
    - call `MeshoptSimplifier.simplify(triangles, vertices, 3, maxTriangles * 3, 0.05)`;
    - if the result is still over the limit, call `simplifySloppy` with the same target;
    - then drop vertices no triangle uses.
  - **`prepareStl`:** check the size first, then parse, weld (`weldMesh`), and simplify when the count is over the limit. After that, check gaps (`countOpenEdges > 0`), centre the model, and measure it.
    - Catch `StlError` and return its message.
    - Any other error returns `NOT_STL`, logged with `console.error`.

- [ ] **Step 4: Run** `npx vitest run src/import`. Expected: all pass.

- [ ] **Step 5: Commit** `feat: read, weld and simplify STL files` (add both source and test files, plus `package.json` and `package-lock.json`).

---

### Task 3: Models in the document

**Files:**
- Create: `src/document/models.ts`, `src/document/models.test.ts`, `src/plugins/builtin/imported.ts`
- Modify: `src/document/types.ts`, `src/document/schema.ts`, `src/document/factory.ts` (empty `models`), `src/persistence/migrate.ts`, `src/plugins/index.ts` (register `imported`), `src/plugins/types.ts` (`TextParamSpec.hidden?: true`), `src/ui/PropertiesPanel.tsx` (skip hidden params), `src/persistence/design-file.ts`, `src/app/useAutosave.ts`
- Test: `src/persistence/migrate.test.ts`, `src/persistence/design-file.test.ts`, `src/ui/PropertiesPanel.test.tsx`

**Interfaces:**
- Consumes: `PreparedModel` (Task 2), `codeHash` from `src/kade/hash.ts`, `MAX_MODELS`.
- Produces:
  - `types.ts`:
    - `interface ImportedModel { readonly name: string; readonly vertices: string; readonly triangles: string }`, where both arrays are base64 of little-endian `Float32Array` and `Uint32Array`;
    - `BloKadeDocument.models: Readonly<Record<string, ImportedModel>>`;
    - `schemaVersion: 5`;
    - `CURRENT_SCHEMA_VERSION = 5`.
  - `models.ts`:
    - `IMPORTED_SHAPE = 'imported'`;
    - `encodeModel(name: string, vertices: Float32Array, triangles: Uint32Array): { id: string; model: ImportedModel }`. The id is `codeHash(model.vertices + '|' + model.triangles)`.
    - `decodeModel(model: ImportedModel): { vertices: Float32Array; triangles: Uint32Array }`.
    - `addImportedPart(doc: BloKadeDocument, input: { name: string; vertices: Float32Array; triangles: Uint32Array; size: Vec3; color: string; position?: Vec3; rotation?: Vec3 }): { doc: BloKadeDocument; id: NodeId }`. It throws `DocumentOpError('This design already has 20 imported models. Delete one you don't use first.')` when a new model would pass `MAX_MODELS`.
    - `modelsInUse(doc: BloKadeDocument): ReadonlySet<string>`.
    - `withoutUnusedModels(doc: BloKadeDocument): BloKadeDocument`.
    - `containsImported(doc: BloKadeDocument, id: NodeId): boolean`, which is true for an imported part, or a group with one anywhere inside.
  - The `imported` plugin:
    - `{ id: 'imported', name: 'Imported model', icon: '📥', palette: 'hidden', version: 1 }`;
    - params `model` (`text`, default `''`, `hidden: true`, label `Model`), and `width`, `depth`, `height` (`mm`, default 20, labels `Width`, `Depth`, `Height`);
    - `size: { x: 'width', y: 'depth', z: 'height' }`;
    - `build` throws `Error('Imported models are built by BloKade itself.')`, because the Evaluator builds them (Task 4).

- [ ] **Step 1: Write the failing tests.**

`models.test.ts`:

```ts
it('stores a model once and makes a part that uses it', () => {
  const { doc, id } = addImportedPart(createEmptyDocument(), part('Gear'))
  expect(Object.keys(doc.models)).toHaveLength(1)
  expect(doc.nodes[id]).toMatchObject({ shapeType: 'imported', name: 'Gear', mode: 'solid', params: { width: 10, depth: 10, height: 10 } })
})
it('importing the same model twice stores it once', () => {
  const once = addImportedPart(createEmptyDocument(), part('Gear')).doc
  const twice = addImportedPart(once, part('Gear again')).doc
  expect(Object.keys(twice.models)).toHaveLength(1)
  expect(modelsInUse(removeNodes(twice, [Object.keys(once.nodes)[0]!]))).toEqual(new Set(Object.keys(twice.models)))
})
it('round-trips the triangles exactly', () => { /* encode then decode a cubeMesh: arrays equal */ })
it('drops a model only from the saved copy', () => {
  const { doc, id } = addImportedPart(createEmptyDocument(), part('Gear'))
  const removed = removeNodes(doc, [id])
  expect(withoutUnusedModels(removed).models).toEqual({})
  expect(removed.models).not.toEqual({})            // the history's copy still has it
})
it('knows when a group contains an imported part', () => { /* group an imported part with a box: true for the group, false for a lone box */ })
it('stops at 20 models', () => { /* 20 different models OK, the 21st throws the exact message */ })
```

Also add these tests:
- `migrate.test.ts`: a version 4 design migrates to 5 with `models: {}`.
- `design-file.test.ts`:
  - `serializeDesign` leaves out unused models;
  - a design with an imported part survives `serializeDesign` → `parseDesignFile`;
  - a design whose part names a missing model still parses, because a missing model is a build problem, not a broken file.
- `PropertiesPanel.test.tsx`: an imported part shows **Width**, **Depth** and **Height**, and no **Model** field.

- [ ] **Step 2: Run** `npx vitest run src/document src/persistence src/ui/PropertiesPanel.test.tsx`. Expected: FAIL on the missing module and the new expectations.

- [ ] **Step 3: Implement.**
  - **zod schema:** `models` is a `z.record` keyed by `/^[0-9a-f]{8}-[0-9a-z]+$/`. Each value is `{ name: string (max 100), vertices: base64 string, triangles: base64 string }`.
    - Limit the base64 lengths to what `MAX_IMPORT_TRIANGLES` allows: at most `3 × MAX_IMPORT_TRIANGLES` vertices of 12 bytes, and `MAX_IMPORT_TRIANGLES` triangles of 12 bytes, each × 4/3 rounded up, plus 4.
    - At most `MAX_MODELS` entries.
  - **Migration 4 → 5** adds `models: {}`.
  - **`serializeDesign`** and the autosave's `save` (in `useAutosave.ts`) both write `withoutUnusedModels(doc)`.
  - **Base64:** encode in chunks of 32 KB with `String.fromCharCode`, so large arrays don't overflow the call stack.

- [ ] **Step 4: Run** `npm test`. Expected: all pass, including the existing schema and migration tests, updated for version 5.

- [ ] **Step 5: Commit** `feat: store imported models in the design`.

---

### Task 4: Building imported parts

**Files:**
- Create: `src/geometry/feature-edges.ts`, `src/geometry/feature-edges.test.ts`
- Modify: `src/geometry/evaluate.ts`, `src/geometry/api.ts`
- Test: `src/geometry/evaluate.test.ts`, `src/geometry/api.test.ts`

**Interfaces:**
- Consumes: `meshSolid` (Task 1); `IMPORTED_SHAPE`, `decodeModel`, `containsImported`, `addImportedPart` (Task 3).
- Produces: `featureEdges(positions: Float32Array, indices: Uint32Array, minAngleDegrees?: number): Float32Array`. It returns line segments (6 floats each) for edges whose two faces meet at more than `minAngleDegrees` (default 30), plus edges with only one face. It welds positions first, because OpenCascade's display mesh repeats vertices per face.

- [ ] **Step 1: Write the failing tests.**

`feature-edges.test.ts`:

```ts
it('draws the 12 edges of a cube', () => expect(featureEdges(...flat(cubeMesh(10))).length).toBe(12 * 6))
it('hides the diagonal of a flat square', () => expect(featureEdges(...flat(squareMesh())).length).toBe(4 * 6))
it('hides the edges of a smooth sphere', () => {
  expect(featureEdges(...flat(sphereMesh(40, 32, 16))).length).toBe(0)
})
```

`evaluate.test.ts`:

```ts
it('builds an imported part at its size', () => {
  const { doc, id } = addImportedPart(createEmptyDocument(), fromMesh(cubeMesh(10)))
  expect(shapeBox(newEvaluator().local(doc, id))).toMatchObject({ min: [-5, -5, 0], max: [5, 5, 10] })
})
it('stretches only the axis that changed', () => {
  // updateNode width → 30: box x is -15..15, y and z unchanged
})
it('cuts an imported part with a hole', () => {
  // group the cube (20 mm) with a cylinder hole (d10, h40, z -10): volume ≈ 8000 - π·25·20
})
it('explains a missing model', () => {
  // delete doc.models entry: throws NodeBuildError 'This imported model is missing from the design. Import it again.'
})
it('a model with gaps fails to cut with a friendly problem', () => {
  // openCubeMesh grouped with a cylinder hole: rebuild returns { status: 'error' } with a message, and no throw escapes
})
```

`api.test.ts`:
- `rebuild` of a design with an imported cube gives edges from `featureEdges` (12 segments), not every triangle edge.
- `exportStl` of it gives a closed mesh of volume 1000.

- [ ] **Step 2: Run** `npx vitest run src/geometry`. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - **Evaluator:**
    - `base()` passes `doc` to `shapeLocal(doc, node)`.
    - When `node.shapeType === IMPORTED_SHAPE`, it builds through `importedLocal`.
    - `importedLocal` decodes the model, keeping decoded arrays in a `Map<string, …>` keyed by model id. It works out the model's own size from the vertices, scales each axis by `width/size`, `depth/size` and `height/size`, and calls `meshSolid`.
    - The cache key stays `shapeKey(node)`. That's safe because model ids are content hashes.
    - Failures become `NodeBuildError` with the plugin-crash wording already used: `Imported model couldn't be built: …`.
  - **`api.ts` `buildNode`:** when `containsImported(doc, id)`, replace `mesh.edges` with `featureEdges(mesh.positions, mesh.indices)`.

- [ ] **Step 4: Run** `npm test`. Expected: all pass.

- [ ] **Step 5: Commit** `feat: build, cut and export imported models`.

---

### Task 5: Preparing files in the geometry worker

**Files:**
- Modify: `src/geometry/types.ts` (`GeometryApi.prepareStl`), `src/geometry/api.ts`, `src/geometry/client.ts`
- Test: `src/geometry/api.test.ts`, `src/geometry/client.test.ts`

**Interfaces:**
- Consumes: `prepareStl`, `PrepareResult` (Task 2).
- Produces:
  - `GeometryApi.prepareStl(bytes: ArrayBuffer): Promise<PrepareResult>`;
  - `GeometryClient.prepareStl(bytes: ArrayBuffer): Promise<PrepareResult>`, which transfers the buffer with `Comlink.transfer(bytes, [bytes])` and queues behind builds like `exportStl`.

- [ ] **Step 1: Write the failing tests.**
  - `api.test.ts`: `api.prepareStl(binaryStl(cubeMesh(10)))` resolves `{ ok: true }` with size `[10, 10, 10]`.
  - `client.test.ts`: `prepareStl` goes through the same `call` path as `exportStl` (follow the file's existing `exportStl` test).
- [ ] **Step 2: Run** `npx vitest run src/geometry/api.test.ts src/geometry/client.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** (one line each in `api.ts` and `client.ts`, plus the type).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: prepare STL files in the geometry worker`.

---

### Task 6: The import flow and dialog

**Files:**
- Create: `src/app/import-stl.ts`, `src/app/import-stl.test.ts`, `src/app/useStlImport.ts`, `src/ui/ImportDialog.tsx`, `src/ui/ImportDialog.test.tsx`
- Modify: `src/ui/ShapePalette.tsx`, `src/ui/Workspace.tsx`, `src/ui/ModifierStack.tsx`, `src/ui/App.css`
- Test: `src/ui/ShapePalette.test.tsx`, `src/ui/ModifierStack.test.tsx`

**Interfaces:**
- Consumes: `GeometryClient.prepareStl` (Task 5); `addImportedPart`, `containsImported` (Task 3); `MAX_STL_BYTES`, the messages (Task 2); `MAX_MM` from `src/plugins/params.ts`; `pickColor` from `src/document/factory.ts`.
- Produces:
  - `import-stl.ts`:
    - `type ImportUnit = 'mm' | 'cm' | 'inches'`;
    - `UNIT_FACTORS: Readonly<Record<ImportUnit, number>>` = `{ mm: 1, cm: 10, inches: 25.4 }`;
    - `sizeInMm(size: Vec3, unit: ImportUnit): Vec3`;
    - `fitsBloKade(size: Vec3): boolean`, which means every size is ≤ `MAX_MM`;
    - `partNameFor(fileName: string): string`, which drops a final `.stl` in any case, then trims and cuts to 60 characters, and falls back to `Imported model`;
    - `importPart(store: BloKadeStore, fileName: string, model: PreparedModel, unit: ImportUnit): void`. It scales the vertices and size by the unit factor and calls `addImportedPart` with `pickColor` and the workplane origin and rotation, as `addShape` does. That's one `apply`. It then selects the new part. A `DocumentOpError` becomes `store.getState().notify(message)`.
  - `useStlImport(client, store)` → `{ pending: { fileName: string; model: PreparedModel } | null; busy: boolean; choose(file: File): void; confirm(unit: ImportUnit): void; cancel(): void }`:
    - `choose` refuses files over `MAX_STL_BYTES` with `notify(TOO_BIG_FILE)` and without reading them;
    - otherwise it reads `file.arrayBuffer()`, calls `prepareStl`, and either sets `pending` or notifies the message.
  - `ImportDialog` props: `{ fileName: string; model: PreparedModel; onImport(unit: ImportUnit): void; onCancel(): void }`. Test ids:
    - `import-dialog`;
    - `import-size`, text like `20 × 20 × 10 mm`, using `formatMm` from `src/viewport/measure.ts`;
    - `import-units` (a select);
    - `import-note-simplified`, `import-note-gaps`, `import-too-large`;
    - `import-confirm` (**Import**), `import-cancel` (**Cancel**).

    It uses the `dialog-backdrop` and `dialog` classes from `DesignsDialog`. Esc and a backdrop click cancel.
  - `ShapePalette` gains an optional `onImport?(file: File): void`. When it's given, a `📥 Import STL` label-button with a hidden `<input type="file" accept=".stl,model/stl" data-testid="import-stl">` goes at the end of the Shapes grid, with `data-help="import-stl"`.
  - `Workspace`:
    - wires `useStlImport` and renders `ImportDialog` when `pending` is set;
    - passes `onImport` to `ShapePalette`;
    - wraps the viewport in a drop target: `dragover` calls `preventDefault`, and `drop` takes the first file whose name ends in `.stl`, case-insensitive. A drop with no `.stl` file does nothing.
    - While `busy`, the palette's import button is disabled and the viewport shows a `viewport-hint` saying "Reading the model…".
  - `ModifierStack`: when `containsImported(doc, node.id)`, the `add-modifier` select leaves out `fillet` and `chamfer`.

- [ ] **Step 1: Write the failing tests.**

`import-stl.test.ts`:

```ts
it('converts sizes to mm', () => expect(sizeInMm([1, 2, 3], 'inches')).toEqual([25.4, 50.8, 76.2]))
it('knows what fits', () => {
  expect(fitsBloKade([2000, 10, 10])).toBe(true)
  expect(fitsBloKade([2000.1, 10, 10])).toBe(false)
})
it('names the part after the file', () => {
  expect(partNameFor('Benchy.STL')).toBe('Benchy')
  expect(partNameFor('.stl')).toBe('Imported model')
})
it('adds the part in one undo step, selected and in mm', () => {
  importPart(store, 'cube.stl', prepared(cubeMesh(1)), 'cm')
  // one undo restores the empty design; before undo, the part has width 10 and is the selection
})
```

`ImportDialog.test.tsx`:
- **The size readout follows the unit choice:** `20 × 20 × 10 mm` becomes `50.8 × 50.8 × 25.4 mm` for inches.
- **The notes show only when they apply:** the simplified note uses the exact copy with `20,000`, and the gaps note uses the exact copy.
- **Too large:** a model 100 × 1 × 1 in inches shows `TOO_LARGE_SIZE`, and **Import** is disabled.
- **Import** calls `onImport` with the chosen unit, and **Esc** calls `onCancel`.

`ShapePalette.test.tsx`: choosing a file on `import-stl` calls `onImport` with it.

`ModifierStack.test.tsx`: an imported part's `add-modifier` options are exactly `linearPattern`, `circularPattern` and `mirror`.

- [ ] **Step 2: Run** `npx vitest run src/app/import-stl.test.ts src/ui`. Expected: FAIL.
- [ ] **Step 3: Implement** as in Interfaces.
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: all pass, including `src/help/coverage.test.tsx`. If coverage fails on the new controls, that's expected until Task 7, so note it and go on.
- [ ] **Step 5: Commit** `feat: import an STL from the palette or by dropping it on the 3D view`.

---

### Task 7: Help, README and end-to-end tests

**Files:**
- Modify: `src/help/help-texts.ts`, `src/help/lookup.test.ts`, `src/help/coverage.test.tsx`, `README.md`
- Create: `e2e/stl-import.spec.ts`, `e2e/fixtures/cube-20.stl` (binary, 12 triangles, 20 mm), `e2e/fixtures/not-a-model.stl` (the text `hello`)

**Interfaces:**
- Consumes: the test ids from Task 6.

- [ ] **Step 1: Write the failing tests.**
  - **`lookup.test.ts`:** `helpFor('import-stl')`, `helpFor('import-units')`, `helpFor('import-confirm')` and `helpFor('import-cancel')` are all non-null. The `import-stl` card contains `**Import STL**`.
  - **`coverage.test.tsx`:** render `ImportDialog` with a sample model; `missingHelp()` is `[]`.
  - **`e2e/stl-import.spec.ts`:**
    1. **Import, size, cut, undo:**
       - `setInputFiles` on `import-stl` with `cube-20.stl` → `import-dialog` shows `20 × 20 × 20 mm` → **Import** → `param-width` is `20`, `prop-name` is `cube-20`.
       - With **⤢ Size**, drag the `x+` handle as `e2e/size-handles.spec.ts` does → width over 30. Use `expect.poll` for the read, per the face-handles ruling.
       - Add a cylinder, make it a hole, select both, **Group** → no problem shown for the group.
       - **Undo** back to the import → `param-width` is `20` again.
    2. **A bad file:** `not-a-model.stl` → the notice says `BloKade couldn't read this file. Is it an STL?`, and the design has no parts.
    3. **Save and load:** import the cube, **Save to file**, and capture the download. Then, in a new page, use **Load from file** with the saved file → an imported part shows `param-width` `20` with no problem badge.
- [ ] **Step 2: Run** `npx vitest run src/help` and `npx playwright test e2e/stl-import.spec.ts`. Expected: FAIL on the missing help, then on the specs before the help exists.
- [ ] **Step 3: Write the help texts and the README section.**

  Help texts (tip ≤ 110 characters):
  - **`import-stl`:**
    - tip: "Brings in a 3D model from an STL file."
    - card: "Click **Import STL** and pick an STL file, for example from Thingiverse or TinkerCAD. You can also drop the file on the 3D view. The model becomes a part you can move, size and cut with holes."
  - **`import-units`:**
    - tip: "Says what units the file uses."
    - card: "STL files don't say how big a unit is. If the size looks too small or too big, try another unit."
  - **`import-confirm`:**
    - tip: "Adds the model to your design."
    - card: "Adds the model as a new part. One **Undo** takes it away again."
  - **`import-cancel`:**
    - tip: "Closes this without adding anything."
    - card: "Closes this window. Your design doesn't change."

  README: add an "Importing models" section under the features list, with three bullets:
  - where STL files come from;
  - the units question;
  - very detailed models get simplified, and rounded edges aren't offered on imported models.
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run build && npm run e2e`. Expected: all pass; `build` prints only the existing chunk-size warning.
- [ ] **Step 5: Commit** `docs: help and README for importing STL files` (help files, README, e2e spec and fixtures).
