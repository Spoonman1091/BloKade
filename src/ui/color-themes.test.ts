import { describe, expect, it } from 'vitest'
import { COLOR_THEMES, colorTheme, DEFAULT_COLOR, mixHex } from './color-themes'

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}
const contrastWithWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05)

describe('colour themes', () => {
  it('has six themes with unique ids, starting with Ocean', () => {
    expect(COLOR_THEMES).toHaveLength(6)
    expect(new Set(COLOR_THEMES.map((t) => t.id)).size).toBe(6)
    expect(DEFAULT_COLOR).toBe('ocean')
    expect(COLOR_THEMES[0]?.id).toBe('ocean')
  })

  it('keeps Ocean the blue BloKade always had', () => {
    expect(colorTheme('ocean').accent).toEqual({ light: '#4f9dff', dark: '#4f9dff' })
  })

  it('keeps white button text readable on every accent, in both modes', () => {
    for (const theme of COLOR_THEMES) {
      for (const accent of [theme.accent.light, theme.accent.dark]) {
        expect(accent).toMatch(/^#[0-9a-f]{6}$/)
        expect(contrastWithWhite(accent), `${theme.id} ${accent}`).toBeGreaterThanOrEqual(2.7)
      }
    }
  })

  it('falls back to Ocean for an unknown id', () => {
    expect(colorTheme('nope' as never).id).toBe('ocean')
  })

  it('mixes two colours by a fraction of the first', () => {
    expect(mixHex('#ffffff', '#000000', 0)).toBe('#000000')
    expect(mixHex('#ffffff', '#000000', 1)).toBe('#ffffff')
    expect(mixHex('#ff0000', '#0000ff', 0.5)).toBe('#800080')
  })
})
