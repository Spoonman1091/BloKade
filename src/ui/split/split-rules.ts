import { TONGUE_MIN_BASE } from '../../split/constants'
import type { Cut, SplitSettings } from '../../split/types'

/** Cuts on one axis stay at least this far apart (mm), and in order. */
const MIN_CUT_GAP = 1

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

/** The cuts with cut `index` moved to `at`: kept inside its window and ≥ 1 mm from its neighbours on the same axis. */
export function moveCutIn(cuts: readonly Cut[], index: number, at: number): readonly Cut[] {
  const cut = cuts[index]
  if (!cut) return cuts
  const sameAxis = cuts
    .map((c, i) => ({ at: c.at, i }))
    .filter((c) => cuts[c.i]?.axis === cut.axis)
    .sort((a, b) => a.at - b.at || a.i - b.i)
  const place = sameAxis.findIndex((c) => c.i === index)
  const before = sameAxis[place - 1]
  const after = sameAxis[place + 1]
  const low = Math.max(cut.min, before ? before.at + MIN_CUT_GAP : cut.min)
  const high = Math.min(cut.max, after ? after.at - MIN_CUT_GAP : cut.max)
  const next = low > high ? cut.at : clamp(at, low, high)
  return cuts.map((c, i) => (i === index ? { ...c, at: next } : c))
}

const TOO_BIG_TAIL = 'too big for your printer. Move the cuts or pick a bigger printer.'

/** "Pieces 1, 2 and 4 are too big …", or null when every piece fits. */
export function misfitMessage(numbers: readonly number[]): string | null {
  const [only, ...rest] = numbers
  if (only === undefined) return null
  if (rest.length === 0) return `Piece ${only} is ${TOO_BIG_TAIL}`
  const last = rest[rest.length - 1]
  const list = [only, ...rest.slice(0, -1)].join(', ')
  return `Pieces ${list} and ${last} are ${TOO_BIG_TAIL}`
}

/** A tongue needs a thick enough base; anything thinner switches to tabs. */
export function normalizeSettings(settings: SplitSettings): SplitSettings {
  const thin = settings.baseThickness !== null && settings.baseThickness < TONGUE_MIN_BASE
  return settings.joint === 'tongue' && thin ? { ...settings, joint: 'tabs' } : settings
}

/** What the worker is asked to use. `hasBase` is false when planning found no flat base: then there are no joints. */
export function effectiveSettings(settings: SplitSettings, hasBase: boolean | null): SplitSettings {
  return hasBase === false ? { ...settings, joint: 'none', baseThickness: null } : settings
}

/** The pieces' line under the size: "4 pieces (2 × 2)". */
export function piecesLine(cols: number, rows: number): string {
  const count = cols * rows
  return count === 1 ? '1 piece (it already fits)' : `${count} pieces (${cols} × ${rows})`
}
