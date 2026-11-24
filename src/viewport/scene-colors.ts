import { colorTheme, mixHex, type ColorThemeId } from '../ui/color-themes'
import { useColorTheme, useTheme, type Theme } from '../ui/theme-store'

export interface SceneColors {
  readonly background: string
  readonly plate: string
  readonly plateEdge: string
  readonly gridCell: string
  readonly gridSection: string
}

/** Neutral colours for each mode, before the colour theme's tint. */
const BASE: Readonly<Record<Theme, SceneColors>> = {
  light: { background: '#eceff3', plate: '#dfe3ea', plateEdge: '#5b6475', gridCell: '#cdd2db', gridSection: '#9aa2b1' },
  dark: { background: '#12151c', plate: '#20242e', plateEdge: '#8a93a6', gridCell: '#2f3441', gridSection: '#4d5466' },
}

/** How much of the accent goes into each colour, like the tints in App.css. */
const TINT: Readonly<Record<keyof SceneColors, number>> = { background: 0.08, plate: 0.1, plateEdge: 0.35, gridCell: 0.12, gridSection: 0.3 }

/** The 3D views' colours for a mode and colour theme. Parts keep their own colours either way. */
export function sceneColors(theme: Theme, color: ColorThemeId): SceneColors {
  const accent = colorTheme(color).accent[theme]
  const base = BASE[theme]
  const tint = (key: keyof SceneColors) => mixHex(accent, base[key], TINT[key])
  return { background: tint('background'), plate: tint('plate'), plateEdge: tint('plateEdge'), gridCell: tint('gridCell'), gridSection: tint('gridSection') }
}

export const useSceneColors = (): SceneColors => sceneColors(useTheme(), useColorTheme())
