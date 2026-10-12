import { DocumentOpError } from '../document/ops'
import { MAX_CARRIED_SHAPES, type BloKadeDocument, type CarriedShape } from '../document/types'
import type { LibraryShape } from './library'

export const TOO_MANY_SHAPES = `A design can carry up to ${MAX_CARRIED_SHAPES} of your shapes. Try a new design for more.`

/** Copies one of Kade's shapes into the design. A shape the design already carries keeps its version. */
export function carryShape(doc: BloKadeDocument, id: string, shape: CarriedShape): BloKadeDocument {
  if (Object.hasOwn(doc.plugins, id)) return doc
  if (Object.keys(doc.plugins).length >= MAX_CARRIED_SHAPES) throw new DocumentOpError(TOO_MANY_SHAPES)
  return { ...doc, plugins: { ...doc.plugins, [id]: { name: shape.name, code: shape.code } } }
}

/** Library shapes whose code differs from the version this design carries. */
export function outdatedShapes(doc: BloKadeDocument, library: readonly LibraryShape[]): LibraryShape[] {
  return library.filter((shape) => Object.hasOwn(doc.plugins, shape.id) && doc.plugins[shape.id]?.code !== shape.code)
}

/** The design with the library's newest code for every outdated shape (one undo step when applied once). */
export function withNewestVersions(doc: BloKadeDocument, library: readonly LibraryShape[]): BloKadeDocument {
  const outdated = outdatedShapes(doc, library)
  if (outdated.length === 0) return doc
  const newest = Object.fromEntries(outdated.map((shape) => [shape.id, { name: shape.name, code: shape.code }]))
  return { ...doc, plugins: { ...doc.plugins, ...newest } }
}
