import { useEffect, useRef, useState } from 'react'
import { COLOR_THEMES } from './color-themes'
import { themeStore, useColorTheme, useTheme } from './theme-store'

/** Dark mode (the default) or light mode, remembered in this browser. */
export function ThemeToggle() {
  const dark = useTheme() === 'dark'
  return (
    <button type="button" className="tool-button" data-testid="theme-toggle" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'} onClick={() => themeStore.getState().toggle()}>{dark ? '☀️' : '🌙'}</button>
  )
}

/** The 🎨 button and its menu of colour themes. Each theme has a light and a dark version, so it works in both modes. */
export function ColorThemePicker() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const theme = useTheme()
  const current = useColorTheme()

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    const onPointer = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  return (
    <div className="color-picker" ref={box}>
      <button type="button" className="tool-button" data-testid="theme-colors" aria-label="Colour theme" title="Colour theme"
        aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)}>🎨</button>
      {open && (
        <div className="color-menu" role="radiogroup" aria-label="Colour theme">
          {COLOR_THEMES.map((option) => (
            <button key={option.id} type="button" role="radio" className="color-option" data-testid={`theme-color-${option.id}`}
              aria-checked={option.id === current}
              onClick={() => { themeStore.getState().setColor(option.id); setOpen(false) }}>
              <span className="color-swatch" style={{ background: option.accent[theme] }} aria-hidden="true" />
              {option.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
