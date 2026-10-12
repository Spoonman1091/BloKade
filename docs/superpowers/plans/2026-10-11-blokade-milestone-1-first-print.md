# BloKade Milestone 1 ("First Print") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser-based 3D design app where Kade can add basic shapes, mark them solid or hole, group them, move/rotate/resize them precisely, undo, save designs, and export STL/3MF for printing. The app is served from a small Docker container.

**Architecture:** One immutable design document is the single source of truth. A React UI and a Three.js viewport read the document from a Zustand store, and every edit produces a new document. A Web Worker running replicad (OpenCascade compiled to WASM) rebuilds solids from the document, using a per-node cache, and sends triangle meshes back. Shapes are plugins (`definePlugin`), including all the built-in shapes.

**Tech Stack:** TypeScript 5.9, React 19, Vite 8, Three.js 0.186 + @react-three/fiber 9 + @react-three/drei 10, replicad 1.1.0 + replicad-opencascadejs 1.1.0, Zustand 5, zod 4, Comlink 4, fflate, idb-keyval, Vitest 5, Testing Library, Playwright, nginx (Docker).

**Spec:** `docs/superpowers/specs/2026-10-11-blokade-design.md` (Milestone 1 row of section 9, plus sections 2, 3, 4, 6, 7, 8 as they apply to Milestone 1).

## Global Constraints

- Units are millimeters. The world is **Z-up**, matching slicers. New shapes rest on z = 0, centered on X/Y at their own origin.
- Rotations are stored in **degrees** as Euler XYZ in the three.js convention: matrix = Rx·Ry·Rz. In replicad, that means rotating about Z first, then Y, then X, all about the world origin.
- Private household use. No accounts, no auth, no network calls besides loading the app itself.
- **The app must work over plain HTTP on the LAN** (for example `http://homeserver:8080`), which is not a secure browser context. Never use secure-context-only APIs (`crypto.randomUUID`, Clipboard API, and so on). `crypto.getRandomValues`, IndexedDB, Web Workers, and WebAssembly are fine.
- Desktop browser with mouse and keyboard. No touch work.
- **Immutability:** document, history, and store state are never mutated. Every operation returns new objects. Temporary three.js math objects (`Matrix4`, and so on) inside a function are fine.
- In Milestone 1, document values are plain numbers. Formulas and variables arrive in Milestone 2.
- Never use `eval`, `new Function`, or similar.
- **replicad ownership rule:** `translate`/`rotate` delete the shape they're called on. `fuse`/`cut` keep their inputs. Always `.clone()` a cached shape before transforming it, and `.delete()` shapes evicted from the cache.
- Files stay under 400 lines and functions under 50 lines. Nesting is at most 4 levels deep.
- No `console.log`. `console.error` is allowed only for unexpected errors, together with a user-facing message.
- Exact limits from the spec: undo history is capped at **200** entries, autosave debounce is **1000 ms**, and the worker rebuild timeout is **30 000 ms**.
- Coverage: **80%+ lines** on non-UI logic (`src/document`, `src/history`, `src/store`, `src/plugins`, `src/geometry` except worker/browser bootstrap, `src/persistence`, `src/app` non-hook modules).
- User-facing messages are plain English an 11-year-old understands. No stack traces or OpenCascade jargon.
- Commit messages use conventional commits (`feat:`, `test:`, `chore:` …) and end with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

**Scope note:** the spec lists a Text shape in Milestone 1. replicad's `drawText` needs a bundled font file (checked: it fails without `loadFont`), so **Text moves to Milestone 2**. The spec table was updated to match. The other Milestone 1 shapes are box, cylinder, sphere, cone, wedge, and torus.

## Review Focus

1. **Served over plain HTTP from the home server:** `crypto.randomUUID` is undefined outside secure contexts. Expected: ids are still generated and the app works. Pinned by the `newId` test in Task 2.
2. **Junk or extreme numbers typed into fields** (`abc`, empty, `-5`, `0`, `1e9`). Expected: junk reverts to the previous value, and out-of-range values are clamped (mm values to 0.01–2000), so the worker never receives an impossible shape. Pinned in Task 6 (`normalizeParam`) and Task 15 (`NumberField`).
3. **Holes that remove everything, or groups with only holes.** Expected: a plain-English warning badge on that object instead of an empty or broken mesh, and export refuses with a clear message. Pinned in Task 8 and Task 9.
4. **Damaged or hand-edited design data** (dangling child ids, a part listed twice, cycles, a newer schema version, non-JSON files), whether loaded from a file or from IndexedDB. Expected: a friendly message, and the app still opens with a usable design. Pinned in Task 2 and Task 11.
5. **Rapid edits while a rebuild is still running** (typing quickly, repeated drags). Expected: only the newest document's result is applied, an older result never overwrites a newer one, and a hung worker is restarted after 30 s. Pinned in Task 10.

---

## File Map

```
blokade/
├─ package.json, tsconfig.json, vite.config.ts, index.html, playwright.config.ts
├─ Dockerfile, nginx.conf, docker-compose.yml, .dockerignore, README.md
├─ plugins/README.md                      # Kade's plugin folder (used from Milestone 5)
├─ e2e/first-print.spec.ts
└─ src/
   ├─ main.tsx                            # entry: creates deps, renders <App/>
   ├─ test-setup.ts
   ├─ shared/result.ts                    # Result<T> type
   ├─ document/
   │  ├─ types.ts                         # BloKadeDocument, SceneNode, Transform…
   │  ├─ factory.ts                       # newId, createEmptyDocument, createShapeNode, createGroupNode, pickColor
   │  ├─ schema.ts                        # zod schema + tree integrity → validateDocument
   │  ├─ tree.ts                          # parentOf, siblingsOf, descendantsOf, isDescendant, rootAncestorOf
   │  ├─ transform-math.ts                # Transform ⇄ Matrix4, worldMatrix, transformFromParts
   │  └─ ops.ts                           # immutable edits: add/update/remove/move/group/ungroup/duplicate/…
   ├─ history/history.ts                  # pure undo/redo (cap 200)
   ├─ store/
   │  ├─ store.ts                         # Zustand vanilla store
   │  ├─ merge-build.ts                   # merge worker results, keep last good mesh
   │  └─ context.tsx                      # React provider + hooks
   ├─ plugins/
   │  ├─ types.ts                         # ShapePlugin, NumberParamSpec, definePlugin
   │  ├─ params.ts                        # normalizeParam, resolveParams, defaultParams
   │  ├─ registry.ts                      # createRegistry (validates plugins)
   │  ├─ index.ts                         # loads builtin + /plugins via import.meta.glob
   │  ├─ cad.ts                           # CadToolkit over replicad (worker/tests only)
   │  └─ builtin/{box,cylinder,sphere,cone,wedge,torus}.ts
   ├─ geometry/
   │  ├─ types.ts                         # MeshData, BuildResult, GeometryApi (no replicad import)
   │  ├─ transform.ts                     # placeShape
   │  ├─ evaluate.ts                      # Evaluator (cache, groups, errors)
   │  ├─ tessellate.ts                    # toMeshData
   │  ├─ weld.ts                          # weldMesh, countOpenEdges
   │  ├─ export-3mf.ts                    # write3mf
   │  ├─ api.ts                           # createGeometryApi
   │  ├─ client.ts                        # GeometryClient (latest-wins, timeout restart)
   │  ├─ spawn.ts                         # spawnGeometryWorker (browser)
   │  ├─ oc-browser.ts                    # OpenCascade init in browser
   │  ├─ geometry.worker.ts               # Comlink.expose
   │  └─ testing/{oc-node.ts,stl.ts}      # test helpers
   ├─ persistence/
   │  ├─ migrate.ts                       # schema migrations
   │  ├─ design-file.ts                   # parseDesign, parseDesignFile, serializeDesign, fileNameFor
   │  ├─ repository.ts                    # DesignRepository interface + helpers
   │  ├─ idb-repository.ts                # IndexedDB implementation
   │  ├─ memory-repository.ts             # in-memory implementation (tests/fallback)
   │  ├─ autosave.ts                      # debounced saver
   │  └─ bootstrap.ts                     # openInitialDesign
   ├─ app/
   │  ├─ deps.ts                          # AppDeps + createAppDeps
   │  ├─ actions.ts                       # user actions over store
   │  ├─ selection.ts                     # toggleInSelection
   │  ├─ shortcuts.ts                     # matchShortcut + useShortcuts
   │  ├─ export.ts                        # exportDesign
   │  ├─ download.ts                      # downloadBytes
   │  ├─ useGeometrySync.ts, useAutosave.ts
   │  └─ testing/fakes.ts                 # fake deps for UI tests
   ├─ viewport/
   │  ├─ three-geometry.ts                # MeshData → BufferGeometry
   │  ├─ sizing.ts                        # paramsFromScale
   │  ├─ Viewport.tsx, NodeMesh.tsx, TransformHandles.tsx, useShiftHeld.ts
   └─ ui/
      ├─ App.tsx, Workspace.tsx, App.css
      ├─ ShapePalette.tsx, Toasts.tsx, Toolbar.tsx
      ├─ NumberField.tsx, PropertiesPanel.tsx
      ├─ SceneTree.tsx, DesignsDialog.tsx
```

Tests sit next to their code as `*.test.ts(x)`. Geometry tests run in Node with real OpenCascade. UI tests use `// @vitest-environment jsdom`.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.tsx`, `src/test-setup.ts`, `src/ui/App.tsx`, `src/ui/App.test.tsx`, `plugins/README.md`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `typecheck`, `test`, `coverage`, `e2e`. Vitest runs `src/**/*.test.{ts,tsx}` in the `node` environment by default.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "blokade",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "description": "BloKade — Kade's 3D design app for 3D printing",
  "scripts": {
    "dev": "vite --host",
    "build": "tsc && vite build",
    "preview": "vite preview --host",
    "typecheck": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage",
    "e2e": "playwright test"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install react@^19 react-dom@^19 three@^0.186 @react-three/fiber@^9 @react-three/drei@^10 replicad@1.1.0 replicad-opencascadejs@1.1.0 zustand@^5 zod@^4 comlink@^4 fflate@^0.8 idb-keyval@^6
```

```bash
npm install -D typescript@~5.9.3 vite@^8 @vitejs/plugin-react@^6 vitest@^5 @vitest/coverage-v8@^5 jsdom@^30 @testing-library/react@^16 @testing-library/user-event@^14 @testing-library/jest-dom@^6 @types/react@^19 @types/react-dom@^19 @types/three@^0.186 @types/node@^22 fake-indexeddb@^6 @playwright/test@^1.64
```

Expected: both finish without `ERR!`. Warnings about peer ranges are fine as long as the install succeeds.

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "allowJs": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "plugins", "e2e", "vite.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 4: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  // The OpenCascade WASM loader must not be pre-bundled; it locates its .wasm via an explicit URL.
  optimizeDeps: { exclude: ['replicad-opencascadejs'] },
  test: {
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: [
        'src/document/**', 'src/history/**', 'src/store/**', 'src/plugins/**',
        'src/geometry/**', 'src/persistence/**', 'src/app/**',
      ],
      exclude: [
        '**/*.test.*', '**/testing/**', '**/*.tsx',
        'src/geometry/geometry.worker.ts', 'src/geometry/oc-browser.ts', 'src/geometry/spawn.ts',
        'src/app/useGeometrySync.ts', 'src/app/useAutosave.ts', 'src/app/deps.ts', 'src/app/download.ts',
      ],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 75 },
    },
  },
})
```

- [ ] **Step 5: Write `index.html`, `.gitignore`, `src/test-setup.ts`, `plugins/README.md`**

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BloKade</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`.gitignore`:
```
node_modules/
dist/
coverage/
playwright-report/
test-results/
.DS_Store
```

`src/test-setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
```

`plugins/README.md`:
```markdown
# Kade's Plugins

This folder is for shapes Kade writes himself. Every `.js` or `.ts` file here that
`export default`s a plugin shows up in BloKade's shape palette.

The plugin guide arrives in Milestone 5. Until then, look at `src/plugins/builtin/`,
because every built-in shape is a plugin written the same way.
```

- [ ] **Step 6: Write the failing test `src/ui/App.test.tsx`**

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('shows the BloKade name', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'BloKade' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run src/ui/App.test.tsx`
Expected: FAIL, because `./App` can't be resolved.

- [ ] **Step 8: Write `src/ui/App.tsx` and `src/main.tsx`**

`src/ui/App.tsx` (temporary; Task 12 replaces it):
```tsx
export function App() {
  return <h1>BloKade</h1>
}
```

`src/main.tsx` (temporary; Task 12 replaces it):
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App'

const container = document.getElementById('root')
if (!container) throw new Error('BloKade could not find its #root element')
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 9: Verify the test, type check, and build**

Run: `npx vitest run src/ui/App.test.tsx && npm run typecheck && npx vite build`
Expected: the test passes, tsc prints nothing, and vite writes `dist/`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold BloKade (Vite, React, TypeScript, Vitest)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Document types, factory, and schema

**Files:**
- Create: `src/shared/result.ts`, `src/document/types.ts`, `src/document/factory.ts`, `src/document/schema.ts`
- Test: `src/document/factory.test.ts`, `src/document/schema.test.ts`

**Interfaces:**
- Produces:
  - `type Result<T> = { ok: true; value: T } | { ok: false; error: string }`, `ok(value)`, `fail(error)`
  - Types `NodeId`, `Vec3`, `Mode`, `Transform`, `ShapeNode`, `GroupNode`, `SceneNode`, `DocumentSettings`, `BloKadeDocument`, plus constants `CURRENT_SCHEMA_VERSION = 1`, `IDENTITY_TRANSFORM`, `DEFAULT_GRID_SNAP = 1`
  - `newId(): NodeId` (32 hex chars, uses `crypto.getRandomValues`)
  - `createEmptyDocument(name?: string): BloKadeDocument`
  - `createShapeNode(input: { shapeType: string; name: string; params: Readonly<Record<string, number>>; color: string; id?: NodeId; position?: Vec3 }): ShapeNode`
  - `createGroupNode(input: { children: readonly NodeId[]; name?: string; color?: string; id?: NodeId }): GroupNode`
  - `SHAPE_COLORS: readonly string[]`, `HOLE_COLOR = '#9aa5b1'`, `pickColor(index: number): string`
  - `validateDocument(raw: unknown): Result<BloKadeDocument>`

- [ ] **Step 1: Write the failing tests**

`src/document/factory.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createEmptyDocument, createGroupNode, createShapeNode, newId, pickColor, SHAPE_COLORS,
} from './factory'
import { CURRENT_SCHEMA_VERSION, IDENTITY_TRANSFORM } from './types'

afterEach(() => vi.unstubAllGlobals())

describe('newId', () => {
  it('makes 32-character hex ids that differ', () => {
    const a = newId()
    const b = newId()
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(a).not.toBe(b)
  })

  it('works without crypto.randomUUID (plain-HTTP home server)', () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) })
    expect(newId()).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('factories', () => {
  it('creates an empty document', () => {
    const doc = createEmptyDocument('Phone Stand')
    expect(doc).toEqual({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      name: 'Phone Stand',
      units: 'mm',
      settings: { gridSnap: 1 },
      root: [],
      nodes: {},
    })
  })

  it('creates a solid, visible shape at the origin by default', () => {
    const node = createShapeNode({ shapeType: 'box', name: 'Box', params: { width: 20 }, color: '#ff0000' })
    expect(node).toMatchObject({
      kind: 'shape', shapeType: 'box', name: 'Box', params: { width: 20 }, color: '#ff0000',
      mode: 'solid', hidden: false, transform: IDENTITY_TRANSFORM,
    })
    expect(node.id).toMatch(/^[0-9a-f]{32}$/)
  })

  it('places a shape at a given position', () => {
    const node = createShapeNode({ shapeType: 'box', name: 'Box', params: {}, color: '#fff', position: [1, 2, 3] })
    expect(node.transform.position).toEqual([1, 2, 3])
  })

  it('creates a group', () => {
    const group = createGroupNode({ id: 'g', children: ['a', 'b'] })
    expect(group).toEqual({
      id: 'g', kind: 'group', name: 'Group', children: ['a', 'b'], mode: 'solid',
      hidden: false, color: SHAPE_COLORS[0], transform: IDENTITY_TRANSFORM,
    })
  })

  it('cycles through shape colors', () => {
    expect(pickColor(0)).toBe(SHAPE_COLORS[0])
    expect(pickColor(SHAPE_COLORS.length + 1)).toBe(SHAPE_COLORS[1])
  })
})
```

`src/document/schema.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createGroupNode, createShapeNode } from './factory'
import { validateDocument } from './schema'
import type { BloKadeDocument, SceneNode } from './types'

const box = (id: string) =>
  createShapeNode({ id, shapeType: 'box', name: 'Box', params: { width: 10 }, color: '#ff0000' })

function docWith(nodes: readonly SceneNode[], root: readonly string[]): BloKadeDocument {
  return { ...createEmptyDocument('Test'), root, nodes: Object.fromEntries(nodes.map((n) => [n.id, n])) }
}

function errorOf(raw: unknown): string {
  const result = validateDocument(raw)
  if (result.ok) throw new Error('expected validation to fail')
  return result.error
}

describe('validateDocument', () => {
  it('accepts a valid nested document', () => {
    const doc = docWith([box('a'), box('b'), createGroupNode({ id: 'g', children: ['b'] })], ['a', 'g'])
    const result = validateDocument(doc)
    expect(result).toEqual({ ok: true, value: doc })
  })

  it('rejects a group that points at a missing part', () => {
    const doc = docWith([createGroupNode({ id: 'g', children: ['ghost'] })], ['g'])
    expect(errorOf(doc)).toContain('Missing part')
  })

  it('rejects a part listed twice', () => {
    const doc = docWith([box('a'), createGroupNode({ id: 'g', children: ['a'] })], ['a', 'g'])
    expect(errorOf(doc)).toContain('more than once')
  })

  it('rejects a cycle of groups', () => {
    const doc = docWith(
      [createGroupNode({ id: 'g1', children: ['g2'] }), createGroupNode({ id: 'g2', children: ['g1'] })],
      ['g1'],
    )
    expect(errorOf(doc)).toContain('more than once')
  })

  it('rejects parts that are not connected to the design', () => {
    expect(errorOf(docWith([box('a'), box('orphan')], ['a']))).toContain('not connected')
  })

  it('rejects a node whose id does not match its key', () => {
    const doc = { ...docWith([box('a')], ['a']), nodes: { a: box('different') } }
    expect(errorOf(doc)).toContain('mismatched id')
  })

  it('rejects an unknown schema version', () => {
    expect(errorOf({ ...createEmptyDocument(), schemaVersion: 2 })).toContain('damaged')
  })

  it('rejects things that are not designs at all', () => {
    expect(errorOf('hello')).toContain('damaged')
    expect(errorOf(null)).toContain('damaged')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/document`
Expected: FAIL, because modules `./factory`, `./schema`, and `./types` don't exist yet.

- [ ] **Step 3: Implement**

`src/shared/result.ts`:
```ts
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string }

export const ok = <T>(value: T): Result<T> => ({ ok: true, value })
export const fail = <T = never>(error: string): Result<T> => ({ ok: false, error })
```

`src/document/types.ts`:
```ts
export type NodeId = string
export type Vec3 = readonly [number, number, number]
export type Mode = 'solid' | 'hole'

/** Position in mm; rotation in degrees, Euler XYZ (three.js convention: matrix = Rx·Ry·Rz). */
export interface Transform {
  readonly position: Vec3
  readonly rotation: Vec3
}

interface NodeBase {
  readonly id: NodeId
  readonly name: string
  readonly mode: Mode
  readonly transform: Transform
  readonly hidden: boolean
  readonly color: string
}

export interface ShapeNode extends NodeBase {
  readonly kind: 'shape'
  readonly shapeType: string
  readonly params: Readonly<Record<string, number>>
}

export interface GroupNode extends NodeBase {
  readonly kind: 'group'
  readonly children: readonly NodeId[]
}

export type SceneNode = ShapeNode | GroupNode

export interface DocumentSettings {
  /** Grid snap in mm; 0 means snapping is off. */
  readonly gridSnap: number
}

export interface BloKadeDocument {
  readonly schemaVersion: 1
  readonly name: string
  readonly units: 'mm'
  readonly settings: DocumentSettings
  readonly root: readonly NodeId[]
  readonly nodes: Readonly<Record<NodeId, SceneNode>>
}

export const CURRENT_SCHEMA_VERSION = 1
export const DEFAULT_GRID_SNAP = 1
export const IDENTITY_TRANSFORM: Transform = { position: [0, 0, 0], rotation: [0, 0, 0] }
```

`src/document/factory.ts`:
```ts
import {
  CURRENT_SCHEMA_VERSION, DEFAULT_GRID_SNAP, IDENTITY_TRANSFORM,
  type BloKadeDocument, type GroupNode, type NodeId, type ShapeNode, type Vec3,
} from './types'

export const SHAPE_COLORS: readonly string[] = ['#ff6b6b', '#4f9dff', '#ffd93d', '#6bcb77', '#c77dff', '#ff9f43']
export const HOLE_COLOR = '#9aa5b1'

/** Random id. Uses getRandomValues because randomUUID is unavailable over plain HTTP. */
export function newId(): NodeId {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function pickColor(index: number): string {
  return SHAPE_COLORS[index % SHAPE_COLORS.length] ?? '#4f9dff'
}

export function createEmptyDocument(name = 'Untitled design'): BloKadeDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name,
    units: 'mm',
    settings: { gridSnap: DEFAULT_GRID_SNAP },
    root: [],
    nodes: {},
  }
}

export function createShapeNode(input: {
  shapeType: string
  name: string
  params: Readonly<Record<string, number>>
  color: string
  id?: NodeId
  position?: Vec3
}): ShapeNode {
  return {
    id: input.id ?? newId(),
    kind: 'shape',
    name: input.name,
    shapeType: input.shapeType,
    params: input.params,
    mode: 'solid',
    hidden: false,
    color: input.color,
    transform: input.position ? { ...IDENTITY_TRANSFORM, position: input.position } : IDENTITY_TRANSFORM,
  }
}

export function createGroupNode(input: {
  children: readonly NodeId[]
  name?: string
  color?: string
  id?: NodeId
}): GroupNode {
  return {
    id: input.id ?? newId(),
    kind: 'group',
    name: input.name ?? 'Group',
    children: input.children,
    mode: 'solid',
    hidden: false,
    color: input.color ?? pickColor(0),
    transform: IDENTITY_TRANSFORM,
  }
}
```

`src/document/schema.ts`:
```ts
import { z } from 'zod'
import { fail, ok, type Result } from '../shared/result'
import type { BloKadeDocument } from './types'

const vec3 = z.tuple([z.number(), z.number(), z.number()])
const transform = z.object({ position: vec3, rotation: vec3 })
const base = {
  id: z.string().min(1),
  name: z.string(),
  mode: z.enum(['solid', 'hole']),
  transform,
  hidden: z.boolean(),
  color: z.string(),
}
const shapeNode = z.object({
  ...base,
  kind: z.literal('shape'),
  shapeType: z.string().min(1),
  params: z.record(z.string(), z.number()),
})
const groupNode = z.object({ ...base, kind: z.literal('group'), children: z.array(z.string()) })
const sceneNode = z.discriminatedUnion('kind', [shapeNode, groupNode])

const documentShape = z.object({
  schemaVersion: z.literal(1),
  name: z.string(),
  units: z.literal('mm'),
  settings: z.object({ gridSnap: z.number().min(0) }),
  root: z.array(z.string()),
  nodes: z.record(z.string(), sceneNode),
})

type DocShape = z.infer<typeof documentShape>

/** Every node is reachable from root exactly once; ids match their keys. */
function checkTree(doc: DocShape, ctx: z.RefinementCtx): void {
  for (const [key, node] of Object.entries(doc.nodes)) {
    if (node.id !== key) ctx.addIssue({ code: 'custom', message: `Part "${key}" has mismatched id "${node.id}"` })
  }
  const seen = new Set<string>()
  const visit = (ids: readonly string[]): void => {
    for (const id of ids) {
      const node = doc.nodes[id]
      if (!node) {
        ctx.addIssue({ code: 'custom', message: `Missing part "${id}"` })
      } else if (seen.has(id)) {
        ctx.addIssue({ code: 'custom', message: `Part "${id}" appears more than once` })
      } else {
        seen.add(id)
        if (node.kind === 'group') visit(node.children)
      }
    }
  }
  visit(doc.root)
  if (seen.size !== Object.keys(doc.nodes).length) {
    ctx.addIssue({ code: 'custom', message: 'Some parts are not connected to the design' })
  }
}

export const documentSchema = documentShape.superRefine(checkTree)

export function validateDocument(raw: unknown): Result<BloKadeDocument> {
  const parsed = documentSchema.safeParse(raw)
  if (parsed.success) return ok(parsed.data)
  const issue = parsed.error.issues[0]
  const where = issue && issue.path.length > 0 ? ` (at ${issue.path.join('.')})` : ''
  return fail(`This design is damaged: ${issue?.message ?? 'unknown problem'}${where}`)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/document && npm run typecheck`
Expected: all tests pass and tsc is clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared src/document
git commit -m "feat: add design document types, factories and validation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Tree helpers and transform math

**Files:**
- Create: `src/document/tree.ts`, `src/document/transform-math.ts`
- Test: `src/document/tree.test.ts`, `src/document/transform-math.test.ts`

**Interfaces:**
- Consumes: types from Task 2.
- Produces:
  - `parentOf(doc, id): NodeId | null | undefined` (`null` = top level, `undefined` = not in the tree)
  - `siblingsOf(doc, parentId: NodeId | null): readonly NodeId[]` (children of a group, or `doc.root`; `[]` for unknown/non-group)
  - `descendantsOf(doc, id): NodeId[]` (excluding `id`)
  - `isDescendant(doc, ancestorId, id): boolean`
  - `rootAncestorOf(doc, id): NodeId | undefined`
  - `transformToMatrix(t: Transform): Matrix4`, `matrixToTransform(m: Matrix4): Transform` (rounded to 1e-6, no `-0`)
  - `transformFromParts(position: Vec3, rotationRadians: Vec3): Transform`
  - `worldMatrix(doc, id): Matrix4`

- [ ] **Step 1: Write the failing tests**

`src/document/tree.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createGroupNode, createShapeNode } from './factory'
import { descendantsOf, isDescendant, parentOf, rootAncestorOf, siblingsOf } from './tree'
import type { BloKadeDocument, SceneNode } from './types'

const box = (id: string) => createShapeNode({ id, shapeType: 'box', name: id, params: {}, color: '#fff' })

// root: [a, g1]; g1: [b, g2]; g2: [c]
const nodes: SceneNode[] = [
  box('a'), box('b'), box('c'),
  createGroupNode({ id: 'g1', children: ['b', 'g2'] }),
  createGroupNode({ id: 'g2', children: ['c'] }),
]
const doc: BloKadeDocument = {
  ...createEmptyDocument(), root: ['a', 'g1'], nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
}

describe('tree helpers', () => {
  it('finds parents', () => {
    expect(parentOf(doc, 'a')).toBeNull()
    expect(parentOf(doc, 'c')).toBe('g2')
    expect(parentOf(doc, 'nope')).toBeUndefined()
  })

  it('lists siblings', () => {
    expect(siblingsOf(doc, null)).toEqual(['a', 'g1'])
    expect(siblingsOf(doc, 'g1')).toEqual(['b', 'g2'])
    expect(siblingsOf(doc, 'a')).toEqual([])
  })

  it('lists descendants depth-first', () => {
    expect(descendantsOf(doc, 'g1')).toEqual(['b', 'g2', 'c'])
    expect(descendantsOf(doc, 'a')).toEqual([])
  })

  it('checks ancestry', () => {
    expect(isDescendant(doc, 'g1', 'c')).toBe(true)
    expect(isDescendant(doc, 'g2', 'b')).toBe(false)
  })

  it('finds the top-level ancestor', () => {
    expect(rootAncestorOf(doc, 'c')).toBe('g1')
    expect(rootAncestorOf(doc, 'a')).toBe('a')
    expect(rootAncestorOf(doc, 'nope')).toBeUndefined()
  })
})
```

`src/document/transform-math.test.ts`:
```ts
import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createGroupNode, createShapeNode } from './factory'
import { matrixToTransform, transformFromParts, transformToMatrix, worldMatrix } from './transform-math'
import type { BloKadeDocument, Transform } from './types'

describe('transform math', () => {
  it('round-trips a transform through a matrix', () => {
    const t: Transform = { position: [1.5, -2, 3], rotation: [30, 45, 60] }
    expect(matrixToTransform(transformToMatrix(t))).toEqual(t)
  })

  it('never produces negative zero', () => {
    const t = matrixToTransform(transformToMatrix({ position: [-0, 0, 0], rotation: [0, 0, 0] }))
    expect(Object.is(t.position[0], -0)).toBe(false)
  })

  it('builds transforms from radians', () => {
    expect(transformFromParts([1, 2, 3], [Math.PI / 2, 0, Math.PI])).toEqual({ position: [1, 2, 3], rotation: [90, 0, 180] })
  })

  it('composes parent and child transforms', () => {
    const child = { ...createShapeNode({ id: 'c', shapeType: 'box', name: 'c', params: {}, color: '#fff' }),
      transform: { position: [5, 0, 0], rotation: [0, 0, 0] } as Transform }
    const group = { ...createGroupNode({ id: 'g', children: ['c'] }),
      transform: { position: [10, 0, 0], rotation: [0, 0, 90] } as Transform }
    const doc: BloKadeDocument = { ...createEmptyDocument(), root: ['g'], nodes: { c: child, g: group } }
    const p = new Vector3().applyMatrix4(worldMatrix(doc, 'c'))
    expect(p.x).toBeCloseTo(10)
    expect(p.y).toBeCloseTo(5)
    expect(p.z).toBeCloseTo(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/document/tree.test.ts src/document/transform-math.test.ts`
Expected: FAIL, because the modules are missing.

- [ ] **Step 3: Implement**

`src/document/tree.ts`:
```ts
import type { BloKadeDocument, NodeId } from './types'

export function parentOf(doc: BloKadeDocument, id: NodeId): NodeId | null | undefined {
  if (doc.root.includes(id)) return null
  for (const node of Object.values(doc.nodes)) {
    if (node.kind === 'group' && node.children.includes(id)) return node.id
  }
  return undefined
}

export function siblingsOf(doc: BloKadeDocument, parentId: NodeId | null): readonly NodeId[] {
  if (parentId === null) return doc.root
  const parent = doc.nodes[parentId]
  return parent?.kind === 'group' ? parent.children : []
}

export function descendantsOf(doc: BloKadeDocument, id: NodeId): NodeId[] {
  const node = doc.nodes[id]
  if (node?.kind !== 'group') return []
  return node.children.flatMap((child) => [child, ...descendantsOf(doc, child)])
}

export function isDescendant(doc: BloKadeDocument, ancestorId: NodeId, id: NodeId): boolean {
  return descendantsOf(doc, ancestorId).includes(id)
}

export function rootAncestorOf(doc: BloKadeDocument, id: NodeId): NodeId | undefined {
  const parent = parentOf(doc, id)
  if (parent === undefined) return undefined
  return parent === null ? id : rootAncestorOf(doc, parent)
}
```

`src/document/transform-math.ts`:
```ts
import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three'
import { parentOf } from './tree'
import type { BloKadeDocument, NodeId, Transform, Vec3 } from './types'

const round6 = (v: number): number => {
  const r = Math.round(v * 1e6) / 1e6
  return Object.is(r, -0) ? 0 : r
}

export function transformToMatrix(t: Transform): Matrix4 {
  const [rx, ry, rz] = t.rotation.map(MathUtils.degToRad) as [number, number, number]
  const q = new Quaternion().setFromEuler(new Euler(rx, ry, rz, 'XYZ'))
  return new Matrix4().compose(new Vector3(...t.position), q, new Vector3(1, 1, 1))
}

export function transformFromParts(position: Vec3, rotationRadians: Vec3): Transform {
  return {
    position: [round6(position[0]), round6(position[1]), round6(position[2])],
    rotation: [
      round6(MathUtils.radToDeg(rotationRadians[0])),
      round6(MathUtils.radToDeg(rotationRadians[1])),
      round6(MathUtils.radToDeg(rotationRadians[2])),
    ],
  }
}

export function matrixToTransform(m: Matrix4): Transform {
  const position = new Vector3()
  const q = new Quaternion()
  m.decompose(position, q, new Vector3())
  const e = new Euler().setFromQuaternion(q, 'XYZ')
  return transformFromParts([position.x, position.y, position.z], [e.x, e.y, e.z])
}

/** Placement of a node in world space: product of all ancestor transforms and its own. */
export function worldMatrix(doc: BloKadeDocument, id: NodeId): Matrix4 {
  const node = doc.nodes[id]
  if (!node) throw new Error(`Unknown part ${id}`)
  const local = transformToMatrix(node.transform)
  const parent = parentOf(doc, id)
  return parent ? new Matrix4().multiplyMatrices(worldMatrix(doc, parent), local) : local
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/document && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/document
git commit -m "feat: add scene tree helpers and transform math

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Immutable document operations

**Files:**
- Create: `src/document/ops.ts`
- Test: `src/document/ops.test.ts`

**Interfaces:**
- Consumes: Task 2 factories and types, Task 3 tree helpers and transform math.
- Produces (all pure; they throw `DocumentOpError` for invalid requests, and its message is safe to show to Kade):
  - `class DocumentOpError extends Error`
  - `DUPLICATE_OFFSET: Vec3 = [5, 5, 0]`
  - `addNode(doc, node: SceneNode, parentId?: NodeId | null): BloKadeDocument`
  - `updateNode(doc, id, fn: (node: SceneNode) => SceneNode): BloKadeDocument`
  - `removeNodes(doc, ids: readonly NodeId[]): BloKadeDocument`
  - `moveNode(doc, id, newParentId: NodeId | null): BloKadeDocument` (keeps world placement)
  - `groupNodes(doc, ids, groupId?: NodeId): { doc: BloKadeDocument; groupId: NodeId }`
  - `ungroupNode(doc, id): { doc: BloKadeDocument; childIds: readonly NodeId[] }`
  - `duplicateNodes(doc, ids): { doc: BloKadeDocument; newIds: readonly NodeId[] }`
  - `setMode(doc, ids, mode: Mode)`, `setHidden(doc, ids, hidden: boolean)`, `renameNode(doc, id, name: string)`, `renameDocument(doc, name: string)`, `setGridSnap(doc, gridSnap: number)`

- [ ] **Step 1: Write the failing tests**

`src/document/ops.test.ts`:
```ts
import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from './factory'
import {
  addNode, DocumentOpError, DUPLICATE_OFFSET, duplicateNodes, groupNodes, moveNode, removeNodes,
  renameDocument, renameNode, setGridSnap, setHidden, setMode, ungroupNode, updateNode,
} from './ops'
import { worldMatrix } from './transform-math'
import type { BloKadeDocument, Transform } from './types'

const box = (id: string, position: [number, number, number] = [0, 0, 0]) =>
  createShapeNode({ id, shapeType: 'box', name: `Box ${id}`, params: { width: 10 }, color: '#fff', position })

/** root: [a, b, c] */
function threeBoxes(): BloKadeDocument {
  return [box('a'), box('b', [20, 0, 0]), box('c')].reduce((d, n) => addNode(d, n), createEmptyDocument())
}

const worldPos = (doc: BloKadeDocument, id: string) =>
  new Vector3().applyMatrix4(worldMatrix(doc, id)).toArray().map((v) => Math.round(v * 1e6) / 1e6)

describe('addNode / updateNode', () => {
  it('adds at top level without touching the original', () => {
    const empty = createEmptyDocument()
    const doc = addNode(empty, box('a'))
    expect(doc.root).toEqual(['a'])
    expect(empty.root).toEqual([])
  })

  it('refuses duplicate ids', () => {
    expect(() => addNode(threeBoxes(), box('a'))).toThrow(DocumentOpError)
  })

  it('updates a node immutably', () => {
    const doc = threeBoxes()
    const next = updateNode(doc, 'a', (n) => ({ ...n, name: 'Base' }))
    expect(next.nodes.a?.name).toBe('Base')
    expect(doc.nodes.a?.name).toBe('Box a')
  })

  it('refuses to change id or kind', () => {
    expect(() => updateNode(threeBoxes(), 'a', (n) => ({ ...n, id: 'zzz' }))).toThrow(DocumentOpError)
  })

  it('reports missing parts in plain English', () => {
    expect(() => updateNode(threeBoxes(), 'ghost', (n) => n)).toThrow('That part no longer exists.')
  })
})

describe('removeNodes', () => {
  it('removes nodes and their descendants', () => {
    const { doc, groupId } = groupNodes(threeBoxes(), ['a', 'b'])
    const next = removeNodes(doc, [groupId])
    expect(next.root).toEqual(['c'])
    expect(Object.keys(next.nodes)).toEqual(['c'])
  })

  it('removes a child from its group', () => {
    const { doc, groupId } = groupNodes(threeBoxes(), ['a', 'b'])
    const next = removeNodes(doc, ['a'])
    const group = next.nodes[groupId]
    expect(group?.kind === 'group' && group.children).toEqual(['b'])
  })
})

describe('groupNodes / ungroupNode', () => {
  it('groups siblings in place, keeping their order', () => {
    const { doc, groupId } = groupNodes(threeBoxes(), ['c', 'b'], 'g')
    expect(groupId).toBe('g')
    expect(doc.root).toEqual(['a', 'g'])
    const group = doc.nodes.g
    expect(group?.kind === 'group' && group.children).toEqual(['b', 'c'])
  })

  it('needs at least two parts at the same level', () => {
    expect(() => groupNodes(threeBoxes(), ['a'])).toThrow('Pick at least two parts to group.')
    const { doc } = groupNodes(threeBoxes(), ['a', 'b'], 'g')
    expect(() => groupNodes(doc, ['a', 'c'])).toThrow('same level')
  })

  it('ungroups back into the parent, keeping world placement', () => {
    const grouped = groupNodes(threeBoxes(), ['a', 'b'], 'g').doc
    const moved = updateNode(grouped, 'g', (n) => ({ ...n, transform: { position: [0, 10, 0], rotation: [0, 0, 90] } as Transform }))
    const before = worldPos(moved, 'b')
    const { doc, childIds } = ungroupNode(moved, 'g')
    expect(childIds).toEqual(['a', 'b'])
    expect(doc.root).toEqual(['a', 'b', 'c'])
    expect(doc.nodes.g).toBeUndefined()
    expect(worldPos(doc, 'b')).toEqual(before)
  })

  it('refuses to ungroup a shape', () => {
    expect(() => ungroupNode(threeBoxes(), 'a')).toThrow("That's not a group.")
  })
})

describe('moveNode', () => {
  it('moves into a group and keeps world placement', () => {
    const grouped = groupNodes(threeBoxes(), ['a', 'b'], 'g').doc
    const shifted = updateNode(grouped, 'g', (n) => ({ ...n, transform: { position: [7, 0, 0], rotation: [0, 0, 0] } as Transform }))
    const before = worldPos(shifted, 'c')
    const doc = moveNode(shifted, 'c', 'g')
    expect(doc.root).toEqual(['g'])
    expect(worldPos(doc, 'c')).toEqual(before)
    expect(doc.nodes.c?.transform.position).toEqual([-7, 0, 0])
  })

  it('moves back to the top level', () => {
    const grouped = groupNodes(threeBoxes(), ['a', 'b'], 'g').doc
    expect(moveNode(grouped, 'a', null).root).toEqual(['g', 'c', 'a'])
  })

  it("refuses to put a group inside itself", () => {
    const grouped = groupNodes(threeBoxes(), ['a', 'b'], 'g').doc
    expect(() => moveNode(grouped, 'g', 'g')).toThrow("can't go inside itself")
  })
})

describe('duplicateNodes', () => {
  it('copies a group with fresh ids, offset, right after the original', () => {
    const grouped = groupNodes(threeBoxes(), ['a', 'b'], 'g').doc
    const { doc, newIds } = duplicateNodes(grouped, ['g'])
    const [copyId] = newIds
    expect(copyId).toBeDefined()
    expect(doc.root).toEqual(['g', copyId, 'c'])
    const copy = doc.nodes[copyId as string]
    expect(copy?.kind).toBe('group')
    expect(copy?.transform.position).toEqual(DUPLICATE_OFFSET)
    const children = copy?.kind === 'group' ? copy.children : []
    expect(children).toHaveLength(2)
    expect(children).not.toContain('a')
    expect(Object.keys(doc.nodes)).toHaveLength(Object.keys(grouped.nodes).length + 3)
  })

  it('skips parts whose group is also being duplicated', () => {
    const grouped = groupNodes(threeBoxes(), ['a', 'b'], 'g').doc
    expect(duplicateNodes(grouped, ['g', 'a']).newIds).toHaveLength(1)
  })
})

describe('simple setters', () => {
  it('sets mode and visibility', () => {
    const doc = setHidden(setMode(threeBoxes(), ['a', 'b'], 'hole'), ['c'], true)
    expect(doc.nodes.a?.mode).toBe('hole')
    expect(doc.nodes.b?.mode).toBe('hole')
    expect(doc.nodes.c?.hidden).toBe(true)
  })

  it('renames with trimming and refuses empty names', () => {
    expect(renameNode(threeBoxes(), 'a', '  Base  ').nodes.a?.name).toBe('Base')
    expect(() => renameNode(threeBoxes(), 'a', '   ')).toThrow("Names can't be empty.")
  })

  it('renames the whole design', () => {
    expect(renameDocument(threeBoxes(), ' Phone Stand ').name).toBe('Phone Stand')
    expect(() => renameDocument(threeBoxes(), '')).toThrow("Names can't be empty.")
  })

  it('sets grid snap and refuses negatives', () => {
    expect(setGridSnap(threeBoxes(), 0.5).settings.gridSnap).toBe(0.5)
    expect(() => setGridSnap(threeBoxes(), -1)).toThrow(DocumentOpError)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/document/ops.test.ts`
Expected: FAIL, because `./ops` is missing.

- [ ] **Step 3: Implement `src/document/ops.ts`**

```ts
import { Matrix4 } from 'three'
import { createGroupNode, newId } from './factory'
import { matrixToTransform, transformToMatrix, worldMatrix } from './transform-math'
import { descendantsOf, isDescendant, parentOf, siblingsOf } from './tree'
import type { BloKadeDocument, Mode, NodeId, SceneNode, Vec3 } from './types'

export class DocumentOpError extends Error {
  override name = 'DocumentOpError'
}

export const DUPLICATE_OFFSET: Vec3 = [5, 5, 0]

function requireNode(doc: BloKadeDocument, id: NodeId): SceneNode {
  const node = doc.nodes[id]
  if (!node) throw new DocumentOpError('That part no longer exists.')
  return node
}

function withChildren(doc: BloKadeDocument, parentId: NodeId | null, children: readonly NodeId[]): BloKadeDocument {
  if (parentId === null) return { ...doc, root: children }
  const parent = requireNode(doc, parentId)
  if (parent.kind !== 'group') throw new DocumentOpError('Only groups can hold other parts.')
  return { ...doc, nodes: { ...doc.nodes, [parentId]: { ...parent, children } } }
}

export function addNode(doc: BloKadeDocument, node: SceneNode, parentId: NodeId | null = null): BloKadeDocument {
  if (doc.nodes[node.id]) throw new DocumentOpError(`A part with id ${node.id} already exists.`)
  const withNode = { ...doc, nodes: { ...doc.nodes, [node.id]: node } }
  return withChildren(withNode, parentId, [...siblingsOf(doc, parentId), node.id])
}

export function updateNode(
  doc: BloKadeDocument, id: NodeId, fn: (node: SceneNode) => SceneNode,
): BloKadeDocument {
  const node = requireNode(doc, id)
  const next = fn(node)
  if (next.id !== id || next.kind !== node.kind) throw new DocumentOpError("A part's id and kind can't change.")
  return { ...doc, nodes: { ...doc.nodes, [id]: next } }
}

export function removeNodes(doc: BloKadeDocument, ids: readonly NodeId[]): BloKadeDocument {
  const doomed = new Set(ids.flatMap((id) => (doc.nodes[id] ? [id, ...descendantsOf(doc, id)] : [])))
  const nodes = Object.fromEntries(
    Object.entries(doc.nodes)
      .filter(([id]) => !doomed.has(id))
      .map(([id, n]) => [id, n.kind === 'group' ? { ...n, children: n.children.filter((c) => !doomed.has(c)) } : n]),
  )
  return { ...doc, root: doc.root.filter((id) => !doomed.has(id)), nodes }
}

export function moveNode(doc: BloKadeDocument, id: NodeId, newParentId: NodeId | null): BloKadeDocument {
  requireNode(doc, id)
  if (newParentId === id || (newParentId !== null && isDescendant(doc, id, newParentId))) {
    throw new DocumentOpError("A group can't go inside itself.")
  }
  const oldParentId = parentOf(doc, id) ?? null
  if (oldParentId === newParentId) return doc
  const world = worldMatrix(doc, id)
  const detached = withChildren(doc, oldParentId, siblingsOf(doc, oldParentId).filter((c) => c !== id))
  const parentWorld = newParentId === null ? new Matrix4() : worldMatrix(detached, newParentId)
  const local = new Matrix4().multiplyMatrices(parentWorld.clone().invert(), world)
  const moved = updateNode(detached, id, (n) => ({ ...n, transform: matrixToTransform(local) }))
  return withChildren(moved, newParentId, [...siblingsOf(moved, newParentId), id])
}

export function groupNodes(
  doc: BloKadeDocument, ids: readonly NodeId[], groupId: NodeId = newId(),
): { doc: BloKadeDocument; groupId: NodeId } {
  if (ids.length < 2) throw new DocumentOpError('Pick at least two parts to group.')
  const parents = new Set(ids.map((id) => {
    requireNode(doc, id)
    return parentOf(doc, id) ?? null
  }))
  if (parents.size !== 1) throw new DocumentOpError('Parts must be at the same level to group them.')
  const parentId = [...parents][0] ?? null
  const siblings = siblingsOf(doc, parentId)
  const chosen = siblings.filter((id) => ids.includes(id))
  const insertAt = siblings.findIndex((id) => ids.includes(id))
  const remaining = siblings.filter((id) => !ids.includes(id))
  const first = requireNode(doc, chosen[0] ?? '')
  const group = createGroupNode({ id: groupId, children: chosen, color: first.color })
  const withGroup = { ...doc, nodes: { ...doc.nodes, [groupId]: group } }
  const newSiblings = [...remaining.slice(0, insertAt), groupId, ...remaining.slice(insertAt)]
  return { doc: withChildren(withGroup, parentId, newSiblings), groupId }
}

export function ungroupNode(
  doc: BloKadeDocument, id: NodeId,
): { doc: BloKadeDocument; childIds: readonly NodeId[] } {
  const group = requireNode(doc, id)
  if (group.kind !== 'group') throw new DocumentOpError("That's not a group.")
  const parentId = parentOf(doc, id) ?? null
  const groupMatrix = transformToMatrix(group.transform)
  const lifted = Object.fromEntries(
    group.children.map((cid) => {
      const child = requireNode(doc, cid)
      const m = new Matrix4().multiplyMatrices(groupMatrix, transformToMatrix(child.transform))
      return [cid, { ...child, transform: matrixToTransform(m) }]
    }),
  )
  const others = Object.fromEntries(Object.entries(doc.nodes).filter(([key]) => key !== id))
  const siblings = siblingsOf(doc, parentId)
  const at = siblings.indexOf(id)
  const newSiblings = [...siblings.slice(0, at), ...group.children, ...siblings.slice(at + 1)]
  return { doc: withChildren({ ...doc, nodes: { ...others, ...lifted } }, parentId, newSiblings), childIds: group.children }
}

function copySubtree(doc: BloKadeDocument, id: NodeId): { topId: NodeId; nodes: SceneNode[] } {
  const ids = [id, ...descendantsOf(doc, id)]
  const fresh = new Map(ids.map((old) => [old, newId()]))
  const rename = (old: NodeId): NodeId => fresh.get(old) ?? old
  const nodes = ids.map((old): SceneNode => {
    const n = requireNode(doc, old)
    return n.kind === 'group' ? { ...n, id: rename(old), children: n.children.map(rename) } : { ...n, id: rename(old) }
  })
  return { topId: rename(id), nodes }
}

export function duplicateNodes(
  doc: BloKadeDocument, ids: readonly NodeId[],
): { doc: BloKadeDocument; newIds: readonly NodeId[] } {
  const tops = ids.filter((id) => requireNode(doc, id) && !ids.some((other) => other !== id && isDescendant(doc, other, id)))
  return tops.reduce(
    (acc, id) => {
      const { topId, nodes } = copySubtree(acc.doc, id)
      const parentId = parentOf(acc.doc, id) ?? null
      const offsetNodes = nodes.map((n) => (n.id === topId
        ? { ...n, transform: { ...n.transform, position: addVec(n.transform.position, DUPLICATE_OFFSET) } }
        : n))
      const withNodes = { ...acc.doc, nodes: { ...acc.doc.nodes, ...Object.fromEntries(offsetNodes.map((n) => [n.id, n])) } }
      const siblings = siblingsOf(acc.doc, parentId)
      const at = siblings.indexOf(id) + 1
      const nextDoc = withChildren(withNodes, parentId, [...siblings.slice(0, at), topId, ...siblings.slice(at)])
      return { doc: nextDoc, newIds: [...acc.newIds, topId] }
    },
    { doc, newIds: [] as readonly NodeId[] },
  )
}

const addVec = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]

export function setMode(doc: BloKadeDocument, ids: readonly NodeId[], mode: Mode): BloKadeDocument {
  return ids.reduce((d, id) => updateNode(d, id, (n) => ({ ...n, mode })), doc)
}

export function setHidden(doc: BloKadeDocument, ids: readonly NodeId[], hidden: boolean): BloKadeDocument {
  return ids.reduce((d, id) => updateNode(d, id, (n) => ({ ...n, hidden })), doc)
}

export function renameNode(doc: BloKadeDocument, id: NodeId, name: string): BloKadeDocument {
  const trimmed = name.trim()
  if (!trimmed) throw new DocumentOpError("Names can't be empty.")
  return updateNode(doc, id, (n) => ({ ...n, name: trimmed }))
}

export function renameDocument(doc: BloKadeDocument, name: string): BloKadeDocument {
  const trimmed = name.trim()
  if (!trimmed) throw new DocumentOpError("Names can't be empty.")
  return { ...doc, name: trimmed }
}

export function setGridSnap(doc: BloKadeDocument, gridSnap: number): BloKadeDocument {
  if (!Number.isFinite(gridSnap) || gridSnap < 0) throw new DocumentOpError('Grid snap must be zero or more.')
  return { ...doc, settings: { ...doc.settings, gridSnap } }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/document && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/document
git commit -m "feat: add immutable document operations (group, move, duplicate, …)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Undo history and app store

**Files:**
- Create: `src/history/history.ts`, `src/geometry/types.ts`, `src/store/merge-build.ts`, `src/store/store.ts`
- Test: `src/history/history.test.ts`, `src/store/merge-build.test.ts`, `src/store/store.test.ts`

**Interfaces:**
- Consumes: Task 2 types, Task 4 `DocumentOpError`.
- Produces:
  - `History<T>`, `HISTORY_LIMIT = 200`, `createHistory`, `commit`, `undo`, `redo`, `canUndo`, `canRedo`
  - `src/geometry/types.ts` (shared by worker and UI, with **no replicad import**):
    ```ts
    interface MeshData { positions: Float32Array; normals: Float32Array; indices: Uint32Array; edges: Float32Array }
    type NodeBuild = { status: 'ok'; mesh: MeshData } | { status: 'error'; message: string }
    interface BuildResult { nodes: Readonly<Record<NodeId, NodeBuild>> }
    interface GeometryApi {
      rebuild(doc: BloKadeDocument): Promise<BuildResult>
      exportStl(doc: BloKadeDocument, ids?: readonly NodeId[]): Promise<ArrayBuffer>
      export3mf(doc: BloKadeDocument, ids?: readonly NodeId[]): Promise<ArrayBuffer>
    }
    ```
  - `DisplayedMesh { mesh: MeshData; stale: boolean }`, `mergeBuild(prev, result): { meshes, errors }`
  - `ToolMode = 'move' | 'rotate' | 'size'`, `BloKadeState`, `BloKadeStore = StoreApi<BloKadeState>`, `createBloKadeStore({ designId, doc })`
  - State fields: `designId`, `history`, `selection`, `tool`, `meshes`, `errors`, `engineReady`, `notice`
  - Actions: `apply(fn)`, `select(ids)`, `setTool(tool)`, `undo()`, `redo()`, `openDesign(designId, doc)`, `applyBuild(designId, result)`, `notify(message | null)`

- [ ] **Step 1: Write the failing tests**

`src/history/history.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { canRedo, canUndo, commit, createHistory, HISTORY_LIMIT, redo, undo } from './history'

describe('history', () => {
  it('undoes and redoes', () => {
    const h = commit(commit(createHistory(1), 2), 3)
    expect(undo(h).present).toBe(2)
    expect(redo(undo(h)).present).toBe(3)
    expect(canUndo(h)).toBe(true)
    expect(canRedo(h)).toBe(false)
  })

  it('clears redo after a new commit', () => {
    const h = commit(undo(commit(createHistory(1), 2)), 5)
    expect(h.present).toBe(5)
    expect(canRedo(h)).toBe(false)
  })

  it('ignores commits of the same value', () => {
    const h = createHistory(1)
    expect(commit(h, 1)).toBe(h)
  })

  it('is a no-op at the ends', () => {
    const h = createHistory(1)
    expect(undo(h)).toBe(h)
    expect(redo(h)).toBe(h)
  })

  it(`keeps at most ${HISTORY_LIMIT} undo steps`, () => {
    const h = Array.from({ length: 250 }, (_, i) => i + 1).reduce(commit, createHistory(0))
    expect(h.past).toHaveLength(HISTORY_LIMIT)
    expect(h.past[0]).toBe(50)
  })
})
```

`src/store/merge-build.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { MeshData } from '../geometry/types'
import { mergeBuild } from './merge-build'

const mesh = (n: number): MeshData => ({
  positions: new Float32Array([n]), normals: new Float32Array(), indices: new Uint32Array(), edges: new Float32Array(),
})

describe('mergeBuild', () => {
  it('stores fresh meshes and errors', () => {
    const out = mergeBuild({}, { nodes: { a: { status: 'ok', mesh: mesh(1) }, b: { status: 'error', message: 'oops' } } })
    expect(out.meshes.a).toEqual({ mesh: mesh(1), stale: false })
    expect(out.meshes.b).toBeUndefined()
    expect(out.errors).toEqual({ b: 'oops' })
  })

  it('keeps the last good mesh, marked stale, when a part fails', () => {
    const prev = { a: { mesh: mesh(1), stale: false } }
    const out = mergeBuild(prev, { nodes: { a: { status: 'error', message: 'bad' } } })
    expect(out.meshes.a).toEqual({ mesh: mesh(1), stale: true })
  })

  it('drops parts that are gone', () => {
    const prev = { a: { mesh: mesh(1), stale: false } }
    expect(mergeBuild(prev, { nodes: {} }).meshes).toEqual({})
  })
})
```

`src/store/store.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode, groupNodes, removeNodes } from '../document/ops'
import type { MeshData } from '../geometry/types'
import { createBloKadeStore } from './store'

const box = (id: string) => createShapeNode({ id, shapeType: 'box', name: id, params: {}, color: '#fff' })
const mesh: MeshData = { positions: new Float32Array(), normals: new Float32Array(), indices: new Uint32Array(), edges: new Float32Array() }

function setup() {
  return createBloKadeStore({ designId: 'd1', doc: createEmptyDocument() })
}

describe('store', () => {
  it('applies edits with undo and redo', () => {
    const store = setup()
    store.getState().apply((d) => addNode(d, box('a')))
    expect(store.getState().history.present.root).toEqual(['a'])
    store.getState().undo()
    expect(store.getState().history.present.root).toEqual([])
    store.getState().redo()
    expect(store.getState().history.present.root).toEqual(['a'])
  })

  it('turns DocumentOpErrors into a notice instead of crashing', () => {
    const store = setup()
    store.getState().apply((d) => groupNodes(d, ['a']).doc)
    expect(store.getState().notice).toBe('Pick at least two parts to group.')
  })

  it('drops deleted parts from the selection', () => {
    const store = setup()
    store.getState().apply((d) => addNode(d, box('a')))
    store.getState().select(['a', 'ghost'])
    expect(store.getState().selection).toEqual(['a'])
    store.getState().apply((d) => removeNodes(d, ['a']))
    expect(store.getState().selection).toEqual([])
  })

  it('applies builds only for the open design', () => {
    const store = setup()
    store.getState().applyBuild('other', { nodes: { a: { status: 'ok', mesh } } })
    expect(store.getState().meshes).toEqual({})
    expect(store.getState().engineReady).toBe(false)
    store.getState().applyBuild('d1', { nodes: { a: { status: 'ok', mesh } } })
    expect(store.getState().meshes.a?.stale).toBe(false)
    expect(store.getState().engineReady).toBe(true)
  })

  it('opens another design with fresh history', () => {
    const store = setup()
    store.getState().apply((d) => addNode(d, box('a')))
    store.getState().openDesign('d2', createEmptyDocument('Other'))
    expect(store.getState().designId).toBe('d2')
    expect(store.getState().history.past).toEqual([])
    expect(store.getState().history.present.name).toBe('Other')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/history src/store`
Expected: FAIL, because the modules are missing.

- [ ] **Step 3: Implement**

`src/history/history.ts`:
```ts
export const HISTORY_LIMIT = 200

export interface History<T> {
  readonly past: readonly T[]
  readonly present: T
  readonly future: readonly T[]
}

export const createHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] })

export function commit<T>(h: History<T>, next: T): History<T> {
  if (next === h.present) return h
  return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: [] }
}

export function undo<T>(h: History<T>): History<T> {
  const previous = h.past[h.past.length - 1]
  if (h.past.length === 0 || previous === undefined) return h
  return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future] }
}

export function redo<T>(h: History<T>): History<T> {
  const [next, ...rest] = h.future
  if (h.future.length === 0 || next === undefined) return h
  return { past: [...h.past, h.present], present: next, future: rest }
}

export const canUndo = <T>(h: History<T>): boolean => h.past.length > 0
export const canRedo = <T>(h: History<T>): boolean => h.future.length > 0
```

`src/geometry/types.ts`:
```ts
import type { BloKadeDocument, NodeId } from '../document/types'

export interface MeshData {
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly indices: Uint32Array
  /** Line-segment endpoints (x,y,z pairs) for drawing edges. */
  readonly edges: Float32Array
}

export type NodeBuild =
  | { readonly status: 'ok'; readonly mesh: MeshData }
  | { readonly status: 'error'; readonly message: string }

/** One entry per top-level node; meshes are in the node's local frame (before its own transform). */
export interface BuildResult {
  readonly nodes: Readonly<Record<NodeId, NodeBuild>>
}

export interface GeometryApi {
  rebuild(doc: BloKadeDocument): Promise<BuildResult>
  exportStl(doc: BloKadeDocument, ids?: readonly NodeId[]): Promise<ArrayBuffer>
  export3mf(doc: BloKadeDocument, ids?: readonly NodeId[]): Promise<ArrayBuffer>
}
```

`src/store/merge-build.ts`:
```ts
import type { NodeId } from '../document/types'
import type { BuildResult, MeshData } from '../geometry/types'

export interface DisplayedMesh {
  readonly mesh: MeshData
  readonly stale: boolean
}

export function mergeBuild(
  prev: Readonly<Record<NodeId, DisplayedMesh>>, result: BuildResult,
): { meshes: Record<NodeId, DisplayedMesh>; errors: Record<NodeId, string> } {
  const entries = Object.entries(result.nodes)
  const meshes = Object.fromEntries(
    entries.flatMap(([id, build]): [NodeId, DisplayedMesh][] => {
      if (build.status === 'ok') return [[id, { mesh: build.mesh, stale: false }]]
      const old = prev[id]
      return old ? [[id, { mesh: old.mesh, stale: true }]] : []
    }),
  )
  const errors = Object.fromEntries(
    entries.flatMap(([id, build]) => (build.status === 'error' ? [[id, build.message]] : [])),
  )
  return { meshes, errors }
}
```

`src/store/store.ts`:
```ts
import { createStore, type StoreApi } from 'zustand/vanilla'
import { DocumentOpError } from '../document/ops'
import type { BloKadeDocument, NodeId } from '../document/types'
import type { BuildResult } from '../geometry/types'
import { commit, createHistory, redo, undo, type History } from '../history/history'
import { mergeBuild, type DisplayedMesh } from './merge-build'

export type ToolMode = 'move' | 'rotate' | 'size'

export interface BloKadeState {
  readonly designId: string
  readonly history: History<BloKadeDocument>
  readonly selection: readonly NodeId[]
  readonly tool: ToolMode
  readonly meshes: Readonly<Record<NodeId, DisplayedMesh>>
  readonly errors: Readonly<Record<NodeId, string>>
  readonly engineReady: boolean
  readonly notice: string | null
  apply(fn: (doc: BloKadeDocument) => BloKadeDocument): void
  select(ids: readonly NodeId[]): void
  setTool(tool: ToolMode): void
  undo(): void
  redo(): void
  openDesign(designId: string, doc: BloKadeDocument): void
  applyBuild(designId: string, result: BuildResult): void
  notify(message: string | null): void
}

export type BloKadeStore = StoreApi<BloKadeState>

const pruneSelection = (doc: BloKadeDocument, ids: readonly NodeId[]): readonly NodeId[] =>
  ids.filter((id) => doc.nodes[id] !== undefined)

export function createBloKadeStore(init: { designId: string; doc: BloKadeDocument }): BloKadeStore {
  return createStore<BloKadeState>()((set, get) => ({
    designId: init.designId,
    history: createHistory(init.doc),
    selection: [],
    tool: 'move',
    meshes: {},
    errors: {},
    engineReady: false,
    notice: null,
    apply: (fn) => {
      try {
        const next = fn(get().history.present)
        set((s) => ({ history: commit(s.history, next), selection: pruneSelection(next, s.selection) }))
      } catch (error) {
        if (!(error instanceof DocumentOpError)) throw error
        set({ notice: error.message })
      }
    },
    select: (ids) => set((s) => ({ selection: pruneSelection(s.history.present, ids) })),
    setTool: (tool) => set({ tool }),
    undo: () => set((s) => {
      const history = undo(s.history)
      return { history, selection: pruneSelection(history.present, s.selection) }
    }),
    redo: () => set((s) => {
      const history = redo(s.history)
      return { history, selection: pruneSelection(history.present, s.selection) }
    }),
    openDesign: (designId, doc) =>
      set({ designId, history: createHistory(doc), selection: [], meshes: {}, errors: {} }),
    applyBuild: (designId, result) => {
      if (designId !== get().designId) return
      set((s) => ({ ...mergeBuild(s.meshes, result), engineReady: true }))
    },
    notify: (notice) => set({ notice }),
  }))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/history src/store && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/history src/store src/geometry/types.ts
git commit -m "feat: add undo history and the app store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Plugin types, parameters, and registry

**Files:**
- Create: `src/plugins/types.ts`, `src/plugins/params.ts`, `src/plugins/registry.ts`, `src/plugins/index.ts`
- Test: `src/plugins/params.test.ts`, `src/plugins/registry.test.ts`

**Interfaces:**
- Produces:
  - `NumberParamType = 'mm' | 'whole' | 'number' | 'angle'`
  - `NumberParamSpec { type; default: number; min?: number; max?: number; label: string }`
  - `ParamValues = Readonly<Record<string, number>>`
  - `ShapePlugin<K extends string = string> { id; name; icon; version: number; params: Readonly<Record<K, NumberParamSpec>>; size?: { x?: K; y?: K; z?: K }; build(params: Readonly<Record<K, number>>, cad: CadToolkit): Shape3D }`
  - `definePlugin<K extends string>(plugin: ShapePlugin<K>): ShapePlugin<K>`
  - `MIN_MM = 0.01`, `MAX_MM = 2000`, `normalizeParam(spec, raw: unknown): number`, `resolveParams(plugin, raw): ParamValues`, `defaultParams(plugin): ParamValues`
  - `PluginRegistry { get(id): ShapePlugin | undefined; list(): readonly ShapePlugin[] }`
  - `createRegistry(candidates: readonly unknown[]): { registry: PluginRegistry; problems: readonly string[] }`
  - `src/plugins/index.ts` exports `registry` and `pluginProblems` (from built-ins plus `/plugins`)
- `CadToolkit` is declared in Task 7's `src/plugins/cad.ts`. In this task, create a **type-only** stub file `src/plugins/cad-types.ts` that Task 7 fills with the real interface. `types.ts` imports the type from `./cad-types`.

- [ ] **Step 1: Write the failing tests**

`src/plugins/params.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { defaultParams, MAX_MM, MIN_MM, normalizeParam, resolveParams } from './params'
import { definePlugin } from './types'

const plugin = definePlugin({
  id: 'thing', name: 'Thing', icon: '⭐', version: 1,
  params: {
    width: { type: 'mm', default: 20, label: 'Width' },
    teeth: { type: 'whole', default: 12, min: 6, max: 100, label: 'Teeth' },
    tilt: { type: 'angle', default: 0, label: 'Tilt' },
  },
  build: () => { throw new Error('not used') },
})

describe('normalizeParam', () => {
  const mm = { type: 'mm', default: 20, label: 'Width' } as const

  it('keeps good values', () => expect(normalizeParam(mm, 12.5)).toBe(12.5))
  it('replaces junk with the default', () => {
    expect(normalizeParam(mm, 'abc')).toBe(20)
    expect(normalizeParam(mm, Number.NaN)).toBe(20)
    expect(normalizeParam(mm, Infinity)).toBe(20)
    expect(normalizeParam(mm, undefined)).toBe(20)
  })
  it('clamps mm to a printable range', () => {
    expect(normalizeParam(mm, -5)).toBe(MIN_MM)
    expect(normalizeParam(mm, 0)).toBe(MIN_MM)
    expect(normalizeParam(mm, 1e9)).toBe(MAX_MM)
  })
  it('rounds whole numbers and honors min/max', () => {
    const whole = { type: 'whole', default: 12, min: 6, max: 100, label: 'Teeth' } as const
    expect(normalizeParam(whole, 7.6)).toBe(8)
    expect(normalizeParam(whole, 2)).toBe(6)
  })
  it('lets angles go negative', () => {
    expect(normalizeParam({ type: 'angle', default: 0, label: 'Tilt' }, -45)).toBe(-45)
  })
})

describe('resolveParams', () => {
  it('fills in defaults and drops unknown keys', () => {
    expect(resolveParams(plugin, { width: 5, extra: 9 })).toEqual({ width: 5, teeth: 12, tilt: 0 })
  })
  it('gives all defaults', () => {
    expect(defaultParams(plugin)).toEqual({ width: 20, teeth: 12, tilt: 0 })
  })
})
```

`src/plugins/registry.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createRegistry } from './registry'

const good = (id: string) => ({
  id, name: 'Good', icon: '✅', version: 1,
  params: { size: { type: 'mm', default: 10, label: 'Size' } },
  size: { x: 'size' },
  build: () => null,
})

describe('createRegistry', () => {
  it('registers valid plugins in order', () => {
    const { registry, problems } = createRegistry([good('a'), good('b')])
    expect(problems).toEqual([])
    expect(registry.list().map((p) => p.id)).toEqual(['a', 'b'])
    expect(registry.get('b')?.name).toBe('Good')
    expect(registry.get('nope')).toBeUndefined()
  })

  it('reports broken plugins instead of crashing', () => {
    const { registry, problems } = createRegistry([{ name: 'No id' }, { ...good('c'), build: 'nope' }, 42])
    expect(registry.list()).toEqual([])
    expect(problems).toHaveLength(3)
  })

  it('reports a size mapping to a missing parameter', () => {
    const { problems } = createRegistry([{ ...good('d'), size: { x: 'width' } }])
    expect(problems[0]).toContain('width')
  })

  it('keeps the first of two plugins with the same id', () => {
    const { registry, problems } = createRegistry([good('a'), { ...good('a'), name: 'Second' }])
    expect(registry.get('a')?.name).toBe('Good')
    expect(problems[0]).toContain('"a"')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/plugins`
Expected: FAIL, because the modules are missing.

- [ ] **Step 3: Implement**

`src/plugins/cad-types.ts` (Task 7 replaces this body with the real interface):
```ts
import type { Shape3D } from 'replicad'

export type Point2 = readonly [number, number]

/** The toolkit handed to every plugin's build(). Implemented in cad.ts (worker only). */
export interface CadToolkit {
  box(x: number, y: number, z: number): Shape3D
}
```

`src/plugins/types.ts`:
```ts
import type { Shape3D } from 'replicad'
import type { CadToolkit } from './cad-types'

export type NumberParamType = 'mm' | 'whole' | 'number' | 'angle'

export interface NumberParamSpec {
  readonly type: NumberParamType
  readonly default: number
  readonly min?: number
  readonly max?: number
  readonly label: string
}

export type ParamValues = Readonly<Record<string, number>>

export interface ShapePlugin<K extends string = string> {
  readonly id: string
  readonly name: string
  readonly icon: string
  readonly version: number
  readonly params: Readonly<Record<K, NumberParamSpec>>
  /** Which parameter each size handle (x/y/z) changes. */
  readonly size?: { readonly x?: K; readonly y?: K; readonly z?: K }
  build(params: Readonly<Record<K, number>>, cad: CadToolkit): Shape3D
}

/** Identity helper so plugin authors get type checking and inferred parameter names. */
export function definePlugin<K extends string>(plugin: ShapePlugin<K>): ShapePlugin<K> {
  return plugin
}
```

`src/plugins/params.ts`:
```ts
import type { NumberParamSpec, ParamValues, ShapePlugin } from './types'

export const MIN_MM = 0.01
export const MAX_MM = 2000

function boundsOf(spec: NumberParamSpec): { min: number; max: number } {
  const isMm = spec.type === 'mm'
  return {
    min: spec.min ?? (isMm ? MIN_MM : -Infinity),
    max: spec.max ?? (isMm ? MAX_MM : Infinity),
  }
}

/** Junk becomes the default; numbers are clamped (and rounded for whole numbers). */
export function normalizeParam(spec: NumberParamSpec, raw: unknown): number {
  const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : spec.default
  const { min, max } = boundsOf(spec)
  const clamped = Math.min(max, Math.max(min, value))
  return spec.type === 'whole' ? Math.round(clamped) : clamped
}

export function resolveParams(plugin: ShapePlugin, raw: Readonly<Record<string, unknown>>): ParamValues {
  return Object.fromEntries(
    Object.entries<NumberParamSpec>(plugin.params).map(([key, spec]) => [key, normalizeParam(spec, raw[key])]),
  )
}

export const defaultParams = (plugin: ShapePlugin): ParamValues => resolveParams(plugin, {})
```

`src/plugins/registry.ts`:
```ts
import { z } from 'zod'
import type { ShapePlugin } from './types'

export interface PluginRegistry {
  get(id: string): ShapePlugin | undefined
  list(): readonly ShapePlugin[]
}

const paramSpec = z.object({
  type: z.enum(['mm', 'whole', 'number', 'angle']),
  default: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
  label: z.string().min(1),
})

const pluginSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/, 'id must be lowercase letters, numbers and dashes'),
    name: z.string().min(1),
    icon: z.string().min(1),
    version: z.number().int().positive(),
    params: z.record(z.string(), paramSpec),
    size: z.object({ x: z.string().optional(), y: z.string().optional(), z: z.string().optional() }).optional(),
    build: z.custom<ShapePlugin['build']>((v) => typeof v === 'function', 'build must be a function'),
  })
  .superRefine((p, ctx) => {
    for (const target of Object.values(p.size ?? {})) {
      if (target && !(target in p.params)) {
        ctx.addIssue({ code: 'custom', message: `size handle points at missing parameter "${target}"` })
      }
    }
  })

const labelOf = (candidate: unknown, index: number): string => {
  const name = typeof candidate === 'object' && candidate !== null && 'name' in candidate ? String(candidate.name) : ''
  return name ? `"${name}"` : `#${index + 1}`
}

export function createRegistry(candidates: readonly unknown[]): {
  registry: PluginRegistry
  problems: readonly string[]
} {
  const byId = new Map<string, ShapePlugin>()
  const problems: string[] = []
  candidates.forEach((candidate, index) => {
    const parsed = pluginSchema.safeParse(candidate)
    if (!parsed.success) {
      problems.push(`Plugin ${labelOf(candidate, index)} has a problem: ${parsed.error.issues[0]?.message ?? 'invalid'}`)
      return
    }
    const plugin = candidate as ShapePlugin
    if (byId.has(plugin.id)) {
      problems.push(`Two plugins use the id "${plugin.id}"; keeping the first one.`)
      return
    }
    byId.set(plugin.id, plugin)
  })
  const list = [...byId.values()]
  return { registry: { get: (id) => byId.get(id), list: () => list }, problems }
}
```

`src/plugins/index.ts`:
```ts
import { createRegistry } from './registry'

const builtin = import.meta.glob<unknown>('./builtin/*.ts', { eager: true, import: 'default' })
const kades = import.meta.glob<unknown>('../../plugins/**/*.{js,ts}', { eager: true, import: 'default' })

const BUILTIN_ORDER = ['box', 'cylinder', 'sphere', 'cone', 'wedge', 'torus']
const orderOf = (path: string): number => {
  const index = BUILTIN_ORDER.findIndex((name) => path.endsWith(`/${name}.ts`))
  return index === -1 ? BUILTIN_ORDER.length : index
}

const builtinPlugins = Object.entries(builtin)
  .sort(([a], [b]) => orderOf(a) - orderOf(b))
  .map(([, plugin]) => plugin)

export const { registry, problems: pluginProblems } = createRegistry([...builtinPlugins, ...Object.values(kades)])
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/plugins && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/plugins
git commit -m "feat: add shape plugin types, parameter rules and registry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Geometry test harness, CAD toolkit, and built-in shapes

**Files:**
- Create: `src/geometry/testing/oc-node.ts`, `src/plugins/cad.ts`, `src/plugins/builtin/box.ts`, `cylinder.ts`, `sphere.ts`, `cone.ts`, `wedge.ts`, `torus.ts`
- Modify: `src/plugins/cad-types.ts` (replace the stub with the full interface)
- Test: `src/plugins/cad.test.ts`, `src/plugins/builtin/builtin.test.ts`

**Interfaces:**
- Consumes: `definePlugin`, `ShapePlugin`, `registry`, `pluginProblems` from Task 6.
- Produces:
  - `initTestOC(): Promise<void>` loads OpenCascade into replicad under Node (for tests only)
  - `CadToolkit` (in `cad-types.ts`):
    - `box(x, y, z)`: centered on X/Y, z from 0 to `z`
    - `cylinder(diameter, height)`: centered on X/Y, z from 0 to `height`
    - `sphere(diameter)`: resting on z = 0
    - `torus(outerDiameter, thickness)`: resting on z = 0; throws if the hole would close up
    - `revolve(profile: readonly Point2[])`: profile points are `[radius, z]`, spun around the Z axis
    - `extrudeSide(profile: readonly Point2[], width)`: profile points are `[x, z]`, extruded across Y and centered
  - `createCadToolkit(): CadToolkit`, `cleanProfile(profile): Point2[]`
  - Six built-in plugins, with ids `box`, `cylinder`, `sphere`, `cone`, `wedge`, `torus`

**Background (verified against replicad 1.1.0):** `makeBaseBox(x,y,z)` spans x∈[-x/2,x/2], y∈[-y/2,y/2], z∈[0,z]. `makeCylinder(r,h)` spans z∈[0,h]. `makeSphere(r)` is centered on the origin. A drawing sketched on plane `'XZ'` maps drawing (x, y) to world (x, z). Extruding an `'XZ'` sketch goes toward **−Y**, so it uses origin `[0, width/2, 0]` to center on Y. `revolve()` spins around world Z. `Drawing.sketchOnPlane` is typed `SketchInterface | Sketches`, so `extrude`/`revolve` return `Shape3D | AnyShape`. Narrow the result with `asSolid` below.

- [ ] **Step 1: Write the failing tests**

`src/plugins/cad.test.ts`:
```ts
import { measureVolume } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { initTestOC } from '../geometry/testing/oc-node'
import { cleanProfile, createCadToolkit } from './cad'

beforeAll(initTestOC)

const boundsOf = (shape: { boundingBox: { bounds: [number[], number[]] } }) =>
  shape.boundingBox.bounds.map((p) => p.map((v) => Math.round(v * 1000) / 1000))

describe('cleanProfile', () => {
  it('removes repeated and closing points', () => {
    expect(cleanProfile([[0, 0], [1, 0], [1, 0], [0, 1], [0, 0]])).toEqual([[0, 0], [1, 0], [0, 1]])
  })
})

describe('cad toolkit', () => {
  const cad = createCadToolkit()

  it('makes a box resting on the ground', () => {
    const box = cad.box(10, 20, 30)
    expect(measureVolume(box)).toBeCloseTo(6000, 3)
    expect(boundsOf(box)).toEqual([[-5, -10, 0], [5, 10, 30]])
  })

  it('makes a cylinder from a diameter', () => {
    expect(measureVolume(cad.cylinder(10, 10))).toBeCloseTo(Math.PI * 25 * 10, 3)
  })

  it('makes a sphere resting on the ground', () => {
    expect(boundsOf(cad.sphere(10))).toEqual([[-5, -5, 0], [5, 5, 10]])
  })

  it('revolves a profile around Z', () => {
    const cone = cad.revolve([[0, 0], [10, 0], [0, 20]])
    expect(measureVolume(cone)).toBeCloseTo((Math.PI * 100 * 20) / 3, 2)
  })

  it('refuses revolve profiles that cross the center line', () => {
    expect(() => cad.revolve([[-1, 0], [5, 0], [0, 5]])).toThrow('center line')
  })

  it('refuses profiles with fewer than 3 points', () => {
    expect(() => cad.revolve([[0, 0], [5, 0], [5, 0]])).toThrow('at least 3')
  })

  it('extrudes a side profile centered on Y', () => {
    const wedge = cad.extrudeSide([[-10, 0], [10, 0], [-10, 15]], 10)
    expect(measureVolume(wedge)).toBeCloseTo(1500, 3)
    expect(boundsOf(wedge)).toEqual([[-10, -5, 0], [10, 5, 15]])
  })

  it('makes a torus and refuses a closed-up ring', () => {
    expect(measureVolume(cad.torus(50, 10))).toBeCloseTo(2 * Math.PI ** 2 * 20 * 25, 1)
    expect(() => cad.torus(20, 10)).toThrow('wider than twice its thickness')
  })
})
```

`src/plugins/builtin/builtin.test.ts`:
```ts
import { measureVolume } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { initTestOC } from '../../geometry/testing/oc-node'
import { createCadToolkit } from '../cad'
import { pluginProblems, registry } from '../index'
import { defaultParams } from '../params'

beforeAll(initTestOC)

const expectedVolumes: Record<string, number> = {
  box: 8000,
  cylinder: Math.PI * 100 * 20,
  sphere: (4 / 3) * Math.PI * 1000,
  cone: (Math.PI * 100 * 20) / 3,
  wedge: 4000,
  torus: 2 * Math.PI ** 2 * 15 * 25,
}

describe('built-in shapes', () => {
  it('registers all six built-ins in palette order with no problems', () => {
    expect(pluginProblems).toEqual([])
    expect(registry.list().map((p) => p.id)).toEqual(['box', 'cylinder', 'sphere', 'cone', 'wedge', 'torus'])
  })

  it.each(Object.entries(expectedVolumes))('%s builds with its defaults', (id, volume) => {
    const plugin = registry.get(id)
    if (!plugin) throw new Error(`missing ${id}`)
    const shape = plugin.build(defaultParams(plugin), createCadToolkit())
    expect(measureVolume(shape)).toBeCloseTo(volume, 1)
    expect(shape.boundingBox.bounds[0][2]).toBeCloseTo(0, 5)
  })

  it('every size handle maps to a real parameter', () => {
    for (const plugin of registry.list()) {
      for (const target of Object.values(plugin.size ?? {})) expect(plugin.params).toHaveProperty(target as string)
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/plugins`
Expected: FAIL, because `./cad` and `../geometry/testing/oc-node` are missing.

- [ ] **Step 3: Implement**

`src/geometry/testing/oc-node.ts`:
```ts
import { createRequire } from 'node:module'
import { setOC } from 'replicad'
import opencascade from 'replicad-opencascadejs'

let ready: Promise<void> | null = null

/** Loads OpenCascade into replicad for Node-based tests (once per test worker). */
export function initTestOC(): Promise<void> {
  if (!ready) {
    const wasmPath = createRequire(import.meta.url).resolve('replicad-opencascadejs/wasm')
    ready = opencascade({ locateFile: () => wasmPath }).then((oc) => setOC(oc))
  }
  return ready
}
```

`src/plugins/cad-types.ts` (full version):
```ts
import type { Shape3D } from 'replicad'

export type Point2 = readonly [number, number]

/** The toolkit handed to every plugin's build(). Implemented in cad.ts (worker and tests only). */
export interface CadToolkit {
  /** Box centered on X/Y, sitting on z = 0. */
  box(x: number, y: number, z: number): Shape3D
  /** Upright cylinder centered on X/Y, sitting on z = 0. */
  cylinder(diameter: number, height: number): Shape3D
  /** Ball sitting on z = 0. */
  sphere(diameter: number): Shape3D
  /** Ring lying flat on z = 0. */
  torus(outerDiameter: number, thickness: number): Shape3D
  /** Spin a [radius, z] outline around the Z axis. */
  revolve(profile: readonly Point2[]): Shape3D
  /** Draw an [x, z] outline and push it out across Y, centered. */
  extrudeSide(profile: readonly Point2[], width: number): Shape3D
}
```

`src/plugins/cad.ts`:
```ts
import { draw, drawCircle, makeBaseBox, makeCylinder, makeSphere, type AnyShape, type Shape3D } from 'replicad'
import type { CadToolkit, Point2 } from './cad-types'

const EPS = 1e-9
const samePoint = (a: Point2, b: Point2): boolean => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS

/** Drops consecutive repeats and a closing point equal to the first. */
export function cleanProfile(profile: readonly Point2[]): Point2[] {
  const noRepeats = profile.filter((p, i) => {
    const prev = profile[i - 1]
    return i === 0 || !prev || !samePoint(p, prev)
  })
  const first = noRepeats[0]
  const last = noRepeats[noRepeats.length - 1]
  return noRepeats.length > 1 && first && last && samePoint(first, last) ? noRepeats.slice(0, -1) : noRepeats
}

function profileDrawing(profile: readonly Point2[]) {
  const [first, ...rest] = cleanProfile(profile)
  if (!first || rest.length < 2) throw new Error('A profile needs at least 3 different points.')
  return rest.reduce((pen, [x, y]) => pen.lineTo([x, y]), draw([first[0], first[1]])).close()
}

function asSolid(shape: Shape3D | AnyShape): Shape3D {
  if ('fuse' in shape && 'cut' in shape) return shape as Shape3D
  throw new Error("That outline didn't make a solid shape.")
}

export function createCadToolkit(): CadToolkit {
  return {
    box: (x, y, z) => makeBaseBox(x, y, z),
    cylinder: (diameter, height) => makeCylinder(diameter / 2, height),
    sphere: (diameter) => makeSphere(diameter / 2).translate([0, 0, diameter / 2]),
    torus: (outerDiameter, thickness) => {
      const tube = thickness / 2
      const ringRadius = outerDiameter / 2 - tube
      if (ringRadius <= tube) throw new Error('Make the ring wider than twice its thickness.')
      return asSolid(drawCircle(tube).translate([ringRadius, tube]).sketchOnPlane('XZ').revolve())
    },
    revolve: (profile) => {
      if (profile.some(([x]) => x < 0)) {
        throw new Error('A spin outline must stay on the right of the center line (x ≥ 0).')
      }
      return asSolid(profileDrawing(profile).sketchOnPlane('XZ').revolve())
    },
    extrudeSide: (profile, width) =>
      asSolid(profileDrawing(profile).sketchOnPlane('XZ', [0, width / 2, 0]).extrude(width)),
  }
}
```

`src/plugins/builtin/box.ts`:
```ts
import { definePlugin } from '../types'

export default definePlugin({
  id: 'box',
  name: 'Box',
  icon: '🟦',
  version: 1,
  params: {
    width: { type: 'mm', default: 20, label: 'Width' },
    depth: { type: 'mm', default: 20, label: 'Depth' },
    height: { type: 'mm', default: 20, label: 'Height' },
  },
  size: { x: 'width', y: 'depth', z: 'height' },
  build: ({ width, depth, height }, cad) => cad.box(width, depth, height),
})
```

`src/plugins/builtin/cylinder.ts`:
```ts
import { definePlugin } from '../types'

export default definePlugin({
  id: 'cylinder',
  name: 'Cylinder',
  icon: '🥫',
  version: 1,
  params: {
    diameter: { type: 'mm', default: 20, label: 'Diameter' },
    height: { type: 'mm', default: 20, label: 'Height' },
  },
  size: { x: 'diameter', y: 'diameter', z: 'height' },
  build: ({ diameter, height }, cad) => cad.cylinder(diameter, height),
})
```

`src/plugins/builtin/sphere.ts`:
```ts
import { definePlugin } from '../types'

export default definePlugin({
  id: 'sphere',
  name: 'Sphere',
  icon: '⚪',
  version: 1,
  params: { diameter: { type: 'mm', default: 20, label: 'Diameter' } },
  size: { x: 'diameter', y: 'diameter', z: 'diameter' },
  build: ({ diameter }, cad) => cad.sphere(diameter),
})
```

`src/plugins/builtin/cone.ts`:
```ts
import { definePlugin } from '../types'

export default definePlugin({
  id: 'cone',
  name: 'Cone',
  icon: '🔺',
  version: 1,
  params: {
    bottomDiameter: { type: 'mm', default: 20, label: 'Bottom diameter' },
    topDiameter: { type: 'mm', default: 0, min: 0, label: 'Top diameter' },
    height: { type: 'mm', default: 20, label: 'Height' },
  },
  size: { x: 'bottomDiameter', y: 'bottomDiameter', z: 'height' },
  build: ({ bottomDiameter, topDiameter, height }, cad) =>
    cad.revolve([[0, 0], [bottomDiameter / 2, 0], [topDiameter / 2, height], [0, height]]),
})
```

`src/plugins/builtin/wedge.ts`:
```ts
import { definePlugin } from '../types'

/** A ramp: tall at -X, sloping down to the ground at +X. */
export default definePlugin({
  id: 'wedge',
  name: 'Wedge',
  icon: '📐',
  version: 1,
  params: {
    length: { type: 'mm', default: 20, label: 'Length' },
    width: { type: 'mm', default: 20, label: 'Width' },
    height: { type: 'mm', default: 20, label: 'Height' },
  },
  size: { x: 'length', y: 'width', z: 'height' },
  build: ({ length, width, height }, cad) =>
    cad.extrudeSide([[-length / 2, 0], [length / 2, 0], [-length / 2, height]], width),
})
```

`src/plugins/builtin/torus.ts`:
```ts
import { definePlugin } from '../types'

export default definePlugin({
  id: 'torus',
  name: 'Ring',
  icon: '🍩',
  version: 1,
  params: {
    diameter: { type: 'mm', default: 40, label: 'Outside diameter' },
    thickness: { type: 'mm', default: 10, label: 'Thickness' },
  },
  size: { x: 'diameter', y: 'diameter', z: 'thickness' },
  build: ({ diameter, thickness }, cad) => cad.torus(diameter, thickness),
})
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/plugins && npm run typecheck`
Expected: PASS. The first geometry test file takes a few seconds while OpenCascade loads.

- [ ] **Step 5: Commit**

```bash
git add src/plugins src/geometry/testing
git commit -m "feat: add CAD toolkit and the six built-in shape plugins

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Placement and the evaluator

**Files:**
- Create: `src/geometry/transform.ts`, `src/geometry/evaluate.ts`
- Test: `src/geometry/transform.test.ts`, `src/geometry/evaluate.test.ts`

**Interfaces:**
- Consumes: `PluginRegistry`, `resolveParams`, `CadToolkit`, document types, `transformToMatrix` (in tests).
- Produces:
  - `placeShape(shape: Shape3D, t: Transform): Shape3D`. **Consumes `shape`**, so pass a clone if you still need the original.
  - `class NodeBuildError extends Error { readonly nodeId: NodeId }`
  - `class Evaluator`, built with `new Evaluator(registry, cad)`:
    - `beginPass(): void`, `endPass(): void`. Shapes not used since `beginPass` are deleted at `endPass`.
    - `local(doc, id): Shape3D`: the node before its own transform. Groups apply their children's transforms.
    - `placed(doc, id): Shape3D`: `local` plus the node's own transform.
    - Returned shapes belong to the evaluator cache. Callers may read, mesh, or boolean them, but must `.clone()` before `translate`/`rotate`, and must never `.delete()` them.

- [ ] **Step 1: Write the failing tests**

`src/geometry/transform.test.ts`:
```ts
import { makeBaseBox } from 'replicad'
import { Box3, Vector3 } from 'three'
import { beforeAll, describe, expect, it } from 'vitest'
import { transformToMatrix } from '../document/transform-math'
import type { Transform } from '../document/types'
import { initTestOC } from './testing/oc-node'
import { placeShape } from './transform'

beforeAll(initTestOC)

describe('placeShape', () => {
  it('matches the three.js placement used by the viewport', () => {
    const t: Transform = { position: [5, -3, 2], rotation: [30, 45, 60] }
    const placed = placeShape(makeBaseBox(10, 20, 30), t)
    const corners = [-5, 5].flatMap((x) => [-10, 10].flatMap((y) => [0, 30].map((z) => new Vector3(x, y, z))))
    const expected = new Box3().setFromPoints(corners.map((c) => c.applyMatrix4(transformToMatrix(t))))
    const [min, max] = placed.boundingBox.bounds
    expect(min[0]).toBeCloseTo(expected.min.x, 2)
    expect(min[1]).toBeCloseTo(expected.min.y, 2)
    expect(min[2]).toBeCloseTo(expected.min.z, 2)
    expect(max[0]).toBeCloseTo(expected.max.x, 2)
    expect(max[1]).toBeCloseTo(expected.max.y, 2)
    expect(max[2]).toBeCloseTo(expected.max.z, 2)
  })
})
```

`src/geometry/evaluate.test.ts`:
```ts
import { measureVolume } from 'replicad'
import { beforeAll, describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode, groupNodes, setHidden, setMode, updateNode } from '../document/ops'
import type { BloKadeDocument, Transform } from '../document/types'
import { createCadToolkit } from '../plugins/cad'
import { registry } from '../plugins/index'
import { createRegistry } from '../plugins/registry'
import { definePlugin } from '../plugins/types'
import { Evaluator, NodeBuildError } from './evaluate'
import { initTestOC } from './testing/oc-node'

beforeAll(initTestOC)

const shape = (id: string, shapeType: string, params: Record<string, number>, position: [number, number, number] = [0, 0, 0]) =>
  createShapeNode({ id, shapeType, name: id, params, color: '#fff', position })

function boxWithHole(): BloKadeDocument {
  const doc = [shape('box', 'box', { width: 20, depth: 20, height: 20 }), shape('hole', 'cylinder', { diameter: 10, height: 40 }, [0, 0, -10])]
    .reduce((d, n) => addNode(d, n), createEmptyDocument())
  return groupNodes(setMode(doc, ['hole'], 'hole'), ['box', 'hole'], 'g').doc
}

const newEvaluator = () => new Evaluator(registry, createCadToolkit())

function buildError(fn: () => unknown): NodeBuildError {
  try { fn() } catch (error) { if (error instanceof NodeBuildError) return error }
  throw new Error('expected a NodeBuildError')
}

describe('Evaluator', () => {
  it('builds a shape with its parameters', () => {
    const doc = addNode(createEmptyDocument(), shape('a', 'box', { width: 10, depth: 10, height: 10 }))
    expect(measureVolume(newEvaluator().local(doc, 'a'))).toBeCloseTo(1000, 3)
  })

  it('applies the node transform only when placed', () => {
    const doc = addNode(createEmptyDocument(), shape('a', 'box', { width: 10, depth: 10, height: 10 }, [100, 0, 0]))
    const ev = newEvaluator()
    expect(ev.local(doc, 'a').boundingBox.center[0]).toBeCloseTo(0, 5)
    expect(ev.placed(doc, 'a').boundingBox.center[0]).toBeCloseTo(100, 5)
  })

  it('cuts holes out of solids in a group', () => {
    const volume = measureVolume(newEvaluator().local(boxWithHole(), 'g'))
    expect(volume).toBeCloseTo(8000 - Math.PI * 25 * 20, 1)
  })

  it('ignores hidden parts inside a group', () => {
    const doc = setHidden(boxWithHole(), ['hole'], true)
    expect(measureVolume(newEvaluator().local(doc, 'g'))).toBeCloseTo(8000, 1)
  })

  it('explains a group with only holes', () => {
    const doc = setMode(boxWithHole(), ['box'], 'hole')
    expect(buildError(() => newEvaluator().local(doc, 'g')).message).toContain('no solid parts')
  })

  it('explains holes that cut away everything', () => {
    const doc = updateNode(boxWithHole(), 'hole', (n) => (n.kind === 'shape' ? { ...n, params: { diameter: 100, height: 100 } } : n))
    expect(buildError(() => newEvaluator().local(doc, 'g')).message).toContain('cut away everything')
  })

  it('explains an unknown shape type', () => {
    const doc = addNode(createEmptyDocument(), shape('a', 'spaceship', {}))
    const error = buildError(() => newEvaluator().local(doc, 'a'))
    expect(error.message).toContain('"spaceship"')
    expect(error.nodeId).toBe('a')
  })

  it("names the child when a group's part fails", () => {
    const doc = updateNode(boxWithHole(), 'box', (n) => (n.kind === 'shape' ? { ...n, shapeType: 'spaceship' } : n))
    const error = buildError(() => newEvaluator().local(doc, 'g'))
    expect(error.nodeId).toBe('g')
    expect(error.message).toContain('"box"')
  })

  it('wraps plugin crashes in a friendly message', () => {
    const broken = definePlugin({
      id: 'broken', name: 'Broken', icon: '💥', version: 1, params: {},
      build: () => { throw new Error('kaboom') },
    })
    const { registry: withBroken } = createRegistry([...registry.list(), broken])
    const doc = addNode(createEmptyDocument(), shape('a', 'broken', {}))
    const error = buildError(() => new Evaluator(withBroken, createCadToolkit()).local(doc, 'a'))
    expect(error.message).toBe("Broken couldn't be built: kaboom")
  })

  it('reuses cached shapes and frees unused ones', () => {
    const ev = newEvaluator()
    const doc = boxWithHole()
    ev.beginPass()
    const first = ev.local(doc, 'g')
    ev.endPass()
    ev.beginPass()
    expect(ev.local(doc, 'g')).toBe(first)
    ev.endPass()

    const moved = updateNode(doc, 'hole', (n) => ({ ...n, transform: { position: [5, 0, -10], rotation: [0, 0, 0] } as Transform }))
    ev.beginPass()
    const second = ev.local(moved, 'g')
    ev.endPass()
    expect(second).not.toBe(first)
    expect(() => measureVolume(first)).toThrow()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/geometry`
Expected: FAIL, because the modules are missing.

- [ ] **Step 3: Implement**

`src/geometry/transform.ts`:
```ts
import type { Shape3D } from 'replicad'
import type { Transform } from '../document/types'

type Axis = [number, number, number]

/**
 * Applies a node transform. Matches three.js Euler 'XYZ' (matrix = Rx·Ry·Rz):
 * rotate about world Z, then Y, then X, then translate.
 * Consumes `shape` (replicad deletes the original on transform).
 */
export function placeShape(shape: Shape3D, t: Transform): Shape3D {
  const [rx, ry, rz] = t.rotation
  const steps: ReadonlyArray<[number, Axis]> = [[rz, [0, 0, 1]], [ry, [0, 1, 0]], [rx, [1, 0, 0]]]
  const rotated = steps.reduce<Shape3D>(
    (current, [angle, axis]) => (angle === 0 ? current : current.rotate(angle, [0, 0, 0], axis)),
    shape,
  )
  const [x, y, z] = t.position
  return x === 0 && y === 0 && z === 0 ? rotated : rotated.translate([x, y, z])
}
```

`src/geometry/evaluate.ts`:
```ts
import type { Shape3D } from 'replicad'
import type { BloKadeDocument, GroupNode, NodeId, SceneNode, ShapeNode } from '../document/types'
import type { CadToolkit } from '../plugins/cad-types'
import { resolveParams } from '../plugins/params'
import type { PluginRegistry } from '../plugins/registry'
import { placeShape } from './transform'

export class NodeBuildError extends Error {
  override name = 'NodeBuildError'
  constructor(message: string, readonly nodeId: NodeId) {
    super(message)
  }
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))
const stableKey = (values: Readonly<Record<string, number>>): string =>
  JSON.stringify(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)))

/** Builds solids from the document with a per-node cache. Returned shapes are owned by the cache. */
export class Evaluator {
  private readonly cache = new Map<string, Shape3D>()
  private touched = new Set<string>()

  constructor(private readonly registry: PluginRegistry, private readonly cad: CadToolkit) {}

  beginPass(): void {
    this.touched = new Set()
  }

  endPass(): void {
    for (const [key, shape] of this.cache) {
      if (!this.touched.has(key)) {
        shape.delete()
        this.cache.delete(key)
      }
    }
  }

  local(doc: BloKadeDocument, id: NodeId): Shape3D {
    const node = this.nodeOf(doc, id)
    return node.kind === 'shape' ? this.shapeLocal(node) : this.groupLocal(doc, node)
  }

  placed(doc: BloKadeDocument, id: NodeId): Shape3D {
    const node = this.nodeOf(doc, id)
    const local = this.local(doc, id)
    return this.entry(this.placedKey(doc, node), () => placeShape(local.clone(), node.transform))
  }

  private nodeOf(doc: BloKadeDocument, id: NodeId): SceneNode {
    const node = doc.nodes[id]
    if (!node) throw new NodeBuildError('This part is missing from the design.', id)
    return node
  }

  private entry(key: string, make: () => Shape3D): Shape3D {
    this.touched.add(key)
    const hit = this.cache.get(key)
    if (hit) return hit
    const shape = make()
    this.cache.set(key, shape)
    return shape
  }

  private shapeKey(node: ShapeNode): string {
    const plugin = this.registry.get(node.shapeType)
    const params = plugin ? resolveParams(plugin, node.params) : node.params
    return `shape:${node.shapeType}@${plugin?.version ?? 0}:${stableKey(params)}`
  }

  private groupKey(doc: BloKadeDocument, group: GroupNode): string {
    const parts = this.members(doc, group).map((m) => `${m.mode}:${this.placedKey(doc, m)}`)
    return `group:[${parts.join(',')}]`
  }

  private placedKey(doc: BloKadeDocument, node: SceneNode): string {
    const local = node.kind === 'shape' ? this.shapeKey(node) : this.groupKey(doc, node)
    return `${local}@${node.transform.position.join(',')}/${node.transform.rotation.join(',')}`
  }

  private members(doc: BloKadeDocument, group: GroupNode): SceneNode[] {
    return group.children.flatMap((id) => {
      const child = doc.nodes[id]
      return child && !child.hidden ? [child] : []
    })
  }

  private shapeLocal(node: ShapeNode): Shape3D {
    const plugin = this.registry.get(node.shapeType)
    if (!plugin) {
      throw new NodeBuildError(`BloKade doesn't know the shape "${node.shapeType}". Is its plugin missing?`, node.id)
    }
    const params = resolveParams(plugin, node.params)
    return this.entry(this.shapeKey(node), () => {
      try {
        return plugin.build(params, this.cad)
      } catch (error) {
        throw new NodeBuildError(`${plugin.name} couldn't be built: ${messageOf(error)}`, node.id)
      }
    })
  }

  private groupLocal(doc: BloKadeDocument, group: GroupNode): Shape3D {
    const members = this.members(doc, group)
    const solids = members.filter((m) => m.mode === 'solid')
    const holes = members.filter((m) => m.mode === 'hole')
    const [firstSolid, ...otherSolids] = solids
    if (!firstSolid) {
      throw new NodeBuildError(
        "This group has no solid parts, so there's nothing to keep. Add a solid or switch a part from Hole to Solid.",
        group.id,
      )
    }
    return this.entry(this.groupKey(doc, group), () => {
      const fused = otherSolids.reduce((acc, m) => swap(acc, acc.fuse(this.placedMember(doc, group, m))),
        this.placedMember(doc, group, firstSolid).clone())
      const result = holes.reduce((acc, m) => swap(acc, acc.cut(this.placedMember(doc, group, m))), fused)
      if (result.faces.length === 0) {
        result.delete()
        throw new NodeBuildError('The holes cut away everything in this group.', group.id)
      }
      return result
    })
  }

  private placedMember(doc: BloKadeDocument, group: GroupNode, member: SceneNode): Shape3D {
    try {
      return this.placed(doc, member.id)
    } catch (error) {
      throw new NodeBuildError(`"${member.name}" inside this group has a problem: ${messageOf(error)}`, group.id)
    }
  }
}

/** Frees the previous intermediate shape and returns the next one. */
function swap(previous: Shape3D, next: Shape3D): Shape3D {
  previous.delete()
  return next
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/geometry && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/geometry
git commit -m "feat: add the geometry evaluator with groups, holes and caching

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Meshing, export (STL/3MF), and the geometry API

**Files:**
- Create: `src/geometry/tessellate.ts`, `src/geometry/weld.ts`, `src/geometry/export-3mf.ts`, `src/geometry/api.ts`, `src/geometry/testing/stl.ts`
- Test: `src/geometry/weld.test.ts`, `src/geometry/export-3mf.test.ts`, `src/geometry/api.test.ts`

**Interfaces:**
- Consumes: `Evaluator`, `NodeBuildError` (Task 8); `MeshData`, `BuildResult`, `NodeBuild`, `GeometryApi` (Task 5); `rootAncestorOf` (Task 3).
- Produces:
  - `DISPLAY_QUALITY = { tolerance: 0.1, angularTolerance: 0.3 }`, `EXPORT_QUALITY = { tolerance: 0.01, angularTolerance: 0.1 }`
  - `toMeshData(shape: Shape3D): MeshData`
  - `weldMesh(vertices: ArrayLike<number>, triangles: ArrayLike<number>, precision?: number): { vertices: number[]; triangles: number[] }`
  - `countOpenEdges(triangles: ArrayLike<number>): number`
  - `write3mf(mesh: { vertices: ArrayLike<number>; triangles: ArrayLike<number> }, title: string): Uint8Array`
  - `class ExportError extends Error`, `exportTargets(doc, ids?): NodeId[]`, `createGeometryApi(evaluator: Evaluator): GeometryApi`
  - Test helpers: `parseBinaryStl(buffer: ArrayBuffer): { vertices: number[]; triangles: number[] }`, `meshVolume(vertices, triangles): number`

- [ ] **Step 1: Write the failing tests**

`src/geometry/weld.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { countOpenEdges, weldMesh } from './weld'

// Two triangles of a square, with the shared corner duplicated (as STL/face meshes do).
const vertices = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0]
const triangles = [0, 1, 2, 3, 4, 5]

describe('weldMesh', () => {
  it('merges duplicate vertices', () => {
    const welded = weldMesh(vertices, triangles)
    expect(welded.vertices).toHaveLength(12)
    expect(welded.triangles).toEqual([0, 1, 2, 0, 2, 3])
  })

  it('drops triangles that collapse to a line', () => {
    expect(weldMesh([0, 0, 0, 0, 0, 0, 1, 0, 0], [0, 1, 2]).triangles).toEqual([])
  })
})

describe('countOpenEdges', () => {
  it('counts edges not shared by exactly two triangles', () => {
    expect(countOpenEdges(weldMesh(vertices, triangles).triangles)).toBe(4)
  })

  it('finds a closed tetrahedron watertight', () => {
    expect(countOpenEdges([0, 1, 2, 0, 3, 1, 1, 3, 2, 2, 3, 0])).toBe(0)
  })
})
```

`src/geometry/export-3mf.test.ts`:
```ts
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { write3mf } from './export-3mf'

describe('write3mf', () => {
  it('writes a 3MF package with the mesh in millimeters', () => {
    const bytes = write3mf({ vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], triangles: [0, 1, 2, 0, 3, 1, 1, 3, 2, 2, 3, 0] }, 'Kade & "Dad"')
    const files = unzipSync(bytes)
    expect(Object.keys(files).sort()).toEqual(['3D/3dmodel.model', '[Content_Types].xml', '_rels/.rels'])
    const model = strFromU8(files['3D/3dmodel.model'] as Uint8Array)
    expect(model).toContain('unit="millimeter"')
    expect(model.match(/<vertex /g)).toHaveLength(4)
    expect(model.match(/<triangle /g)).toHaveLength(4)
    expect(model).toContain('Kade &amp; &quot;Dad&quot;')
  })
})
```

`src/geometry/api.test.ts`:
```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode, groupNodes, setHidden, setMode } from '../document/ops'
import type { BloKadeDocument } from '../document/types'
import { createCadToolkit } from '../plugins/cad'
import { registry } from '../plugins/index'
import { createGeometryApi, exportTargets } from './api'
import { Evaluator } from './evaluate'
import { initTestOC } from './testing/oc-node'
import { meshVolume, parseBinaryStl } from './testing/stl'
import { countOpenEdges, weldMesh } from './weld'

beforeAll(initTestOC)

const shape = (id: string, shapeType: string, params: Record<string, number>, position: [number, number, number] = [0, 0, 0]) =>
  createShapeNode({ id, shapeType, name: id, params, color: '#fff', position })

function design(): BloKadeDocument {
  const doc = [
    shape('box', 'box', { width: 20, depth: 20, height: 20 }),
    shape('hole', 'cylinder', { diameter: 10, height: 40 }, [0, 0, -10]),
    shape('ball', 'sphere', { diameter: 10 }, [50, 0, 0]),
  ].reduce((d, n) => addNode(d, n), createEmptyDocument('Test part'))
  return groupNodes(setMode(doc, ['hole'], 'hole'), ['box', 'hole'], 'g').doc
}

const newApi = () => createGeometryApi(new Evaluator(registry, createCadToolkit()))

describe('geometry api', () => {
  it('rebuilds every top-level part into a mesh', async () => {
    const result = await newApi().rebuild(design())
    expect(Object.keys(result.nodes).sort()).toEqual(['ball', 'g'])
    const g = result.nodes.g
    expect(g?.status).toBe('ok')
    if (g?.status === 'ok') {
      expect(g.mesh.positions.length).toBeGreaterThan(0)
      expect(g.mesh.indices.length % 3).toBe(0)
      expect(g.mesh.edges.length).toBeGreaterThan(0)
    }
  })

  it('reports a broken part without failing the others', async () => {
    const broken = addNode(design(), shape('ring', 'torus', { diameter: 10, thickness: 10 }))
    const result = await newApi().rebuild(broken)
    expect(result.nodes.ring).toEqual({ status: 'error', message: "Ring couldn't be built: Make the ring wider than twice its thickness." })
    expect(result.nodes.g?.status).toBe('ok')
  })

  it('exports a watertight STL with the right volume', async () => {
    const doc = setHidden(design(), ['ball'], true)
    const stl = parseBinaryStl(await newApi().exportStl(doc))
    const welded = weldMesh(stl.vertices, stl.triangles)
    expect(countOpenEdges(welded.triangles)).toBe(0)
    expect(meshVolume(welded.vertices, welded.triangles)).toBeCloseTo(8000 - Math.PI * 25 * 20, -1)
  })

  it('exports a watertight 3MF', async () => {
    const files = unzipSync(new Uint8Array(await newApi().export3mf(design(), ['ball'])))
    const model = strFromU8(files['3D/3dmodel.model'] as Uint8Array)
    expect(model).toContain('<metadata name="Title">Test part</metadata>')
    expect(model.match(/<triangle /g)?.length).toBeGreaterThan(100)
  })

  it('exports only visible solid top-level parts, mapping children to their group', () => {
    const doc = addNode(setMode(design(), ['ball'], 'hole'), shape('hidden', 'box', {}))
    const hidden = setHidden(doc, ['hidden'], true)
    expect(exportTargets(hidden)).toEqual(['g'])
    expect(exportTargets(hidden, ['box', 'hole'])).toEqual(['g'])
  })

  it('refuses to export nothing', async () => {
    const doc = setHidden(design(), ['g', 'ball'], true)
    await expect(newApi().exportStl(doc)).rejects.toThrow("There's nothing to export")
  })

  it('refuses to export a part with a problem', async () => {
    const doc = addNode(createEmptyDocument(), shape('ring', 'torus', { diameter: 10, thickness: 10 }))
    await expect(newApi().exportStl(doc)).rejects.toThrow('"ring" has a problem')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/geometry`
Expected: FAIL, because the modules are missing.

- [ ] **Step 3: Implement**

`src/geometry/tessellate.ts`:
```ts
import type { Shape3D } from 'replicad'
import type { MeshData } from './types'

export const DISPLAY_QUALITY = { tolerance: 0.1, angularTolerance: 0.3 } as const
export const EXPORT_QUALITY = { tolerance: 0.01, angularTolerance: 0.1 } as const

export function toMeshData(shape: Shape3D): MeshData {
  const mesh = shape.mesh(DISPLAY_QUALITY)
  const edges = shape.meshEdges(DISPLAY_QUALITY)
  return {
    positions: new Float32Array(mesh.vertices),
    normals: new Float32Array(mesh.normals),
    indices: new Uint32Array(mesh.triangles),
    edges: new Float32Array(edges.lines),
  }
}
```

`src/geometry/weld.ts`:
```ts
/** Merges vertices closer than `precision` and drops collapsed triangles. */
export function weldMesh(
  vertices: ArrayLike<number>, triangles: ArrayLike<number>, precision = 1e-4,
): { vertices: number[]; triangles: number[] } {
  const lookup = new Map<string, number>()
  const outVertices: number[] = []
  const remap: number[] = []
  for (let i = 0; i < vertices.length / 3; i++) {
    const xyz = [vertices[i * 3] ?? 0, vertices[i * 3 + 1] ?? 0, vertices[i * 3 + 2] ?? 0]
    const key = xyz.map((v) => Math.round(v / precision)).join(',')
    const existing = lookup.get(key)
    const index = existing ?? outVertices.length / 3
    if (existing === undefined) {
      lookup.set(key, index)
      outVertices.push(...xyz)
    }
    remap.push(index)
  }
  const outTriangles: number[] = []
  for (let i = 0; i + 2 < triangles.length; i += 3) {
    const [a, b, c] = [remap[triangles[i] ?? 0] ?? 0, remap[triangles[i + 1] ?? 0] ?? 0, remap[triangles[i + 2] ?? 0] ?? 0]
    if (a !== b && b !== c && a !== c) outTriangles.push(a, b, c)
  }
  return { vertices: outVertices, triangles: outTriangles }
}

/** Number of edges not shared by exactly two triangles (0 = watertight). */
export function countOpenEdges(triangles: ArrayLike<number>): number {
  const uses = new Map<string, number>()
  for (let i = 0; i + 2 < triangles.length; i += 3) {
    const t = [triangles[i] ?? 0, triangles[i + 1] ?? 0, triangles[i + 2] ?? 0]
    for (let k = 0; k < 3; k++) {
      const a = t[k] ?? 0
      const b = t[(k + 1) % 3] ?? 0
      const key = a < b ? `${a},${b}` : `${b},${a}`
      uses.set(key, (uses.get(key) ?? 0) + 1)
    }
  }
  return [...uses.values()].filter((count) => count !== 2).length
}
```

`src/geometry/export-3mf.ts`:
```ts
import { strToU8, zipSync } from 'fflate'

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`

const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const num = (v: number | undefined): string => String(Math.round((v ?? 0) * 1e5) / 1e5)

function modelXml(mesh: { vertices: ArrayLike<number>; triangles: ArrayLike<number> }, title: string): string {
  const vertices: string[] = []
  for (let i = 0; i + 2 < mesh.vertices.length; i += 3) {
    vertices.push(`<vertex x="${num(mesh.vertices[i])}" y="${num(mesh.vertices[i + 1])}" z="${num(mesh.vertices[i + 2])}"/>`)
  }
  const triangles: string[] = []
  for (let i = 0; i + 2 < mesh.triangles.length; i += 3) {
    triangles.push(`<triangle v1="${mesh.triangles[i]}" v2="${mesh.triangles[i + 1]}" v3="${mesh.triangles[i + 2]}"/>`)
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Title">${escapeXml(title)}</metadata>
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>${vertices.join('')}</vertices>
        <triangles>${triangles.join('')}</triangles>
      </mesh>
    </object>
  </resources>
  <build><item objectid="1"/></build>
</model>`
}

/** Packs an indexed triangle mesh (mm) into a 3MF file. */
export function write3mf(mesh: { vertices: ArrayLike<number>; triangles: ArrayLike<number> }, title: string): Uint8Array {
  return zipSync({
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    '_rels/.rels': strToU8(RELS),
    '3D/3dmodel.model': strToU8(modelXml(mesh, title)),
  })
}
```

`src/geometry/api.ts`:
```ts
import type { Shape3D } from 'replicad'
import { rootAncestorOf } from '../document/tree'
import type { BloKadeDocument, NodeId } from '../document/types'
import { NodeBuildError, type Evaluator } from './evaluate'
import { write3mf } from './export-3mf'
import { EXPORT_QUALITY, toMeshData } from './tessellate'
import type { BuildResult, GeometryApi, NodeBuild } from './types'
import { weldMesh } from './weld'

export class ExportError extends Error {
  override name = 'ExportError'
}

const UNEXPECTED = 'Something went wrong building this part. Try changing its size a little, or undo.'

function buildNode(evaluator: Evaluator, doc: BloKadeDocument, id: NodeId): NodeBuild {
  try {
    return { status: 'ok', mesh: toMeshData(evaluator.local(doc, id)) }
  } catch (error) {
    if (error instanceof NodeBuildError) return { status: 'error', message: error.message }
    console.error('Unexpected geometry failure', error)
    return { status: 'error', message: UNEXPECTED }
  }
}

function rebuild(evaluator: Evaluator, doc: BloKadeDocument): BuildResult {
  evaluator.beginPass()
  try {
    return { nodes: Object.fromEntries(doc.root.map((id) => [id, buildNode(evaluator, doc, id)])) }
  } finally {
    evaluator.endPass()
  }
}

/** Visible, solid, top-level parts to export. Selected children export their whole top-level group. */
export function exportTargets(doc: BloKadeDocument, ids?: readonly NodeId[]): NodeId[] {
  const roots = (ids ?? doc.root).map((id) => rootAncestorOf(doc, id))
  return [...new Set(roots)].filter((id): id is NodeId => {
    const node = id === undefined ? undefined : doc.nodes[id]
    return node !== undefined && !node.hidden && node.mode === 'solid'
  })
}

function placedForExport(evaluator: Evaluator, doc: BloKadeDocument, id: NodeId): Shape3D {
  try {
    return evaluator.placed(doc, id)
  } catch (error) {
    const reason = error instanceof NodeBuildError ? error.message : UNEXPECTED
    throw new ExportError(`Can't export yet: "${doc.nodes[id]?.name ?? id}" has a problem. ${reason}`)
  }
}

/** One fused solid for export. The caller must delete() it. */
function exportShape(evaluator: Evaluator, doc: BloKadeDocument, ids?: readonly NodeId[]): Shape3D {
  const [first, ...rest] = exportTargets(doc, ids).map((id) => placedForExport(evaluator, doc, id))
  if (!first) throw new ExportError("There's nothing to export. Add a solid shape (holes and hidden parts aren't exported).")
  return rest.reduce((acc, shape) => {
    const next = acc.fuse(shape)
    acc.delete()
    return next
  }, first.clone())
}

export function createGeometryApi(evaluator: Evaluator): GeometryApi {
  return {
    rebuild: async (doc) => rebuild(evaluator, doc),
    exportStl: async (doc, ids) => {
      const shape = exportShape(evaluator, doc, ids)
      try {
        return await shape.blobSTL({ binary: true, ...EXPORT_QUALITY }).arrayBuffer()
      } finally {
        shape.delete()
      }
    },
    export3mf: async (doc, ids) => {
      const shape = exportShape(evaluator, doc, ids)
      try {
        const mesh = shape.mesh(EXPORT_QUALITY)
        return new Uint8Array(write3mf(weldMesh(mesh.vertices, mesh.triangles), doc.name)).buffer
      } finally {
        shape.delete()
      }
    },
  }
}
```

`src/geometry/testing/stl.ts`:
```ts
/** Reads a binary STL into a (non-indexed) vertex/triangle list. */
export function parseBinaryStl(buffer: ArrayBuffer): { vertices: number[]; triangles: number[] } {
  const view = new DataView(buffer)
  const count = view.getUint32(80, true)
  const vertices: number[] = []
  for (let i = 0; i < count; i++) {
    const offset = 84 + i * 50 + 12
    for (let k = 0; k < 9; k++) vertices.push(view.getFloat32(offset + k * 4, true))
  }
  return { vertices, triangles: Array.from({ length: count * 3 }, (_, i) => i) }
}

/** Signed volume of a closed triangle mesh. */
export function meshVolume(vertices: readonly number[], triangles: readonly number[]): number {
  let sum = 0
  for (let i = 0; i + 2 < triangles.length; i += 3) {
    const [a, b, c] = [triangles[i] ?? 0, triangles[i + 1] ?? 0, triangles[i + 2] ?? 0].map((t) => [
      vertices[t * 3] ?? 0, vertices[t * 3 + 1] ?? 0, vertices[t * 3 + 2] ?? 0,
    ]) as [number[], number[], number[]]
    sum += ((a[0] ?? 0) * ((b[1] ?? 0) * (c[2] ?? 0) - (b[2] ?? 0) * (c[1] ?? 0))
      - (a[1] ?? 0) * ((b[0] ?? 0) * (c[2] ?? 0) - (b[2] ?? 0) * (c[0] ?? 0))
      + (a[2] ?? 0) * ((b[0] ?? 0) * (c[1] ?? 0) - (b[1] ?? 0) * (c[0] ?? 0))) / 6
  }
  return Math.abs(sum)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/geometry && npm run typecheck`
Expected: PASS. `toBeCloseTo(…, -1)` allows ±5 mm³, because the STL is a faceted approximation of the curved hole.

- [ ] **Step 5: Commit**

```bash
git add src/geometry
git commit -m "feat: add meshing, STL/3MF export and the geometry API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Geometry worker and client

**Files:**
- Create: `src/geometry/client.ts`, `src/geometry/oc-browser.ts`, `src/geometry/geometry.worker.ts`, `src/geometry/spawn.ts`
- Test: `src/geometry/client.test.ts`

**Interfaces:**
- Consumes: `GeometryApi`, `BuildResult` (Task 5); `createGeometryApi` (Task 9); `Evaluator` (Task 8); `registry`, `createCadToolkit` (Tasks 6–7).
- Produces:
  - `WorkerHandle { api: GeometryApi; terminate(): void }`
  - `REBUILD_TIMEOUT_MS = 30_000`, `class GeometryTimeoutError extends Error`
  - `class GeometryClient`, built with `new GeometryClient(spawn: () => WorkerHandle, timeoutMs?)`:
    - `rebuild(doc): Promise<BuildResult | null>`. Latest wins: a queued request that gets replaced resolves `null`.
    - `exportStl(doc, ids?)`, `export3mf(doc, ids?)`: `Promise<ArrayBuffer>`
    - `dispose(): void`
  - `spawnGeometryWorker(): WorkerHandle` (browser only)

- [ ] **Step 1: Write the failing test `src/geometry/client.test.ts`**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import type { BloKadeDocument } from '../document/types'
import { GeometryClient, GeometryTimeoutError, type WorkerHandle } from './client'
import type { BuildResult } from './types'

interface Deferred<T> { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void }
function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined
  let reject: (error: unknown) => void = () => undefined
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function fakeWorker() {
  const calls: { doc: BloKadeDocument; reply: Deferred<BuildResult> }[] = []
  const handle: WorkerHandle = {
    api: {
      rebuild: (doc) => {
        const reply = deferred<BuildResult>()
        calls.push({ doc, reply })
        return reply.promise
      },
      exportStl: async () => new ArrayBuffer(84),
      export3mf: async () => new ArrayBuffer(10),
    },
    terminate: vi.fn(),
  }
  return { handle, calls }
}

const doc = (name: string) => createEmptyDocument(name)
const result = (tag: string): BuildResult => ({ nodes: { [tag]: { status: 'error', message: tag } } })
const flush = () => new Promise((r) => setTimeout(r, 0))

afterEach(() => vi.useRealTimers())

describe('GeometryClient', () => {
  it('returns the build result', async () => {
    const { handle, calls } = fakeWorker()
    const client = new GeometryClient(() => handle)
    const pending = client.rebuild(doc('one'))
    calls[0]?.reply.resolve(result('one'))
    await expect(pending).resolves.toEqual(result('one'))
  })

  it('only builds the newest waiting document', async () => {
    const { handle, calls } = fakeWorker()
    const client = new GeometryClient(() => handle)
    const first = client.rebuild(doc('one'))
    const second = client.rebuild(doc('two'))
    const third = client.rebuild(doc('three'))
    await expect(second).resolves.toBeNull()
    expect(calls).toHaveLength(1)
    calls[0]?.reply.resolve(result('one'))
    await expect(first).resolves.toEqual(result('one'))
    await flush()
    expect(calls.map((c) => c.doc.name)).toEqual(['one', 'three'])
    calls[1]?.reply.resolve(result('three'))
    await expect(third).resolves.toEqual(result('three'))
  })

  it('passes worker errors through', async () => {
    const { handle, calls } = fakeWorker()
    const client = new GeometryClient(() => handle)
    const pending = client.rebuild(doc('one'))
    calls[0]?.reply.reject(new Error('engine failed to load'))
    await expect(pending).rejects.toThrow('engine failed to load')
  })

  it('restarts a stuck worker after the timeout', async () => {
    vi.useFakeTimers()
    const first = fakeWorker()
    const second = fakeWorker()
    const spawn = vi.fn().mockReturnValueOnce(first.handle).mockReturnValueOnce(second.handle)
    const client = new GeometryClient(spawn, 30_000)
    const pending = client.rebuild(doc('stuck'))
    const assertion = expect(pending).rejects.toBeInstanceOf(GeometryTimeoutError)
    await vi.advanceTimersByTimeAsync(30_000)
    await assertion
    expect(first.handle.terminate).toHaveBeenCalledOnce()
    expect(spawn).toHaveBeenCalledTimes(2)
    const next = client.rebuild(doc('after'))
    await vi.advanceTimersByTimeAsync(0)
    expect(second.calls.map((c) => c.doc.name)).toEqual(['after'])
    second.calls[0]?.reply.resolve(result('after'))
    await expect(next).resolves.toEqual(result('after'))
  })

  it('exports through the worker', async () => {
    const { handle } = fakeWorker()
    const client = new GeometryClient(() => handle)
    expect((await client.exportStl(doc('x'))).byteLength).toBe(84)
    expect((await client.export3mf(doc('x'), ['a'])).byteLength).toBe(10)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/geometry/client.test.ts`
Expected: FAIL, because `./client` is missing.

- [ ] **Step 3: Implement**

`src/geometry/client.ts`:
```ts
import type { BloKadeDocument, NodeId } from '../document/types'
import type { BuildResult, GeometryApi } from './types'

export interface WorkerHandle {
  readonly api: GeometryApi
  terminate(): void
}

export const REBUILD_TIMEOUT_MS = 30_000

export class GeometryTimeoutError extends Error {
  override name = 'GeometryTimeoutError'
  constructor() {
    super('The geometry engine got stuck on your last change, so BloKade restarted it. Try undoing that change.')
  }
}

interface PendingRebuild {
  readonly doc: BloKadeDocument
  resolve(result: BuildResult | null): void
  reject(error: unknown): void
}

/** Talks to the geometry worker: one rebuild at a time, newest request wins, stuck workers restart. */
export class GeometryClient {
  private handle: WorkerHandle
  private busy = false
  private pending: PendingRebuild | null = null

  constructor(private readonly spawn: () => WorkerHandle, private readonly timeoutMs = REBUILD_TIMEOUT_MS) {
    this.handle = spawn()
  }

  rebuild(doc: BloKadeDocument): Promise<BuildResult | null> {
    return new Promise((resolve, reject) => {
      this.pending?.resolve(null)
      this.pending = { doc, resolve, reject }
      this.pump()
    })
  }

  exportStl(doc: BloKadeDocument, ids?: readonly NodeId[]): Promise<ArrayBuffer> {
    return this.call((api) => api.exportStl(doc, ids))
  }

  export3mf(doc: BloKadeDocument, ids?: readonly NodeId[]): Promise<ArrayBuffer> {
    return this.call((api) => api.export3mf(doc, ids))
  }

  dispose(): void {
    this.handle.terminate()
  }

  private pump(): void {
    const job = this.pending
    if (this.busy || !job) return
    this.pending = null
    this.busy = true
    this.call((api) => api.rebuild(job.doc))
      .then(job.resolve, job.reject)
      .finally(() => {
        this.busy = false
        this.pump()
      })
  }

  private call<T>(fn: (api: GeometryApi) => Promise<T>): Promise<T> {
    const handle = this.handle
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        this.restart(handle)
        reject(new GeometryTimeoutError())
      }, this.timeoutMs)
    })
    return Promise.race([fn(handle.api), timeout]).finally(() => clearTimeout(timer))
  }

  private restart(stuck: WorkerHandle): void {
    if (this.handle !== stuck) return
    stuck.terminate()
    this.handle = this.spawn()
  }
}
```

`src/geometry/oc-browser.ts`:
```ts
import { setOC } from 'replicad'
import opencascade from 'replicad-opencascadejs'
import wasmUrl from 'replicad-opencascadejs/wasm?url'

let ready: Promise<void> | null = null

/** Loads OpenCascade (about 10–20 MB of WASM) once per worker. */
export function initBrowserOC(): Promise<void> {
  ready ??= opencascade({ locateFile: () => wasmUrl }).then((oc) => setOC(oc))
  return ready
}
```

`src/geometry/geometry.worker.ts`:
```ts
import * as Comlink from 'comlink'
import { createCadToolkit } from '../plugins/cad'
import { registry } from '../plugins/index'
import { createGeometryApi } from './api'
import { Evaluator } from './evaluate'
import { initBrowserOC } from './oc-browser'
import type { GeometryApi } from './types'

const apiReady = initBrowserOC().then(() => createGeometryApi(new Evaluator(registry, createCadToolkit())))

const api: GeometryApi = {
  rebuild: async (doc) => (await apiReady).rebuild(doc),
  exportStl: async (doc, ids) => (await apiReady).exportStl(doc, ids),
  export3mf: async (doc, ids) => (await apiReady).export3mf(doc, ids),
}

Comlink.expose(api)
```

`src/geometry/spawn.ts`:
```ts
import * as Comlink from 'comlink'
import type { WorkerHandle } from './client'
import type { GeometryApi } from './types'

export function spawnGeometryWorker(): WorkerHandle {
  const worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' })
  const remote = Comlink.wrap<GeometryApi>(worker)
  return {
    api: {
      rebuild: (doc) => remote.rebuild(doc),
      exportStl: (doc, ids) => remote.exportStl(doc, ids),
      export3mf: (doc, ids) => remote.export3mf(doc, ids),
    },
    terminate: () => worker.terminate(),
  }
}
```

- [ ] **Step 4: Run the tests, type check, and build**

Run: `npx vitest run src/geometry/client.test.ts && npm run typecheck && npx vite build`
Expected: the tests pass, tsc is clean, and the build succeeds. The worker is only bundled once something imports `spawn.ts` (Task 12), so the build has no `.wasm` asset yet.

- [ ] **Step 5: Commit**

```bash
git add src/geometry
git commit -m "feat: add geometry worker and latest-wins client with restart

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Persistence: migrations, files, repositories, autosave, and startup

**Files:**
- Create: `src/persistence/migrate.ts`, `design-file.ts`, `repository.ts`, `memory-repository.ts`, `idb-repository.ts`, `autosave.ts`, `bootstrap.ts`
- Test: `src/persistence/migrate.test.ts`, `design-file.test.ts`, `repositories.test.ts`, `autosave.test.ts`, `bootstrap.test.ts`

**Interfaces:**
- Consumes: `validateDocument`, `createEmptyDocument`, `newId`, `CURRENT_SCHEMA_VERSION`, `Result`.
- Produces:
  - `Migration`, `MIGRATIONS`, `migrateDocument(raw, current?, migrations?): Result<unknown>`
  - `parseDesign(raw: unknown): Result<BloKadeDocument>`, `parseDesignFile(text: string): Result<BloKadeDocument>`, `serializeDesign(doc): string`, `fileNameFor(doc, extension: 'blokade' | 'stl' | '3mf'): string`
  - `DesignSummary`, `DesignRepository` (`list`, `load`, `save`, `remove`, `getLastOpened`, `setLastOpened`), `NOT_FOUND`, `duplicateDesign(repo, id)`, `renameDesign(repo, id, name)`
  - `createMemoryDesignRepository(options?: { seed?: Record<string, unknown>; now?: () => number }): DesignRepository`
  - `createIdbDesignRepository(options?: { dbName?: string; now?: () => number }): DesignRepository`
  - `AUTOSAVE_DELAY_MS = 1000`, `Autosaver { schedule(id, doc); flush(): Promise<void>; cancel() }`, `createAutosaver({ save, onError, delayMs? })`
  - `InitialDesign { id; doc; notice: string | null }`, `DAMAGED_DESIGN`, `STORAGE_UNAVAILABLE`, `openInitialDesign(repo): Promise<InitialDesign>` (never rejects)

- [ ] **Step 1: Write the failing tests**

`src/persistence/migrate.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { migrateDocument } from './migrate'

describe('migrateDocument', () => {
  it('passes current documents through', () => {
    expect(migrateDocument({ schemaVersion: 1, name: 'x' })).toEqual({ ok: true, value: { schemaVersion: 1, name: 'x' } })
  })

  it('runs migrations in order', () => {
    const migrations = {
      1: (d: Readonly<Record<string, unknown>>) => ({ ...d, a: true }),
      2: (d: Readonly<Record<string, unknown>>) => ({ ...d, b: d.a === true }),
    }
    expect(migrateDocument({ schemaVersion: 1 }, 3, migrations)).toEqual({
      ok: true, value: { schemaVersion: 3, a: true, b: true },
    })
  })

  it('refuses newer designs', () => {
    expect(migrateDocument({ schemaVersion: 9 })).toEqual({
      ok: false, error: 'This design was made with a newer version of BloKade. Update BloKade to open it.',
    })
  })

  it('refuses things that are not designs', () => {
    for (const raw of [null, 'text', [], { schemaVersion: 'one' }, { schemaVersion: 0 }]) {
      expect(migrateDocument(raw).ok).toBe(false)
    }
  })

  it('refuses when a migration step is missing', () => {
    expect(migrateDocument({ schemaVersion: 1 }, 2, {}).ok).toBe(false)
  })
})
```

`src/persistence/design-file.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode } from '../document/ops'
import { fileNameFor, parseDesignFile, serializeDesign } from './design-file'

describe('design files', () => {
  it('round-trips a design', () => {
    const doc = addNode(createEmptyDocument('Phone Stand'), createShapeNode({ shapeType: 'box', name: 'Box', params: { width: 5 }, color: '#fff' }))
    expect(parseDesignFile(serializeDesign(doc))).toEqual({ ok: true, value: doc })
  })

  it('explains files that are not JSON', () => {
    expect(parseDesignFile('not json at all')).toEqual({ ok: false, error: "This file isn't a BloKade design." })
  })

  it('explains damaged designs', () => {
    const result = parseDesignFile(JSON.stringify({ ...createEmptyDocument(), root: ['ghost'] }))
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toContain('damaged')
  })

  it('makes friendly file names', () => {
    expect(fileNameFor(createEmptyDocument("Kade's Phone Stand!"), 'stl')).toBe('kade-s-phone-stand.stl')
    expect(fileNameFor(createEmptyDocument('***'), '3mf')).toBe('design.3mf')
  })
})
```

`src/persistence/repositories.test.ts`:
```ts
import 'fake-indexeddb/auto'
import { createStore, set } from 'idb-keyval'
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { createIdbDesignRepository } from './idb-repository'
import { createMemoryDesignRepository } from './memory-repository'
import { duplicateDesign, NOT_FOUND, renameDesign, type DesignRepository } from './repository'

let dbCounter = 0
function clock() {
  let t = 0
  return () => ++t
}

const implementations: [string, () => DesignRepository][] = [
  ['memory', () => createMemoryDesignRepository({ now: clock() })],
  ['indexeddb', () => createIdbDesignRepository({ dbName: `test-${++dbCounter}`, now: clock() })],
]

describe.each(implementations)('%s design repository', (_, make) => {
  it('saves, lists newest first, loads and removes', async () => {
    const repo = make()
    await repo.save('a', createEmptyDocument('First'))
    await repo.save('b', createEmptyDocument('Second'))
    expect((await repo.list()).map((d) => d.name)).toEqual(['Second', 'First'])
    expect(await repo.load('a')).toEqual({ ok: true, value: createEmptyDocument('First') })
    await repo.remove('a')
    expect((await repo.list()).map((d) => d.id)).toEqual(['b'])
    expect(await repo.load('a')).toEqual({ ok: false, error: NOT_FOUND })
  })

  it('updates the summary when saving again', async () => {
    const repo = make()
    await repo.save('a', createEmptyDocument('Old'))
    await repo.save('a', createEmptyDocument('New'))
    expect((await repo.list()).map((d) => d.name)).toEqual(['New'])
  })

  it('remembers the last opened design', async () => {
    const repo = make()
    expect(await repo.getLastOpened()).toBeNull()
    await repo.setLastOpened('b')
    expect(await repo.getLastOpened()).toBe('b')
  })

  it('duplicates and renames designs', async () => {
    const repo = make()
    await repo.save('a', createEmptyDocument('Stand'))
    const copy = await duplicateDesign(repo, 'a')
    expect(copy.ok && copy.value.doc.name).toBe('Stand copy')
    expect(await renameDesign(repo, 'a', '  Better Stand ')).toMatchObject({ ok: true, value: { name: 'Better Stand' } })
    expect(await renameDesign(repo, 'a', '  ')).toEqual({ ok: false, error: "Names can't be empty." })
    expect(await duplicateDesign(repo, 'missing')).toEqual({ ok: false, error: NOT_FOUND })
  })
})

describe('damaged stored designs', () => {
  it('memory: reports a damaged design instead of throwing', async () => {
    const repo = createMemoryDesignRepository({ seed: { bad: { schemaVersion: 1, nonsense: true } } })
    const result = await repo.load('bad')
    expect(result.ok).toBe(false)
  })

  it('indexeddb: reports a damaged design instead of throwing', async () => {
    const dbName = `test-${++dbCounter}`
    const repo = createIdbDesignRepository({ dbName })
    await set('design:bad', { hello: 'world' }, createStore(dbName, 'designs'))
    expect((await repo.load('bad')).ok).toBe(false)
  })
})
```

`src/persistence/autosave.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { AUTOSAVE_DELAY_MS, createAutosaver } from './autosave'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('autosaver', () => {
  it('saves once, 1 s after the last change', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const saver = createAutosaver({ save, onError: vi.fn() })
    saver.schedule('d', createEmptyDocument('one'))
    await vi.advanceTimersByTimeAsync(500)
    saver.schedule('d', createEmptyDocument('two'))
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledWith('d', createEmptyDocument('two'))
  })

  it('flushes immediately', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const saver = createAutosaver({ save, onError: vi.fn() })
    saver.schedule('d', createEmptyDocument())
    await saver.flush()
    expect(save).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(save).toHaveBeenCalledOnce()
  })

  it('saves the previous design right away when switching designs', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const saver = createAutosaver({ save, onError: vi.fn() })
    saver.schedule('a', createEmptyDocument('A'))
    saver.schedule('b', createEmptyDocument('B'))
    await vi.advanceTimersByTimeAsync(0)
    expect(save).toHaveBeenCalledWith('a', createEmptyDocument('A'))
  })

  it('reports a failure once until saving works again', async () => {
    const save = vi.fn().mockRejectedValue(new Error('quota'))
    const onError = vi.fn()
    const saver = createAutosaver({ save, onError })
    saver.schedule('d', createEmptyDocument())
    await saver.flush()
    saver.schedule('d', createEmptyDocument('again'))
    await saver.flush()
    expect(onError).toHaveBeenCalledOnce()
  })

  it('can cancel a pending save', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const saver = createAutosaver({ save, onError: vi.fn() })
    saver.schedule('d', createEmptyDocument())
    saver.cancel()
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)
    expect(save).not.toHaveBeenCalled()
  })
})
```

`src/persistence/bootstrap.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { DAMAGED_DESIGN, openInitialDesign, STORAGE_UNAVAILABLE } from './bootstrap'
import { createMemoryDesignRepository } from './memory-repository'
import type { DesignRepository } from './repository'

describe('openInitialDesign', () => {
  it('creates and saves a new design the first time', async () => {
    const repo = createMemoryDesignRepository()
    const opened = await openInitialDesign(repo)
    expect(opened.notice).toBeNull()
    expect(opened.doc.root).toEqual([])
    expect((await repo.list()).map((d) => d.id)).toEqual([opened.id])
  })

  it('reopens the last design', async () => {
    const repo = createMemoryDesignRepository()
    await repo.save('a', createEmptyDocument('A'))
    await repo.save('b', createEmptyDocument('B'))
    await repo.setLastOpened('a')
    expect((await openInitialDesign(repo)).doc.name).toBe('A')
  })

  it('skips a damaged design and says so', async () => {
    const repo = createMemoryDesignRepository({ seed: { bad: { schemaVersion: 1 } } })
    await repo.save('good', createEmptyDocument('Good'))
    await repo.setLastOpened('bad')
    const opened = await openInitialDesign(repo)
    expect(opened.doc.name).toBe('Good')
    expect(opened.notice).toBe(DAMAGED_DESIGN)
  })

  it('starts fresh with a warning when storage is broken', async () => {
    const broken: DesignRepository = {
      list: vi.fn().mockRejectedValue(new Error('no idb')),
      load: vi.fn(), save: vi.fn(), remove: vi.fn(),
      getLastOpened: vi.fn().mockRejectedValue(new Error('no idb')),
      setLastOpened: vi.fn(),
    }
    const opened = await openInitialDesign(broken)
    expect(opened.notice).toBe(STORAGE_UNAVAILABLE)
    expect(opened.doc.root).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/persistence`
Expected: FAIL, because the modules are missing.

- [ ] **Step 3: Implement**

`src/persistence/migrate.ts`:
```ts
import { CURRENT_SCHEMA_VERSION } from '../document/types'
import { fail, ok, type Result } from '../shared/result'

export type Migration = (doc: Readonly<Record<string, unknown>>) => Record<string, unknown>

/** MIGRATIONS[n] upgrades a version-n document to version n + 1. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {}

const NOT_A_DESIGN = "This file isn't a BloKade design."

export function migrateDocument(
  raw: unknown, current: number = CURRENT_SCHEMA_VERSION, migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): Result<unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return fail(NOT_A_DESIGN)
  const doc = raw as Readonly<Record<string, unknown>>
  const start = doc.schemaVersion
  if (typeof start !== 'number' || !Number.isInteger(start) || start < 1) return fail(NOT_A_DESIGN)
  if (start > current) return fail('This design was made with a newer version of BloKade. Update BloKade to open it.')
  const steps = Array.from({ length: current - start }, (_, i) => start + i)
  const missing = steps.find((version) => !migrations[version])
  if (missing !== undefined) return fail(`BloKade can't upgrade designs from version ${missing}.`)
  return ok(steps.reduce<Readonly<Record<string, unknown>>>((acc, version) => {
    const migrate = migrations[version]
    return migrate ? { ...migrate(acc), schemaVersion: version + 1 } : acc
  }, doc))
}
```

`src/persistence/design-file.ts`:
```ts
import { validateDocument } from '../document/schema'
import type { BloKadeDocument } from '../document/types'
import { fail, ok, type Result } from '../shared/result'
import { migrateDocument } from './migrate'

export function parseDesign(raw: unknown): Result<BloKadeDocument> {
  const migrated = migrateDocument(raw)
  return migrated.ok ? validateDocument(migrated.value) : migrated
}

function parseJson(text: string): Result<unknown> {
  try {
    return ok(JSON.parse(text))
  } catch {
    return fail("This file isn't a BloKade design.")
  }
}

export function parseDesignFile(text: string): Result<BloKadeDocument> {
  const json = parseJson(text)
  return json.ok ? parseDesign(json.value) : json
}

export const serializeDesign = (doc: BloKadeDocument): string => JSON.stringify(doc, null, 2)

export function fileNameFor(doc: BloKadeDocument, extension: 'blokade' | 'stl' | '3mf'): string {
  const slug = doc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `${slug || 'design'}.${extension}`
}
```

`src/persistence/repository.ts`:
```ts
import { newId } from '../document/factory'
import type { BloKadeDocument } from '../document/types'
import { fail, ok, type Result } from '../shared/result'

export interface DesignSummary {
  readonly id: string
  readonly name: string
  readonly updatedAt: number
}

export interface DesignRepository {
  /** Newest first. */
  list(): Promise<readonly DesignSummary[]>
  load(id: string): Promise<Result<BloKadeDocument>>
  save(id: string, doc: BloKadeDocument): Promise<void>
  remove(id: string): Promise<void>
  getLastOpened(): Promise<string | null>
  setLastOpened(id: string): Promise<void>
}

export const NOT_FOUND = "That design couldn't be found."

export const sortNewestFirst = (list: readonly DesignSummary[]): DesignSummary[] =>
  [...list].sort((a, b) => b.updatedAt - a.updatedAt)

export const upsertSummary = (list: readonly DesignSummary[], summary: DesignSummary): DesignSummary[] =>
  [...list.filter((d) => d.id !== summary.id), summary]

export async function duplicateDesign(
  repo: DesignRepository, id: string,
): Promise<Result<{ id: string; doc: BloKadeDocument }>> {
  const loaded = await repo.load(id)
  if (!loaded.ok) return loaded
  const copy = { id: newId(), doc: { ...loaded.value, name: `${loaded.value.name} copy` } }
  await repo.save(copy.id, copy.doc)
  return ok(copy)
}

export async function renameDesign(repo: DesignRepository, id: string, name: string): Promise<Result<BloKadeDocument>> {
  const trimmed = name.trim()
  if (!trimmed) return fail("Names can't be empty.")
  const loaded = await repo.load(id)
  if (!loaded.ok) return loaded
  const renamed = { ...loaded.value, name: trimmed }
  await repo.save(id, renamed)
  return ok(renamed)
}
```

`src/persistence/memory-repository.ts`:
```ts
import { fail } from '../shared/result'
import { parseDesign } from './design-file'
import { NOT_FOUND, sortNewestFirst, upsertSummary, type DesignRepository, type DesignSummary } from './repository'

/** In-memory designs; used by tests and as a fallback. Seed values may be deliberately damaged. */
export function createMemoryDesignRepository(
  options: { seed?: Readonly<Record<string, unknown>>; now?: () => number } = {},
): DesignRepository {
  const now = options.now ?? Date.now
  const designs = new Map<string, unknown>(Object.entries(options.seed ?? {}))
  let index: readonly DesignSummary[] = Object.keys(options.seed ?? {}).map((id) => ({ id, name: id, updatedAt: 0 }))
  let lastOpened: string | null = null

  return {
    list: async () => sortNewestFirst(index),
    load: async (id) => (designs.has(id) ? parseDesign(structuredClone(designs.get(id))) : fail(NOT_FOUND)),
    save: async (id, doc) => {
      designs.set(id, structuredClone(doc))
      index = upsertSummary(index, { id, name: doc.name, updatedAt: now() })
    },
    remove: async (id) => {
      designs.delete(id)
      index = index.filter((d) => d.id !== id)
    },
    getLastOpened: async () => lastOpened,
    setLastOpened: async (id) => {
      lastOpened = id
    },
  }
}
```

`src/persistence/idb-repository.ts`:
```ts
import { createStore, del, get, set, update } from 'idb-keyval'
import { fail } from '../shared/result'
import { parseDesign } from './design-file'
import { NOT_FOUND, sortNewestFirst, upsertSummary, type DesignRepository, type DesignSummary } from './repository'

const INDEX_KEY = 'index'
const LAST_OPENED_KEY = 'last-opened'
const designKey = (id: string): string => `design:${id}`

export function createIdbDesignRepository(
  options: { dbName?: string; now?: () => number } = {},
): DesignRepository {
  const store = createStore(options.dbName ?? 'blokade', 'designs')
  const now = options.now ?? Date.now

  return {
    list: async () => sortNewestFirst((await get<DesignSummary[]>(INDEX_KEY, store)) ?? []),
    load: async (id) => {
      const raw: unknown = await get(designKey(id), store)
      return raw === undefined ? fail(NOT_FOUND) : parseDesign(raw)
    },
    save: async (id, doc) => {
      await set(designKey(id), doc, store)
      await update<DesignSummary[]>(INDEX_KEY, (old) => upsertSummary(old ?? [], { id, name: doc.name, updatedAt: now() }), store)
    },
    remove: async (id) => {
      await del(designKey(id), store)
      await update<DesignSummary[]>(INDEX_KEY, (old) => (old ?? []).filter((d) => d.id !== id), store)
    },
    getLastOpened: async () => (await get<string>(LAST_OPENED_KEY, store)) ?? null,
    setLastOpened: async (id) => set(LAST_OPENED_KEY, id, store),
  }
}
```

`src/persistence/autosave.ts`:
```ts
import type { BloKadeDocument } from '../document/types'

export const AUTOSAVE_DELAY_MS = 1000

export interface Autosaver {
  schedule(id: string, doc: BloKadeDocument): void
  flush(): Promise<void>
  cancel(): void
}

export function createAutosaver(options: {
  save(id: string, doc: BloKadeDocument): Promise<void>
  onError(error: unknown): void
  delayMs?: number
}): Autosaver {
  const delayMs = options.delayMs ?? AUTOSAVE_DELAY_MS
  let timer: ReturnType<typeof setTimeout> | null = null
  let queued: { id: string; doc: BloKadeDocument } | null = null
  let failing = false

  const clearTimer = (): void => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  const flush = async (): Promise<void> => {
    clearTimer()
    const job = queued
    queued = null
    if (!job) return
    try {
      await options.save(job.id, job.doc)
      failing = false
    } catch (error) {
      if (!failing) options.onError(error)
      failing = true
    }
  }

  return {
    schedule(id, doc) {
      if (queued && queued.id !== id) void flush()
      queued = { id, doc }
      clearTimer()
      timer = setTimeout(() => void flush(), delayMs)
    },
    flush,
    cancel() {
      clearTimer()
      queued = null
    },
  }
}
```

`src/persistence/bootstrap.ts`:
```ts
import { createEmptyDocument, newId } from '../document/factory'
import type { BloKadeDocument } from '../document/types'
import type { DesignRepository } from './repository'

export interface InitialDesign {
  readonly id: string
  readonly doc: BloKadeDocument
  readonly notice: string | null
}

export const DAMAGED_DESIGN = 'One of your saved designs is damaged and could not be opened.'
export const STORAGE_UNAVAILABLE =
  "Saving in this browser isn't working, so use Designs → Save to file to keep your work."

async function firstLoadable(repo: DesignRepository, ids: readonly string[]) {
  for (const [skipped, id] of ids.entries()) {
    const loaded = await repo.load(id)
    if (loaded.ok) return { id, doc: loaded.value, skipped }
  }
  return null
}

/** Opens the last design, else the newest loadable one, else a new one. Never rejects. */
export async function openInitialDesign(repo: DesignRepository): Promise<InitialDesign> {
  try {
    const last = await repo.getLastOpened()
    const listed = (await repo.list()).map((d) => d.id)
    const ids = [...new Set([last, ...listed].filter((id): id is string => typeof id === 'string'))]
    const opened = await firstLoadable(repo, ids)
    if (opened) return { id: opened.id, doc: opened.doc, notice: opened.skipped > 0 ? DAMAGED_DESIGN : null }
    const fresh = { id: newId(), doc: createEmptyDocument() }
    await repo.save(fresh.id, fresh.doc)
    return { ...fresh, notice: ids.length > 0 ? DAMAGED_DESIGN : null }
  } catch (error) {
    console.error('Design storage failed', error)
    return { id: newId(), doc: createEmptyDocument(), notice: STORAGE_UNAVAILABLE }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/persistence && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/persistence
git commit -m "feat: add design storage, file format, migrations and autosave

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: App shell: store context, actions, palette, notices, sync, and autosave

**Files:**
- Create: `src/store/context.tsx`, `src/app/deps.ts`, `src/app/selection.ts`, `src/app/actions.ts`, `src/app/useGeometrySync.ts`, `src/app/useAutosave.ts`, `src/app/testing/fakes.ts`, `src/app/testing/render.tsx`, `src/ui/Workspace.tsx`, `src/ui/ShapePalette.tsx`, `src/ui/Toasts.tsx`, `src/ui/App.css`
- Replace: `src/ui/App.tsx`, `src/ui/App.test.tsx`, `src/main.tsx`
- Test: `src/app/selection.test.ts`, `src/app/actions.test.ts`, `src/ui/ShapePalette.test.tsx`, `src/ui/App.test.tsx`

**Interfaces:**
- Consumes: the store (Task 5), registry (Tasks 6–7), `GeometryClient` and `spawnGeometryWorker` (Task 10), persistence (Task 11), document ops (Task 4).
- Produces:
  - `StoreProvider`, `useBloKadeStore(): BloKadeStore`, `useBloKade<T>(selector): T`
  - `AppDeps { repo: DesignRepository; client: GeometryClient; registry: PluginRegistry; pluginProblems: readonly string[] }`, `createAppDeps()`
  - `toggleInSelection(selection, id)`, `nextSelection(selection, id, additive)`
  - `Actions` (`addShape`, `deleteSelection`, `duplicateSelection`, `groupSelection`, `ungroupSelection`, `toggleHole`, `selectNode`, `clearSelection`, `setTool`, `setGridSnap`, `undo`, `redo`), `createActions(store, registry): Actions`
  - `useGeometrySync(store, client)`, `useAutosave(store, repo): () => Promise<void>` (the returned function flushes pending saves)
  - Test helpers: `fakeGeometryApi(overrides?)`, `fakeDeps(overrides?)`, `renderWithStore(ui, store)`
  - `Workspace`, which later tasks fill in. Its layout areas: `.toolbar`, `.left-panel`, `.viewport`, `.right-panel`.

- [ ] **Step 1: Write the failing tests**

`src/app/selection.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { nextSelection, toggleInSelection } from './selection'

describe('selection helpers', () => {
  it('toggles ids', () => {
    expect(toggleInSelection(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleInSelection(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('replaces or adds depending on the modifier key', () => {
    expect(nextSelection(['a'], 'b', false)).toEqual(['b'])
    expect(nextSelection(['a'], 'b', true)).toEqual(['a', 'b'])
  })
})
```

`src/app/actions.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { registry } from '../plugins/index'
import { createBloKadeStore } from '../store/store'
import { createActions } from './actions'

function setup() {
  const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
  return { store, actions: createActions(store, registry), doc: () => store.getState().history.present }
}

describe('actions', () => {
  it('adds a shape with default sizes and selects it', () => {
    const { store, actions, doc } = setup()
    actions.addShape('box')
    const [id] = doc().root
    expect(store.getState().selection).toEqual([id])
    expect(doc().nodes[id as string]).toMatchObject({ shapeType: 'box', name: 'Box', params: { width: 20, depth: 20, height: 20 } })
  })

  it('explains an unknown shape', () => {
    const { store, actions } = setup()
    actions.addShape('spaceship')
    expect(store.getState().notice).toContain('"spaceship"')
  })

  it('groups the selection and selects the group', () => {
    const { store, actions, doc } = setup()
    actions.addShape('box')
    actions.addShape('cylinder')
    store.getState().select(doc().root)
    actions.groupSelection()
    expect(doc().root).toHaveLength(1)
    expect(store.getState().selection).toEqual(doc().root)
  })

  it('explains grouping a single part', () => {
    const { store, actions } = setup()
    actions.addShape('box')
    actions.groupSelection()
    expect(store.getState().notice).toBe('Pick at least two parts to group.')
  })

  it('ungroups and selects the children', () => {
    const { store, actions, doc } = setup()
    actions.addShape('box')
    actions.addShape('sphere')
    const parts = doc().root
    store.getState().select(parts)
    actions.groupSelection()
    actions.ungroupSelection()
    expect(doc().root).toEqual(parts)
    expect(store.getState().selection).toEqual(parts)
  })

  it('asks for one group when ungrouping something else', () => {
    const { store, actions } = setup()
    actions.ungroupSelection()
    expect(store.getState().notice).toBe('Pick one group to ungroup.')
  })

  it('duplicates and deletes the selection', () => {
    const { store, actions, doc } = setup()
    actions.addShape('box')
    actions.duplicateSelection()
    expect(doc().root).toHaveLength(2)
    expect(store.getState().selection).toEqual([doc().root[1]])
    actions.deleteSelection()
    expect(doc().root).toHaveLength(1)
  })

  it('toggles holes: mixed becomes all holes, all holes become solid', () => {
    const { store, actions, doc } = setup()
    actions.addShape('box')
    actions.addShape('box')
    store.getState().select(doc().root)
    actions.toggleHole()
    expect(doc().root.map((id) => doc().nodes[id]?.mode)).toEqual(['hole', 'hole'])
    actions.toggleHole()
    expect(doc().root.map((id) => doc().nodes[id]?.mode)).toEqual(['solid', 'solid'])
  })

  it('selects with and without the modifier key, and changes settings', () => {
    const { store, actions, doc } = setup()
    actions.addShape('box')
    actions.addShape('box')
    const [a, b] = doc().root as [string, string]
    actions.selectNode(a, false)
    actions.selectNode(b, true)
    expect(store.getState().selection).toEqual([a, b])
    actions.clearSelection()
    expect(store.getState().selection).toEqual([])
    actions.setTool('rotate')
    expect(store.getState().tool).toBe('rotate')
    actions.setGridSnap(0.5)
    expect(doc().settings.gridSnap).toBe(0.5)
    actions.undo()
    expect(doc().settings.gridSnap).toBe(1)
    actions.redo()
    expect(doc().settings.gridSnap).toBe(0.5)
  })
})
```

`src/ui/ShapePalette.test.tsx`:
```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { registry } from '../plugins/index'
import { ShapePalette } from './ShapePalette'

describe('ShapePalette', () => {
  it('shows one button per shape and adds the clicked one', async () => {
    const onAdd = vi.fn()
    render(<ShapePalette registry={registry} onAdd={onAdd} />)
    expect(screen.getAllByRole('button')).toHaveLength(6)
    await userEvent.click(screen.getByRole('button', { name: /Cylinder/ }))
    expect(onAdd).toHaveBeenCalledWith('cylinder')
  })
})
```

`src/ui/App.test.tsx` (replaces the Task 1 version):
```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakeDeps } from '../app/testing/fakes'
import { App } from './App'

describe('App', () => {
  it('starts up and shows the shape palette', async () => {
    render(<App deps={fakeDeps()} />)
    expect(screen.getByText('Starting BloKade…')).toBeInTheDocument()
    expect(await screen.findByTestId('add-box')).toBeInTheDocument()
  })

  it("tells Kade when one of his plugins is broken", async () => {
    render(<App deps={fakeDeps({ pluginProblems: ['Plugin "Gear" has a problem: build must be a function'] })} />)
    expect(await screen.findByRole('status')).toHaveTextContent('Gear')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app src/ui`
Expected: FAIL, because the new modules are missing.

- [ ] **Step 3: Implement the non-UI modules**

`src/store/context.tsx`:
```tsx
import { createContext, useContext, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { BloKadeState, BloKadeStore } from './store'

const StoreContext = createContext<BloKadeStore | null>(null)

export function StoreProvider({ store, children }: { store: BloKadeStore; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useBloKadeStore(): BloKadeStore {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useBloKadeStore must be used inside <StoreProvider>')
  return store
}

/** Selectors must return stable values (state fields or primitives), never fresh arrays/objects. */
export function useBloKade<T>(selector: (state: BloKadeState) => T): T {
  return useStore(useBloKadeStore(), selector)
}
```

`src/app/deps.ts`:
```ts
import { GeometryClient } from '../geometry/client'
import { spawnGeometryWorker } from '../geometry/spawn'
import { createIdbDesignRepository } from '../persistence/idb-repository'
import type { DesignRepository } from '../persistence/repository'
import { pluginProblems, registry } from '../plugins/index'
import type { PluginRegistry } from '../plugins/registry'

export interface AppDeps {
  readonly repo: DesignRepository
  readonly client: GeometryClient
  readonly registry: PluginRegistry
  readonly pluginProblems: readonly string[]
}

export function createAppDeps(): AppDeps {
  return { repo: createIdbDesignRepository(), client: new GeometryClient(spawnGeometryWorker), registry, pluginProblems }
}
```

`src/app/selection.ts`:
```ts
import type { NodeId } from '../document/types'

export const toggleInSelection = (selection: readonly NodeId[], id: NodeId): NodeId[] =>
  selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id]

export const nextSelection = (selection: readonly NodeId[], id: NodeId, additive: boolean): NodeId[] =>
  additive ? toggleInSelection(selection, id) : [id]
```

`src/app/actions.ts`:
```ts
import { createShapeNode, pickColor } from '../document/factory'
import {
  addNode, DocumentOpError, duplicateNodes, groupNodes, removeNodes, setGridSnap, setMode, ungroupNode,
} from '../document/ops'
import type { BloKadeDocument, NodeId } from '../document/types'
import { defaultParams } from '../plugins/params'
import type { PluginRegistry } from '../plugins/registry'
import type { BloKadeStore, ToolMode } from '../store/store'
import { nextSelection } from './selection'

export interface Actions {
  addShape(pluginId: string): void
  deleteSelection(): void
  duplicateSelection(): void
  groupSelection(): void
  ungroupSelection(): void
  toggleHole(): void
  selectNode(id: NodeId, additive: boolean): void
  clearSelection(): void
  setTool(tool: ToolMode): void
  setGridSnap(gridSnap: number): void
  undo(): void
  redo(): void
}

/** Runs an op that also returns a value; DocumentOpErrors become notices. */
function run<T>(store: BloKadeStore, op: (doc: BloKadeDocument) => { doc: BloKadeDocument; value: T }): T | undefined {
  const state = store.getState()
  try {
    const { doc, value } = op(state.history.present)
    state.apply(() => doc)
    return value
  } catch (error) {
    if (!(error instanceof DocumentOpError)) throw error
    state.notify(error.message)
    return undefined
  }
}

export function createActions(store: BloKadeStore, registry: PluginRegistry): Actions {
  const state = () => store.getState()
  const selectIf = (ids: readonly NodeId[] | undefined): void => {
    if (ids) state().select(ids)
  }

  return {
    addShape: (pluginId) => {
      const plugin = registry.get(pluginId)
      if (!plugin) {
        state().notify(`BloKade doesn't have a "${pluginId}" shape.`)
        return
      }
      const color = pickColor(Object.keys(state().history.present.nodes).length)
      const node = createShapeNode({ shapeType: plugin.id, name: plugin.name, params: defaultParams(plugin), color })
      selectIf(run(store, (doc) => ({ doc: addNode(doc, node), value: [node.id] })))
    },
    deleteSelection: () => {
      const ids = state().selection
      if (ids.length > 0) state().apply((doc) => removeNodes(doc, ids))
    },
    duplicateSelection: () => {
      const ids = state().selection
      if (ids.length === 0) return
      selectIf(run(store, (doc) => {
        const result = duplicateNodes(doc, ids)
        return { doc: result.doc, value: result.newIds }
      }))
    },
    groupSelection: () => selectIf(run(store, (doc) => {
      const result = groupNodes(doc, state().selection)
      return { doc: result.doc, value: [result.groupId] }
    })),
    ungroupSelection: () => {
      const [id, ...rest] = state().selection
      if (!id || rest.length > 0) {
        state().notify('Pick one group to ungroup.')
        return
      }
      selectIf(run(store, (doc) => {
        const result = ungroupNode(doc, id)
        return { doc: result.doc, value: result.childIds }
      }))
    },
    toggleHole: () => {
      const { selection, history } = state()
      if (selection.length === 0) return
      const allHoles = selection.every((id) => history.present.nodes[id]?.mode === 'hole')
      state().apply((doc) => setMode(doc, selection, allHoles ? 'solid' : 'hole'))
    },
    selectNode: (id, additive) => state().select(nextSelection(state().selection, id, additive)),
    clearSelection: () => state().select([]),
    setTool: (tool) => state().setTool(tool),
    setGridSnap: (gridSnap) => state().apply((doc) => setGridSnap(doc, gridSnap)),
    undo: () => state().undo(),
    redo: () => state().redo(),
  }
}
```

`src/app/useGeometrySync.ts`:
```ts
import { useEffect } from 'react'
import type { BloKadeDocument } from '../document/types'
import { GeometryTimeoutError, type GeometryClient } from '../geometry/client'
import type { BloKadeStore } from '../store/store'

const ENGINE_PROBLEM = "The geometry engine had a problem, so your shapes can't update right now. Try reloading the page."

/** Rebuilds geometry whenever the document changes and feeds results into the store. */
export function useGeometrySync(store: BloKadeStore, client: GeometryClient): void {
  useEffect(() => {
    const rebuild = (doc: BloKadeDocument, designId: string): void => {
      client.rebuild(doc).then(
        (result) => {
          if (result) store.getState().applyBuild(designId, result)
        },
        (error: unknown) => {
          if (!(error instanceof GeometryTimeoutError)) console.error('Geometry rebuild failed', error)
          store.getState().notify(error instanceof GeometryTimeoutError ? error.message : ENGINE_PROBLEM)
        },
      )
    }
    const initial = store.getState()
    rebuild(initial.history.present, initial.designId)
    return store.subscribe((next, prev) => {
      if (next.history.present !== prev.history.present) rebuild(next.history.present, next.designId)
    })
  }, [store, client])
}
```

`src/app/useAutosave.ts`:
```ts
import { useCallback, useEffect, useRef } from 'react'
import { createAutosaver, type Autosaver } from '../persistence/autosave'
import type { DesignRepository } from '../persistence/repository'
import type { BloKadeStore } from '../store/store'

const AUTOSAVE_BROKEN = "Autosave isn't working in this browser. Use Designs → Save to file to keep your work."

/** Saves the open design 1 s after each change. Returns a function that saves immediately. */
export function useAutosave(store: BloKadeStore, repo: DesignRepository): () => Promise<void> {
  const saver = useRef<Autosaver | null>(null)

  useEffect(() => {
    const autosaver = createAutosaver({
      save: (id, doc) => repo.save(id, doc),
      onError: (error) => {
        console.error('Autosave failed', error)
        store.getState().notify(AUTOSAVE_BROKEN)
      },
    })
    saver.current = autosaver
    const unsubscribe = store.subscribe((next, prev) => {
      if (next.history.present !== prev.history.present) autosaver.schedule(next.designId, next.history.present)
    })
    const flushOnHide = (): void => void autosaver.flush()
    window.addEventListener('pagehide', flushOnHide)
    return () => {
      unsubscribe()
      window.removeEventListener('pagehide', flushOnHide)
      void autosaver.flush()
      saver.current = null
    }
  }, [store, repo])

  return useCallback(() => saver.current?.flush() ?? Promise.resolve(), [])
}
```

`src/app/testing/fakes.ts`:
```ts
import { GeometryClient } from '../../geometry/client'
import type { GeometryApi } from '../../geometry/types'
import { createMemoryDesignRepository } from '../../persistence/memory-repository'
import { registry } from '../../plugins/index'
import type { AppDeps } from '../deps'

export function fakeGeometryApi(overrides: Partial<GeometryApi> = {}): GeometryApi {
  return {
    rebuild: async () => ({ nodes: {} }),
    exportStl: async () => new ArrayBuffer(84),
    export3mf: async () => new ArrayBuffer(22),
    ...overrides,
  }
}

export function fakeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    repo: createMemoryDesignRepository(),
    client: new GeometryClient(() => ({ api: fakeGeometryApi(), terminate: () => undefined })),
    registry,
    pluginProblems: [],
    ...overrides,
  }
}
```

`src/app/testing/render.tsx`:
```tsx
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { StoreProvider } from '../../store/context'
import type { BloKadeStore } from '../../store/store'

export function renderWithStore(ui: ReactElement, store: BloKadeStore) {
  return render(<StoreProvider store={store}>{ui}</StoreProvider>)
}
```

- [ ] **Step 4: Implement the UI shell**

`src/ui/ShapePalette.tsx`:
```tsx
import type { PluginRegistry } from '../plugins/registry'

export function ShapePalette({ registry, onAdd }: { registry: PluginRegistry; onAdd(pluginId: string): void }) {
  return (
    <section className="panel" aria-label="Shapes">
      <h2>Shapes</h2>
      <div className="palette-grid">
        {registry.list().map((plugin) => (
          <button key={plugin.id} type="button" className="palette-button" data-testid={`add-${plugin.id}`} onClick={() => onAdd(plugin.id)}>
            <span className="palette-icon" aria-hidden="true">{plugin.icon}</span>
            {plugin.name}
          </button>
        ))}
      </div>
    </section>
  )
}
```

`src/ui/Toasts.tsx`:
```tsx
import { useEffect } from 'react'
import { useBloKade } from '../store/context'

export const NOTICE_DURATION_MS = 8000

export function Toasts() {
  const notice = useBloKade((s) => s.notice)
  const notify = useBloKade((s) => s.notify)

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => notify(null), NOTICE_DURATION_MS)
    return () => clearTimeout(timer)
  }, [notice, notify])

  if (!notice) return null
  return (
    <div className="toast" role="status">
      <span>{notice}</span>
      <button type="button" aria-label="Dismiss message" onClick={() => notify(null)}>✕</button>
    </div>
  )
}
```

`src/ui/Workspace.tsx` (later tasks replace the placeholder areas):
```tsx
import { useMemo } from 'react'
import { createActions } from '../app/actions'
import type { AppDeps } from '../app/deps'
import { useAutosave } from '../app/useAutosave'
import { useGeometrySync } from '../app/useGeometrySync'
import { useBloKadeStore } from '../store/context'
import { ShapePalette } from './ShapePalette'
import { Toasts } from './Toasts'

export function Workspace({ deps }: { deps: AppDeps }) {
  const store = useBloKadeStore()
  const actions = useMemo(() => createActions(store, deps.registry), [store, deps.registry])
  useGeometrySync(store, deps.client)
  useAutosave(store, deps.repo)

  return (
    <div className="workspace">
      <header className="toolbar"><span className="brand">BloKade</span></header>
      <aside className="left-panel">
        <ShapePalette registry={deps.registry} onAdd={actions.addShape} />
      </aside>
      <main className="viewport" data-testid="viewport" />
      <aside className="right-panel" />
      <Toasts />
    </div>
  )
}
```

`src/ui/App.tsx` (replaces the placeholder):
```tsx
import { useEffect, useState } from 'react'
import type { AppDeps } from '../app/deps'
import { openInitialDesign, type InitialDesign } from '../persistence/bootstrap'
import { StoreProvider } from '../store/context'
import { createBloKadeStore, type BloKadeStore } from '../store/store'
import { Workspace } from './Workspace'

// React StrictMode runs effects twice in development; start each app only once
// so a first-time visitor doesn't get two "Untitled design" entries.
const startups = new WeakMap<AppDeps, Promise<InitialDesign>>()
function startOnce(deps: AppDeps): Promise<InitialDesign> {
  const existing = startups.get(deps)
  if (existing) return existing
  const started = openInitialDesign(deps.repo)
  startups.set(deps, started)
  return started
}

export function App({ deps }: { deps: AppDeps }) {
  const [store, setStore] = useState<BloKadeStore | null>(null)

  useEffect(() => {
    let active = true
    void startOnce(deps).then(({ id, doc, notice }) => {
      if (!active) return
      const created = createBloKadeStore({ designId: id, doc })
      const messages = [notice, ...deps.pluginProblems].filter((m): m is string => Boolean(m))
      if (messages.length > 0) created.getState().notify(messages.join(' '))
      // Remembering the last design is a convenience; autosave reports real storage failures.
      deps.repo.setLastOpened(id).catch((error: unknown) => console.error('Could not remember last design', error))
      setStore(created)
    })
    return () => {
      active = false
    }
  }, [deps])

  if (!store) return <div className="splash">Starting BloKade…</div>
  return (
    <StoreProvider store={store}>
      <Workspace deps={deps} />
    </StoreProvider>
  )
}
```

`src/main.tsx` (replaces the placeholder):
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createAppDeps } from './app/deps'
import { App } from './ui/App'
import './ui/App.css'

const container = document.getElementById('root')
if (!container) throw new Error('BloKade could not find its #root element')

// Created outside React so StrictMode never starts two geometry workers.
const deps = createAppDeps()

createRoot(container).render(
  <StrictMode>
    <App deps={deps} />
  </StrictMode>,
)
```

`src/ui/App.css`:
```css
:root {
  --bg: #f4f6fb;
  --panel: #ffffff;
  --ink: #1d2433;
  --muted: #5b6475;
  --accent: #4f9dff;
  --accent-ink: #ffffff;
  --danger: #e5484d;
  --border: #dde3ee;
  --radius: 10px;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: var(--ink);
  background: var(--bg);
}
* { box-sizing: border-box; }
body { margin: 0; }
button { font: inherit; }
.splash { display: grid; place-items: center; height: 100vh; font-size: 1.4rem; }
.workspace {
  display: grid;
  grid-template-columns: 250px 1fr 290px;
  grid-template-rows: auto 1fr;
  grid-template-areas: 'toolbar toolbar toolbar' 'left viewport right';
  height: 100vh;
}
.toolbar {
  grid-area: toolbar; display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  padding: 8px 12px; background: var(--panel); border-bottom: 1px solid var(--border);
}
.brand { font-weight: 800; font-size: 1.25rem; margin-right: 8px; }
.toolbar-group { display: flex; gap: 4px; padding-right: 8px; border-right: 1px solid var(--border); }
.left-panel { grid-area: left; overflow-y: auto; background: var(--panel); border-right: 1px solid var(--border); }
.right-panel { grid-area: right; overflow-y: auto; background: var(--panel); border-left: 1px solid var(--border); }
.viewport { grid-area: viewport; position: relative; min-height: 0; background: #e9eef7; }
.viewport-overlay { position: absolute; left: 0; right: 0; bottom: 16px; text-align: center; color: var(--muted); pointer-events: none; }
.panel { padding: 12px; }
.panel h2 { margin: 0 0 8px; font-size: 0.8rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.panel h3 { margin: 12px 0 6px; font-size: 0.85rem; color: var(--muted); }
.hint { color: var(--muted); font-size: 0.9rem; }
.palette-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.palette-button {
  display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 4px;
  border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg); cursor: pointer;
}
.palette-button:hover { border-color: var(--accent); }
.palette-icon { font-size: 1.6rem; }
.tool-button { padding: 6px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--panel); cursor: pointer; }
.tool-button[aria-pressed='true'] { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.tool-button:disabled { opacity: 0.4; cursor: default; }
.icon-button { border: none; background: none; cursor: pointer; padding: 2px 4px; }
.field { display: grid; grid-template-columns: 1fr 96px; gap: 6px; align-items: center; margin-bottom: 6px; font-size: 0.9rem; }
.field input { width: 100%; padding: 4px 6px; border: 1px solid var(--border); border-radius: 6px; font: inherit; }
.field-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.field-row .field { grid-template-columns: 14px 1fr; }
.mode-toggle { display: flex; gap: 4px; margin: 8px 0; }
.error-text { color: var(--danger); font-size: 0.9rem; }
.tree { list-style: none; margin: 0; padding: 0; }
.tree .tree { padding-left: 16px; }
.tree-row { display: flex; align-items: center; gap: 4px; padding: 3px 6px; border-radius: 6px; cursor: pointer; }
.tree-row[aria-selected='true'] { background: #dceaff; }
.tree-row.drop-target { outline: 2px dashed var(--accent); }
.tree-name { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.badge { color: var(--danger); }
.drop-zone { margin-top: 8px; padding: 8px; border: 2px dashed var(--accent); border-radius: 8px; text-align: center; color: var(--muted); }
.toast {
  position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 20;
  display: flex; gap: 12px; align-items: center; max-width: 80vw;
  padding: 10px 16px; border-radius: var(--radius); background: var(--ink); color: #fff;
}
.toast button { border: none; background: none; color: inherit; cursor: pointer; }
.dialog-backdrop { position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; background: rgba(15, 20, 30, 0.45); }
.dialog { width: min(480px, 92vw); padding: 16px; border-radius: var(--radius); background: var(--panel); box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25); }
.design-list { list-style: none; margin: 8px 0; padding: 0; max-height: 300px; overflow-y: auto; }
.design-list li { display: flex; gap: 6px; align-items: center; padding: 4px 0; }
.design-list li.current .design-name { font-weight: 700; }
.design-name { flex: 1; }
.dialog-actions { display: flex; flex-wrap: wrap; gap: 6px; }
```

- [ ] **Step 5: Run the tests, type check, and build**

Run: `npx vitest run && npm run typecheck && npx vite build && ls dist/assets | grep -E '\.wasm$'`
Expected: all tests pass, tsc is clean, the build succeeds, and a `replicad_single-*.wasm` file is listed. That means the worker and WASM are now bundled.

- [ ] **Step 6: Manual smoke check**

Run `npm run dev`, open the printed URL, and confirm the palette shows six shapes and nothing errors in the browser console. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add app shell with actions, shape palette, notices, sync and autosave

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: 3D viewport and click-to-select

**Files:**
- Create: `src/viewport/three-geometry.ts`, `src/viewport/NodeMesh.tsx`, `src/viewport/Viewport.tsx`
- Replace: `src/ui/Workspace.tsx`
- Modify: `src/ui/App.test.tsx` (mock the viewport, since jsdom has no WebGL)
- Test: `src/viewport/three-geometry.test.ts`

**Interfaces:**
- Consumes: `MeshData` (Task 5), `DisplayedMesh`, store hooks, `nextSelection`, `HOLE_COLOR`.
- Produces:
  - `toBufferGeometry(mesh: MeshData): BufferGeometry`, `toEdgeGeometry(mesh: MeshData): BufferGeometry`
  - `NodeMesh`: a `<group name={node.id}>` placed at the node's transform. Task 14 finds it with `scene.getObjectByName(id)`.
  - `Viewport({ registry })`: the `registry` prop is used from Task 14 onward.

- [ ] **Step 1: Write the failing test `src/viewport/three-geometry.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import type { MeshData } from '../geometry/types'
import { toBufferGeometry, toEdgeGeometry } from './three-geometry'

const triangle: MeshData = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  indices: new Uint32Array([0, 1, 2]),
  edges: new Float32Array([0, 0, 0, 1, 0, 0]),
}

describe('three geometry', () => {
  it('builds an indexed triangle mesh', () => {
    const g = toBufferGeometry(triangle)
    expect(g.getAttribute('position').count).toBe(3)
    expect(g.getAttribute('normal').count).toBe(3)
    expect(g.getIndex()?.count).toBe(3)
  })

  it('builds edge line segments', () => {
    expect(toEdgeGeometry(triangle).getAttribute('position').count).toBe(2)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/viewport`
Expected: FAIL, because `./three-geometry` is missing.

- [ ] **Step 3: Implement**

`src/viewport/three-geometry.ts`:
```ts
import { BufferAttribute, BufferGeometry } from 'three'
import type { MeshData } from '../geometry/types'

export function toBufferGeometry(mesh: MeshData): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(mesh.positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(mesh.normals, 3))
  geometry.setIndex(new BufferAttribute(mesh.indices, 1))
  geometry.computeBoundingSphere()
  return geometry
}

export function toEdgeGeometry(mesh: MeshData): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(mesh.edges, 3))
  return geometry
}
```

`src/viewport/NodeMesh.tsx`:
```tsx
import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { MathUtils } from 'three'
import { HOLE_COLOR } from '../document/factory'
import type { NodeId, SceneNode } from '../document/types'
import type { DisplayedMesh } from '../store/merge-build'
import { toBufferGeometry, toEdgeGeometry } from './three-geometry'

const EDGE_COLOR = '#2b3445'
const SELECTED_EDGE_COLOR = '#ff8a00'

interface NodeMeshProps {
  node: SceneNode
  displayed: DisplayedMesh
  selected: boolean
  onSelect(id: NodeId, additive: boolean): void
}

export function NodeMesh({ node, displayed, selected, onSelect }: NodeMeshProps) {
  const geometry = useMemo(() => toBufferGeometry(displayed.mesh), [displayed.mesh])
  const edges = useMemo(() => toEdgeGeometry(displayed.mesh), [displayed.mesh])
  useEffect(() => () => {
    geometry.dispose()
    edges.dispose()
  }, [geometry, edges])

  const [x, y, z] = node.transform.position
  const [rx, ry, rz] = node.transform.rotation
  const isHole = node.mode === 'hole'
  const opacity = isHole ? 0.35 : displayed.stale ? 0.5 : 1
  const handleClick = (event: ThreeEvent<MouseEvent>): void => {
    event.stopPropagation()
    onSelect(node.id, event.shiftKey || event.metaKey || event.ctrlKey)
  }

  return (
    <group
      name={node.id}
      position={[x, y, z]}
      rotation={[MathUtils.degToRad(rx), MathUtils.degToRad(ry), MathUtils.degToRad(rz)]}
      onClick={handleClick}
    >
      <mesh geometry={geometry}>
        <meshStandardMaterial color={isHole ? HOLE_COLOR : node.color} transparent={opacity < 1} opacity={opacity} depthWrite={!isHole} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={selected ? SELECTED_EDGE_COLOR : EDGE_COLOR} />
      </lineSegments>
    </group>
  )
}
```

`src/viewport/Viewport.tsx`:
```tsx
import { GizmoHelper, GizmoViewport, Grid, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Object3D } from 'three'
import { nextSelection } from '../app/selection'
import type { NodeId } from '../document/types'
import type { PluginRegistry } from '../plugins/registry'
import { useBloKade } from '../store/context'
import { NodeMesh } from './NodeMesh'

// BloKade is Z-up like slicers. This must run before the camera is created.
Object3D.DEFAULT_UP.set(0, 0, 1)

export function Viewport(_props: { registry: PluginRegistry }) {
  const doc = useBloKade((s) => s.history.present)
  const meshes = useBloKade((s) => s.meshes)
  const selection = useBloKade((s) => s.selection)
  const engineReady = useBloKade((s) => s.engineReady)
  const select = useBloKade((s) => s.select)
  const onSelect = (id: NodeId, additive: boolean): void => select(nextSelection(selection, id, additive))

  return (
    <>
      <Canvas camera={{ position: [120, -160, 120], fov: 45, near: 0.5, far: 5000 }} onPointerMissed={() => select([])}>
        <color attach="background" args={['#e9eef7']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[150, -100, 250]} intensity={1.6} />
        <directionalLight position={[-150, 100, 80]} intensity={0.5} />
        <Grid rotation={[Math.PI / 2, 0, 0]} cellSize={1} sectionSize={10} infiniteGrid fadeDistance={600} cellColor="#c9d3e3" sectionColor="#8fa3c2" />
        {doc.root.map((id) => {
          const node = doc.nodes[id]
          const displayed = meshes[id]
          return node && displayed && !node.hidden ? (
            <NodeMesh key={id} node={node} displayed={displayed} selected={selection.includes(id)} onSelect={onSelect} />
          ) : null
        })}
        <OrbitControls makeDefault />
        <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
          <GizmoViewport />
        </GizmoHelper>
      </Canvas>
      {!engineReady && <div className="viewport-overlay">Warming up the geometry engine…</div>}
    </>
  )
}
```

`src/ui/Workspace.tsx` (full replacement; the viewport is now real):
```tsx
import { useMemo } from 'react'
import { createActions } from '../app/actions'
import type { AppDeps } from '../app/deps'
import { useAutosave } from '../app/useAutosave'
import { useGeometrySync } from '../app/useGeometrySync'
import { useBloKadeStore } from '../store/context'
import { Viewport } from '../viewport/Viewport'
import { ShapePalette } from './ShapePalette'
import { Toasts } from './Toasts'

export function Workspace({ deps }: { deps: AppDeps }) {
  const store = useBloKadeStore()
  const actions = useMemo(() => createActions(store, deps.registry), [store, deps.registry])
  useGeometrySync(store, deps.client)
  useAutosave(store, deps.repo)

  return (
    <div className="workspace">
      <header className="toolbar"><span className="brand">BloKade</span></header>
      <aside className="left-panel">
        <ShapePalette registry={deps.registry} onAdd={actions.addShape} />
      </aside>
      <main className="viewport" data-testid="viewport">
        <Viewport registry={deps.registry} />
      </main>
      <aside className="right-panel" />
      <Toasts />
    </div>
  )
}
```

In `src/ui/App.test.tsx`, add this right after the imports:
```tsx
vi.mock('../viewport/Viewport', () => ({ Viewport: () => null }))
```
and change the vitest import line to `import { describe, expect, it, vi } from 'vitest'`.

- [ ] **Step 4: Run the tests, type check, and smoke test**

Run: `npx vitest run && npm run typecheck`
Expected: PASS.

Then run `npm run dev`, open the app, and check:
- "Warming up the geometry engine…" shows briefly.
- Clicking **Box** shows a red/blue box sitting on the grid.
- Dragging orbits the camera, and the gizmo at the bottom right shows Z up.
- Clicking the box turns its edges orange, and clicking empty space clears that.

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add the 3D viewport with click-to-select

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Move, rotate, and size handles

**Files:**
- Create: `src/viewport/sizing.ts`, `src/viewport/useShiftHeld.ts`, `src/viewport/TransformHandles.tsx`
- Modify: `src/viewport/Viewport.tsx`
- Test: `src/viewport/sizing.test.ts`

**Interfaces:**
- Consumes: `ShapePlugin.size`, `resolveParams`, `transformFromParts`, `updateNode`, store hooks.
- Produces:
  - `paramsFromScale(plugin: ShapePlugin, params: ParamValues, scale: Vec3): ParamValues`. If two axes drive the same parameter, the axis that changed most wins. Values are rounded to 0.01 mm and clamped by `resolveParams`.
  - `useShiftHeld(): boolean`
  - `TransformHandles({ registry })`: shows drei `TransformControls` on a single selected top-level part. The mode follows `store.tool`. It commits once on mouse-up as one undo step. Snapping uses the grid for moves and 15° for rotation; holding Shift turns snapping off.

- [ ] **Step 1: Write the failing test `src/viewport/sizing.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { registry } from '../plugins/index'
import { MIN_MM } from '../plugins/params'
import { paramsFromScale } from './sizing'

const plugin = (id: string) => {
  const found = registry.get(id)
  if (!found) throw new Error(id)
  return found
}

describe('paramsFromScale', () => {
  it('scales each mapped parameter by its axis', () => {
    expect(paramsFromScale(plugin('box'), { width: 20, depth: 20, height: 20 }, [2, 1, 0.5]))
      .toEqual({ width: 40, depth: 20, height: 10 })
  })

  it('uses the axis that changed most when two axes share a parameter', () => {
    expect(paramsFromScale(plugin('cylinder'), { diameter: 20, height: 10 }, [1.5, 0.9, 1]).diameter).toBe(30)
  })

  it('rounds to 0.01 mm', () => {
    expect(paramsFromScale(plugin('sphere'), { diameter: 10 }, [1.23456, 1, 1]).diameter).toBe(12.35)
  })

  it('never goes below the minimum size, even when flipped', () => {
    expect(paramsFromScale(plugin('box'), { width: 20, depth: 20, height: 20 }, [0, 1, 1]).width).toBe(MIN_MM)
    expect(paramsFromScale(plugin('box'), { width: 20, depth: 20, height: 20 }, [-2, 1, 1]).width).toBe(40)
  })

  it('leaves unmapped parameters alone', () => {
    expect(paramsFromScale(plugin('cone'), { bottomDiameter: 20, topDiameter: 4, height: 20 }, [2, 2, 1]))
      .toEqual({ bottomDiameter: 40, topDiameter: 4, height: 20 })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/viewport/sizing.test.ts`
Expected: FAIL, because `./sizing` is missing.

- [ ] **Step 3: Implement**

`src/viewport/sizing.ts`:
```ts
import type { Vec3 } from '../document/types'
import { resolveParams } from '../plugins/params'
import type { ParamValues, ShapePlugin } from '../plugins/types'

const AXES = ['x', 'y', 'z'] as const
const round2 = (v: number): number => Math.round(v * 100) / 100

/** Turns a size-handle drag (scale per axis) into new plugin parameters. */
export function paramsFromScale(plugin: ShapePlugin, params: ParamValues, scale: Vec3): ParamValues {
  const factors = AXES.reduce<Readonly<Record<string, number>>>((acc, axis, i) => {
    const target = plugin.size?.[axis]
    const factor = Math.abs(scale[i] ?? 1)
    if (!target || factor === 1) return acc
    const current = acc[target]
    return current === undefined || Math.abs(factor - 1) > Math.abs(current - 1) ? { ...acc, [target]: factor } : acc
  }, {})
  const scaled = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, round2(value * (factors[key] ?? 1))]),
  )
  return resolveParams(plugin, scaled)
}
```

`src/viewport/useShiftHeld.ts`:
```ts
import { useEffect, useState } from 'react'

/** True while Shift is held; used to turn snapping off during a drag. */
export function useShiftHeld(): boolean {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    const update = (event: KeyboardEvent): void => setHeld(event.shiftKey)
    const reset = (): void => setHeld(false)
    window.addEventListener('keydown', update)
    window.addEventListener('keyup', update)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', update)
      window.removeEventListener('keyup', update)
      window.removeEventListener('blur', reset)
    }
  }, [])
  return held
}
```

`src/viewport/TransformHandles.tsx`:
```tsx
import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { MathUtils, type Object3D } from 'three'
import { updateNode } from '../document/ops'
import { transformFromParts } from '../document/transform-math'
import type { SceneNode, Transform, Vec3 } from '../document/types'
import type { PluginRegistry } from '../plugins/registry'
import { useBloKade, useBloKadeStore } from '../store/context'
import type { ToolMode } from '../store/store'
import { paramsFromScale } from './sizing'
import { useShiftHeld } from './useShiftHeld'

const ROTATION_SNAP = MathUtils.degToRad(15)
const CONTROL_MODES = { move: 'translate', rotate: 'rotate', size: 'scale' } as const

const sameTransform = (a: Transform, b: Transform): boolean =>
  a.position.every((v, i) => v === b.position[i]) && a.rotation.every((v, i) => v === b.rotation[i])

function edited(node: SceneNode, tool: ToolMode, transform: Transform, scale: Vec3, registry: PluginRegistry): SceneNode {
  if (node.kind !== 'shape' || tool !== 'size') return { ...node, transform }
  const plugin = registry.get(node.shapeType)
  return plugin ? { ...node, transform, params: paramsFromScale(plugin, node.params, scale) } : { ...node, transform }
}

export function TransformHandles({ registry }: { registry: PluginRegistry }) {
  const store = useBloKadeStore()
  const doc = useBloKade((s) => s.history.present)
  const selection = useBloKade((s) => s.selection)
  const tool = useBloKade((s) => s.tool)
  const meshes = useBloKade((s) => s.meshes)
  const scene = useThree((s) => s.scene)
  const shiftHeld = useShiftHeld()
  const [target, setTarget] = useState<Object3D | null>(null)

  const selectedId = selection.length === 1 ? selection[0] : undefined
  const id = selectedId && doc.root.includes(selectedId) ? selectedId : null
  const node = id ? doc.nodes[id] : undefined

  useEffect(() => {
    setTarget(id ? scene.getObjectByName(id) ?? null : null)
  }, [id, scene, meshes])

  if (!node || !target || (tool === 'size' && node.kind !== 'shape')) return null

  const commit = (): void => {
    const transform = transformFromParts(
      [target.position.x, target.position.y, target.position.z],
      [target.rotation.x, target.rotation.y, target.rotation.z],
    )
    const scale: Vec3 = [target.scale.x, target.scale.y, target.scale.z]
    // TransformControls scales the three.js object directly; BloKade stores size in parameters instead.
    target.scale.set(1, 1, 1)
    if (scale.every((s) => s === 1) && sameTransform(transform, node.transform)) return
    store.getState().apply((d) => updateNode(d, node.id, (n) => edited(n, tool, transform, scale, registry)))
  }

  const gridSnap = doc.settings.gridSnap
  return (
    <TransformControls
      object={target}
      mode={CONTROL_MODES[tool]}
      translationSnap={gridSnap > 0 && !shiftHeld ? gridSnap : null}
      rotationSnap={shiftHeld ? null : ROTATION_SNAP}
      onMouseUp={commit}
    />
  )
}
```

`src/viewport/Viewport.tsx`: rename the unused prop to `{ registry }`, import `TransformHandles`, and render it right after the `doc.root.map(...)` block, before `<OrbitControls makeDefault />`:
```tsx
import { TransformHandles } from './TransformHandles'
// …
export function Viewport({ registry }: { registry: PluginRegistry }) {
// …
        <TransformHandles registry={registry} />
        <OrbitControls makeDefault />
```

- [ ] **Step 4: Run the tests, type check, and smoke test**

Run: `npx vitest run && npm run typecheck`
Expected: PASS.

Then run `npm run dev` and, with a box selected, check each of these. There's no toolbar yet, so to test the other modes, temporarily call `actions.setTool` from React DevTools, or check after Task 17.
- **Move:** arrows drag the box in 1 mm steps, and holding Shift makes it smooth. Undo isn't wired to a button yet; the store test covers it.
- **Rotate:** the rings snap every 15°.
- **Size:** dragging a handle changes the box, and after release it rebuilds at the new size.

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add move, rotate and size handles with snapping

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Properties panel

**Files:**
- Create: `src/ui/number-input.ts`, `src/ui/NumberField.tsx`, `src/ui/PropertiesPanel.tsx`
- Replace: `src/ui/Workspace.tsx`
- Test: `src/ui/number-input.test.ts`, `src/ui/NumberField.test.tsx`, `src/ui/PropertiesPanel.test.tsx`

**Interfaces:**
- Consumes: `renameNode`, `setMode`, `updateNode` (Task 4); `resolveParams` (Task 6); store hooks; `renderWithStore` (Task 12).
- Produces:
  - `formatNumber(value): string` (up to 3 decimals), `parseNumberInput(text): number | null`
  - `NumberField({ label, value, onCommit, testId? })` and `TextField({ label, value, onCommit, testId? })`. Both commit on Enter or blur, Escape reverts, junk reverts without committing, and the inputs are `type="text"` so Milestone 2 can accept formulas.
  - `PropertiesPanel({ registry })`. Test ids: `prop-name`, `mode-solid`, `mode-hole`, `param-<key>`, `pos-x|y|z`, `rot-x|y|z`. Errors show in `role="alert"`.

- [ ] **Step 1: Write the failing tests**

`src/ui/number-input.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { formatNumber, parseNumberInput } from './number-input'

describe('number input helpers', () => {
  it('formats with up to 3 decimals', () => {
    expect(formatNumber(20)).toBe('20')
    expect(formatNumber(1 / 3)).toBe('0.333')
    expect(formatNumber(-0)).toBe('0')
  })

  it('parses numbers and rejects junk', () => {
    expect(parseNumberInput(' 12.5 ')).toBe(12.5)
    expect(parseNumberInput('-3')).toBe(-3)
    expect(parseNumberInput('')).toBeNull()
    expect(parseNumberInput('abc')).toBeNull()
    expect(parseNumberInput('Infinity')).toBeNull()
  })
})
```

`src/ui/NumberField.test.tsx`:
```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NumberField } from './NumberField'

function setup(value = 20) {
  const onCommit = vi.fn()
  const view = render(<NumberField label="Width" value={value} onCommit={onCommit} testId="w" />)
  return { onCommit, input: screen.getByTestId('w') as HTMLInputElement, view }
}

describe('NumberField', () => {
  it('commits on Enter', async () => {
    const { onCommit, input } = setup()
    await userEvent.clear(input)
    await userEvent.type(input, '35{Enter}')
    expect(onCommit).toHaveBeenCalledWith(35)
  })

  it('commits on blur', async () => {
    const { onCommit, input } = setup()
    await userEvent.clear(input)
    await userEvent.type(input, '7')
    await userEvent.tab()
    expect(onCommit).toHaveBeenCalledWith(7)
  })

  it('reverts junk without committing', async () => {
    const { onCommit, input } = setup()
    await userEvent.clear(input)
    await userEvent.type(input, 'abc{Enter}')
    expect(onCommit).not.toHaveBeenCalled()
    expect(input.value).toBe('20')
  })

  it('reverts on Escape', async () => {
    const { onCommit, input } = setup()
    await userEvent.type(input, '99{Escape}')
    expect(input.value).toBe('20')
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('does not commit an unchanged value', async () => {
    const { onCommit, input } = setup()
    await userEvent.type(input, '{Enter}')
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('shows new values from outside (undo)', () => {
    const { view, input } = setup(20)
    view.rerender(<NumberField label="Width" value={42} onCommit={vi.fn()} testId="w" />)
    expect(input.value).toBe('42')
  })
})
```

`src/ui/PropertiesPanel.test.tsx`:
```tsx
// @vitest-environment jsdom
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createActions } from '../app/actions'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument } from '../document/factory'
import { MIN_MM } from '../plugins/params'
import { registry } from '../plugins/index'
import { createBloKadeStore } from '../store/store'
import { PropertiesPanel } from './PropertiesPanel'

function setup() {
  const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
  const actions = createActions(store, registry)
  renderWithStore(<PropertiesPanel registry={registry} />, store)
  const selected = () => {
    const id = store.getState().selection[0]
    return id ? store.getState().history.present.nodes[id] : undefined
  }
  return { store, actions, selected }
}

async function setField(testId: string, text: string) {
  const input = screen.getByTestId(testId)
  await userEvent.clear(input)
  await userEvent.type(input, `${text}{Enter}`)
}

describe('PropertiesPanel', () => {
  it('shows a hint when nothing is selected', () => {
    setup()
    expect(screen.getByText(/Click a shape to change it/)).toBeInTheDocument()
  })

  it('edits shape sizes, clamping impossible values', async () => {
    const { actions, selected } = setup()
    act(() => actions.addShape('box'))
    await setField('param-width', '40')
    expect(selected()).toMatchObject({ params: { width: 40 } })
    await setField('param-height', '-5')
    expect(selected()).toMatchObject({ params: { height: MIN_MM } })
  })

  it('edits position, rotation and name', async () => {
    const { actions, selected } = setup()
    act(() => actions.addShape('box'))
    await setField('pos-x', '12')
    await setField('rot-z', '45')
    await setField('prop-name', 'Base')
    expect(selected()?.transform).toEqual({ position: [12, 0, 0], rotation: [0, 0, 45] })
    expect(selected()?.name).toBe('Base')
  })

  it('switches between solid and hole', async () => {
    const { actions, selected } = setup()
    act(() => actions.addShape('cylinder'))
    await userEvent.click(screen.getByTestId('mode-hole'))
    expect(selected()?.mode).toBe('hole')
    expect(screen.getByTestId('mode-hole')).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows build problems', () => {
    const { store, actions } = setup()
    act(() => actions.addShape('torus'))
    const id = store.getState().selection[0] as string
    act(() => store.getState().applyBuild('d', { nodes: { [id]: { status: 'error', message: 'Ring too thin' } } }))
    expect(screen.getByRole('alert')).toHaveTextContent('Ring too thin')
  })

  it('summarizes a multi-selection', () => {
    const { store, actions } = setup()
    act(() => {
      actions.addShape('box')
      actions.addShape('box')
      store.getState().select(store.getState().history.present.root)
    })
    expect(screen.getByText(/2 parts selected/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui`
Expected: FAIL, because the modules are missing.

- [ ] **Step 3: Implement**

`src/ui/number-input.ts`:
```ts
export function formatNumber(value: number): string {
  const rounded = Math.round(value * 1000) / 1000
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

export function parseNumberInput(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}
```

`src/ui/NumberField.tsx`:
```tsx
import { useEffect, useState, type KeyboardEvent } from 'react'
import { formatNumber, parseNumberInput } from './number-input'

interface DraftFieldProps<T> {
  label: string
  value: T
  onCommit(value: T): void
  testId?: string
  format(value: T): string
  parse(text: string): T | null
}

/** Text input holding a draft; commits valid changes on Enter/blur, reverts junk and on Escape. */
function DraftField<T>({ label, value, onCommit, testId, format, parse }: DraftFieldProps<T>) {
  const [draft, setDraft] = useState(format(value))
  useEffect(() => setDraft(format(value)), [value, format])

  const commit = (): void => {
    const parsed = parse(draft)
    if (parsed === null) {
      setDraft(format(value))
      return
    }
    if (parsed !== value) onCommit(parsed)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') commit()
    if (event.key === 'Escape') setDraft(format(value))
  }

  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        data-testid={testId}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    </label>
  )
}

type FieldProps<T> = Omit<DraftFieldProps<T>, 'format' | 'parse'>

const identity = (text: string): string => text
const nonEmpty = (text: string): string | null => (text.trim() ? text.trim() : null)

export function NumberField(props: FieldProps<number>) {
  return <DraftField {...props} format={formatNumber} parse={parseNumberInput} />
}

export function TextField(props: FieldProps<string>) {
  return <DraftField {...props} format={identity} parse={nonEmpty} />
}
```

`src/ui/PropertiesPanel.tsx`:
```tsx
import { renameNode, setMode, updateNode } from '../document/ops'
import type { SceneNode, ShapeNode, Vec3 } from '../document/types'
import { resolveParams } from '../plugins/params'
import type { PluginRegistry } from '../plugins/registry'
import type { NumberParamSpec } from '../plugins/types'
import { useBloKade } from '../store/context'
import { NumberField, TextField } from './NumberField'

const AXES = ['x', 'y', 'z'] as const
const UNIT: Record<NumberParamSpec['type'], string> = { mm: ' (mm)', angle: ' (°)', whole: '', number: '' }

const withAxis = (v: Vec3, index: number, value: number): Vec3 =>
  [index === 0 ? value : v[0], index === 1 ? value : v[1], index === 2 ? value : v[2]]

function ShapeParams({ node, registry }: { node: ShapeNode; registry: PluginRegistry }) {
  const apply = useBloKade((s) => s.apply)
  const plugin = registry.get(node.shapeType)
  if (!plugin) return <p className="error-text">This shape's plugin is missing, so its size can't be changed.</p>
  return (
    <>
      <h3>Size</h3>
      {Object.entries<NumberParamSpec>(plugin.params).map(([key, spec]) => (
        <NumberField
          key={key}
          label={`${spec.label}${UNIT[spec.type]}`}
          value={node.params[key] ?? spec.default}
          testId={`param-${key}`}
          onCommit={(value) => apply((d) => updateNode(d, node.id, (n) => (
            n.kind === 'shape' ? { ...n, params: resolveParams(plugin, { ...n.params, [key]: value }) } : n
          )))}
        />
      ))}
    </>
  )
}

function Placement({ node }: { node: SceneNode }) {
  const apply = useBloKade((s) => s.apply)
  const setPart = (part: 'position' | 'rotation', index: number, value: number): void =>
    apply((d) => updateNode(d, node.id, (n) => ({
      ...n, transform: { ...n.transform, [part]: withAxis(n.transform[part], index, value) },
    })))
  return (
    <>
      <h3>Position (mm)</h3>
      <div className="field-row">
        {AXES.map((axis, i) => (
          <NumberField key={axis} label={axis} value={node.transform.position[i] ?? 0} testId={`pos-${axis}`} onCommit={(v) => setPart('position', i, v)} />
        ))}
      </div>
      <h3>Rotation (°)</h3>
      <div className="field-row">
        {AXES.map((axis, i) => (
          <NumberField key={axis} label={axis} value={node.transform.rotation[i] ?? 0} testId={`rot-${axis}`} onCommit={(v) => setPart('rotation', i, v)} />
        ))}
      </div>
    </>
  )
}

export function PropertiesPanel({ registry }: { registry: PluginRegistry }) {
  const doc = useBloKade((s) => s.history.present)
  const selection = useBloKade((s) => s.selection)
  const errors = useBloKade((s) => s.errors)
  const apply = useBloKade((s) => s.apply)
  const node = selection.length === 1 && selection[0] ? doc.nodes[selection[0]] : undefined

  if (selection.length > 1) {
    return (
      <section className="panel" aria-label="Properties">
        <h2>Properties</h2>
        <p className="hint">{selection.length} parts selected. Group them, or pick one to change it.</p>
      </section>
    )
  }
  if (!node) {
    return (
      <section className="panel" aria-label="Properties">
        <h2>Properties</h2>
        <p className="hint">Click a shape to change it. Add shapes from the left.</p>
      </section>
    )
  }
  const error = errors[node.id]
  return (
    <section className="panel" aria-label="Properties">
      <h2>Properties</h2>
      <TextField label="Name" value={node.name} testId="prop-name" onCommit={(name) => apply((d) => renameNode(d, node.id, name))} />
      <div className="mode-toggle" role="group" aria-label="Solid or hole">
        <button type="button" className="tool-button" data-testid="mode-solid" aria-pressed={node.mode === 'solid'}
          onClick={() => apply((d) => setMode(d, [node.id], 'solid'))}>Solid</button>
        <button type="button" className="tool-button" data-testid="mode-hole" aria-pressed={node.mode === 'hole'}
          onClick={() => apply((d) => setMode(d, [node.id], 'hole'))}>Hole</button>
      </div>
      {error && <p className="error-text" role="alert">⚠ {error}</p>}
      {node.kind === 'shape' && <ShapeParams node={node} registry={registry} />}
      <Placement node={node} />
    </section>
  )
}
```

`src/ui/Workspace.tsx` (full replacement; adds the properties panel):
```tsx
import { useMemo } from 'react'
import { createActions } from '../app/actions'
import type { AppDeps } from '../app/deps'
import { useAutosave } from '../app/useAutosave'
import { useGeometrySync } from '../app/useGeometrySync'
import { useBloKadeStore } from '../store/context'
import { Viewport } from '../viewport/Viewport'
import { PropertiesPanel } from './PropertiesPanel'
import { ShapePalette } from './ShapePalette'
import { Toasts } from './Toasts'

export function Workspace({ deps }: { deps: AppDeps }) {
  const store = useBloKadeStore()
  const actions = useMemo(() => createActions(store, deps.registry), [store, deps.registry])
  useGeometrySync(store, deps.client)
  useAutosave(store, deps.repo)

  return (
    <div className="workspace">
      <header className="toolbar"><span className="brand">BloKade</span></header>
      <aside className="left-panel">
        <ShapePalette registry={deps.registry} onAdd={actions.addShape} />
      </aside>
      <main className="viewport" data-testid="viewport">
        <Viewport registry={deps.registry} />
      </main>
      <aside className="right-panel">
        <PropertiesPanel registry={deps.registry} />
      </aside>
      <Toasts />
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add properties panel with exact sizes, position and rotation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Scene tree

**Files:**
- Create: `src/ui/SceneTree.tsx`
- Replace: `src/ui/Workspace.tsx`
- Test: `src/ui/SceneTree.test.tsx`

**Interfaces:**
- Consumes: `moveNode`, `renameNode`, `setHidden`, `setMode` (Task 4); `nextSelection`; store hooks.
- Produces: `SceneTree({ registry })`. Each part is a `role="treeitem"` whose accessible name is the part's name, with `aria-selected`. Clicking selects it, and Shift/Ctrl/Cmd-click adds to the selection. Double-clicking renames it. Each row has hole and hide toggles and a ⚠ badge with the error text. Dragging a part onto a group moves it inside; dropping on "Drop here to move to the top level" moves it out.

- [ ] **Step 1: Write the failing test `src/ui/SceneTree.test.tsx`**

```tsx
// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createActions } from '../app/actions'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument } from '../document/factory'
import { registry } from '../plugins/index'
import { createBloKadeStore } from '../store/store'
import { SceneTree } from './SceneTree'

function setup() {
  const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
  const actions = createActions(store, registry)
  renderWithStore(<SceneTree registry={registry} />, store)
  const doc = () => store.getState().history.present
  return { store, actions, doc }
}

describe('SceneTree', () => {
  it('invites Kade to add a shape when empty', () => {
    setup()
    expect(screen.getByText(/No parts yet/)).toBeInTheDocument()
  })

  it('selects with click and shift-click', async () => {
    const { store, actions, doc } = setup()
    act(() => {
      actions.addShape('box')
      actions.addShape('sphere')
    })
    await userEvent.click(screen.getByRole('treeitem', { name: 'Box' }))
    await userEvent.keyboard('{Shift>}')
    await userEvent.click(screen.getByRole('treeitem', { name: 'Sphere' }))
    await userEvent.keyboard('{/Shift}')
    expect(store.getState().selection).toEqual(doc().root)
    expect(screen.getByRole('treeitem', { name: 'Box' })).toHaveAttribute('aria-selected', 'true')
  })

  it('toggles hole and hidden', async () => {
    const { actions, doc } = setup()
    act(() => actions.addShape('box'))
    const id = doc().root[0] as string
    await userEvent.click(screen.getByRole('button', { name: 'Make Box a hole' }))
    await userEvent.click(screen.getByRole('button', { name: 'Hide Box' }))
    expect(doc().nodes[id]).toMatchObject({ mode: 'hole', hidden: true })
  })

  it('renames on double-click', async () => {
    const { actions, doc } = setup()
    act(() => actions.addShape('box'))
    await userEvent.dblClick(screen.getByRole('treeitem', { name: 'Box' }))
    const input = screen.getByRole('textbox', { name: 'Part name' })
    await userEvent.clear(input)
    await userEvent.type(input, 'Base{Enter}')
    expect(doc().nodes[doc().root[0] as string]?.name).toBe('Base')
  })

  it('drags a part into a group and back out', () => {
    const { store, actions, doc } = setup()
    act(() => {
      actions.addShape('box')
      actions.addShape('box')
      store.getState().select(doc().root)
      actions.groupSelection()
      actions.addShape('sphere')
    })
    const [groupId, sphereId] = doc().root as [string, string]
    fireEvent.dragStart(screen.getByRole('treeitem', { name: 'Sphere' }))
    fireEvent.dragOver(screen.getByRole('treeitem', { name: 'Group' }))
    fireEvent.drop(screen.getByRole('treeitem', { name: 'Group' }))
    expect(doc().root).toEqual([groupId])
    fireEvent.dragStart(screen.getByRole('treeitem', { name: 'Sphere' }))
    fireEvent.drop(screen.getByTestId('drop-top-level'))
    expect(doc().root).toEqual([groupId, sphereId])
  })

  it('shows a problem badge', () => {
    const { store, actions, doc } = setup()
    act(() => actions.addShape('torus'))
    act(() => store.getState().applyBuild('d', { nodes: { [doc().root[0] as string]: { status: 'error', message: 'Too thin' } } }))
    expect(screen.getByLabelText('Problem: Too thin')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/ui/SceneTree.test.tsx`
Expected: FAIL, because `./SceneTree` is missing.

- [ ] **Step 3: Implement `src/ui/SceneTree.tsx`**

```tsx
import { useState, type DragEvent, type MouseEvent } from 'react'
import { nextSelection } from '../app/selection'
import { moveNode, renameNode, setHidden, setMode } from '../document/ops'
import type { NodeId } from '../document/types'
import type { PluginRegistry } from '../plugins/registry'
import { useBloKade, useBloKadeStore } from '../store/context'

interface DragProps {
  dragging: NodeId | null
  setDragging(id: NodeId | null): void
  dropInto(target: NodeId | null): void
}

function RenameInput({ initial, onDone }: { initial: string; onDone(name: string | null): void }) {
  return (
    <input
      autoFocus
      aria-label="Part name"
      defaultValue={initial}
      onClick={(event) => event.stopPropagation()}
      onBlur={(event) => onDone(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onDone(event.currentTarget.value)
        if (event.key === 'Escape') onDone(null)
      }}
    />
  )
}

function TreeItem({ id, registry, drag }: { id: NodeId; registry: PluginRegistry; drag: DragProps }) {
  const store = useBloKadeStore()
  const node = useBloKade((s) => s.history.present.nodes[id])
  const selected = useBloKade((s) => s.selection.includes(id))
  const error = useBloKade((s) => s.errors[id])
  const [editing, setEditing] = useState(false)
  const [over, setOver] = useState(false)
  if (!node) return null

  const { apply } = store.getState()
  const isGroup = node.kind === 'group'
  const icon = isGroup ? '📦' : registry.get(node.shapeType)?.icon ?? '❓'
  const canDropHere = isGroup && drag.dragging !== null && drag.dragging !== id
  const onClick = (event: MouseEvent): void => {
    const state = store.getState()
    state.select(nextSelection(state.selection, id, event.shiftKey || event.metaKey || event.ctrlKey))
  }
  const finishRename = (name: string | null): void => {
    if (editing && name !== null && name.trim() && name.trim() !== node.name) apply((d) => renameNode(d, id, name))
    setEditing(false)
  }
  const stopThen = (fn: () => void) => (event: MouseEvent): void => {
    event.stopPropagation()
    fn()
  }
  const onDrop = (event: DragEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    setOver(false)
    if (canDropHere) drag.dropInto(id)
  }

  return (
    <li role="none">
      <div
        role="treeitem"
        aria-label={node.name}
        aria-selected={selected}
        aria-expanded={isGroup ? true : undefined}
        className={`tree-row${over ? ' drop-target' : ''}`}
        draggable={!editing}
        onClick={onClick}
        onDoubleClick={() => setEditing(true)}
        onDragStart={(event) => {
          event.dataTransfer?.setData('text/plain', id)
          drag.setDragging(id)
        }}
        onDragEnd={() => drag.setDragging(null)}
        onDragOver={(event) => {
          if (!canDropHere) return
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <span aria-hidden="true">{icon}</span>
        {editing ? <RenameInput initial={node.name} onDone={finishRename} /> : <span className="tree-name">{node.name}</span>}
        {error && <span className="badge" title={error} aria-label={`Problem: ${error}`}>⚠</span>}
        <button type="button" className="icon-button"
          aria-label={node.mode === 'hole' ? `Make ${node.name} solid` : `Make ${node.name} a hole`}
          onClick={stopThen(() => apply((d) => setMode(d, [id], node.mode === 'hole' ? 'solid' : 'hole')))}>
          {node.mode === 'hole' ? '⬚' : '◼'}
        </button>
        <button type="button" className="icon-button"
          aria-label={node.hidden ? `Show ${node.name}` : `Hide ${node.name}`}
          onClick={stopThen(() => apply((d) => setHidden(d, [id], !node.hidden)))}>
          {node.hidden ? '🚫' : '👁'}
        </button>
      </div>
      {isGroup && node.children.length > 0 && (
        <ul className="tree" role="group">
          {node.children.map((child) => <TreeItem key={child} id={child} registry={registry} drag={drag} />)}
        </ul>
      )}
    </li>
  )
}

export function SceneTree({ registry }: { registry: PluginRegistry }) {
  const root = useBloKade((s) => s.history.present.root)
  const apply = useBloKade((s) => s.apply)
  const [dragging, setDragging] = useState<NodeId | null>(null)
  const dropInto = (target: NodeId | null): void => {
    if (dragging) apply((d) => moveNode(d, dragging, target))
    setDragging(null)
  }
  const drag: DragProps = { dragging, setDragging, dropInto }

  return (
    <section className="panel" aria-label="Parts">
      <h2>Parts</h2>
      {root.length === 0 ? (
        <p className="hint">No parts yet. Click a shape above to add one.</p>
      ) : (
        <ul className="tree" role="tree" aria-label="Parts">
          {root.map((id) => <TreeItem key={id} id={id} registry={registry} drag={drag} />)}
        </ul>
      )}
      {dragging && (
        <div className="drop-zone" data-testid="drop-top-level"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            dropInto(null)
          }}>
          Drop here to move to the top level
        </div>
      )}
    </section>
  )
}
```

`src/ui/Workspace.tsx` (full replacement; adds the scene tree under the palette):
```tsx
import { useMemo } from 'react'
import { createActions } from '../app/actions'
import type { AppDeps } from '../app/deps'
import { useAutosave } from '../app/useAutosave'
import { useGeometrySync } from '../app/useGeometrySync'
import { useBloKadeStore } from '../store/context'
import { Viewport } from '../viewport/Viewport'
import { PropertiesPanel } from './PropertiesPanel'
import { SceneTree } from './SceneTree'
import { ShapePalette } from './ShapePalette'
import { Toasts } from './Toasts'

export function Workspace({ deps }: { deps: AppDeps }) {
  const store = useBloKadeStore()
  const actions = useMemo(() => createActions(store, deps.registry), [store, deps.registry])
  useGeometrySync(store, deps.client)
  useAutosave(store, deps.repo)

  return (
    <div className="workspace">
      <header className="toolbar"><span className="brand">BloKade</span></header>
      <aside className="left-panel">
        <ShapePalette registry={deps.registry} onAdd={actions.addShape} />
        <SceneTree registry={deps.registry} />
      </aside>
      <main className="viewport" data-testid="viewport">
        <Viewport registry={deps.registry} />
      </main>
      <aside className="right-panel">
        <PropertiesPanel registry={deps.registry} />
      </aside>
      <Toasts />
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add scene tree with rename, hide, hole toggle and drag-to-group

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Toolbar, keyboard shortcuts, export, and the Designs dialog

**Files:**
- Create: `src/app/shortcuts.ts`, `src/app/export.ts`, `src/app/download.ts`, `src/ui/Toolbar.tsx`, `src/ui/DesignsDialog.tsx`
- Replace: `src/ui/Workspace.tsx`
- Test: `src/app/shortcuts.test.ts`, `src/app/export.test.ts`, `src/ui/Toolbar.test.tsx`, `src/ui/DesignsDialog.test.tsx`

**Interfaces:**
- Consumes: `Actions` (Task 12), `GeometryClient` (Task 10), persistence (Task 11), `renameDocument` (Task 4), `TextField` (Task 15), `canUndo`/`canRedo` (Task 5).
- Produces:
  - `ShortcutAction`, `KeyInput`, `matchShortcut(input): ShortcutAction | null`, `runShortcut(action, actions)`, `useShortcuts(actions, enabled)`
  - Shortcuts:

    | Keys | Action |
    |---|---|
    | Delete / Backspace | delete |
    | Ctrl/Cmd+D | duplicate |
    | Ctrl/Cmd+G | group |
    | Ctrl/Cmd+Shift+G | ungroup |
    | Ctrl/Cmd+Z | undo |
    | Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y | redo |
    | H | toggle hole |
    | M / R / S | move / rotate / size handles |
    | Esc | clear the selection |

    Shortcuts are ignored while typing in an input.
  - `ExportFormat = 'stl' | '3mf'`, `exportDesign({ client, store, format, download? }): Promise<void>`. It exports the selection, or everything if nothing is selected, and turns errors into notices.
  - `downloadBytes(data: BlobPart, filename, mime)`
  - `Toolbar({ actions, onExport, onOpenDesigns })`. Test ids: `undo`, `redo`, `group`, `ungroup`, `duplicate`, `delete`, `tool-move`, `tool-rotate`, `tool-size`, `export-stl`, `export-3mf`, `open-designs`. Grid snap is a `<select aria-label="Grid snap">`.
  - `DesignsDialog({ repo, flushAutosave, onClose, confirm? })`: new, open, duplicate, delete (with confirmation), rename the current design, save to file, and load from file (`data-testid="load-file"`).

- [ ] **Step 1: Write the failing tests**

`src/app/shortcuts.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import type { Actions } from './actions'
import { matchShortcut, runShortcut, type KeyInput } from './shortcuts'

const key = (k: string, mods: Partial<KeyInput> = {}): KeyInput => ({
  key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, target: null, ...mods,
})

describe('matchShortcut', () => {
  it.each([
    [key('Delete'), 'delete'],
    [key('Backspace'), 'delete'],
    [key('d', { metaKey: true }), 'duplicate'],
    [key('g', { ctrlKey: true }), 'group'],
    [key('G', { ctrlKey: true, shiftKey: true }), 'ungroup'],
    [key('z', { metaKey: true }), 'undo'],
    [key('z', { metaKey: true, shiftKey: true }), 'redo'],
    [key('y', { ctrlKey: true }), 'redo'],
    [key('h'), 'toggleHole'],
    [key('m'), 'toolMove'],
    [key('r'), 'toolRotate'],
    [key('s'), 'toolSize'],
    [key('Escape'), 'clearSelection'],
  ] as const)('%o → %s', (input, expected) => {
    expect(matchShortcut(input)).toBe(expected)
  })

  it('ignores keys while typing in a field', () => {
    expect(matchShortcut(key('Backspace', { target: { tagName: 'INPUT' } as unknown as EventTarget }))).toBeNull()
  })

  it('ignores unknown keys and Alt combos', () => {
    expect(matchShortcut(key('q'))).toBeNull()
    expect(matchShortcut(key('h', { altKey: true }))).toBeNull()
    expect(matchShortcut(key('q', { ctrlKey: true }))).toBeNull()
  })
})

describe('runShortcut', () => {
  it('calls the matching action', () => {
    const actions = {
      deleteSelection: vi.fn(), duplicateSelection: vi.fn(), groupSelection: vi.fn(), ungroupSelection: vi.fn(),
      undo: vi.fn(), redo: vi.fn(), toggleHole: vi.fn(), setTool: vi.fn(), clearSelection: vi.fn(),
      addShape: vi.fn(), selectNode: vi.fn(), setGridSnap: vi.fn(),
    } satisfies Actions
    runShortcut('toolRotate', actions)
    runShortcut('group', actions)
    expect(actions.setTool).toHaveBeenCalledWith('rotate')
    expect(actions.groupSelection).toHaveBeenCalledOnce()
  })
})
```

`src/app/export.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import { createBloKadeStore } from '../store/store'
import { exportDesign } from './export'

const store = () => createBloKadeStore({ designId: 'd', doc: createEmptyDocument('Phone Stand') })

describe('exportDesign', () => {
  it('downloads the export with a friendly file name', async () => {
    const download = vi.fn()
    const data = new ArrayBuffer(84)
    const client = { exportStl: vi.fn().mockResolvedValue(data), export3mf: vi.fn() }
    await exportDesign({ client, store: store(), format: 'stl', download })
    expect(client.exportStl).toHaveBeenCalledWith(expect.objectContaining({ name: 'Phone Stand' }), undefined)
    expect(download).toHaveBeenCalledWith(data, 'phone-stand.stl', 'model/stl')
  })

  it('exports only the selection when something is selected', async () => {
    const s = store()
    const client = { exportStl: vi.fn(), export3mf: vi.fn().mockResolvedValue(new ArrayBuffer(1)) }
    s.setState({ selection: ['a'] })
    await exportDesign({ client, store: s, format: '3mf', download: vi.fn() })
    expect(client.export3mf).toHaveBeenCalledWith(expect.anything(), ['a'])
  })

  it('shows export problems as a notice', async () => {
    const s = store()
    const client = { exportStl: vi.fn().mockRejectedValue(new Error("There's nothing to export.")), export3mf: vi.fn() }
    await exportDesign({ client, store: s, format: 'stl', download: vi.fn() })
    expect(s.getState().notice).toBe("There's nothing to export.")
  })
})
```

`src/ui/Toolbar.test.tsx`:
```tsx
// @vitest-environment jsdom
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createActions } from '../app/actions'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument } from '../document/factory'
import { registry } from '../plugins/index'
import { createBloKadeStore } from '../store/store'
import { Toolbar } from './Toolbar'

function setup() {
  const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument('My Robot') })
  const actions = createActions(store, registry)
  const onExport = vi.fn()
  const onOpenDesigns = vi.fn()
  renderWithStore(<Toolbar actions={actions} onExport={onExport} onOpenDesigns={onOpenDesigns} />, store)
  return { store, actions, onExport, onOpenDesigns, doc: () => store.getState().history.present }
}

describe('Toolbar', () => {
  it('enables buttons only when they can do something', () => {
    const { store, actions } = setup()
    expect(screen.getByTestId('undo')).toBeDisabled()
    expect(screen.getByTestId('group')).toBeDisabled()
    act(() => {
      actions.addShape('box')
      actions.addShape('box')
      store.getState().select(store.getState().history.present.root)
    })
    expect(screen.getByTestId('undo')).toBeEnabled()
    expect(screen.getByTestId('group')).toBeEnabled()
    expect(screen.getByTestId('ungroup')).toBeDisabled()
  })

  it('groups the selection', async () => {
    const { store, actions, doc } = setup()
    act(() => {
      actions.addShape('box')
      actions.addShape('box')
      store.getState().select(doc().root)
    })
    await userEvent.click(screen.getByTestId('group'))
    expect(doc().root).toHaveLength(1)
  })

  it('switches handle modes', async () => {
    const { store } = setup()
    await userEvent.click(screen.getByTestId('tool-size'))
    expect(store.getState().tool).toBe('size')
    expect(screen.getByTestId('tool-size')).toHaveAttribute('aria-pressed', 'true')
  })

  it('changes grid snap', async () => {
    const { doc } = setup()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Grid snap' }), '0.5')
    expect(doc().settings.gridSnap).toBe(0.5)
  })

  it('exports and opens the designs dialog', async () => {
    const { onExport, onOpenDesigns } = setup()
    await userEvent.click(screen.getByTestId('export-3mf'))
    await userEvent.click(screen.getByTestId('open-designs'))
    expect(onExport).toHaveBeenCalledWith('3mf')
    expect(onOpenDesigns).toHaveBeenCalledOnce()
    expect(screen.getByTestId('open-designs')).toHaveTextContent('My Robot')
  })
})
```

`src/ui/DesignsDialog.test.tsx`:
```tsx
// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument } from '../document/factory'
import { serializeDesign } from '../persistence/design-file'
import { createMemoryDesignRepository } from '../persistence/memory-repository'
import { createBloKadeStore } from '../store/store'
import { DesignsDialog } from './DesignsDialog'

async function setup(confirm = () => true) {
  let t = 0
  const repo = createMemoryDesignRepository({ now: () => ++t })
  await repo.save('other', createEmptyDocument('Other'))
  await repo.save('current', createEmptyDocument('Current'))
  const store = createBloKadeStore({ designId: 'current', doc: createEmptyDocument('Current') })
  const onClose = vi.fn()
  renderWithStore(<DesignsDialog repo={repo} flushAutosave={async () => undefined} onClose={onClose} confirm={confirm} />, store)
  await screen.findByText('Other')
  return { repo, store, onClose }
}

describe('DesignsDialog', () => {
  it('opens another design', async () => {
    const { store, onClose } = await setup()
    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    await waitFor(() => expect(store.getState().designId).toBe('other'))
    expect(store.getState().history.present.name).toBe('Other')
    expect(onClose).toHaveBeenCalled()
  })

  it('starts a new design', async () => {
    const { store, repo } = await setup()
    await userEvent.click(screen.getByRole('button', { name: 'New design' }))
    await waitFor(() => expect(store.getState().designId).not.toBe('current'))
    expect(await repo.list()).toHaveLength(3)
  })

  it('renames the current design', async () => {
    const { store } = await setup()
    const input = screen.getByTestId('design-name')
    await userEvent.clear(input)
    await userEvent.type(input, 'Rocket{Enter}')
    expect(store.getState().history.present.name).toBe('Rocket')
  })

  it('deletes another design after confirming', async () => {
    const confirm = vi.fn(() => true)
    const { repo } = await setup(confirm)
    await userEvent.click(screen.getByRole('button', { name: 'Delete Other' }))
    await waitFor(async () => expect((await repo.list()).map((d) => d.id)).toEqual(['current']))
    expect(confirm).toHaveBeenCalledWith('Delete "Other"? This can\'t be undone.')
  })

  it('keeps a design when deletion is not confirmed', async () => {
    const { repo } = await setup(() => false)
    await userEvent.click(screen.getByRole('button', { name: 'Delete Other' }))
    expect(await repo.list()).toHaveLength(2)
  })

  it('duplicates a design', async () => {
    await setup()
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate Other' }))
    expect(await screen.findByText('Other copy')).toBeInTheDocument()
  })

  it('loads a design file', async () => {
    const { store } = await setup()
    const file = new File([serializeDesign(createEmptyDocument('From File'))], 'from-file.blokade')
    fireEvent.change(screen.getByTestId('load-file'), { target: { files: [file] } })
    await waitFor(() => expect(store.getState().history.present.name).toBe('From File'))
  })

  it('explains a bad file', async () => {
    const { store } = await setup()
    const file = new File(['nope'], 'bad.blokade')
    fireEvent.change(screen.getByTestId('load-file'), { target: { files: [file] } })
    await waitFor(() => expect(store.getState().notice).toBe("This file isn't a BloKade design."))
    expect(store.getState().designId).toBe('current')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app src/ui`
Expected: FAIL, because the new modules are missing.

- [ ] **Step 3: Implement the app modules**

`src/app/shortcuts.ts`:
```ts
import { useEffect } from 'react'
import type { Actions } from './actions'

export type ShortcutAction =
  | 'delete' | 'duplicate' | 'group' | 'ungroup' | 'undo' | 'redo'
  | 'toggleHole' | 'toolMove' | 'toolRotate' | 'toolSize' | 'clearSelection'

export interface KeyInput {
  readonly key: string
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly shiftKey: boolean
  readonly altKey: boolean
  readonly target: EventTarget | null
}

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function isTypingTarget(target: EventTarget | null): boolean {
  if (typeof target !== 'object' || target === null) return false
  const element = target as { tagName?: unknown; isContentEditable?: unknown }
  return (typeof element.tagName === 'string' && TYPING_TAGS.has(element.tagName)) || element.isContentEditable === true
}

/** [without Shift, with Shift] for Ctrl/Cmd combos. */
const WITH_MODIFIER: Readonly<Record<string, readonly [ShortcutAction, ShortcutAction]>> = {
  z: ['undo', 'redo'],
  y: ['redo', 'redo'],
  d: ['duplicate', 'duplicate'],
  g: ['group', 'ungroup'],
}

const PLAIN: Readonly<Record<string, ShortcutAction>> = {
  delete: 'delete',
  backspace: 'delete',
  h: 'toggleHole',
  m: 'toolMove',
  r: 'toolRotate',
  s: 'toolSize',
  escape: 'clearSelection',
}

export function matchShortcut(input: KeyInput): ShortcutAction | null {
  if (input.altKey || isTypingTarget(input.target)) return null
  const key = input.key.toLowerCase()
  if (input.ctrlKey || input.metaKey) {
    const pair = WITH_MODIFIER[key]
    return pair ? pair[input.shiftKey ? 1 : 0] : null
  }
  return PLAIN[key] ?? null
}

export function runShortcut(action: ShortcutAction, actions: Actions): void {
  const table: Record<ShortcutAction, () => void> = {
    delete: actions.deleteSelection,
    duplicate: actions.duplicateSelection,
    group: actions.groupSelection,
    ungroup: actions.ungroupSelection,
    undo: actions.undo,
    redo: actions.redo,
    toggleHole: actions.toggleHole,
    toolMove: () => actions.setTool('move'),
    toolRotate: () => actions.setTool('rotate'),
    toolSize: () => actions.setTool('size'),
    clearSelection: actions.clearSelection,
  }
  table[action]()
}

export function useShortcuts(actions: Actions, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return undefined
    const onKeyDown = (event: KeyboardEvent): void => {
      const action = matchShortcut(event)
      if (!action) return
      event.preventDefault()
      runShortcut(action, actions)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [actions, enabled])
}
```

`src/app/download.ts`:
```ts
/** Hands bytes to the browser as a file download. */
export function downloadBytes(data: BlobPart, filename: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: mime }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
```

`src/app/export.ts`:
```ts
import type { GeometryClient } from '../geometry/client'
import { fileNameFor } from '../persistence/design-file'
import type { BloKadeStore } from '../store/store'
import { downloadBytes } from './download'

export type ExportFormat = 'stl' | '3mf'

const MIME: Record<ExportFormat, string> = { stl: 'model/stl', '3mf': 'model/3mf' }
const EXPORT_FAILED = "Export didn't work. Try again."

export async function exportDesign(input: {
  client: Pick<GeometryClient, 'exportStl' | 'export3mf'>
  store: BloKadeStore
  format: ExportFormat
  download?: (data: ArrayBuffer, filename: string, mime: string) => void
}): Promise<void> {
  const { history, selection, notify } = input.store.getState()
  const doc = history.present
  const ids = selection.length > 0 ? selection : undefined
  try {
    const data = input.format === 'stl'
      ? await input.client.exportStl(doc, ids)
      : await input.client.export3mf(doc, ids)
    const download = input.download ?? downloadBytes
    download(data, fileNameFor(doc, input.format), MIME[input.format])
  } catch (error) {
    notify(error instanceof Error && error.message ? error.message : EXPORT_FAILED)
  }
}
```

- [ ] **Step 4: Implement the UI**

`src/ui/Toolbar.tsx`:
```tsx
import type { Actions } from '../app/actions'
import type { ExportFormat } from '../app/export'
import { canRedo, canUndo } from '../history/history'
import { useBloKade } from '../store/context'
import type { ToolMode } from '../store/store'

const SNAP_OPTIONS = [
  { value: 1, label: '1 mm' },
  { value: 0.5, label: '0.5 mm' },
  { value: 0.1, label: '0.1 mm' },
  { value: 0, label: 'Off' },
] as const

const TOOLS: readonly { tool: ToolMode; label: string; key: string }[] = [
  { tool: 'move', label: '✥ Move', key: 'M' },
  { tool: 'rotate', label: '⟳ Rotate', key: 'R' },
  { tool: 'size', label: '⤢ Size', key: 'S' },
]

interface ToolbarProps {
  actions: Actions
  onExport(format: ExportFormat): void
  onOpenDesigns(): void
}

export function Toolbar({ actions, onExport, onOpenDesigns }: ToolbarProps) {
  const undoable = useBloKade((s) => canUndo(s.history))
  const redoable = useBloKade((s) => canRedo(s.history))
  const count = useBloKade((s) => s.selection.length)
  const tool = useBloKade((s) => s.tool)
  const gridSnap = useBloKade((s) => s.history.present.settings.gridSnap)
  const designName = useBloKade((s) => s.history.present.name)

  return (
    <header className="toolbar">
      <span className="brand">BloKade</span>
      <button type="button" className="tool-button" data-testid="open-designs" onClick={onOpenDesigns}>📁 {designName}</button>
      <div className="toolbar-group">
        <button type="button" className="tool-button" data-testid="undo" title="Undo (Ctrl+Z)" disabled={!undoable} onClick={actions.undo}>↶ Undo</button>
        <button type="button" className="tool-button" data-testid="redo" title="Redo (Ctrl+Shift+Z)" disabled={!redoable} onClick={actions.redo}>↷ Redo</button>
      </div>
      <div className="toolbar-group">
        <button type="button" className="tool-button" data-testid="group" title="Group (Ctrl+G)" disabled={count < 2} onClick={actions.groupSelection}>Group</button>
        <button type="button" className="tool-button" data-testid="ungroup" title="Ungroup (Ctrl+Shift+G)" disabled={count !== 1} onClick={actions.ungroupSelection}>Ungroup</button>
        <button type="button" className="tool-button" data-testid="duplicate" title="Duplicate (Ctrl+D)" disabled={count === 0} onClick={actions.duplicateSelection}>Duplicate</button>
        <button type="button" className="tool-button" data-testid="delete" title="Delete (Del)" disabled={count === 0} onClick={actions.deleteSelection}>Delete</button>
      </div>
      <div className="toolbar-group" role="group" aria-label="Handle mode">
        {TOOLS.map(({ tool: t, label, key }) => (
          <button key={t} type="button" className="tool-button" data-testid={`tool-${t}`} title={`${label.slice(2)} (${key})`}
            aria-pressed={tool === t} onClick={() => actions.setTool(t)}>{label}</button>
        ))}
      </div>
      <label className="toolbar-group">
        Snap
        <select aria-label="Grid snap" value={gridSnap} onChange={(event) => actions.setGridSnap(Number(event.target.value))}>
          {SNAP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <div className="toolbar-group">
        <button type="button" className="tool-button" data-testid="export-stl" onClick={() => onExport('stl')}>⬇ STL</button>
        <button type="button" className="tool-button" data-testid="export-3mf" onClick={() => onExport('3mf')}>⬇ 3MF</button>
      </div>
    </header>
  )
}
```

`src/ui/DesignsDialog.tsx`:
```tsx
import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { downloadBytes } from '../app/download'
import { createEmptyDocument, newId } from '../document/factory'
import { renameDocument } from '../document/ops'
import type { BloKadeDocument } from '../document/types'
import { STORAGE_UNAVAILABLE } from '../persistence/bootstrap'
import { fileNameFor, parseDesignFile, serializeDesign } from '../persistence/design-file'
import { duplicateDesign, type DesignRepository, type DesignSummary } from '../persistence/repository'
import { useBloKade, useBloKadeStore } from '../store/context'
import { TextField } from './NumberField'

interface DesignsDialogProps {
  repo: DesignRepository
  flushAutosave(): Promise<void>
  onClose(): void
  confirm?(message: string): boolean
}

function useDesignActions({ repo, flushAutosave, onClose, confirm }: Required<DesignsDialogProps>) {
  const store = useBloKadeStore()
  const [designs, setDesigns] = useState<readonly DesignSummary[]>([])
  const notify = useCallback((message: string) => store.getState().notify(message), [store])
  const guarded = useCallback(async (task: () => Promise<void>): Promise<void> => {
    try {
      await task()
    } catch (error) {
      console.error('Design storage failed', error)
      notify(STORAGE_UNAVAILABLE)
    }
  }, [notify])
  const refresh = useCallback(() => guarded(async () => {
    await flushAutosave()
    setDesigns(await repo.list())
  }), [guarded, flushAutosave, repo])
  useEffect(() => void refresh(), [refresh])

  const open = async (id: string, doc: BloKadeDocument): Promise<void> => {
    await flushAutosave()
    store.getState().openDesign(id, doc)
    await repo.setLastOpened(id)
    onClose()
  }
  const createNew = async (): Promise<void> => {
    const fresh = { id: newId(), doc: createEmptyDocument() }
    await repo.save(fresh.id, fresh.doc)
    await open(fresh.id, fresh.doc)
  }
  const openExisting = async (id: string): Promise<void> => {
    const loaded = await repo.load(id)
    if (loaded.ok) await open(id, loaded.value)
    else notify(loaded.error)
  }
  const remove = async (summary: DesignSummary): Promise<void> => {
    if (!confirm(`Delete "${summary.name}"? This can't be undone.`)) return
    await flushAutosave()
    await repo.remove(summary.id)
    if (summary.id !== store.getState().designId) return refresh()
    const next = (await repo.list())[0]
    return next ? openExisting(next.id) : createNew()
  }
  const duplicate = async (id: string): Promise<void> => {
    await flushAutosave()
    const copied = await duplicateDesign(repo, id)
    if (!copied.ok) notify(copied.error)
    await refresh()
  }
  const loadFile = async (file: File): Promise<void> => {
    const parsed = parseDesignFile(await file.text())
    if (!parsed.ok) return notify(parsed.error)
    const id = newId()
    await repo.save(id, parsed.value)
    await open(id, parsed.value)
  }

  return {
    designs,
    createNew: () => guarded(createNew),
    openExisting: (id: string) => guarded(() => openExisting(id)),
    remove: (summary: DesignSummary) => guarded(() => remove(summary)),
    duplicate: (id: string) => guarded(() => duplicate(id)),
    loadFile: (file: File) => guarded(() => loadFile(file)),
  }
}

export function DesignsDialog({ repo, flushAutosave, onClose, confirm = (m) => window.confirm(m) }: DesignsDialogProps) {
  const store = useBloKadeStore()
  const currentId = useBloKade((s) => s.designId)
  const currentName = useBloKade((s) => s.history.present.name)
  const actions = useDesignActions({ repo, flushAutosave, onClose, confirm })

  const saveToFile = (): void => {
    const doc = store.getState().history.present
    downloadBytes(serializeDesign(doc), fileNameFor(doc, 'blokade'), 'application/json')
  }
  const onFileChosen = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    if (file) void actions.loadFile(file)
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Designs" onClick={(event) => event.stopPropagation()}>
        <h2>Designs</h2>
        <TextField label="This design's name" value={currentName} testId="design-name"
          onCommit={(name) => store.getState().apply((d) => renameDocument(d, name))} />
        <ul className="design-list">
          {actions.designs.map((design) => {
            const isCurrent = design.id === currentId
            const name = isCurrent ? currentName : design.name
            return (
              <li key={design.id} className={isCurrent ? 'current' : undefined}>
                <span className="design-name">{name}</span>
                {!isCurrent && <button type="button" className="tool-button" onClick={() => void actions.openExisting(design.id)}>Open</button>}
                <button type="button" className="tool-button" aria-label={`Duplicate ${name}`} onClick={() => void actions.duplicate(design.id)}>Duplicate</button>
                <button type="button" className="tool-button" aria-label={`Delete ${name}`} onClick={() => void actions.remove(design)}>Delete</button>
              </li>
            )
          })}
        </ul>
        <div className="dialog-actions">
          <button type="button" className="tool-button" onClick={() => void actions.createNew()}>New design</button>
          <button type="button" className="tool-button" onClick={saveToFile}>Save to file</button>
          <label className="tool-button">
            Load from file
            <input type="file" accept=".blokade,application/json" hidden data-testid="load-file" onChange={onFileChosen} />
          </label>
          <button type="button" className="tool-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
```

`src/ui/Workspace.tsx` (final version for Milestone 1):
```tsx
import { useMemo, useState } from 'react'
import { createActions } from '../app/actions'
import type { AppDeps } from '../app/deps'
import { exportDesign, type ExportFormat } from '../app/export'
import { useShortcuts } from '../app/shortcuts'
import { useAutosave } from '../app/useAutosave'
import { useGeometrySync } from '../app/useGeometrySync'
import { useBloKadeStore } from '../store/context'
import { Viewport } from '../viewport/Viewport'
import { DesignsDialog } from './DesignsDialog'
import { PropertiesPanel } from './PropertiesPanel'
import { SceneTree } from './SceneTree'
import { ShapePalette } from './ShapePalette'
import { Toasts } from './Toasts'
import { Toolbar } from './Toolbar'

export function Workspace({ deps }: { deps: AppDeps }) {
  const store = useBloKadeStore()
  const actions = useMemo(() => createActions(store, deps.registry), [store, deps.registry])
  const [showDesigns, setShowDesigns] = useState(false)
  useGeometrySync(store, deps.client)
  const flushAutosave = useAutosave(store, deps.repo)
  useShortcuts(actions, !showDesigns)
  const onExport = (format: ExportFormat): void => void exportDesign({ client: deps.client, store, format })

  return (
    <div className="workspace">
      <Toolbar actions={actions} onExport={onExport} onOpenDesigns={() => setShowDesigns(true)} />
      <aside className="left-panel">
        <ShapePalette registry={deps.registry} onAdd={actions.addShape} />
        <SceneTree registry={deps.registry} />
      </aside>
      <main className="viewport" data-testid="viewport">
        <Viewport registry={deps.registry} />
      </main>
      <aside className="right-panel">
        <PropertiesPanel registry={deps.registry} />
      </aside>
      {showDesigns && <DesignsDialog repo={deps.repo} flushAutosave={flushAutosave} onClose={() => setShowDesigns(false)} />}
      <Toasts />
    </div>
  )
}
```

- [ ] **Step 5: Run the tests and type check**

Run: `npx vitest run && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Manual smoke check**

Run `npm run dev` and confirm:
- M, R, and S switch the handles.
- Ctrl/Cmd+Z undoes a drag.
- **⬇ STL** downloads `untitled-design.stl`, which opens in a slicer.
- **📁** opens Designs, where you can create, rename, switch, and delete designs.
- Reloading the page returns to the same design.

Stop the server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add toolbar, keyboard shortcuts, export and designs dialog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: End-to-end tests (Playwright)

**Files:**
- Create: `playwright.config.ts`, `e2e/first-print.spec.ts`

**Interfaces:**
- Consumes: the test ids and accessible names from Tasks 12–17: `add-<id>`, `param-<key>`, `mode-hole`, the `treeitem` names, `group`, `export-stl`, and `role="alert"`.

- [ ] **Step 1: Install the browser**

Run: `npx playwright install chromium`
Expected: Chromium downloads, or is reported as already installed.

- [ ] **Step 2: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:5199',
    trace: 'retain-on-failure',
    // Headless Chromium has no GPU; force software WebGL so the 3D view renders.
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

- [ ] **Step 3: Write the failing E2E test `e2e/first-print.spec.ts`**

```ts
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('Kade builds a box with a hole, exports it, and finds it again after reloading', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('add-box').click()
  await page.getByTestId('param-width').fill('40')
  await page.getByTestId('param-width').press('Enter')

  await page.getByTestId('add-cylinder').click()
  await page.getByTestId('mode-hole').click()

  await page.getByRole('treeitem', { name: 'Box' }).click()
  await page.getByRole('treeitem', { name: 'Cylinder' }).click({ modifiers: ['Shift'] })
  await page.getByTestId('group').click()
  await expect(page.getByRole('treeitem', { name: 'Group' })).toBeVisible()
  await expect(page.getByText('Warming up the geometry engine…')).toBeHidden()

  const downloading = page.waitForEvent('download')
  await page.getByTestId('export-stl').click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('untitled-design.stl')
  const bytes = await readFile(await download.path())
  const triangles = bytes.readUInt32LE(80)
  expect(triangles).toBeGreaterThan(12)
  expect(bytes.length).toBe(84 + triangles * 50)

  await page.waitForTimeout(1500) // autosave runs 1 s after the last change
  await page.reload()
  await expect(page.getByRole('treeitem', { name: 'Group' })).toBeVisible()
})

test('a shape that cannot be built shows a friendly warning', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('add-torus').click()
  await page.getByTestId('param-thickness').fill('30')
  await page.getByTestId('param-thickness').press('Enter')
  await expect(page.getByRole('alert')).toContainText('Make the ring wider than twice its thickness.')
  await expect(page.getByRole('treeitem', { name: 'Ring' })).toBeVisible()
})
```

- [ ] **Step 4: Run the E2E tests**

Run: `npm run e2e`
Expected: 2 passed. If a test fails, open the trace with `npx playwright show-trace test-results/**/trace.zip`. If the worker fails to load the WASM in dev mode, confirm `optimizeDeps.exclude` in `vite.config.ts` and that `src/geometry/oc-browser.ts` imports `'replicad-opencascadejs/wasm?url'`. Fix the cause; don't weaken the test.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e
git commit -m "test: add end-to-end first-print and friendly-error flows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 19: Docker, README, and final verification

**Files:**
- Create: `Dockerfile`, `nginx.conf`, `docker-compose.yml`, `.dockerignore`, `README.md`

**Interfaces:**
- Produces: `docker compose up -d --build` serves BloKade on port 8080. `.wasm` is served as `application/wasm`, hashed assets are cached for a year, and `index.html` is never cached.

- [ ] **Step 1: Write the Docker files**

`.dockerignore`:
```
node_modules
dist
coverage
playwright-report
test-results
.git
```

`Dockerfile`:
```dockerfile
# Build the static app
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve it with nginx
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ >/dev/null || exit 1
```

`nginx.conf`:
```nginx
server {
  listen 80;
  root /usr/share/nginx/html;

  gzip on;
  gzip_types application/wasm application/javascript text/css application/json;

  # OpenCascade engine: must be served as application/wasm for streaming compile.
  location ~* \.wasm$ {
    default_type application/wasm;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  # Vite puts content-hashed files here, so they can be cached forever.
  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
  }

  location / {
    add_header Cache-Control "no-cache";
    try_files $uri /index.html;
  }
}
```

`docker-compose.yml`:
```yaml
services:
  blokade:
    build: .
    image: blokade:latest
    ports:
      - "8080:80"
    restart: unless-stopped
```

- [ ] **Step 2: Build and check the container**

```bash
docker compose up -d --build
```

```bash
curl -fsS -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:8080/
```
Expected: `200 text/html`

```bash
WASM=$(docker compose exec -T blokade sh -c 'ls /usr/share/nginx/html/assets | grep "\.wasm$"') && curl -fsS -o /dev/null -w "%{http_code} %{content_type}\n" "http://localhost:8080/assets/$WASM"
```
Expected: `200 application/wasm`

Then open `http://localhost:8080` in a browser, add a box, and export an STL. Stop it afterwards:

```bash
docker compose down
```

- [ ] **Step 3: Write `README.md`**

````markdown
# BloKade

Kade's 3D design app for 3D printing. It's as easy as TinkerCAD, and it's built so we can keep adding to it.

## Run it

**On the home server (Docker):**

```bash
docker compose up -d --build
```

Then open `http://<server-name>:8080`. Designs are saved in each browser automatically.
Use **📁 → Save to file** to back them up or move them to another computer.

**For development:**

```bash
npm install
npm run dev
```

## Test it

```bash
npm test              # unit + geometry tests
npm run coverage      # with coverage report (80% minimum)
npx playwright install chromium
npm run e2e           # end-to-end tests in a real browser
```

## Using BloKade

| Keys | What it does |
|---|---|
| M / R / S | Move / rotate / size handles |
| Shift (while dragging) | Turn snapping off |
| H | Switch between solid and hole |
| Ctrl/Cmd + G | Group (holes cut out of solids) |
| Ctrl/Cmd + Shift + G | Ungroup |
| Ctrl/Cmd + D | Duplicate |
| Delete | Delete |
| Ctrl/Cmd + Z / Shift + Z | Undo / redo |
| Esc | Deselect |

## How it's built

- `src/document`: the design "recipe" (shapes, groups, transforms) and immutable edits
- `src/plugins`: every shape is a plugin; the built-in ones are in `builtin/`
- `src/geometry`: the OpenCascade engine (in a Web Worker) that turns the recipe into solids, meshes, and STL/3MF files
- `src/viewport`: the 3D view (Three.js)
- `src/ui`, `src/app`: panels, toolbar, shortcuts, and wiring
- `src/persistence`: autosave, design files, and the designs list

Design spec: `docs/superpowers/specs/2026-10-11-blokade-design.md`.

## Making your own shapes

See [`plugins/README.md`](plugins/README.md). The full plugin guide arrives in Milestone 5.
````

- [ ] **Step 4: Run the full verification**

Run each command, and don't continue until each one is green:

```bash
npm run typecheck
```

```bash
npm run coverage
```
Expected: all tests pass, and the coverage thresholds (lines/statements/functions ≥ 80%, branches ≥ 75%) are met. If a threshold fails, add tests for the uncovered logic. Don't lower the thresholds.

```bash
npm run build
```

```bash
npm run e2e
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add Docker deployment, README and final checks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Milestone 1 Done When

- [ ] Every task above is checked off, and all commits are made.
- [ ] `npm run typecheck`, `npm run coverage`, `npm run build`, and `npm run e2e` all pass.
- [ ] The Docker container serves the app on port 8080 and an exported STL opens in Kade's slicer.
- [ ] **Kade test:** Kade designs and prints a small part in BloKade (for example a box with a hole and a peg) without using TinkerCAD. Write down what confused him, because that's input for Milestone 2.
