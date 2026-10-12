import { createStore, type StoreApi } from 'zustand/vanilla'
import { createEmptyDocument, createShapeNode, pickColor } from '../document/factory'
import type { BloKadeDocument, ParamValue } from '../document/types'
import { GeometryTimeoutError, type GeometryClient } from '../geometry/client'
import type { BuildResult } from '../geometry/types'
import { createBloKadeStore, type BloKadeStore } from '../store/store'
import { selectedShape, type EditorStore } from './editor-store'
import type { LibraryShape } from './library'
import { TOO_LONG } from './messages'

export const PREVIEW_ID = 'preview'
export const PREVIEW_PROBLEM = "The preview had a problem, so it can't update right now. Try reloading the page."

/** A one-part design that carries the shape, for the preview. Its id is the shape's id. */
export function previewDocument(shape: LibraryShape, params: Readonly<Record<string, ParamValue>> = {}): BloKadeDocument {
  const node = createShapeNode({ id: PREVIEW_ID, shapeType: shape.id, name: shape.name, params, color: pickColor(1) })
  return {
    ...createEmptyDocument(shape.name),
    root: [PREVIEW_ID],
    nodes: { [PREVIEW_ID]: node },
    plugins: { [shape.id]: { name: shape.name, code: shape.code } },
  }
}

/** The preview with the shape's newest code. The settings Kade is trying out stay. */
export function withPreviewCode(doc: BloKadeDocument, shape: LibraryShape): BloKadeDocument {
  return { ...doc, plugins: { [shape.id]: { name: shape.name, code: shape.code } } }
}

export const createPreviewStore = (): BloKadeStore => createBloKadeStore({ designId: '', doc: createEmptyDocument('Preview') })

/** Shows `shape`: a fresh preview for a different shape, or its newer code for the same one. */
export function showShape(store: BloKadeStore, shape: LibraryShape): void {
  const state = store.getState()
  if (state.designId !== shape.id) {
    state.openDesign(shape.id, previewDocument(shape))
    return
  }
  const plugins = state.history.present.plugins
  const carried = Object.hasOwn(plugins, shape.id) ? plugins[shape.id] : undefined
  if (carried?.code !== shape.code || carried.name !== shape.name) state.apply((doc) => withPreviewCode(doc, shape))
}

/** Keeps the preview on the editor's selected shape (its settled code). */
export function followSelectedShape(editor: EditorStore, preview: BloKadeStore): () => void {
  const show = (): void => {
    const shape = selectedShape(editor.getState())
    if (shape) showShape(preview, shape)
  }
  show()
  return editor.subscribe(show)
}

export interface PreviewStatusState {
  /** The shape and code the preview's latest build was for. */
  readonly builtFor: { readonly shapeId: string; readonly code: string } | null
  setBuilt(shapeId: string, code: string | null): void
}

export type PreviewStatusStore = StoreApi<PreviewStatusState>

export const createPreviewStatus = (): PreviewStatusStore => createStore<PreviewStatusState>()((set) => ({
  builtFor: null,
  setBuilt: (shapeId, code) => set({ builtFor: code === null ? null : { shapeId, code } }),
}))

/** A build result that puts a friendly message on the preview part. */
export function previewFailure(error: unknown): BuildResult {
  if (!(error instanceof GeometryTimeoutError)) console.error('Preview build failed', error)
  const message = error instanceof GeometryTimeoutError ? TOO_LONG : PREVIEW_PROBLEM
  return { nodes: { [PREVIEW_ID]: { status: 'error', message } } }
}

/** Rebuilds the preview on the 'preview' channel whenever its design changes. */
export function syncPreview(store: BloKadeStore, client: GeometryClient, status: PreviewStatusStore): () => void {
  const rebuild = (doc: BloKadeDocument, shapeId: string): void => {
    if (!shapeId) return
    const code = Object.hasOwn(doc.plugins, shapeId) ? doc.plugins[shapeId]?.code ?? null : null
    const done = (result: BuildResult): void => {
      store.getState().applyBuild(shapeId, result)
      status.getState().setBuilt(shapeId, code)
    }
    client.rebuild(doc, 'preview').then((result) => { if (result) done(result) }, (error: unknown) => done(previewFailure(error)))
  }
  const initial = store.getState()
  rebuild(initial.history.present, initial.designId)
  return store.subscribe((next, prev) => {
    if (next.history.present !== prev.history.present) rebuild(next.history.present, next.designId)
  })
}
