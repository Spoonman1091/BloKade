import type { ImportUnit } from '../app/import-stl'
import { TOO_MANY_MESSAGE, UNEXPECTED_MESSAGE } from './constants'
import { findBaseThickness, placeCuts } from './cut-plan'
import { JOINT_RESERVE, planGrid } from './grid'
import { loadManifold } from './manifold'
import { openModel, type OpenModel } from './model'
import { makePieces } from './pieces'
import { SplitProblem } from './problem'
import { zipPieces } from './save'
import type { GridPlan, ModelInfo, PiecesResult, Plate, SplitResult, SplitSettings } from './types'

export interface ModelPreview { readonly vertices: Float32Array; readonly triangles: Uint32Array }
export type OpenedModel = ModelInfo & { readonly preview: ModelPreview }

export interface SplitApi {
  open(bytes: ArrayBuffer, unit: ImportUnit): Promise<SplitResult<OpenedModel>>
  plan(plate: Plate, settings: SplitSettings): Promise<SplitResult<{ readonly grid: GridPlan; readonly baseThickness: number | null }>>
  pieces(plan: GridPlan, settings: SplitSettings, plate: Plate): Promise<SplitResult<PiecesResult>>
  save(name: string): Promise<SplitResult<Uint8Array>>
}

const fail = <T>(message: string): SplitResult<T> => ({ ok: false, message })

/** Anything we did not expect becomes the plain message; the real error is logged. */
function unexpected<T>(error: unknown): SplitResult<T> {
  if (error instanceof SplitProblem) return fail(error.message)
  console.error('Split for printing failed:', error)
  return fail(UNEXPECTED_MESSAGE)
}

function previewOf(model: OpenModel): ModelPreview {
  const mesh = model.solid.getMesh()
  const { numProp, vertProperties, triVerts } = mesh
  const count = vertProperties.length / numProp
  const vertices = Float32Array.from({ length: count * 3 }, (_, i) => vertProperties[Math.floor(i / 3) * numProp + (i % 3)] ?? 0)
  return { vertices, triangles: Uint32Array.from(triVerts) }
}

/** The split tool's work, in one place. Holds the open model and the last pieces (for Save). */
export function createSplitApi(onProgress: (done: number, total: number) => void): SplitApi {
  let model: OpenModel | null = null
  let made: PiecesResult | null = null

  const release = (): void => {
    model?.solid.delete()
    model = null
    made = null
  }

  return {
    async open(bytes, unit) {
      release()
      try {
        const wasm = await loadManifold()
        const opened = openModel(wasm, bytes, unit)
        if (!opened.ok) return opened
        model = opened.value
        return { ok: true, value: { ...opened.value.info, preview: previewOf(opened.value) } }
      } catch (error) {
        return unexpected(error)
      }
    },

    async plan(plate, settings) {
      try {
        if (!model) throw new Error('plan called before a model was opened')
        const reserve = JOINT_RESERVE[settings.joint]
        const grid = planGrid(model.info.size[0], model.info.size[1], plate, reserve)
        if (!grid) return fail(TOO_MANY_MESSAGE)
        const baseThickness = findBaseThickness(model.solid)
        const wasm = await loadManifold()
        return { ok: true, value: { grid: placeCuts(wasm, model.solid, grid, baseThickness, { plate, reserve }), baseThickness } }
      } catch (error) {
        return unexpected(error)
      }
    },

    async pieces(plan, settings, plate) {
      try {
        if (!model) throw new Error('pieces called before a model was opened')
        made = null
        const wasm = await loadManifold()
        const result = makePieces(wasm, model, plan, settings, plate, onProgress)
        made = result
        return { ok: true, value: result }
      } catch (error) {
        return unexpected(error)
      }
    },

    async save(name) {
      try {
        if (!made) throw new Error('save called before pieces were made')
        return { ok: true, value: zipPieces(name, made.pieces) }
      } catch (error) {
        return unexpected(error)
      }
    },
  }
}
