import { usePrinter } from '../printers/printer-store'
import { FLOATING_COLOR, OVERHANG_COLOR, THIN_COLOR } from '../printers/print-colors'
import { printMessages, type PrintMessage } from '../printers/print-messages'
import { useBloKade } from '../store/context'
import { visiblePrintCheck } from '../store/print-check'
import { RichText } from './RichText'

const SWATCH: Partial<Record<PrintMessage['kind'], string>> = { floating: FLOATING_COLOR, thin: THIN_COLOR, overhang: OVERHANG_COLOR }

/** What Check print found, shown while it is still true of the design. */
export function PrintCheckPanel() {
  const view = useBloKade((s) => s.printCheck)
  const present = useBloKade((s) => s.history.present)
  const setPrintCheck = useBloKade((s) => s.setPrintCheck)
  const printer = usePrinter()
  const result = visiblePrintCheck(view, present)
  if (!result) return null
  return (
    <section className="panel print-check" data-testid="print-check-result" role="status">
      <button type="button" className="print-check-close" data-testid="print-check-close" aria-label="Close print check"
        onClick={() => setPrintCheck(null)}>✕</button>
      <h2>Print check</h2>
      {printMessages(result, printer).map((message) => (
        <p key={message.kind} className="print-check-line">
          {SWATCH[message.kind] && <span className="print-check-swatch" aria-hidden="true" style={{ background: SWATCH[message.kind] }} />}
          <span><RichText text={message.text} /></span>
        </p>
      ))}
    </section>
  )
}
