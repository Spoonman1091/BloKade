export const UNTITLED = 'Untitled design'

/** "Untitled design", else "Untitled design N" with the lowest free N (from 2), so new designs are easy to tell apart. */
export function nextUntitledName(existing: readonly string[]): string {
  const taken = new Set(existing)
  if (!taken.has(UNTITLED)) return UNTITLED
  let n = 2
  while (taken.has(`${UNTITLED} ${n}`)) n += 1
  return `${UNTITLED} ${n}`
}
