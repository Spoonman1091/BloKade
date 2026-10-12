import { describe, expect, it } from 'vitest'
import { ALL_LESSONS } from '../../learn/all-lessons'
import { findSyntaxProblem } from '../syntax'
import { CODE_LESSONS } from './index'

describe('the coding lessons', () => {
  it('are the ten lessons in teaching order', () => {
    expect(CODE_LESSONS.map((l) => l.id)).toEqual([
      'code-numbers', 'code-variables', 'code-functions', 'code-errors', 'code-first-shape',
      'code-settings', 'code-add-cut', 'code-move-turn', 'code-outlines', 'code-repeat',
    ])
  })
  it('have ids that never clash with the design lessons', () => {
    const ids = ALL_LESSONS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('have two or three challenges each, short texts and a hint for every step', () => {
    for (const lesson of CODE_LESSONS) {
      const checked = lesson.steps.filter((s) => s.check)
      expect(checked.length, lesson.id).toBeGreaterThanOrEqual(2)
      expect(checked.length, lesson.id).toBeLessThanOrEqual(3)
      expect(new Set(lesson.steps.map((s) => s.id)).size).toBe(lesson.steps.length)
      for (const step of lesson.steps) {
        expect(step.text.length, `${lesson.id}/${step.id}`).toBeLessThanOrEqual(200)
        expect(step.hint.length, `${lesson.id}/${step.id}`).toBeGreaterThan(0)
        expect(step.text.split('**').length % 2, `${lesson.id}/${step.id} has unmatched **`).toBe(1)
      }
    }
  })
  it('start from code that parses, except the lesson about fixing mistakes', () => {
    for (const lesson of CODE_LESSONS) {
      expect(findSyntaxProblem(lesson.starter) === null, lesson.id).toBe(lesson.id !== 'code-errors')
    }
  })
})
