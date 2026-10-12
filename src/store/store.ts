import { createStore, type StoreApi } from 'zustand/vanilla'
import { DocumentOpError } from '../document/ops'
import type { BloKadeDocument, NodeId } from '../document/types'
import type { BuildResult } from '../geometry/types'
import { commit, createHistory, redo, undo, type History } from '../history/history'
import { mergeBuild, type DisplayedMesh } from './merge-build'

export type ToolMode = 'move' | 'rotate' | 'size'

export interface BloKadeState {
  readonly designId: string
  readonly history: History<BloKadeDocument>
  readonly selection: readonly NodeId[]
  readonly tool: ToolMode
  readonly meshes: Readonly<Record<NodeId, DisplayedMesh>>
  readonly errors: Readonly<Record<NodeId, string>>
  readonly engineReady: boolean
  readonly notice: string | null
  /** A notice that stays until the problem is gone (no timeout, no dismiss button). */
  readonly stickyNotice: string | null
  apply(fn: (doc: BloKadeDocument) => BloKadeDocument): void
  select(ids: readonly NodeId[]): void
  setTool(tool: ToolMode): void
  undo(): void
  redo(): void
  openDesign(designId: string, doc: BloKadeDocument): void
  applyBuild(designId: string, result: BuildResult): void
  notify(message: string | null): void
  setStickyNotice(message: string | null): void
}

export type BloKadeStore = StoreApi<BloKadeState>

const pruneSelection = (doc: BloKadeDocument, ids: readonly NodeId[]): readonly NodeId[] =>
  ids.filter((id) => doc.nodes[id] !== undefined)

export function createBloKadeStore(init: { designId: string; doc: BloKadeDocument }): BloKadeStore {
  return createStore<BloKadeState>()((set, get) => ({
    designId: init.designId,
    history: createHistory(init.doc),
    selection: [],
    tool: 'move',
    meshes: {},
    errors: {},
    engineReady: false,
    notice: null,
    stickyNotice: null,
    apply: (fn) => {
      try {
        const next = fn(get().history.present)
        set((s) => ({ history: commit(s.history, next), selection: pruneSelection(next, s.selection) }))
      } catch (error) {
        if (!(error instanceof DocumentOpError)) throw error
        set({ notice: error.message })
      }
    },
    select: (ids) => set((s) => ({ selection: pruneSelection(s.history.present, ids) })),
    setTool: (tool) => set({ tool }),
    undo: () => set((s) => {
      const history = undo(s.history)
      return { history, selection: pruneSelection(history.present, s.selection) }
    }),
    redo: () => set((s) => {
      const history = redo(s.history)
      return { history, selection: pruneSelection(history.present, s.selection) }
    }),
    openDesign: (designId, doc) =>
      set({ designId, history: createHistory(doc), selection: [], meshes: {}, errors: {} }),
    applyBuild: (designId, result) => {
      if (designId !== get().designId) return
      set((s) => ({ ...mergeBuild(s.meshes, result), engineReady: true }))
    },
    notify: (notice) => set({ notice }),
    setStickyNotice: (stickyNotice) => set({ stickyNotice }),
  }))
}
