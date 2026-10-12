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
