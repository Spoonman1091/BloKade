import { useEffect, useState } from 'react'
import { fitsBloKade, partNameFor, sizeInMm, UNIT_FACTORS, type ImportUnit } from '../app/import-stl'
import { HAS_GAPS_NOTE, TOO_LARGE_SIZE, simplifiedNote } from '../import/limits'
import type { PreparedModel } from '../import/prepare'
import { formatMm } from '../viewport/measure'

interface ImportDialogProps {
  fileName: string
  model: PreparedModel
  onImport(unit: ImportUnit): void
  onCancel(): void
}

const UNIT_LABELS: Readonly<Record<ImportUnit, string>> = { mm: 'Millimetres (mm)', cm: 'Centimetres (cm)', inches: 'Inches' }
const UNITS = Object.keys(UNIT_FACTORS) as ImportUnit[]

/** Asks which units the file uses before the model is added. */
export function ImportDialog({ fileName, model, onImport, onCancel }: ImportDialogProps) {
  const [unit, setUnit] = useState<ImportUnit>('mm')
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  const size = sizeInMm(model.size, unit)
  const fits = fitsBloKade(size)
  return (
    <div className="dialog-backdrop" data-testid="import-dialog" onClick={onCancel}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Import STL" onClick={(event) => event.stopPropagation()}>
        <h2>Import {partNameFor(fileName)}</h2>
        <p className="import-size" data-testid="import-size">{size.map(formatMm).join(' × ')} mm</p>
        <label className="field">
          Units in the file
          <select value={unit} data-testid="import-units" data-help="import-units" onChange={(e) => setUnit(e.target.value as ImportUnit)}>
            {UNITS.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
          </select>
        </label>
        {model.simplified && <p className="hint" data-testid="import-note-simplified">{simplifiedNote(model.triangleCount)}</p>}
        {model.hasGaps && <p className="hint" data-testid="import-note-gaps">{HAS_GAPS_NOTE}</p>}
        {!fits && <p className="import-too-large" role="alert" data-testid="import-too-large">{TOO_LARGE_SIZE}</p>}
        <div className="dialog-actions">
          <button type="button" className="tool-button" data-testid="import-confirm" disabled={!fits} onClick={() => onImport(unit)}>Import</button>
          <button type="button" className="tool-button" data-testid="import-cancel" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
