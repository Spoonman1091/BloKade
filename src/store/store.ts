import { createStore, type StoreApi } from 'zustand/vanilla'
import { DocumentOpError } from '../document/ops'
import type { BloKadeDocument, NodeId, Vec3 } from '../document/types'
import type { BuildResult, EdgeCandidate, ModifierWarnings } from '../geometry/types'
import { commit, createHistory, redo, undo, type History } from '../history/history'
import { mergeBuild, type DisplayedMesh } from './merge-build'

export type ToolMode = 'move' | 'rotate' | 'size'

/** Where new shapes land: a point on a face, turned so a new shape's bottom sits flat on it. */
export interface Workplane {
  readonly origin: Vec3
  readonly rotation: Vec3
}

/** The Round edges / Bevel edges modifier whose edges Kade is clicking. */
export interface EdgePicking {
  readonly nodeId: NodeId
  readonly modifierId: string
}

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
  /** Null means the ground grid. */
  readonly workplane: Workplane | null
  /** True while the next click on a face chooses the workplane. */
  readonly pickingWorkplane: boolean
  readonly modifierWarnings: ModifierWarnings
  readonly pickingEdges: EdgePicking | null
  /** Edges to show while picking; null until the worker has listed them. */
  readonly edgeCandidates: readonly EdgeCandidate[] | null
  setPickingEdges(picking: EdgePicking | null): void
  setEdgeCandidates(candidates: readonly EdgeCandidate[] | null): void
  setWorkplane(workplane: Workplane | null): void
  setPickingWorkplane(picking: boolean): void
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
    workplane: null,
    pickingWorkplane: false,
    modifierWarnings: {},
    pickingEdges: null,
    edgeCandidates: null,
    apply: (fn) => {
      try {
        const next = fn(get().history.present)
        set((s) => ({ history: commit(s.history, next), selection: pruneSelection(next, s.selection) }))
      } catch (error) {
        if (!(error instanceof DocumentOpError)) throw error
        set({ notice: error.message })
      }
    },
    select: (ids) => set((s) => {
      const selection = pruneSelection(s.history.present, ids)
      const leaving = s.pickingEdges !== null && !(selection.length === 1 && selection[0] === s.pickingEdges.nodeId)
      return leaving ? { selection, pickingEdges: null, edgeCandidates: null } : { selection }
    }),
    setTool: (tool) => set({ tool }),
    setWorkplane: (workplane) => set({ workplane, pickingWorkplane: false }),
    setPickingEdges: (pickingEdges) =>
      set((s) => ({ pickingEdges, edgeCandidates: null, pickingWorkplane: pickingEdges ? false : s.pickingWorkplane })),
    setEdgeCandidates: (edgeCandidates) => set({ edgeCandidates }),
    setPickingWorkplane: (pickingWorkplane) =>
      set(() => ({ pickingWorkplane, ...(pickingWorkplane ? { pickingEdges: null, edgeCandidates: null } : {}) })),
    undo: () => set((s) => {
      const history = undo(s.history)
      return { history, selection: pruneSelection(history.present, s.selection) }
    }),
    redo: () => set((s) => {
      const history = redo(s.history)
      return { history, selection: pruneSelection(history.present, s.selection) }
    }),
    openDesign: (designId, doc) =>
      set({ designId, history: createHistory(doc), selection: [], meshes: {}, errors: {}, workplane: null, pickingWorkplane: false,
        modifierWarnings: {}, pickingEdges: null, edgeCandidates: null }),
    applyBuild: (designId, result) => {
      if (designId !== get().designId) return
      set((s) => ({ ...mergeBuild(s.meshes, result), modifierWarnings: result.warnings ?? {}, engineReady: true }))
    },
    notify: (notice) => set({ notice }),
    setStickyNotice: (stickyNotice) => set({ stickyNotice }),
  }))
}
