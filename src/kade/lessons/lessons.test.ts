import { beforeAll, describe, expect, it } from 'vitest'
import { initTestOC } from '../../geometry/testing/oc-node'
import { CODE_LESSONS } from './index'
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
