import { alignSelection } from '../app/align-selection'
import type { Axis, BoxEdge } from '../document/box'
import { useBloKadeStore } from '../store/context'

const AXIS_NAMES = ['x', 'y', 'z'] as const
const EDGES: readonly BoxEdge[] = ['min', 'center', 'max']
const ROWS: readonly { axis: Axis; title: string; labels: Readonly<Record<BoxEdge, string>> }[] = [
  { axis: 0, title: 'Left to right', labels: { min: '⇤ Left', center: '↔ Center', max: 'Right ⇥' } },
  { axis: 1, title: 'Front to back', labels: { min: 'Front', center: 'Center', max: 'Back' } },
  { axis: 2, title: 'Bottom to top', labels: { min: 'Bottom', center: 'Middle', max: 'Top' } },
]

/** Buttons that line up the selected parts' edges or centers. */
export function AlignTools() {
  const store = useBloKadeStore()
  return (
    <div className="align-tools" role="group" aria-label="Line up">
      <h3>Line up</h3>
      {ROWS.map((row) => (
        <div key={row.axis} className="align-row" role="group" aria-label={row.title}>
          {EDGES.map((edge) => (
            <button key={edge} type="button" className="tool-button" data-testid={`align-${AXIS_NAMES[row.axis]}-${edge}`}
              onClick={() => alignSelection(store, row.axis, edge)}>{row.labels[edge]}</button>
          ))}
        </div>
      ))}
    </div>
  )
}
