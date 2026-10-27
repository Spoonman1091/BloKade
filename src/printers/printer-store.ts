import { createStore, useStore, type StoreApi } from 'zustand'
import { browserStorage, type KeyValueStorage } from '../learn/progress'
import { loadPrinter, printerById, savePrinter, type Printer } from './printers'

export interface PrinterState {
  /** A printer id, or NO_PRINTER for the endless grid. */
  readonly printerId: string
  setPrinter(id: string): void
}

/** The printer Kade designs for. It belongs to this browser, not to a design, so it lives outside the design store. */
export function createPrinterStore(storage: KeyValueStorage | null): StoreApi<PrinterState> {
  return createStore<PrinterState>()((set) => ({
    printerId: loadPrinter(storage),
    setPrinter: (printerId) => {
      savePrinter(storage, printerId)
      set({ printerId })
    },
  }))
}

export const printerStore = createPrinterStore(browserStorage())

export const usePrinterId = (): string => useStore(printerStore, (s) => s.printerId)

/** The chosen printer, or null for the endless grid. */
export const usePrinter = (): Printer | null => printerById(usePrinterId())
