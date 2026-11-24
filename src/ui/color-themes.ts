import type { Theme } from './theme-store'

export type ColorThemeId = 'ocean' | 'grape' | 'forest' | 'sunset' | 'bubblegum' | 'lagoon'

export interface ColorTheme {
  readonly id: ColorThemeId
  readonly name: string
  /** The accent for buttons, highlights and selection, in each mode. White text must stay readable on it. */
  readonly accent: Readonly<Record<Theme, string>>
}

/** The colour themes, in menu order. Each one tints the whole app; see the derived colours in App.css. */
export const COLOR_THEMES: readonly ColorTheme[] = [
  { id: 'ocean', name: 'Ocean', accent: { light: '#4f9dff', dark: '#4f9dff' } },
  { id: 'grape', name: 'Grape', accent: { light: '#7c3aed', dark: '#8b5cf6' } },
  { id: 'forest', name: 'Forest', accent: { light: '#1f8f4e', dark: '#2a9d5c' } },
  { id: 'sunset', name: 'Sunset', accent: { light: '#d9620b', dark: '#e06d10' } },
  { id: 'bubblegum', name: 'Bubblegum', accent: { light: '#d6336c', dark: '#e0457f' } },
  { id: 'lagoon', name: 'Lagoon', accent: { light: '#0f8b8d', dark: '#12999c' } },
]

export const DEFAULT_COLOR: ColorThemeId = 'ocean'

const BY_ID = new Map(COLOR_THEMES.map((t) => [t.id, t]))

export const isColorThemeId = (value: unknown): value is ColorThemeId => typeof value === 'string' && BY_ID.has(value as ColorThemeId)

/** The theme with this id, or Ocean when the id is unknown. */
export function colorTheme(id: ColorThemeId): ColorTheme {
  return BY_ID.get(id) ?? (COLOR_THEMES[0] as ColorTheme)
}

const channels = (hex: string): readonly number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/** `amount` of colour `a` mixed into colour `b` (0 gives b, 1 gives a), both #rrggbb. Matches CSS color-mix in srgb. */
export function mixHex(a: string, b: string, amount: number): string {
  const [ca, cb] = [channels(a), channels(b)]
  return `#${ca.map((v, i) => Math.round(v * amount + (cb[i] ?? 0) * (1 - amount)).toString(16).padStart(2, '0')).join('')}`
}
