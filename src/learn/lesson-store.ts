import { createStore, type StoreApi } from 'zustand/vanilla'
import { loadProgress, saveProgress, type KeyValueStorage, type LessonProgress } from './progress'
import { TUTORIALS } from './tutorials'
import type { Tutorial, TutorialStep } from './types'

export interface LessonState {
  readonly panelOpen: boolean
  /** The tutorial to show first in the list (from Help → Learn more). */
  readonly focused: string | null
  /** A tutorial just finished: the panel shows 🎉 until Kade goes back to the list. */
  readonly finished: string | null
  readonly progress: LessonProgress
  openPanel(focus?: string): void
  closePanel(): void
  togglePanel(): void
  begin(tutorialId: string, designId: string): void
  /** Next and Skip. On the last step it finishes the lesson. */
  next(): void
  back(): void
  quit(): void
  hideNudge(): void
  clearFinished(): void
}

export type LessonStore = StoreApi<LessonState>

export function currentStepOf(progress: LessonProgress, tutorials: readonly Tutorial[] = TUTORIALS): TutorialStep | undefined {
  const active = progress.active
  return active ? tutorials.find((t) => t.id === active.tutorialId)?.steps[active.step] : undefined
}

function sanitize(progress: LessonProgress, tutorials: readonly Tutorial[]): LessonProgress {
  const known = new Set(tutorials.map((t) => t.id))
  const active = progress.active
  const tutorial = active ? tutorials.find((t) => t.id === active.tutorialId) : undefined
  return {
    ...progress,
    done: progress.done.filter((id) => known.has(id)),
    active: active && tutorial ? { ...active, step: Math.max(0, Math.min(active.step, tutorial.steps.length - 1)) } : null,
  }
}

function finish(progress: LessonProgress, tutorialId: string): LessonProgress {
  const done = progress.done.includes(tutorialId) ? progress.done : [...progress.done, tutorialId]
  return { ...progress, done, active: null }
}

export function createLessonStore(storage: KeyValueStorage | null, tutorials: readonly Tutorial[] = TUTORIALS): LessonStore {
  const store = createStore<LessonState>()((set, get) => ({
    panelOpen: false,
    focused: null,
    finished: null,
    progress: sanitize(loadProgress(storage), tutorials),
    openPanel: (focus) => set({ panelOpen: true, focused: focus ?? null, ...(focus ? { finished: null } : {}) }),
    closePanel: () => set({ panelOpen: false }),
    togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
    begin: (tutorialId, designId) => set((s) => ({
      panelOpen: true, focused: tutorialId, finished: null,
      progress: { ...s.progress, active: { tutorialId, step: 0, designId } },
    })),
    next: () => {
      const { progress } = get()
      const active = progress.active
      if (!active) return
      const tutorial = tutorials.find((t) => t.id === active.tutorialId)
      if (!tutorial || active.step + 1 >= tutorial.steps.length) {
        set({ finished: active.tutorialId, progress: finish(progress, active.tutorialId) })
        return
      }
      set({ progress: { ...progress, active: { ...active, step: active.step + 1 } } })
    },
    back: () => set((s) => (s.progress.active
      ? { progress: { ...s.progress, active: { ...s.progress.active, step: Math.max(0, s.progress.active.step - 1) } } }
      : {})),
    quit: () => set((s) => ({ progress: { ...s.progress, active: null } })),
    hideNudge: () => set((s) => ({ progress: { ...s.progress, nudgeHidden: true } })),
    clearFinished: () => set({ finished: null }),
  }))
  let warned = false
  store.subscribe((state, previous) => {
    if (!storage || state.progress === previous.progress || saveProgress(storage, state.progress) || warned) return
    warned = true
    console.error('Lesson progress could not be saved in this browser. It will be forgotten when the page closes.')
  })
  return store
}
