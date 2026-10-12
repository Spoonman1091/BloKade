import { describe, expect, it } from 'vitest'
import { createLessonStore } from '../../learn/lesson-store'
import type { CodeView, CodeViewSource } from '../code-view'
import type { CodeLesson } from './types'
import { watchCodeSteps } from './watch-code-steps'

const lesson: CodeLesson = {
  id: 'code-test', title: 'Test', icon: '🧪', intro: 'i', starter: '',
  steps: [{ id: 'build', text: 't', hint: 'h', check: (v) => v.built }, { id: 'read', text: 'r', hint: 'h' }],
}
const view = (over: Partial<CodeView>): CodeView => ({
  shapeId: 'my-a', code: '', typing: false, syntaxOk: true, problem: null, built: false, bounds: null, meta: null, ...over,
})

describe('watchCodeSteps', () => {
  it('moves on when the lesson\'s shape builds', () => {
    let current = view({})
    const listeners = new Set<() => void>()
    const source: CodeViewSource = { read: () => current, subscribe: (l) => { listeners.add(l); return () => listeners.delete(l) } }
    const lessons = createLessonStore(null, [lesson])
    lessons.getState().begin('code-test', 'my-a')
    const stop = watchCodeSteps(lessons, source, [lesson])
    current = view({ built: true })
    listeners.forEach((l) => l())
    expect(lessons.getState().progress.active?.step).toBe(1)
    stop()
  })
})
