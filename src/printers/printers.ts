import type { Vec3 } from '../document/types'
import type { KeyValueStorage } from '../learn/progress'

export interface Printer {
  readonly id: string
  readonly name: string
  /** Build size in mm: width × depth × height. */
  readonly size: Vec3
}

/** Build sizes from each maker's specs (checked October 2026). */
export const PRINTERS: readonly Printer[] = [
  { id: 'bambu-a1-mini', name: 'Bambu Lab A1 mini', size: [180, 180, 180] },
  { id: 'bambu-a1', name: 'Bambu Lab A1', size: [256, 256, 256] },
  { id: 'bambu-p1s', name: 'Bambu Lab P1S / X1 Carbon', size: [256, 256, 256] },
  { id: 'prusa-mini', name: 'Prusa MINI+', size: [180, 180, 180] },
  { id: 'prusa-mk4s', name: 'Prusa MK4S', size: [250, 210, 220] },
  { id: 'ender-3-v3-se', name: 'Creality Ender-3 V3 SE', size: [220, 220, 250] },
  { id: 'creality-k1c', name: 'Creality K1C', size: [220, 220, 250] },
  { id: 'neptune-4-pro', name: 'Elegoo Neptune 4 Pro', size: [225, 225, 265] },
]

/** Kade prints on an A1 mini, so every browser starts there. */
export const DEFAULT_PRINTER = 'bambu-a1-mini'
/** The endless grid, with no plate and no fit check. */
export const NO_PRINTER = 'none'
export const PRINTER_KEY = 'blokade.printer.v1'

export function printerById(id: string): Printer | null {
  return PRINTERS.find((p) => p.id === id) ?? null
}

export const printerLabel = (printer: Printer): string => `${printer.name} (${printer.size.join(' × ')} mm)`

const isKnown = (id: string): boolean => id === NO_PRINTER || printerById(id) !== null

/** The printer this browser picked last. Never throws: an unreadable or unknown choice means the A1 mini. */
export function loadPrinter(storage: KeyValueStorage | null): string {
  try {
    const saved = storage?.getItem(PRINTER_KEY) ?? null
    return saved !== null && isKnown(saved) ? saved : DEFAULT_PRINTER
  } catch {
    return DEFAULT_PRINTER
  }
}

/** Remembers the choice. Never throws: the picker still works for this visit without storage. */
export function savePrinter(storage: KeyValueStorage | null, id: string): void {
  try {
    storage?.setItem(PRINTER_KEY, id)
  } catch {
    // Some private windows refuse storage; the choice just isn't remembered.
  }
}
