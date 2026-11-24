import { describe, expect, it } from 'vitest'
import { COLOR_THEMES } from '../ui/color-themes'
import { sceneColors } from './scene-colors'

/** Relative luminance (0 black … 1 white) of a #rrggbb colour, plain RGB weights. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
}

describe('scene colours', () => {
  it('has a dark background in dark mode and a light one in light mode, for every colour theme', () => {
    for (const { id } of COLOR_THEMES) {
      expect(luminance(sceneColors('dark', id).background), id).toBeLessThan(0.15)
      expect(luminance(sceneColors('light', id).background), id).toBeGreaterThan(0.8)
    }
  })

  it('keeps the plate apart from the background and its edge apart from the plate, for every theme and mode', () => {
    for (const { id } of COLOR_THEMES) {
      for (const mode of ['dark', 'light'] as const) {
        const colors = sceneColors(mode, id)
        expect(Math.abs(luminance(colors.plate) - luminance(colors.background)), `${mode} ${id}`).toBeGreaterThan(0.03)
        expect(Math.abs(luminance(colors.plateEdge) - luminance(colors.plate)), `${mode} ${id}`).toBeGreaterThan(0.15)
      }
    }
  })

  it('tints the scene with the colour theme', () => {
    expect(sceneColors('dark', 'grape').background).not.toBe(sceneColors('dark', 'forest').background)
    expect(sceneColors('light', 'sunset').plate).not.toBe(sceneColors('light', 'lagoon').plate)
  })
})
