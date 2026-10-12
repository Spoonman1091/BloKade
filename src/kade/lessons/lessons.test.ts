import { beforeAll, describe, expect, it } from 'vitest'
import { initTestOC } from '../../geometry/testing/oc-node'
import { CODE_LESSONS } from './index'
import { errorsLesson, firstShape } from './basics'
import { settingsLesson } from './shapes'
import { codeViewFor } from './testing/code-view'
import { SOLUTIONS, type Solution } from './testing/solutions'

beforeAll(initTestOC)

describe.each(CODE_LESSONS.map((lesson) => [lesson.id, lesson] as const))('coding lesson %s', (_id, lesson) => {
  it('has a solution for every checked step, and no step is done before its solution', async () => {
    let previous: Solution = { code: lesson.starter }
    for (const step of lesson.steps) {
      if (!step.check) continue
      const solution = SOLUTIONS[lesson.id]?.[step.id]
      if (!solution) throw new Error(`No solution for ${lesson.id} / ${step.id}`)
      expect(step.check(await codeViewFor(previous.code, previous.values)), `${step.id} before its solution`).toBe(false)
      expect(step.check(await codeViewFor(solution.code, solution.values)), `${step.id} after its solution`).toBe(true)
      previous = solution
    }
  })
})

describe('checks that must not pass half-way', () => {
  const step = (lesson: { steps: readonly { id: string; check?: (v: never) => boolean }[] }, id: string) =>
    lesson.steps.find((s) => s.id === id)?.check as (v: Awaited<ReturnType<typeof codeViewFor>>) => boolean

  it('spelling is not done while the word is half typed', async () => {
    const half = SOLUTIONS['code-errors']?.bracket?.code.replace('widht', 'wid') ?? ''
    expect(step(errorsLesson, 'spelling')(await codeViewFor(half))).toBe(false)
  })
  it('add-width is not done until width is used', async () => {
    const unused = SOLUTIONS['code-settings']?.['add-width']?.code.replace('cad.box(width, width, height)', 'cad.box(20, 20, height)') ?? ''
    expect(step(settingsLesson, 'add-width')(await codeViewFor(unused, { height: 60 }))).toBe(false)
  })
  it('the name is not done when the old name is just cut short', async () => {
    const cut = firstShape.starter.replace('My first shape', 'My first shap')
    expect(step(firstShape, 'name')(await codeViewFor(cut))).toBe(false)
  })
})
