import type { EdgeWhich, MirrorPlane, ModifierType, PatternAxis } from '../document/types'

export const MODIFIER_ICONS: Readonly<Record<ModifierType, string>> = {
  fillet: '◠',
  chamfer: '◿',
  linearPattern: '⋯',
  circularPattern: '✲',
  mirror: '⇋',
}

export const EDGE_OPTIONS: readonly { value: EdgeWhich; label: string }[] = [
  { value: 'top', label: 'Top edges' },
  { value: 'bottom', label: 'Bottom edges' },
  { value: 'vertical', label: 'Upright edges' },
  { value: 'horizontal', label: 'Flat edges' },
  { value: 'all', label: 'All edges' },
]

export const PLANE_OPTIONS: readonly { value: MirrorPlane; label: string }[] = [
  { value: 'YZ', label: 'Left ↔ right' },
  { value: 'XZ', label: 'Front ↔ back' },
  { value: 'XY', label: 'Top ↕ bottom' },
]

export const AXIS_OPTIONS: readonly { value: PatternAxis; label: string }[] = [
  { value: 'z', label: 'Up (Z)' },
  { value: 'x', label: 'Left–right (X)' },
  { value: 'y', label: 'Front–back (Y)' },
]
