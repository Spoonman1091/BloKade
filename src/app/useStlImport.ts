import { useCallback, useRef, useState } from 'react'
import type { GeometryClient } from '../geometry/client'
import { MAX_STL_BYTES, NOT_STL, TOO_BIG_FILE } from '../import/limits'
import type { PreparedModel } from '../import/prepare'
import type { BloKadeStore } from '../store/store'
import { importPart, type ImportUnit } from './import-stl'

export interface PendingImport {
  readonly fileName: string
  readonly model: PreparedModel
}

export interface StlImport {
  readonly pending: PendingImport | null
  readonly busy: boolean
  choose(file: File): void
  confirm(unit: ImportUnit): void
  cancel(): void
}

/** Reads and prepares a chosen STL, then waits for the user to pick units and confirm. */
export function useStlImport(client: GeometryClient, store: BloKadeStore): StlImport {
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [busy, setBusy] = useState(false)
  // Read by `choose` so a drop during a read or an open dialog is ignored, never from a stale render.
  const occupied = useRef(false)

  const read = useCallback(async (file: File): Promise<void> => {
    occupied.current = true
    setBusy(true)
    try {
      const result = await client.prepareStl(await file.arrayBuffer())
      if (result.ok) setPending({ fileName: file.name, model: result.model })
      else {
        occupied.current = false
        store.getState().notify(result.message)
      }
    } catch {
      occupied.current = false
      store.getState().notify(NOT_STL)
    } finally {
      setBusy(false)
    }
  }, [client, store])

  const choose = useCallback((file: File): void => {
    if (occupied.current) return
    if (file.size > MAX_STL_BYTES) return store.getState().notify(TOO_BIG_FILE)
    void read(file)
  }, [read, store])

  const confirm = useCallback((unit: ImportUnit): void => {
    if (!pending) return
    importPart(store, pending.fileName, pending.model, unit)
    occupied.current = false
    setPending(null)
  }, [pending, store])

  const cancel = useCallback(() => {
    occupied.current = false
    setPending(null)
  }, [])
  return { pending, busy, choose, confirm, cancel }
}
