import type { ChoiceOption } from './types'

/** ISO sizes in mm. Countersunk heads are ISO 10642 (M2 scaled to match); cap heads ISO 4762; nuts ISO 4032. */
export interface ScrewSpec {
  readonly diameter: number
  readonly countersunkHead: number
  readonly capHead: number
  readonly capHeight: number
  readonly nutFlats: number
  readonly nutHeight: number
  /** Heat-set insert hole (exact, no extra room) and insert length. */
  readonly insertHole: number
  readonly insertLength: number
}

export type ScrewSize = 'M2' | 'M3' | 'M4' | 'M5'

export const SCREWS: Readonly<Record<ScrewSize, ScrewSpec>> = {
  M2: { diameter: 2, countersunkHead: 4.4, capHead: 3.8, capHeight: 2, nutFlats: 4, nutHeight: 1.6, insertHole: 3.2, insertLength: 4 },
  M3: { diameter: 3, countersunkHead: 6.72, capHead: 5.5, capHeight: 3, nutFlats: 5.5, nutHeight: 2.4, insertHole: 4, insertLength: 5.7 },
  M4: { diameter: 4, countersunkHead: 8.96, capHead: 7, capHeight: 4, nutFlats: 7, nutHeight: 3.2, insertHole: 5.6, insertLength: 8.1 },
  M5: { diameter: 5, countersunkHead: 11.2, capHead: 8.5, capHeight: 5, nutFlats: 8, nutHeight: 4.7, insertHole: 6.4, insertLength: 9.5 },
}

export const SCREW_SIZE_OPTIONS = [
  { value: 'M2', label: 'M2' }, { value: 'M3', label: 'M3' }, { value: 'M4', label: 'M4' }, { value: 'M5', label: 'M5' },
] as const satisfies readonly ChoiceOption[]

export type ThreadSize = 'M6' | 'M8' | 'M10' | 'M12' | 'M16' | 'M20'

/** Metric coarse threads. */
export const THREADS: Readonly<Record<ThreadSize, { readonly diameter: number; readonly pitch: number }>> = {
  M6: { diameter: 6, pitch: 1 },
  M8: { diameter: 8, pitch: 1.25 },
  M10: { diameter: 10, pitch: 1.5 },
  M12: { diameter: 12, pitch: 1.75 },
  M16: { diameter: 16, pitch: 2 },
  M20: { diameter: 20, pitch: 2.5 },
}

export const THREAD_SIZE_OPTIONS = (Object.keys(THREADS) as ThreadSize[]).map((value) => ({ value, label: value }))
