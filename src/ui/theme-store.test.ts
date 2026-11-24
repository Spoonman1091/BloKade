// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { KeyValueStorage } from '../learn/progress'
import { applyTheme, COLOR_KEY, createThemeStore, loadColor, loadTheme, THEME_KEY } from './theme-store'

const memory = (): KeyValueStorage => {
  const data = new Map<string, string>()
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}

const broken: KeyValueStorage = {
  getItem: () => { throw new Error('blocked') },
  setItem: () => { throw new Error('blocked') },
}

describe('theme store', () => {
  it('starts dark when nothing is saved, storage is missing or unreadable', () => {
    expect(loadTheme(memory())).toBe('dark')
    expect(loadTheme(null)).toBe('dark')
    expect(loadTheme(broken)).toBe('dark')
  })

  it('ignores a saved value it does not know', () => {
    const storage = memory()
    storage.setItem(THEME_KEY, 'purple')
    expect(loadTheme(storage)).toBe('dark')
  })

  it('toggles to light and back, and remembers the choice', () => {
    const storage = memory()
    const store = createThemeStore(storage)
    store.getState().toggle()
    expect(store.getState().theme).toBe('light')
    expect(storage.getItem(THEME_KEY)).toBe('light')
    expect(createThemeStore(storage).getState().theme).toBe('light')
    store.getState().toggle()
    expect(store.getState().theme).toBe('dark')
    expect(createThemeStore(storage).getState().theme).toBe('dark')
  })

  it('still toggles when storage refuses to save', () => {
    const store = createThemeStore(broken)
    store.getState().toggle()
    expect(store.getState().theme).toBe('light')
  })

  it('starts with the Ocean colours, and ignores unknown or unreadable saved colours', () => {
    expect(loadColor(memory())).toBe('ocean')
    expect(loadColor(null)).toBe('ocean')
    expect(loadColor(broken)).toBe('ocean')
    const storage = memory()
    storage.setItem(COLOR_KEY, 'plaid')
    expect(loadColor(storage)).toBe('ocean')
  })

  it('picks a colour theme and remembers it, separately from dark or light', () => {
    const storage = memory()
    const store = createThemeStore(storage)
    store.getState().setColor('forest')
    expect(store.getState()).toMatchObject({ color: 'forest', theme: 'dark' })
    expect(storage.getItem(COLOR_KEY)).toBe('forest')
    store.getState().toggle()
    expect(createThemeStore(storage).getState()).toMatchObject({ color: 'forest', theme: 'light' })
  })

  it('still picks a colour when storage refuses to save', () => {
    const store = createThemeStore(broken)
    store.getState().setColor('grape')
    expect(store.getState().color).toBe('grape')
  })

  it('puts the mode, the colour theme and its accent on the page root', () => {
    const root = document.createElement('html')
    applyTheme('light', 'grape', root)
    expect(root.dataset.theme).toBe('light')
    expect(root.dataset.color).toBe('grape')
    expect(root.style.getPropertyValue('--accent')).toBe('#7c3aed')
    applyTheme('dark', 'grape', root)
    expect(root.dataset.theme).toBe('dark')
    expect(root.style.getPropertyValue('--accent')).toBe('#8b5cf6')
  })
})
