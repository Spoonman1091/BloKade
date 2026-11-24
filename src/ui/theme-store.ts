import { createStore, type StoreApi } from 'zustand'
import { useStore } from 'zustand'
import { browserStorage, type KeyValueStorage } from '../learn/progress'
import { colorTheme, DEFAULT_COLOR, isColorThemeId, type ColorThemeId } from './color-themes'

export type Theme = 'dark' | 'light'

export const THEME_KEY = 'blokade.theme.v1'
export const DEFAULT_THEME: Theme = 'dark'
export const COLOR_KEY = 'blokade.color.v1'

/** The saved theme. Never throws: nothing saved, an unknown value or unreadable storage means the default, dark. */
export function loadTheme(storage: KeyValueStorage | null): Theme {
  try {
    const saved = storage?.getItem(THEME_KEY) ?? null
    return saved === 'light' || saved === 'dark' ? saved : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

/** The saved colour theme. Never throws: nothing saved, an unknown value or unreadable storage means Ocean. */
export function loadColor(storage: KeyValueStorage | null): ColorThemeId {
  try {
    const saved = storage?.getItem(COLOR_KEY) ?? null
    return isColorThemeId(saved) ? saved : DEFAULT_COLOR
  } catch {
    return DEFAULT_COLOR
  }
}

function save(storage: KeyValueStorage | null, key: string, value: string): void {
  try {
    storage?.setItem(key, value)
  } catch {
    // Some private windows refuse storage; the look still changes for this visit.
  }
}

/** Marks the page root with the mode and colour theme, and sets the accent the CSS derives its tints from. */
export function applyTheme(theme: Theme, color: ColorThemeId, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme
  root.dataset.color = color
  root.style.setProperty('--accent', colorTheme(color).accent[theme])
}

export interface ThemeState {
  readonly theme: Theme
  readonly color: ColorThemeId
  toggle(): void
  setColor(color: ColorThemeId): void
}

/** Dark or light, and the colour theme. It belongs to this browser, so it lives outside the design store. */
export function createThemeStore(storage: KeyValueStorage | null): StoreApi<ThemeState> {
  return createStore<ThemeState>()((set, get) => ({
    theme: loadTheme(storage),
    color: loadColor(storage),
    toggle: () => {
      const theme: Theme = get().theme === 'dark' ? 'light' : 'dark'
      save(storage, THEME_KEY, theme)
      set({ theme })
    },
    setColor: (color) => {
      save(storage, COLOR_KEY, color)
      set({ color })
    },
  }))
}

export const themeStore = createThemeStore(browserStorage())

export const useTheme = (): Theme => useStore(themeStore, (s) => s.theme)

export const useColorTheme = (): ColorThemeId => useStore(themeStore, (s) => s.color)
