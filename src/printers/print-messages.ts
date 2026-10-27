import type { PrintCheckResult } from '../geometry/types'
import type { Printer } from './printers'

export interface PrintMessage {
  readonly kind: 'floating' | 'thin' | 'overhang' | 'unfinished' | 'clear' | 'nothing'
  /** Text where **bold** marks the important words. */
  readonly text: string
}

const FLOATING_TAIL = 'above the plate. It would print in mid-air and fall over. Move it down so it touches the plate or another part.'
const THIN_TAIL = 'They may print broken or not at all. Make them thicker.'

/** What to tell Kade about a print check, most important first. */
export function printMessages(result: PrintCheckResult, printer: Printer | null): readonly PrintMessage[] {
  if (result.status === 'nothing') return [{ kind: 'nothing', text: "There's nothing to check. Add a solid shape." }]
  const found: PrintMessage[] = []
  if (result.floating) {
    const n = result.floating.amount
    found.push({ kind: 'floating', text: `**${n} ${n === 1 ? 'piece is' : 'pieces are'} floating** ${FLOATING_TAIL}` })
  }
  if (result.thin) {
    const limits = result.thin.veryThin ? 'less than 0.8 mm, and some less than 0.4 mm, too thin to print' : 'less than 0.8 mm'
    found.push({ kind: 'thin', text: `**Some walls are very thin** (${limits}). ${THIN_TAIL}` })
  }
  if (result.overhang) {
    found.push({
      kind: 'overhang',
      text: '**Some parts hang over empty space** (shown in orange). They need supports: turn on **Supports** in Bambu Studio, or turn the part so it rests on a flat side, or give the underside a slope.',
    })
  }
  if (!result.thinFinished) found.push({ kind: 'unfinished', text: "Couldn't finish the thin-wall check; the design is very detailed." })
  if (found.length > 0) return found
  return [{ kind: 'clear', text: printer ? `✅ Looks ready to print on the ${printer.name}.` : '✅ Looks ready to print.' }]
}
