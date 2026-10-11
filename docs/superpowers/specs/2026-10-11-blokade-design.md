# BloKade — Design Spec

**Date:** 2026-10-11
**Authors:** Larry & Kade (with Claude)
**Status:** Draft for review

## 1. Purpose

BloKade is a browser-based 3D design tool for Kade (age 11) to design parts for
3D printing. It keeps TinkerCAD's simplicity (drag shapes, solid vs. hole,
group) but adds the capabilities Kade has outgrown TinkerCAD for:

- **A. Exact sizes** — typed dimensions, alignment, change one value and the
  design updates.
- **B. Rounded edges** — fillets and chamfers on chosen edges.
- **C. Parts that fit together** — clearance-aware pegs/sockets, screw holes,
  threads, snap-fits.
- **D. Repeating** — linear/circular patterns and mirroring.

It is a family project: Larry and Kade control the feature set. Kade starts as
designer/tester; a plugin system lets him write his own shapes when ready.

### Success criteria

- Milestone 1: Kade designs and prints a part in BloKade without needing TinkerCAD.
- Overall: Kade designs something he could not easily make in TinkerCAD
  (e.g., a phone stand with rounded edges and a snug press-fit peg) and it
  prints and fits on the first or second try.
- Kade writes at least one working shape plugin of his own.

### Constraints

- Private use only: runs locally or in a Docker container on the home network.
  No accounts, no authentication, no public hosting.
- Units are millimeters throughout.
- Desktop browser with mouse and keyboard is the primary target. Touch is
  out of scope.

### Non-goals

- Sculpting or organic mesh modeling (Blender territory).
- 2D sketch-and-constrain workflow (a possible future milestone, not planned).
- Multi-user collaboration and cloud sync.
- Slicing or sending to printer.

## 2. Architecture

```
┌─────────────── Browser ───────────────────────────────┐
│  UI (React)            3D View (Three.js / R3F)       │
│  • toolbar & shapes    • orbit, zoom, select          │
│  • scene tree          • transform handles            │
│  • properties panel    • grid, snapping, measurements │
│  • variables panel     • edge highlighting/picking    │
│           │                   ▲                       │
│           ▼                   │ meshes + edge data    │
│  Design Document (immutable state, Zustand store)     │
│           │                                           │
│           ▼  rebuild requests                         │
│  Geometry Worker (replicad / OpenCascade WASM)        │
│  • evaluates objects, groups, modifiers, plugins      │
│  • per-node result cache                              │
│  • tessellation, export STL / 3MF / STEP              │
└───────────────────────────────────────────────────────┘
          served as static files by nginx in Docker
```

### Tech stack

| Concern | Choice |
|---|---|
| Language | TypeScript (plugins may be plain JavaScript) |
| Build | Vite |
| UI | React |
| 3D view | Three.js via `@react-three/fiber` + `@react-three/drei` |
| Geometry kernel | `replicad` (OpenCascade compiled to WASM) |
| Worker messaging | Comlink |
| State | Zustand, immutable updates only |
| Validation | zod (document schema, plugin params, file import) |
| Formulas | Safe expression parser (e.g., `expr-eval`); never `eval`/`Function` |
| Persistence | IndexedDB autosave + `.blokade` file download/upload |
| Tests | Vitest (unit + geometry), Playwright (E2E) |
| Deploy | Multi-stage Dockerfile → nginx static container |

### Key principle

The **design document is the single source of truth**. Every user action
produces a new document (immutable update). The geometry worker derives all
shapes from the document. Undo/redo, saving, and plugins all build on this.

## 3. Design Document Model

### Structure

The document is a **scene tree of objects that remember how they were made**,
not a global timeline.

```ts
type BloKadeDocument = {
  schemaVersion: number
  name: string
  units: 'mm'
  settings: { fit: number; gridSnap: number }       // fit default 0.2
  variables: Variable[]                             // { name, expr }
  root: NodeId[]
  nodes: Record<NodeId, SceneNode>
}

type SceneNode = ShapeNode | GroupNode

type ShapeNode = {
  id; kind: 'shape'; name
  shapeType: string                    // plugin id, e.g. 'box', 'gear'
  params: Record<string, Value>        // Value = number | formula string
  mode: 'solid' | 'hole'
  transform: Transform                 // position, rotation (Values)
  modifiers: Modifier[]
  hidden: boolean; color: string
}

type GroupNode = {
  id; kind: 'group'; name
  children: NodeId[]
  mode: 'solid' | 'hole'
  transform: Transform
  modifiers: Modifier[]
  hidden: boolean; color: string
}

type Modifier =
  | { type: 'fillet';  enabled; radius: Value;   edges: EdgeSelection }
  | { type: 'chamfer'; enabled; distance: Value; edges: EdgeSelection }
  | { type: 'linearPattern';   enabled; count: Value; spacing: Vec3Value }
  | { type: 'circularPattern'; enabled; count: Value; axis; angle: Value; center: Vec3Value }
  | { type: 'mirror';  enabled; plane: 'XY' | 'XZ' | 'YZ'; keepOriginal: boolean }

type EdgeSelection =
  | { by: 'description'; which: 'all' | 'top' | 'bottom' | 'vertical' | 'horizontal' }
  | { by: 'picked'; fingerprints: EdgeFingerprint[] }
```

### Evaluation rules

- **Group** = union of solid children minus union of hole children, then the
  group's modifiers, then the group's transform. A group's own `mode` decides
  how it participates in its parent.
- **Shape** = plugin `build(params)` → modifiers in order → transform.
- Modifier order matters and is user-reorderable; disabled modifiers are skipped.
- Top-level nodes are rendered and exported individually; export can merge
  all visible top-level solids.

### Variables and formulas

- Any `Value` is a number or a formula string (`"wall * 2"`, `"peg_d + fit"`).
- Built-in variable `fit` comes from `settings.fit`.
- Variables may reference other variables; cycles are detected and reported.
- Formulas are parsed with a safe math parser: arithmetic, parentheses,
  `min/max/round/floor/ceil/sqrt/sin/cos/tan`, variable names. Nothing else.

### Edge selection and the topological naming problem

Edge indices from OpenCascade change when upstream geometry changes. BloKade
never stores edge indices.

1. **By description** (`top`, `bottom`, `vertical`, `horizontal`, `all`) is
   computed from edge geometry relative to the object's bounding box at
   rebuild time. Robust to any size change. This is the default.
2. **Picked edges** store an `EdgeFingerprint`: edge midpoint and direction
   normalized to the object's pre-modifier bounding box, plus edge type
   (line/circle/other) and normalized length. On rebuild, each fingerprint is
   matched to the nearest candidate edge under a distance threshold.
   Unmatched fingerprints mark the modifier with a warning
   ("Lost track of an edge — click to re-pick"); matched edges still apply.
3. Selections are scoped to a single object's own shape, never across the
   whole design.

### Caching

Each node's built result is cached in the worker, keyed by a hash of the node's
resolved parameters, modifiers, plugin version, and children's cache keys.
Editing one object recomputes only that object and its ancestors.

## 4. Editing Experience

### Placement and sizing (A)

- Default workplane on the ground grid; **workplane tool** sets the workplane
  to any clicked face (new shapes land there).
- Grid snap selectable: 1 / 0.5 / 0.1 mm (and off).
- **Object snapping** to other objects' faces, edges, and centers while dragging.
- **Handles:** move arrows, raise/lower, rotation rings (15° snap, Shift = free),
  size handles.
- **Live measurements** while dragging: size and distance to nearest object.
- **Properties panel** always shows size, position, rotation, and plugin
  params; each accepts a number or formula. Tab moves between fields.
- **Align tool:** min/center/max on X/Y/Z across a selection.
- **Undo/redo** for every document change (history of immutable documents,
  capped at 200 entries).
- Keyboard shortcuts for common actions (delete, duplicate, group, ungroup,
  undo, redo, toggle hole).

### Scene tree

A sidebar lists objects and groups with rename, hide, solid/hole toggle, and
drag to regroup. Each node shows its modifier stack; modifiers can be
toggled, reordered, edited, and deleted.

### Fit tools (C)

All fit tools are shape plugins that use the `fit` variable.

| Tool | Description |
|---|---|
| Peg & socket | Creates a matched pair; socket diameter = peg diameter + 2 × `fit`. Round or square. |
| Screw hole | M2–M5 presets; clearance, countersunk, counterbored, hex-nut trap, heat-set insert. |
| Threaded rod / threaded hole | Printable metric-style thread; hole enlarged by `fit`. |
| Snap-fit clip | Matched cantilever hook and catch. |
| Overlap check | Highlights intersecting volume between two selected objects. |

## 5. Plugin System

A shape plugin is a single module:

```js
export default {
  id: 'gear',
  name: 'Gear',
  icon: '⚙️',
  version: 1,
  params: {
    teeth: { type: 'whole', default: 20, min: 6, max: 100, label: 'Teeth' },
    size:  { type: 'mm',    default: 40, min: 5,           label: 'Size' },
    thick: { type: 'mm',    default: 5,  min: 0.4,         label: 'Thickness' },
  },
  build({ teeth, size, thick }, cad) {
    return cad.gearProfile(teeth, size).extrude(thick)
  },
}
```

- **Param types:** `mm`, `whole` (integer), `number`, `angle`, `yesno`,
  `choice` (with `options`). Each generates a matching properties-panel control.
- **Validation:** a plugin's `params` declaration is converted to a zod schema;
  values are validated and clamped before `build` runs.
- **`cad` toolkit:** a small, documented wrapper over replicad. Initial
  surface: `box`, `cylinder`, `sphere`, `cone`, `torus`, `wedge`, `text`,
  `polygon(points)`, `circle`, `rect`, `.extrude(h)`, `.revolve(angle)`,
  `.move(x,y,z)`, `.rotate(axis, deg)`, `.add(other)`, `.cut(other)`,
  `.intersect(other)`. Grows as plugins need it.
- **Execution:** plugins run inside the geometry worker (no DOM access).
  Exceptions become a warning badge on the object; the app keeps running.
- **Location:** `src/plugins/builtin/` (shipped shapes and fit tools) and
  `plugins/` (Kade's own). Both are loaded via a Vite glob import, so saving
  a plugin file during `npm run dev` hot-reloads it.
- **Dogfooding:** every built-in shape and fit tool is a plugin, so the API is
  exercised from day one and provides examples for Kade.

Plugins are trusted local code written by the household; no sandboxing beyond
the worker boundary is required.

## 6. Error Handling and Reliability

- **Per-object build failure:** the object shows a warning badge with a
  plain-English message; the last successful mesh stays displayed (dimmed).
  Other objects are unaffected.
- **Formula errors** (unknown variable, syntax error, cycle) are shown inline
  on the field; the last valid value is used.
- **Worker crash or hang:** the main thread detects it (error event or rebuild
  timeout of 30 s), restarts the worker, and rebuilds from the document.
- **File import:** `.blokade` files are validated with zod. Older
  `schemaVersion`s pass through ordered migration functions. Invalid files
  produce a friendly error and never replace the current design.
- **Autosave:** the document is written to IndexedDB (debounced 1 s).
  If storage is unavailable, the app warns and continues working.
- **Export:** STL/3MF export fails gracefully with a message if any visible
  object is in an error state.

## 7. Persistence and Deployment

- **Autosave** to IndexedDB, with a simple design list (open, rename,
  duplicate, delete).
- **File save/load:** `.blokade` (JSON) download/upload.
- **Export:** STL (binary), 3MF, STEP. Export all visible objects or the selection.
- **Docker:** multi-stage build (`node` → `nginx:alpine`) serving the static
  build. nginx serves `.wasm` with `application/wasm` and long cache headers
  for hashed assets. One `docker compose up -d` to run on the home server.
- **Local dev:** `npm install && npm run dev`.

## 8. Testing Strategy

Target: 80%+ line coverage on non-UI logic.

- **Unit (Vitest):** document operations (immutable add/update/group/ungroup),
  undo/redo, formula parsing and variable resolution (including cycles),
  edge fingerprint matching, plugin param → zod schema conversion, file
  migrations.
- **Geometry (Vitest in Node with replicad):** each built-in plugin builds;
  booleans produce expected volume/bounding box; fillet by description works
  after resizing; exported STL is watertight (manifold check).
- **E2E (Playwright):** add box → resize via panel → add hole cylinder →
  group → round top edges → export STL; save/reload design; variable change
  updates geometry.
- TDD: tests are written before implementation per milestone plan.

## 9. Milestones

Each milestone is independently usable and gets its own implementation plan.

| # | Name | Scope |
|---|---|---|
| 1 | **First Print** | Project scaffold; document model + store; geometry worker; plugin loader; basic shapes (box, cylinder, sphere, cone, wedge, torus, text) as plugins; solid/hole; groups; selection; move/rotate/size handles; grid snap; properties panel (numbers only); scene tree; undo/redo; autosave + file save/load; STL/3MF export; Dockerfile + compose. |
| 2 | **Smart Sizes** | Variables panel and formulas in every field; `fit` setting; align tool; object snapping; workplane on face; live measurements. |
| 3 | **Round & Repeat** | Modifier stack UI; fillet/chamfer (by description, then picked edges with fingerprints); linear and circular patterns; mirror; STEP export. |
| 4 | **Perfect Fit** | Peg & socket, screw holes, threads, snap-fit clip, overlap check. |
| 5 | **Kade's Plugins** | Documented `cad` toolkit; plugin guide and "make your first shape" tutorial; `plugins/` folder for Kade's shapes; example gear plugin. |

## 10. Open Questions

None blocking. To revisit after Milestone 1:

- Whether to add optional server-side design storage on the home server.
- Whether a 2D sketch mode is worth a future milestone.
