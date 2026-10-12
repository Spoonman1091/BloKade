// @vitest-environment jsdom
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderMainScreen, sampleStores } from '../app/testing/main-screen'
import { createLessonStore } from '../learn/lesson-store'
import { helpFor, helpKeyOf } from './lookup'

vi.mock('../viewport/Viewport', () => ({ Viewport: () => null }))
afterEach(cleanup)

function missingHelp(): string[] {
  return [...document.querySelectorAll('button, input, select, textarea')].flatMap((el) => {
    const found = helpKeyOf(el)
    const entry = found ? helpFor(found.key, found.label) : null
    return entry ? [] : [el.outerHTML.slice(0, 120)]
  })
}

describe('help coverage', () => {
  it('has help for every control on the main screen', () => {
    for (const store of sampleStores()) {
      renderMainScreen(store)
      expect(missingHelp()).toEqual([])
      cleanup()
    }
  })

  it('has help for every control in the Lessons panel', () => {
    const lessons = createLessonStore(null)
    lessons.getState().openPanel()
    renderMainScreen(sampleStores()[3]!, lessons)
    expect(missingHelp()).toEqual([])
    cleanup()
    lessons.getState().begin('first-shape', 'empty')
    renderMainScreen(sampleStores()[3]!, lessons)
    expect(missingHelp()).toEqual([])
  })
})
