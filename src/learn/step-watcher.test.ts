import { describe, expect, it } from 'vitest'
import { createLessonStore } from './lesson-store'
import { watchLessonSteps, type StepViewSource } from './step-watcher'
import type { Tutorial } from './types'

interface Counter { readonly count: number; readonly owner: string }

const lesson: Tutorial<Counter> = {
  id: 'count', title: 'Count', icon: '🔢', intro: 'i',
  steps: [
    { id: 'one', text: 'Get to 1', hint: 'h', check: (v) => v.count >= 1 },
    { id: 'two', text: 'Get to 2', hint: 'h', check: (v) => v.count >= 2 },
  ],
}

function fakeSource(start: Counter) {
  let view = start
  const listeners = new Set<() => void>()
  const source: StepViewSource<Counter> = {
    read: () => ({ view, ownerId: view.owner }),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  const set = (next: Counter) => {
    view = next
    listeners.forEach((l) => l())
  }
  return { source, set }
}

describe('watchLessonSteps', () => {
  it('moves on when a check turns true for the lesson\'s own view', () => {
    const lessons = createLessonStore(null, [lesson])
    lessons.getState().begin('count', 'mine')
    const { source, set } = fakeSource({ count: 0, owner: 'mine' })
    const stop = watchLessonSteps(lessons, [lesson], source)
    set({ count: 1, owner: 'other' })
    expect(lessons.getState().progress.active?.step).toBe(0)
    set({ count: 0, owner: 'mine' })
    set({ count: 1, owner: 'mine' })
    expect(lessons.getState().progress.active?.step).toBe(1)
    set({ count: 2, owner: 'mine' })
    expect(lessons.getState().finished).toBe('count')
    stop()
  })
  it('ignores lessons it was not given', () => {
    const lessons = createLessonStore(null, [lesson])
    lessons.getState().begin('count', 'mine')
    const { source, set } = fakeSource({ count: 0, owner: 'mine' })
    const stop = watchLessonSteps(lessons, [], source)
    set({ count: 5, owner: 'mine' })
    expect(lessons.getState().progress.active?.step).toBe(0)
    stop()
  })
})
