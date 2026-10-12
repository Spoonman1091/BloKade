import type { Actions } from '../app/actions'
import type { ExportFormat } from '../app/export'
import { canRedo, canUndo } from '../history/history'
import { useBloKade } from '../store/context'
import type { ToolMode } from '../store/store'

const SNAP_OPTIONS = [
  { value: 1, label: '1 mm' },
  { value: 0.5, label: '0.5 mm' },
  { value: 0.1, label: '0.1 mm' },
  { value: 0, label: 'Off' },
] as const

const TOOLS: readonly { tool: ToolMode; label: string; key: string }[] = [
  { tool: 'move', label: '✥ Move', key: 'M' },
  { tool: 'rotate', label: '⟳ Rotate', key: 'R' },
  { tool: 'size', label: '⤢ Size', key: 'S' },
]

interface ToolbarProps {
  actions: Actions
  onExport(format: ExportFormat): void
  onOpenDesigns(): void
  learnOpen: boolean
  onLearn(): void
}

export function Toolbar({ actions, onExport, onOpenDesigns, learnOpen, onLearn }: ToolbarProps) {
  const undoable = useBloKade((s) => canUndo(s.history))
  const redoable = useBloKade((s) => canRedo(s.history))
  const count = useBloKade((s) => s.selection.length)
  const tool = useBloKade((s) => s.tool)
  const gridSnap = useBloKade((s) => s.history.present.settings.gridSnap)
  const picking = useBloKade((s) => s.pickingWorkplane)
  const onFace = useBloKade((s) => s.workplane !== null)
  const designName = useBloKade((s) => s.history.present.name)

  return (
    <header className="toolbar">
      <span className="brand">BloKade</span>
      <button type="button" className="tool-button" data-testid="open-designs" onClick={onOpenDesigns}>📁 {designName}</button>
      <div className="toolbar-group">
        <button type="button" className="tool-button" data-testid="learn" aria-pressed={learnOpen} onClick={onLearn}>📘 Learn</button>
      </div>
      <div className="toolbar-group">
        <button type="button" className="tool-button" data-testid="undo" title="Undo (Ctrl+Z)" disabled={!undoable} onClick={actions.undo}>↶ Undo</button>
        <button type="button" className="tool-button" data-testid="redo" title="Redo (Ctrl+Shift+Z)" disabled={!redoable} onClick={actions.redo}>↷ Redo</button>
      </div>
      <div className="toolbar-group">
        <button type="button" className="tool-button" data-testid="group" title="Group (Ctrl+G)" disabled={count < 2} onClick={actions.groupSelection}>Group</button>
        <button type="button" className="tool-button" data-testid="ungroup" title="Ungroup (Ctrl+Shift+G)" disabled={count !== 1} onClick={actions.ungroupSelection}>Ungroup</button>
        <button type="button" className="tool-button" data-testid="duplicate" title="Duplicate (Ctrl+D)" disabled={count === 0} onClick={actions.duplicateSelection}>Duplicate</button>
        <button type="button" className="tool-button" data-testid="delete" title="Delete (Del)" disabled={count === 0} onClick={actions.deleteSelection}>Delete</button>
      </div>
      <div className="toolbar-group" role="group" aria-label="Handle mode">
        {TOOLS.map(({ tool: t, label, key }) => (
          <button key={t} type="button" className="tool-button" data-testid={`tool-${t}`} title={`${label.slice(2)} (${key})`}
            aria-pressed={tool === t} onClick={() => actions.setTool(t)}>{label}</button>
        ))}
      </div>
      <div className="toolbar-group" role="group" aria-label="Workplane">
        <button type="button" className="tool-button" data-testid="workplane" aria-pressed={picking}
          title="Build on a face: click this, then click a face" onClick={actions.toggleWorkplanePicking}>📐 Workplane</button>
        {onFace && <button type="button" className="tool-button" data-testid="workplane-reset"
          title="Build on the ground again" onClick={actions.resetWorkplane}>Ground</button>}
      </div>
      <label className="toolbar-group">
        Snap
        <select aria-label="Grid snap" value={gridSnap} onChange={(event) => actions.setGridSnap(Number(event.target.value))}>
          {SNAP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <div className="toolbar-group">
        <button type="button" className="tool-button" data-testid="export-stl" onClick={() => onExport('stl')}>⬇ STL</button>
        <button type="button" className="tool-button" data-testid="export-3mf" onClick={() => onExport('3mf')}>⬇ 3MF</button>
        <button type="button" className="tool-button" data-testid="export-step" title="STEP: for other CAD programs" onClick={() => onExport('step')}>⬇ STEP</button>
      </div>
    </header>
  )
}
