import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../document/factory'
import type { PrintCheckResult } from '../geometry/types'
import { visiblePrintCheck } from './print-check'

const result: PrintCheckResult = { status: 'nothing' }

describe('visiblePrintCheck', () => {
  it('shows the result for the design it was run on', () => {
    const doc = createEmptyDocument()
    expect(visiblePrintCheck({ doc, result }, doc)).toBe(result)
  })

  it('hides it after an edit, and when there is no result', () => {
    const doc = createEmptyDocument()
    expect(visiblePrintCheck({ doc, result }, { ...doc, name: 'Edited' })).toBeNull()
    expect(visiblePrintCheck(null, doc)).toBeNull()
  })
})
