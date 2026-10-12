import type { BloKadeDocument, NodeId } from '../document/types'
import type { GeometryClient } from '../geometry/client'
import { exportTargets, looseHoles } from '../geometry/export-targets'
import { fileNameFor } from '../persistence/design-file'
import type { BloKadeStore } from '../store/store'
import { downloadBytes } from './download'

export type ExportFormat = 'stl' | '3mf' | 'step'

const MIME: Record<ExportFormat, string> = { stl: 'model/stl', '3mf': 'model/3mf', step: 'model/step' }
const EXPORT_FAILED = "Export didn't work. Try again."
export const SELECTION_ONLY = 'Exported the selected part(s) only. Click empty space first to export everything.'
export const LOOSE_HOLES = 'Holes only cut when grouped with a solid — select both and press Group.'

/** What a successful export quietly left out, in plain words (null when nothing was). */
export function exportNotes(doc: BloKadeDocument, ids?: readonly NodeId[]): string | null {
  const exported = new Set(exportTargets(doc, ids))
  const partial = ids !== undefined && exportTargets(doc).some((id) => !exported.has(id))
  const notes = [partial ? SELECTION_ONLY : null, looseHoles(doc, ids).length > 0 ? LOOSE_HOLES : null]
    .filter((note): note is string => note !== null)
  return notes.length > 0 ? notes.join(' ') : null
}

export async function exportDesign(input: {
  client: Pick<GeometryClient, 'exportStl' | 'export3mf' | 'exportStep'>
  store: BloKadeStore
  format: ExportFormat
  download?: (data: ArrayBuffer, filename: string, mime: string) => void
}): Promise<void> {
  const { history, selection, notify } = input.store.getState()
  const doc = history.present
  const ids = selection.length > 0 ? selection : undefined
  try {
    const exporters: Record<ExportFormat, () => Promise<ArrayBuffer>> = {
      stl: () => input.client.exportStl(doc, ids),
      '3mf': () => input.client.export3mf(doc, ids),
      step: () => input.client.exportStep(doc, ids),
    }
    const data = await exporters[input.format]()
    const download = input.download ?? downloadBytes
    download(data, fileNameFor(doc, input.format), MIME[input.format])
    const notes = exportNotes(doc, ids)
    if (notes) notify(notes)
  } catch (error) {
    notify(error instanceof Error && error.message ? error.message : EXPORT_FAILED)
  }
}
