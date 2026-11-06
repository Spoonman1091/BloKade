import type { ChangeEvent } from 'react'
import { UNIT_FACTORS, type ImportUnit } from '../../app/import-stl'
import { TONGUE_MIN_BASE } from '../../split/constants'
import type { Cut, JointStyle } from '../../split/types'
import { NumberField } from '../NumberField'
import { UNIT_LABELS } from '../ImportDialog'
import { piecesLine } from './split-rules'
import type { Split } from './useSplit'

const UNITS = Object.keys(UNIT_FACTORS) as ImportUnit[]
const MAX_FIT_GAP = 1
const JOINTS: readonly { value: JointStyle; label: string }[] = [
  { value: 'tabs', label: 'Jigsaw tabs' },
  { value: 'tongue', label: 'Tongue and groove' },
  { value: 'none', label: 'None (glue only)' },
]

const tenths = (mm: number): number => Math.round(mm * 10) / 10

/** "Cut 1: slide left or right (127 mm from the left)". Positions count from the model's left or front edge. */
function cutLabel(cut: Cut, index: number, size: readonly number[]): string {
  const across = cut.axis === 'x'
  const from = cut.at + (size[across ? 0 : 1] ?? 0) / 2
  return `Cut ${index + 1}: slide ${across ? 'left or right' : 'front or back'} (${tenths(from)} mm from the ${across ? 'left' : 'front'})`
}

function FilePicker({ split }: { split: Split }) {
  const onChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void split.open(file)
  }
  return (
    <>
      <label className="field">
        <span>Units in the file</span>
        <select data-testid="split-units" value={split.unit} disabled={split.busy !== null} onChange={(e) => split.changeUnit(e.target.value as ImportUnit)}>
          {UNITS.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
        </select>
      </label>
      <label className="tool-button split-open" aria-disabled={split.busy !== null}>
        Open STL…
        <input type="file" accept=".stl,model/stl" hidden data-testid="split-open" disabled={split.busy !== null} onChange={onChange} />
      </label>
    </>
  )
}

function Summary({ split }: { split: Split }) {
  if (!split.info) return null
  const [x, y, z] = split.info.size.map(tenths)
  return (
    <div data-testid="split-summary">
      <p className="split-size" data-testid="split-size">{x} × {y} × {z} mm, {split.info.triangleCount.toLocaleString('en-US')} triangles</p>
      {split.grid && <p className="split-plan" data-testid="split-plan">{piecesLine(split.grid.cols, split.grid.rows)}</p>}
    </div>
  )
}

function Joints({ split }: { split: Split }) {
  const base = split.shown.baseThickness
  const noBase = split.hasBase === false
  const thin = base !== null && base < TONGUE_MIN_BASE
  const locked = split.busy !== null
  return (
    <>
      <label className="field">
        <span>Joint style</span>
        <select data-testid="split-joint" value={split.shown.joint} disabled={locked || noBase}
          onChange={(e) => split.setSetting('joint', e.target.value as JointStyle)}>
          {JOINTS.map((j) => <option key={j.value} value={j.value} disabled={j.value === 'tongue' && thin}>{j.label}</option>)}
        </select>
      </label>
      <NumberField label="Fit gap (mm)" testId="split-fit-gap" value={split.settings.fitGap} disabled={locked}
        onCommit={(gap) => { if (gap >= 0 && gap <= MAX_FIT_GAP) split.setSetting('fitGap', gap) }} />
      {base === null
        ? <label className="field"><span>Base thickness (mm)</span><input data-testid="split-base" disabled readOnly value={noBase ? 'none' : ''} /></label>
        : <NumberField label="Base thickness (mm)" testId="split-base" value={base} disabled={locked}
          onCommit={(mm) => { if (mm > 0 && mm <= (split.info?.size[2] ?? mm)) split.setSetting('baseThickness', mm) }} />}
      <label className="split-check">
        <input type="checkbox" data-testid="split-numbers" checked={split.settings.numbers} disabled={locked}
          onChange={(e) => split.setSetting('numbers', e.target.checked)} />
        <span>Put a number under each piece</span>
      </label>
    </>
  )
}

function CutSliders({ split }: { split: Split }) {
  const cuts = split.grid?.cuts ?? []
  if (cuts.length === 0) return null
  return (
    <>
      <h3>Move the cuts</h3>
      {cuts.map((cut, i) => (
        <label className="field split-cut" key={i}>
          <span>{cutLabel(cut, i, split.info?.size ?? [])}</span>
          <input type="range" data-testid={`split-cut-${i}`} min={cut.min} max={cut.max} step="any" value={cut.at} disabled={split.busy !== null}
            onChange={(e) => split.moveCut(i, Number(e.target.value))} />
        </label>
      ))}
    </>
  )
}

function progressText(split: Split): string {
  const p = split.progress
  if (split.busy === 'opening') return 'Reading the model…'
  if (split.busy === 'planning') return 'Working out the pieces…'
  if (split.busy === 'saving') return 'Packing the pieces…'
  return p ? `Cutting piece ${Math.min(p.done + 1, p.total)} of ${p.total}…` : 'Cutting the pieces…'
}

function Steps({ split }: { split: Split }) {
  const { busy } = split
  const showPlan = split.stage === 'opened' && busy === null && split.plate !== null
  return (
    <>
      {showPlan && <button type="button" className="tool-button" data-testid="split-plan-again" onClick={split.replan}>Work out the pieces</button>}
      <button type="button" className="tool-button primary" data-testid="split-make" disabled={!split.canMake} onClick={() => void split.makePieces()}>Make pieces</button>
      <button type="button" className="tool-button primary" data-testid="split-save" disabled={!split.canSave} onClick={() => void split.save()}>Save pieces</button>
      {busy !== null && (
        <div className="split-busy" data-testid="split-progress">
          <progress max={split.progress?.total ?? 1} value={split.progress?.done ?? 0} />
          <span role="status">{progressText(split)}</span>
          <button type="button" className="tool-button" data-testid="split-cancel" onClick={split.cancel}>Cancel</button>
        </div>
      )}
    </>
  )
}

/** The right-hand panel: open, joints, cuts, then the steps. */
export function SplitSettings({ split }: { split: Split }) {
  return (
    <aside className="right-panel split-settings">
      <div className="panel">
        <h2>1. Open your model</h2>
        <FilePicker split={split} />
        <Summary split={split} />
      </div>
      {split.info && (
        <div className="panel">
          <h2>2. Joints and cuts</h2>
          <Joints split={split} />
          <CutSliders split={split} />
        </div>
      )}
      <div className="panel">
        <h2>3. Make and save</h2>
        <Steps split={split} />
        {split.messages.length > 0 && (
          <div className="split-message" data-testid="split-message" role="alert">
            {split.messages.map((m) => <p key={m}>{m}</p>)}
          </div>
        )}
      </div>
    </aside>
  )
}
