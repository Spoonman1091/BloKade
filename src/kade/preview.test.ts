import { describe, expect, it, vi } from 'vitest'
import { fakeGeometryApi } from '../app/testing/fakes'
import { boxMesh } from '../app/testing/meshes'
import { updateNode } from '../document/ops'
import { validateDocument } from '../document/schema'
import { GeometryClient } from '../geometry/client'
import type { GeometryApi } from '../geometry/types'
import { createEditorStore } from './editor-store'
import { createMemoryShapeLibrary, type LibraryShape } from './library'
import { TOO_LONG } from './messages'
import {
  createPreviewStatus, createPreviewStore, followSelectedShape, previewDocument, PREVIEW_ID, PREVIEW_PROBLEM, showShape, syncPreview,
} from './preview'

const gear: LibraryShape = { id: 'my-gear', name: 'Gear', code: "export default { name: 'Gear' }", updatedAt: 1 }
const flush = () => new Promise((r) => setTimeout(r, 0))
const clientWith = (overrides: Partial<GeometryApi>, timeoutMs?: number) =>
  new GeometryClient(() => ({ api: fakeGeometryApi(overrides), terminate: () => undefined }), timeoutMs)

describe('the preview design', () => {
  it('is a valid one-part design that carries the shape', () => {
    const doc = previewDocument(gear, { size: 30 })
    expect(validateDocument(doc).ok).toBe(true)
    expect(doc.plugins).toEqual({ 'my-gear': { name: 'Gear', code: gear.code } })
    expect(doc.nodes[PREVIEW_ID]).toMatchObject({ shapeType: 'my-gear', params: { size: 30 } })
  })
  it('opens a new shape fresh, and keeps the settings Kade is trying when the code changes', () => {
    const store = createPreviewStore()
    showShape(store, gear)
    expect(store.getState().designId).toBe('my-gear')
    store.getState().apply((d) => updateNode(d, PREVIEW_ID, (n) => (n.kind === 'shape' ? { ...n, params: { size: 30 } } : n)))
    showShape(store, { ...gear, code: 'new code' })
    const doc = store.getState().history.present
    expect(doc.plugins['my-gear']?.code).toBe('new code')
    expect(doc.nodes[PREVIEW_ID]).toMatchObject({ params: { size: 30 } })
    const before = store.getState().history.present
    showShape(store, { ...gear, code: 'new code' })
    expect(store.getState().history.present).toBe(before)
  })
  it('follows the shape selected in the editor', () => {
    const editor = createEditorStore(createMemoryShapeLibrary())
    const store = createPreviewStore()
    const stop = followSelectedShape(editor, store)
    const made = editor.getState().create()
    expect(store.getState().designId).toBe(made.id)
    stop()
  })
})

describe('building the preview', () => {
  it('shows the build and remembers which code it was for', async () => {
    const store = createPreviewStore()
    const status = createPreviewStatus()
    const client = clientWith({ rebuild: async () => ({ nodes: { [PREVIEW_ID]: { status: 'ok', mesh: boxMesh(10, 10, 10) } } }) })
    const stop = syncPreview(store, client, status)
    showShape(store, gear)
    await flush()
    expect(store.getState().meshes[PREVIEW_ID]).toBeDefined()
    expect(status.getState().builtFor).toEqual({ shapeId: 'my-gear', code: gear.code })
    stop()
  })
  it('builds on the preview channel', async () => {
    const rebuild = vi.fn(async () => ({ nodes: {} }))
    const store = createPreviewStore()
    const stop = syncPreview(store, clientWith({ rebuild }), createPreviewStatus())
    showShape(store, gear)
    await flush()
    expect(rebuild).toHaveBeenCalledWith(expect.objectContaining({ name: 'Gear' }), 'preview')
    stop()
  })
  it('puts the loop message on the part when the build never finishes (Review Focus 1)', async () => {
    const store = createPreviewStore()
    const status = createPreviewStatus()
    const stop = syncPreview(store, clientWith({ rebuild: () => new Promise(() => undefined) }, 20), status)
    showShape(store, gear)
    await vi.waitFor(() => expect(store.getState().errors[PREVIEW_ID]).toBe(TOO_LONG))
    expect(status.getState().builtFor).toEqual({ shapeId: 'my-gear', code: gear.code })
    stop()
  })
  it('explains any other failure', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const store = createPreviewStore()
    const stop = syncPreview(store, clientWith({ rebuild: async () => { throw new Error('boom') } }), createPreviewStatus())
    showShape(store, gear)
    await vi.waitFor(() => expect(store.getState().errors[PREVIEW_ID]).toBe(PREVIEW_PROBLEM))
    stop()
    error.mockRestore()
  })
})
