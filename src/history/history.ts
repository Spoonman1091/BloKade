export const HISTORY_LIMIT = 200

export interface History<T> {
  readonly past: readonly T[]
  readonly present: T
  readonly future: readonly T[]
}

export const createHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] })

export function commit<T>(h: History<T>, next: T): History<T> {
  if (next === h.present) return h
  return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: [] }
}

export function undo<T>(h: History<T>): History<T> {
  const previous = h.past[h.past.length - 1]
  if (h.past.length === 0 || previous === undefined) return h
  return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future] }
}

export function redo<T>(h: History<T>): History<T> {
  const [next, ...rest] = h.future
  if (h.future.length === 0 || next === undefined) return h
  return { past: [...h.past, h.present], present: next, future: rest }
}

export const canUndo = <T>(h: History<T>): boolean => h.past.length > 0
export const canRedo = <T>(h: History<T>): boolean => h.future.length > 0
