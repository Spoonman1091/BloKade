import type { BloKadeDocument } from '../document/types'
import type { PrintCheckResult } from '../geometry/types'
import type { PrintCheckView } from './store'

/** The print check result to show: only while the design is exactly the one that was checked. */
export function visiblePrintCheck(view: PrintCheckView | null, present: BloKadeDocument): PrintCheckResult | null {
  return view && view.doc === present ? view.result : null
}
