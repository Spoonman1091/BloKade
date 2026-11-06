/** The message the split worker posts after each finished piece. */
export interface SplitProgressMessage { readonly splitProgress: { readonly done: number; readonly total: number } }

export const splitProgressMessage = (done: number, total: number): SplitProgressMessage => ({ splitProgress: { done, total } })

export function isSplitProgress(data: unknown): data is SplitProgressMessage {
  if (typeof data !== 'object' || data === null) return false
  const progress = (data as Partial<Record<'splitProgress', unknown>>).splitProgress
  if (typeof progress !== 'object' || progress === null) return false
  const { done, total } = progress as Partial<Record<'done' | 'total', unknown>>
  return typeof done === 'number' && typeof total === 'number'
}
