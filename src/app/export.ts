import type { GeometryClient } from '../geometry/client'
import { fileNameFor } from '../persistence/design-file'
import type { BloKadeStore } from '../store/store'
import { downloadBytes } from './download'

export type ExportFormat = 'stl' | '3mf'

const MIME: Record<ExportFormat, string> = { stl: 'model/stl', '3mf': 'model/3mf' }
const EXPORT_FAILED = "Export didn't work. Try again."

export async function exportDesign(input: {
  client: Pick<GeometryClient, 'exportStl' | 'export3mf'>
  store: BloKadeStore
  format: ExportFormat
  download?: (data: ArrayBuffer, filename: string, mime: string) => void
}): Promise<void> {
  const { history, selection, notify } = input.store.getState()
  const doc = history.present
  const ids = selection.length > 0 ? selection : undefined
  try {
    const data = input.format === 'stl'
      ? await input.client.exportStl(doc, ids)
      : await input.client.export3mf(doc, ids)
    const download = input.download ?? downloadBytes
    download(data, fileNameFor(doc, input.format), MIME[input.format])
  } catch (error) {
    notify(error instanceof Error && error.message ? error.message : EXPORT_FAILED)
  }
}
