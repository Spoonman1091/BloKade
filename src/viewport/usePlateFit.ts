import { useMemo } from 'react'
import type { BloKadeDocument, NodeId } from '../document/types'
import { fitWarning, misfits, type PartBox } from '../printers/fit'
import type { Printer } from '../printers/printers'
import type { DisplayedMesh } from '../store/merge-build'
import { topLevelBoxes } from './bounds'

export interface PlateFit {
  /** Parts drawn red because they don't fit the printer. */
  readonly misfitIds: ReadonlySet<NodeId>
  /** Parts that hang off the plate (not just too tall). */
  readonly offPlateIds: ReadonlySet<NodeId>
  /** The warning above the 3D view, or null when everything fits. */
  readonly warning: string | null
}

/** Checks every visible top-level part against the printer's plate and height. */
export function usePlateFit(doc: BloKadeDocument, meshes: Readonly<Record<NodeId, DisplayedMesh>>, printer: Printer | null): PlateFit {
  return useMemo(() => {
    const parts: PartBox[] = topLevelBoxes(doc, meshes).map((b) => ({ ...b, mode: doc.nodes[b.id]?.mode ?? 'solid' }))
    const found = misfits(parts, printer)
    return {
      misfitIds: new Set(found.map((m) => m.id)),
      offPlateIds: new Set(found.filter((m) => m.offPlate).map((m) => m.id)),
      warning: printer ? fitWarning(found, printer) : null,
    }
  }, [doc, meshes, printer])
}
