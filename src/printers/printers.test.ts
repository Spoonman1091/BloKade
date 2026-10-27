import { describe, expect, it } from 'vitest'
import type { KeyValueStorage } from '../learn/progress'
import { DEFAULT_PRINTER, loadPrinter, NO_PRINTER, PRINTERS, printerById, printerLabel, savePrinter } from './printers'

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { readonly data: Record<string, string> } {
  const data = { ...initial }
  return { data, getItem: (key) => data[key] ?? null, setItem: (key, value) => { data[key] = value } }
}

describe('printers', () => {
  it('starts on the Bambu Lab A1 mini', () => {
    expect(printerById(DEFAULT_PRINTER)).toMatchObject({ name: 'Bambu Lab A1 mini', size: [180, 180, 180] })
  })

  it('lists each printer once, by its build size', () => {
    expect(new Set(PRINTERS.map((p) => p.id)).size).toBe(PRINTERS.length)
    expect(printerById('prusa-mk4s')?.size).toEqual([250, 210, 220])
  })

  it('names a printer with its size', () => {
    const a1mini = printerById(DEFAULT_PRINTER)
    expect(a1mini && printerLabel(a1mini)).toBe('Bambu Lab A1 mini (180 × 180 × 180 mm)')
  })

  it('has no printer for the endless grid', () => {
    expect(printerById(NO_PRINTER)).toBeNull()
  })

  it('remembers the choice in the browser', () => {
    const storage = memoryStorage()
    savePrinter(storage, 'prusa-mini')
    expect(loadPrinter(storage)).toBe('prusa-mini')
  })

  it('falls back to the A1 mini for nothing saved, an unknown printer, or no storage', () => {
    expect(loadPrinter(memoryStorage())).toBe(DEFAULT_PRINTER)
    expect(loadPrinter(memoryStorage({ 'blokade.printer.v1': 'printer-from-the-future' }))).toBe(DEFAULT_PRINTER)
    expect(loadPrinter(null)).toBe(DEFAULT_PRINTER)
  })

  it('keeps No printer as a real choice', () => {
    const storage = memoryStorage()
    savePrinter(storage, NO_PRINTER)
    expect(loadPrinter(storage)).toBe(NO_PRINTER)
  })
})
