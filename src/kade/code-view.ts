import { Matrix4 } from 'three'
import type { Box } from '../document/box'
import type { BloKadeStore } from '../store/store'
import { meshBox } from '../viewport/bounds'
import { resultFor, type ShapeCatalog } from './catalog'
import { selectedShape, type EditorStore } from './editor-store'
import type { LibraryShape } from './library'
import type { InspectResult, ShapeMeta } from './meta'
import { PREVIEW_ID, type PreviewStatusStore, type PreviewStatusState } from './preview'
import { findSyntaxProblem } from './syntax'

/** What Kade's code does right now. Coding lessons check this, never the screen. */
export interface CodeView {
  readonly shapeId: string | null
  /** The settled code (typing settles 500 ms after it stops). */
  readonly code: string
  /** Kade is still typing, so the checks below are about the code before. */
  readonly typing: boolean
  readonly syntaxOk: boolean
  /** The one problem to show: a syntax mistake, a definition problem, or a build error. */
  readonly problem: string | null
  /** The preview built this exact code without a problem. */
  readonly built: boolean
  /** The built part's size, when built. */
  readonly bounds: Box | null
  readonly meta: ShapeMeta | null
}

export interface CodeViewInput {
  readonly shape: LibraryShape | null
  readonly typing: boolean
  readonly inspect: InspectResult | undefined
  readonly builtFor: PreviewStatusState['builtFor']
  readonly bounds: Box | null
  readonly buildError: string | undefined
}

export function codeViewOf({ shape, typing, inspect, builtFor, bounds, buildError }: CodeViewInput): CodeView {
  const code = shape?.code ?? ''
  const syntax = shape ? findSyntaxProblem(code) : null
  const fresh = shape !== null && builtFor?.shapeId === shape.id && builtFor.code === code
  const inspectProblem = inspect && !inspect.ok ? inspect.problem : null
  const problem = syntax ?? inspectProblem ?? (fresh && buildError ? buildError : null)
  const built = fresh && problem === null && bounds !== null
  return {
    shapeId: shape?.id ?? null, code, typing, syntaxOk: syntax === null, problem, built,
    bounds: built ? bounds : null, meta: inspect?.ok ? inspect.meta : null,
  }
}

export interface CodeViewSources {
  readonly editor: EditorStore
  readonly catalog: ShapeCatalog
  readonly preview: BloKadeStore
  readonly status: PreviewStatusStore
}

export interface CodeViewSource {
  /** The same object until something it depends on changes. */
  read(): CodeView
  subscribe(listener: () => void): () => void
}

export function createCodeViewSource({ editor, catalog, preview, status }: CodeViewSources): CodeViewSource {
  let last: { readonly key: readonly unknown[]; readonly view: CodeView } | null = null
  const read = (): CodeView => {
    const e = editor.getState()
    const p = preview.getState()
    const shape = selectedShape(e)
    const key = [shape, e.drafts, catalog.getState().results, p.meshes, p.errors, p.designId, status.getState().builtFor]
    if (last && key.every((value, i) => value === last?.key[i])) return last.view
    const showing = shape !== null && p.designId === shape.id
    const displayed = showing && Object.hasOwn(p.meshes, PREVIEW_ID) ? p.meshes[PREVIEW_ID] : undefined
    const view = codeViewOf({
      shape,
      typing: shape !== null && Object.hasOwn(e.drafts, shape.id),
      inspect: shape ? resultFor(catalog.getState().results, shape.code) : undefined,
      builtFor: status.getState().builtFor,
      bounds: displayed && !displayed.stale ? meshBox(displayed.mesh.positions, new Matrix4()) : null,
      buildError: showing && Object.hasOwn(p.errors, PREVIEW_ID) ? p.errors[PREVIEW_ID] : undefined,
    })
    last = { key, view }
    return view
  }
  return {
    read,
    subscribe: (listener) => {
      const stops = [editor.subscribe(listener), catalog.subscribe(listener), preview.subscribe(listener), status.subscribe(listener)]
      return () => stops.forEach((stop) => stop())
    },
  }
}
