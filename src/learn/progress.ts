import { z } from 'zod'

export interface ActiveLesson {
  readonly tutorialId: string
  readonly step: number
  /** The practice design this lesson runs in. */
  readonly designId: string
}

export interface LessonProgress {
  /** Tutorial ids Kade has finished at least once. */
  readonly done: readonly string[]
  readonly active: ActiveLesson | null
  readonly nudgeHidden: boolean
}

export const EMPTY_PROGRESS: LessonProgress = { done: [], active: null, nudgeHidden: false }
export const PROGRESS_KEY = 'blokade.lessons.v1'

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const progressSchema = z.object({
  done: z.array(z.string().max(64)).max(100),
  active: z.object({ tutorialId: z.string().max(64), step: z.number().int().min(0).max(100), designId: z.string().max(64) }).nullable(),
  nudgeHidden: z.boolean(),
})

/** The browser's localStorage, or null where it can't be reached (some private windows). */
export function browserStorage(): KeyValueStorage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function loadProgress(storage: KeyValueStorage | null): LessonProgress {
  if (!storage) return EMPTY_PROGRESS
  try {
    const raw = storage.getItem(PROGRESS_KEY)
    if (!raw) return EMPTY_PROGRESS
    const parsed = progressSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : EMPTY_PROGRESS
  } catch {
    return EMPTY_PROGRESS
  }
}

/** True when saved. Never throws: progress is a convenience, and the lessons work without it. */
export function saveProgress(storage: KeyValueStorage | null, progress: LessonProgress): boolean {
  if (!storage) return false
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify(progress))
    return true
  } catch {
    return false
  }
}
