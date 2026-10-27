import { describe, expect, it } from 'vitest'
import type { KeyValueStorage } from '../learn/progress'
import { createPrinterStore } from './printer-store'
import { DEFAULT_PRINTER, PRINTER_KEY } from './printers'

function memoryStorage(): KeyValueStorage & { readonly data: Record<string, string> } {
  const data: Record<string, string> = {}
  return { data, getItem: (key) => data[key] ?? null, setItem: (key, value) => { data[key] = value } }
}

describe('createPrinterStore', () => {
  it('starts on the saved printer and remembers a new choice', () => {
    const storage = memoryStorage()
    const store = createPrinterStore(storage)
    expect(store.getState().printerId).toBe(DEFAULT_PRINTER)
    store.getState().setPrinter('prusa-mk4s')
    expect(store.getState().printerId).toBe('prusa-mk4s')
    expect(storage.data[PRINTER_KEY]).toBe('prusa-mk4s')
    expect(createPrinterStore(storage).getState().printerId).toBe('prusa-mk4s')
  })
})
