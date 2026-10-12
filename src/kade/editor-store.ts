import { createStore, type StoreApi } from 'zustand/vanilla'
import { MAX_SHAPE_CODE_LENGTH, MAX_SHAPE_NAME_LENGTH } from '../document/types'
import { CODE_TOO_BIG } from './messages'
import { newShapeId, sortByName, type LibraryShape, type ShapeLibraryRepo } from './library'
import { nameInCode, NEW_SHAPE_CODE, renameInCode, uniqueName } from './starter'

/** Typing settles this long after it stops: then the code is saved, checked and previewed. */
export const SAVE_DELAY_MS = 500
export const SAVE_FAILED = "BloKade couldn't save your shapes in this browser. Use 💾 Save to file to keep a copy."
export const LOAD_FAILED = "BloKade couldn't open your saved shapes in this browser. New shapes still work, so save them to a file."

export type EditorTab = 'lessons' | 'commands'

export interface EditorState {
  readonly open: boolean
  readonly loaded: boolean
  /** The settled versions, sorted by name. */
  readonly shapes: readonly LibraryShape[]
  /** Code Kade is still typing, by shape id. */
  readonly drafts: Readonly<Record<string, string>>
  readonly selectedId: string | null
  readonly tab: EditorTab
  readonly notice: string | null
  setOpen(open: boolean): void
  setTab(tab: EditorTab): void
  select(id: string | null): void
  load(): Promise<void>
  create(code?: string): LibraryShape
  setCode(id: string, code: string): void
  duplicate(id: string): LibraryShape | null
  remove(id: string): Promise<void>
  /** Names read from the checked code, by shape id. */
  syncNames(names: Readonly<Record<string, string>>): void
  /** Settles every draft now (before leaving the editor). */
  flush(): Promise<void>
  /** Shows a message in the editor, or clears it with null. */
  notify(notice: string | null): void
}

export type EditorStore = StoreApi<EditorState>

export const selectedShape = (state: Pick<EditorState, 'shapes' | 'selectedId'>): LibraryShape | null =>
  state.shapes.find((s) => s.id === state.selectedId) ?? null

export const currentCode = (state: Pick<EditorState, 'shapes' | 'drafts'>, id: string): string | undefined =>
  Object.hasOwn(state.drafts, id) ? state.drafts[id] : state.shapes.find((s) => s.id === id)?.code

const without = <T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([k]) => k !== key))

interface Context {
  readonly repo: ShapeLibraryRepo
  readonly now: () => number
  readonly timers: Map<string, ReturnType<typeof setTimeout>>
  readonly set: StoreApi<EditorState>['setState']
  readonly get: () => EditorState
}

async function saveShape(ctx: Context, shape: LibraryShape): Promise<void> {
  try {
    await ctx.repo.save(shape)
  } catch (error) {
    if (ctx.get().notice !== SAVE_FAILED) console.error('Could not save a shape', error)
    ctx.set({ notice: SAVE_FAILED })
  }
}

const replaceShape = (ctx: Context, shape: LibraryShape): void =>
  ctx.set((s) => ({ shapes: sortByName(s.shapes.map((x) => (x.id === shape.id ? shape : x))) }))

function stopTimer(ctx: Context, id: string): void {
  const timer = ctx.timers.get(id)
  if (timer) clearTimeout(timer)
  ctx.timers.delete(id)
}

function settle(ctx: Context, id: string): Promise<void> {
  stopTimer(ctx, id)
  const { drafts, shapes } = ctx.get()
  const shape = shapes.find((s) => s.id === id)
  const draft = Object.hasOwn(drafts, id) ? drafts[id] : undefined
  if (draft === undefined) return Promise.resolve()
  if (!shape) {
    ctx.set((s) => ({ drafts: without(s.drafts, id) }))
    return Promise.resolve()
  }
  if (draft.length > MAX_SHAPE_CODE_LENGTH) {
    ctx.set({ notice: CODE_TOO_BIG })
    return Promise.resolve()
  }
  const next = { ...shape, code: draft, updatedAt: ctx.now() }
  ctx.set((s) => ({ drafts: without(s.drafts, id) }))
  replaceShape(ctx, next)
  return saveShape(ctx, next)
}

function addShape(ctx: Context, code: string, baseName: string): LibraryShape {
  const name = uniqueName(baseName, ctx.get().shapes.map((s) => s.name), MAX_SHAPE_NAME_LENGTH)
  const shape = { id: newShapeId(), name, code: renameInCode(code, name), updatedAt: ctx.now() }
  ctx.set((s) => ({ shapes: sortByName([...s.shapes, shape]), selectedId: shape.id }))
  void saveShape(ctx, shape)
  return shape
}

async function removeShape(ctx: Context, id: string): Promise<void> {
  stopTimer(ctx, id)
  ctx.set((s) => {
    const shapes = s.shapes.filter((x) => x.id !== id)
    return { shapes, drafts: without(s.drafts, id), selectedId: s.selectedId === id ? shapes[0]?.id ?? null : s.selectedId }
  })
  try {
    await ctx.repo.remove(id)
  } catch (error) {
    console.error('Could not delete a shape', error)
    ctx.set({ notice: SAVE_FAILED })
  }
}

function syncShapeNames(ctx: Context, names: Readonly<Record<string, string>>): void {
  const renamed = ctx.get().shapes.flatMap((shape) => {
    const name = Object.hasOwn(names, shape.id) ? names[shape.id] : undefined
    return name && name !== shape.name ? [{ ...shape, name }] : []
  })
  for (const shape of renamed) {
    replaceShape(ctx, shape)
    void saveShape(ctx, shape)
  }
}

async function loadShapes(ctx: Context): Promise<void> {
  try {
    const shapes = await ctx.repo.list()
    ctx.set((s) => {
      const kept = s.shapes.filter((m) => !shapes.some((l) => l.id === m.id))
      const merged = sortByName([...shapes, ...kept])
      return { shapes: merged, loaded: true, selectedId: s.selectedId ?? merged[0]?.id ?? null }
    })
  } catch (error) {
    console.error("Could not open Kade's shape library", error)
    ctx.set({ loaded: true, notice: LOAD_FAILED })
  }
}

export function createEditorStore(repo: ShapeLibraryRepo, now: () => number = Date.now): EditorStore {
  return createStore<EditorState>()((set, get) => {
    const ctx: Context = { repo, now, timers: new Map(), set, get }
    return {
      open: false, loaded: false, shapes: [], drafts: {}, selectedId: null, tab: 'lessons', notice: null,
      setOpen: (open) => set({ open }),
      setTab: (tab) => set({ tab }),
      select: (selectedId) => set({ selectedId }),
      notify: (notice) => set({ notice }),
      load: () => loadShapes(ctx),
      create: (code = NEW_SHAPE_CODE) => addShape(ctx, code, nameInCode(code) ?? 'My shape'),
      setCode: (id, code) => {
        set((s) => ({ drafts: { ...s.drafts, [id]: code } }))
        stopTimer(ctx, id)
        ctx.timers.set(id, setTimeout(() => void settle(ctx, id), SAVE_DELAY_MS))
      },
      duplicate: (id) => {
        const source = get().shapes.find((s) => s.id === id)
        return source ? addShape(ctx, currentCode(get(), id) ?? source.code, `${source.name} copy`) : null
      },
      remove: (id) => removeShape(ctx, id),
      syncNames: (names) => syncShapeNames(ctx, names),
      flush: async () => {
        await Promise.all([...ctx.timers.keys()].map((id) => settle(ctx, id)))
      },
    }
  })
}
