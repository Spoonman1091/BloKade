import { useState } from 'react'
import { useStore } from 'zustand'
import { selectedShape, type EditorStore } from '../kade/editor-store'
import { useShapeFiles } from './useShapeFiles'

interface DeleteShapeConfirmProps {
  name: string
  onYes(): void
  onNo(): void
}

function DeleteShapeConfirm({ name, onYes, onNo }: DeleteShapeConfirmProps) {
  return (
    <div className="confirm" role="alertdialog" aria-label="Delete shape">
      <p>Delete {name}? This can't be undone.</p>
      <button type="button" className="tool-button" data-testid="delete-shape-yes" onClick={onYes}>Yes, delete it</button>
      <button type="button" className="tool-button" data-testid="delete-shape-no" onClick={onNo}>Keep it</button>
    </div>
  )
}

/** Kade's shapes, with + New shape, Duplicate, Delete (asks first), Save to file and Load from file. */
export function LibraryList({ editor }: { editor: EditorStore }) {
  const shapes = useStore(editor, (s) => s.shapes)
  const selectedId = useStore(editor, (s) => s.selectedId)
  const selected = useStore(editor, selectedShape)
  const [confirming, setConfirming] = useState(false)
  const { saveFile, loadFile } = useShapeFiles(editor)
  const { create, duplicate, remove, select } = editor.getState()

  return (
    <section className="panel library" aria-label="My shapes">
      <h2 data-help="panel-library">🧩 My shapes</h2>
      {shapes.length === 0 && <p className="hint">No shapes yet. Press <strong>+ New shape</strong>, or start a lesson below.</p>}
      <ul className="shape-list">
        {shapes.map((s) => (
          <li key={s.id}>
            <button type="button" className="shape-item" data-testid={`shape-item-${s.id}`} aria-pressed={s.id === selectedId}
              onClick={() => select(s.id)}>{s.name}</button>
          </li>
        ))}
      </ul>
      <div className="library-actions">
        <button type="button" className="tool-button" data-testid="new-shape" onClick={() => create()}>+ New shape</button>
        <button type="button" className="tool-button" data-testid="duplicate-shape" disabled={!selected}
          onClick={() => selected && duplicate(selected.id)}>Duplicate</button>
        <button type="button" className="tool-button" data-testid="delete-shape" disabled={!selected} onClick={() => setConfirming(true)}>🗑 Delete</button>
        <button type="button" className="tool-button" data-testid="save-shape-file" disabled={!selected} onClick={saveFile}>💾 Save to file</button>
        <label className="tool-button">
          📂 Load from file
          <input type="file" accept=".js,text/javascript" hidden data-testid="load-shape-file" onChange={(e) => void loadFile(e)} />
        </label>
      </div>
      {confirming && selected && (
        <DeleteShapeConfirm name={selected.name} onNo={() => setConfirming(false)}
          onYes={() => { setConfirming(false); void remove(selected.id) }} />
      )}
    </section>
  )
}
