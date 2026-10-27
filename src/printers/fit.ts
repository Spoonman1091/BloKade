import type { Box } from '../document/box'
import type { Mode, NodeId } from '../document/types'
import type { Printer } from './printers'

/** A top-level part's world box. */
export interface PartBox {
  readonly id: NodeId
  readonly name: string
  readonly mode: Mode
  readonly box: Box
}

export interface Misfit {
  readonly id: NodeId
  readonly name: string
  readonly offPlate: boolean
  readonly tooTall: boolean
}

/** Rounding slack, so a part that exactly touches the edge still fits. */
const EPS = 1e-6

function offPlate(box: Box, printer: Printer): boolean {
  const [width, depth] = printer.size
  return box.min[0] < -width / 2 - EPS || box.max[0] > width / 2 + EPS
    || box.min[1] < -depth / 2 - EPS || box.max[1] > depth / 2 + EPS
}

/** The slicer sets each part down on the bed, so only its own height counts. */
const tooTall = (box: Box, printer: Printer): boolean => box.max[2] - box.min[2] > printer.size[2] + EPS

/** Solid parts that hang off the printer's plate or are too tall for it. Holes are never printed, so they're skipped. */
export function misfits(parts: readonly PartBox[], printer: Printer | null): readonly Misfit[] {
  if (!printer) return []
  return parts.flatMap((part) => {
    if (part.mode !== 'solid') return []
    const off = offPlate(part.box, printer)
    const tall = tooTall(part.box, printer)
    return off || tall ? [{ id: part.id, name: part.name, offPlate: off, tooTall: tall }] : []
  })
}

/** The warning above the 3D view, or null when everything fits. `**…**` marks bold text. */
export function fitWarning(found: readonly Misfit[], printer: Printer): string | null {
  const [only] = found
  if (!only) return null
  const main = found.length === 1
    ? `**${only.name}** doesn't fit on the ${printer.name}. Move it onto the plate or make it smaller.`
    : `${found.length} parts don't fit on the ${printer.name}. Move them onto the plate or make them smaller.`
  const tall = found.length === 1 && only.tooTall ? ` It's taller than ${printer.size[2]} mm.` : ''
  return main + tall
}
