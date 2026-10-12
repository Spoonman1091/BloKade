import { describe, expect, it } from 'vitest'
import { TUTORIALS, tutorialById } from './index'

describe('TUTORIALS', () => {
  it('lists the nine tutorials in teaching order', () => {
    expect(TUTORIALS.map((t) => t.id)).toEqual([
      'first-shape', 'move-turn-size', 'holes-groups', 'undo-save', 'smart-sizes',
      'workplane', 'round-repeat', 'perfect-fit', 'ready-to-print',
    ])
    expect(tutorialById('smart-sizes')?.title).toBe('Smart sizes')
    expect(tutorialById('nope')).toBeUndefined()
  })

  it('gives every step a unique id, a hint, and short text', () => {
    for (const t of TUTORIALS) {
      const ids = t.steps.map((s) => s.id)
      expect(new Set(ids).size, t.id).toBe(ids.length)
      expect(t.steps.length, t.id).toBeGreaterThanOrEqual(4)
      expect(t.steps.length, t.id).toBeLessThanOrEqual(10)
      for (const s of t.steps) {
        expect(s.hint.length, `${t.id}/${s.id}`).toBeGreaterThan(0)
        expect(s.text.length, `${t.id}/${s.id}`).toBeLessThanOrEqual(160)
        if (s.target !== undefined) expect(s.target, `${t.id}/${s.id}`).toMatch(/^[a-z0-9-]+$/)
      }
    }
  })
})
