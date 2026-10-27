import { putSelectionOnPlate } from '../app/put-on-plate'
import { usePrinter } from '../printers/printer-store'
import { useBloKadeStore } from '../store/context'

/** Drops the selected parts onto the plate (and back inside its edges when a printer is picked). */
export function PutOnPlateButton() {
  const store = useBloKadeStore()
  const printer = usePrinter()
  return (
    <button type="button" className="tool-button" data-testid="put-on-plate" title="Put on plate (D)"
      onClick={() => putSelectionOnPlate(store, printer)}>⬇ Put on plate</button>
  )
}
