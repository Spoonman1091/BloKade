import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { downloadBytes } from '../app/download'
import { createEmptyDocument, newId } from '../document/factory'
import { renameDocument } from '../document/ops'
import type { BloKadeDocument } from '../document/types'
import { STORAGE_UNAVAILABLE } from '../persistence/bootstrap'
import { fileNameFor, parseDesignFile, serializeDesign } from '../persistence/design-file'
import { duplicateDesign, type DesignRepository, type DesignSummary } from '../persistence/repository'
import { useBloKade, useBloKadeStore } from '../store/context'
import { TextField } from './NumberField'

interface DesignsDialogProps {
  repo: DesignRepository
  flushAutosave(): Promise<void>
  onClose(): void
  confirm?(message: string): boolean
}

function useDesignActions({ repo, flushAutosave, onClose, confirm }: Required<DesignsDialogProps>) {
  const store = useBloKadeStore()
  const [designs, setDesigns] = useState<readonly DesignSummary[]>([])
  const notify = useCallback((message: string) => store.getState().notify(message), [store])
  const guarded = useCallback(async (task: () => Promise<void>): Promise<void> => {
    try {
      await task()
    } catch (error) {
      console.error('Design storage failed', error)
      notify(STORAGE_UNAVAILABLE)
    }
  }, [notify])
  const refresh = useCallback(() => guarded(async () => {
    await flushAutosave()
    setDesigns(await repo.list())
  }), [guarded, flushAutosave, repo])
  useEffect(() => void refresh(), [refresh])

  const open = async (id: string, doc: BloKadeDocument): Promise<void> => {
    await flushAutosave()
    store.getState().openDesign(id, doc)
    await repo.setLastOpened(id)
    onClose()
  }
  const createNew = async (): Promise<void> => {
    const fresh = { id: newId(), doc: createEmptyDocument() }
    await repo.save(fresh.id, fresh.doc)
    await open(fresh.id, fresh.doc)
  }
  const openExisting = async (id: string): Promise<void> => {
    const loaded = await repo.load(id)
    if (loaded.ok) await open(id, loaded.value)
    else notify(loaded.error)
  }
  const remove = async (summary: DesignSummary): Promise<void> => {
    if (!confirm(`Delete "${summary.name}"? This can't be undone.`)) return
    await flushAutosave()
    await repo.remove(summary.id)
    if (summary.id !== store.getState().designId) return refresh()
    const next = (await repo.list())[0]
    return next ? openExisting(next.id) : createNew()
  }
  const duplicate = async (id: string): Promise<void> => {
    await flushAutosave()
    const copied = await duplicateDesign(repo, id)
    if (!copied.ok) notify(copied.error)
    await refresh()
  }
  const loadFile = async (file: File): Promise<void> => {
    const parsed = parseDesignFile(await file.text())
    if (!parsed.ok) return notify(parsed.error)
    const id = newId()
    await repo.save(id, parsed.value)
    await open(id, parsed.value)
  }

  return {
    designs,
    createNew: () => guarded(createNew),
    openExisting: (id: string) => guarded(() => openExisting(id)),
    remove: (summary: DesignSummary) => guarded(() => remove(summary)),
    duplicate: (id: string) => guarded(() => duplicate(id)),
    loadFile: (file: File) => guarded(() => loadFile(file)),
  }
}

export function DesignsDialog({ repo, flushAutosave, onClose, confirm = (m) => window.confirm(m) }: DesignsDialogProps) {
  const store = useBloKadeStore()
  const currentId = useBloKade((s) => s.designId)
  const currentName = useBloKade((s) => s.history.present.name)
  const actions = useDesignActions({ repo, flushAutosave, onClose, confirm })

  const saveToFile = (): void => {
    const doc = store.getState().history.present
    downloadBytes(serializeDesign(doc), fileNameFor(doc, 'blokade'), 'application/json')
  }
  const onFileChosen = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    if (file) void actions.loadFile(file)
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Designs" onClick={(event) => event.stopPropagation()}>
        <h2>Designs</h2>
        <TextField label="This design's name" value={currentName} testId="design-name"
          onCommit={(name) => store.getState().apply((d) => renameDocument(d, name))} />
        <ul className="design-list">
          {actions.designs.map((design) => {
            const isCurrent = design.id === currentId
            const name = isCurrent ? currentName : design.name
            return (
              <li key={design.id} className={isCurrent ? 'current' : undefined}>
                <span className="design-name">{name}</span>
                {!isCurrent && <button type="button" className="tool-button" onClick={() => void actions.openExisting(design.id)}>Open</button>}
                <button type="button" className="tool-button" aria-label={`Duplicate ${name}`} onClick={() => void actions.duplicate(design.id)}>Duplicate</button>
                <button type="button" className="tool-button" aria-label={`Delete ${name}`} onClick={() => void actions.remove(design)}>Delete</button>
              </li>
            )
          })}
        </ul>
        <div className="dialog-actions">
          <button type="button" className="tool-button" onClick={() => void actions.createNew()}>New design</button>
          <button type="button" className="tool-button" onClick={saveToFile}>Save to file</button>
          <label className="tool-button">
            Load from file
            <input type="file" accept=".blokade,application/json" hidden data-testid="load-file" onChange={onFileChosen} />
          </label>
          <button type="button" className="tool-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
