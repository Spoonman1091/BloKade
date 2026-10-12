import { useRef, useState, type DragEvent, type MouseEvent } from 'react'
import { nextSelection } from '../app/selection'
import { MODIFIER_LABELS, modifiersOf } from '../document/modifiers'
import { moveNode, renameNode, setHidden, setMode } from '../document/ops'
import type { NodeId } from '../document/types'
import type { PluginRegistry } from '../plugins/registry'
import { useBloKade, useBloKadeStore } from '../store/context'
import { MODIFIER_ICONS } from './modifier-icons'

interface DragProps {
  dragging: NodeId | null
  setDragging(id: NodeId | null): void
  dropInto(target: NodeId | null): void
}

function RenameInput({ initial, onDone }: { initial: string; onDone(name: string | null): void }) {
  // Enter/Escape unmount the input, which fires a blur; only the first outcome counts.
  const finished = useRef(false)
  const finish = (name: string | null): void => {
    if (finished.current) return
    finished.current = true
    onDone(name)
  }
  return (
    <input
      autoFocus
      aria-label="Part name"
      defaultValue={initial}
      onClick={(event) => event.stopPropagation()}
      onBlur={(event) => finish(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') finish(event.currentTarget.value)
        if (event.key === 'Escape') finish(null)
      }}
    />
  )
}

function TreeItem({ id, registry, drag }: { id: NodeId; registry: PluginRegistry; drag: DragProps }) {
  const store = useBloKadeStore()
  const node = useBloKade((s) => Object.hasOwn(s.history.present.nodes, id) ? s.history.present.nodes[id] : undefined)
  const selected = useBloKade((s) => s.selection.includes(id))
  const error = useBloKade((s) => (Object.hasOwn(s.errors, id) ? s.errors[id] : undefined))
  const [editing, setEditing] = useState(false)
  const [over, setOver] = useState(false)
  if (!node) return null

  const { apply } = store.getState()
  const isGroup = node.kind === 'group'
  const modifiers = modifiersOf(node)
  const modifierLabels = modifiers.map((m) => MODIFIER_LABELS[m.type]).join(', ')
  const icon = isGroup ? '📦' : registry.get(node.shapeType)?.icon ?? '❓'
  const canDropHere = isGroup && drag.dragging !== null && drag.dragging !== id
  const onClick = (event: MouseEvent): void => {
    const state = store.getState()
    state.select(nextSelection(state.selection, id, event.shiftKey || event.metaKey || event.ctrlKey))
  }
  const finishRename = (name: string | null): void => {
    if (editing && name !== null && name.trim() && name.trim() !== node.name) apply((d) => renameNode(d, id, name))
    setEditing(false)
  }
  const stopThen = (fn: () => void) => (event: MouseEvent): void => {
    event.stopPropagation()
    fn()
  }
  const onDrop = (event: DragEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    setOver(false)
    if (canDropHere) drag.dropInto(id)
  }

  return (
    <li role="none">
      <div
        role="treeitem"
        aria-label={node.name}
        aria-selected={selected}
        aria-expanded={isGroup ? true : undefined}
        className={`tree-row${over ? ' drop-target' : ''}`}
        draggable={!editing}
        onClick={onClick}
        onDoubleClick={() => setEditing(true)}
        onDragStart={(event) => {
          event.dataTransfer?.setData('text/plain', id)
          drag.setDragging(id)
        }}
        onDragEnd={() => drag.setDragging(null)}
        onDragOver={(event) => {
          if (!canDropHere) return
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <span aria-hidden="true">{icon}</span>
        {editing ? <RenameInput initial={node.name} onDone={finishRename} /> : <span className="tree-name">{node.name}</span>}
        {modifiers.length > 0 && (
          <span className="tree-mods" data-testid={`tree-mods-${id}`} title={modifierLabels} aria-label={`Modifiers: ${modifierLabels}`}>
            {modifiers.filter((m) => m.enabled).map((m) => MODIFIER_ICONS[m.type]).join('')}
          </span>
        )}
        {error && <span className="badge" title={error} aria-label={`Problem: ${error}`}>⚠</span>}
        <button type="button" className="icon-button"
          aria-label={node.mode === 'hole' ? `Make ${node.name} solid` : `Make ${node.name} a hole`}
          onClick={stopThen(() => apply((d) => setMode(d, [id], node.mode === 'hole' ? 'solid' : 'hole')))}>
          {node.mode === 'hole' ? '⬚' : '◼'}
        </button>
        <button type="button" className="icon-button"
          aria-label={node.hidden ? `Show ${node.name}` : `Hide ${node.name}`}
          onClick={stopThen(() => apply((d) => setHidden(d, [id], !node.hidden)))}>
          {node.hidden ? '🚫' : '👁'}
        </button>
      </div>
      {isGroup && node.children.length > 0 && (
        <ul className="tree" role="group">
          {node.children.map((child) => <TreeItem key={child} id={child} registry={registry} drag={drag} />)}
        </ul>
      )}
    </li>
  )
}

export function SceneTree({ registry }: { registry: PluginRegistry }) {
  const root = useBloKade((s) => s.history.present.root)
  const apply = useBloKade((s) => s.apply)
  const [dragging, setDragging] = useState<NodeId | null>(null)
  const dropInto = (target: NodeId | null): void => {
    if (dragging) apply((d) => moveNode(d, dragging, target))
    setDragging(null)
  }
  const drag: DragProps = { dragging, setDragging, dropInto }

  return (
    <section className="panel" aria-label="Parts">
      <h2>Parts</h2>
      {root.length === 0 ? (
        <p className="hint">No parts yet. Click a shape above to add one.</p>
      ) : (
        <ul className="tree" role="tree" aria-label="Parts">
          {root.map((id) => <TreeItem key={id} id={id} registry={registry} drag={drag} />)}
        </ul>
      )}
      {dragging && (
        <div className="drop-zone" data-testid="drop-top-level"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            dropInto(null)
          }}>
          Drop here to move to the top level
        </div>
      )}
    </section>
  )
}
