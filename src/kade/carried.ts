import { DocumentOpError, shapeIdsInUse } from '../document/ops'
import { MAX_CARRIED_SHAPES, type BloKadeDocument, type CarriedShape } from '../document/types'
import type { LibraryShape } from './library'

export const TOO_MANY_SHAPES = `A design can carry up to ${MAX_CARRIED_SHAPES} of your shapes. Try a new design for more.`

/**
 * Copies one of Kade's shapes into the design. A shape the design's parts already use keeps its version;
 * a copy no part uses is replaced by this one.
 */
export function carryShape(doc: BloKadeDocument, id: string, shape: CarriedShape): BloKadeDocument {
  const carried = Object.hasOwn(doc.plugins, id)
  if (carried && shapeIdsInUse(doc).has(id)) return doc
  if (!carried && Object.keys(doc.plugins).length >= MAX_CARRIED_SHAPES) throw new DocumentOpError(TOO_MANY_SHAPES)
  return { ...doc, plugins: { ...doc.plugins, [id]: { name: shape.name, code: shape.code } } }
}

/** The carried shapes the design's parts use. A copy no part uses is left out (adding the shape replaces it). */
export function carriedInUse(doc: BloKadeDocument): Record<string, CarriedShape> {
  const used = shapeIdsInUse(doc)
  return Object.fromEntries(Object.entries(doc.plugins).filter(([id]) => used.has(id)))
}

/**
 * Why one of Kade's shapes can't be added right now, by name, or null when it isn't one of theirs.
 * `newest` is the library's version of the shape.
 */
export function unaddableNotice(doc: BloKadeDocument, id: string, newest: CarriedShape | undefined): string | null {
  const copy = Object.hasOwn(carriedInUse(doc), id) ? doc.plugins[id] : undefined
  if (copy) {
    const fix = newest && newest.code !== copy.code ? 'Try the Use my newest version button.' : 'Fix it in 🧩 My shapes.'
    return `This design's copy of ${copy.name} has a problem. ${fix}`
  }
  return newest ? `${newest.name} isn't ready to add yet. Check it in 🧩 My shapes.` : null
}

/** Library shapes whose code differs from the version this design's parts use. */
export function outdatedShapes(doc: BloKadeDocument, library: readonly LibraryShape[]): LibraryShape[] {
  const used = shapeIdsInUse(doc)
  return library.filter((shape) => used.has(shape.id) && Object.hasOwn(doc.plugins, shape.id) && doc.plugins[shape.id]?.code !== shape.code)
}

/** The design with the library's newest code for every outdated shape (one undo step when applied once). */
export function withNewestVersions(doc: BloKadeDocument, library: readonly LibraryShape[]): BloKadeDocument {
  const outdated = outdatedShapes(doc, library)
  if (outdated.length === 0) return doc
  const newest = Object.fromEntries(outdated.map((shape) => [shape.id, { name: shape.name, code: shape.code }]))
  return { ...doc, plugins: { ...doc.plugins, ...newest } }
}
