import { pickColor } from '../document/factory'
import { addImportedPart } from '../document/models'
import { DocumentOpError } from '../document/ops'
import type { Vec3 } from '../document/types'
import type { PreparedModel } from '../import/prepare'
import { MAX_MM } from '../plugins/params'
import type { BloKadeStore } from '../store/store'

export type ImportUnit = 'mm' | 'cm' | 'inches'

/** How many mm one unit of each kind is. */
export const UNIT_FACTORS: Readonly<Record<ImportUnit, number>> = { mm: 1, cm: 10, inches: 25.4 }

const MAX_NAME_LENGTH = 60
/** Sizes are kept to a millionth of a mm, so 3 × 25.4 stays 76.2. */
const ROUNDING = 1e6
const FALLBACK_NAME = 'Imported model'

/** The model's size in mm, if the file's numbers are in `unit`. */
export const sizeInMm = (size: Vec3, unit: ImportUnit): Vec3 => {
  const scaled = (side: number): number => Math.round(side * UNIT_FACTORS[unit] * ROUNDING) / ROUNDING
  return [scaled(size[0]), scaled(size[1]), scaled(size[2])]
}

/** True when no side is longer than BloKade allows. */
export const fitsBloKade = (size: Vec3): boolean => size.every((side) => side <= MAX_MM)

/** The file name without a final .stl, trimmed and cut to a sensible length. */
export function partNameFor(fileName: string): string {
  const name = fileName.replace(/\.stl$/i, '').trim().slice(0, MAX_NAME_LENGTH).trim()
  return name || FALLBACK_NAME
}

/** Adds the model as a new selected part, standing on the workplane, in one undo step. */
export function importPart(store: BloKadeStore, fileName: string, model: PreparedModel, unit: ImportUnit): void {
  const state = store.getState()
  const factor = UNIT_FACTORS[unit]
  const color = pickColor(Object.keys(state.history.present.nodes).length)
  try {
    const { doc, id } = addImportedPart(state.history.present, {
      name: partNameFor(fileName),
      vertices: model.vertices.map((v) => v * factor),
      triangles: model.triangles,
      size: sizeInMm(model.size, unit),
      color,
      position: state.workplane?.origin,
      rotation: state.workplane?.rotation,
    })
    state.apply(() => doc)
    state.select([id])
  } catch (error) {
    if (!(error instanceof DocumentOpError)) throw error
    state.notify(error.message)
  }
}
