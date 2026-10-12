import { describe, expect, it } from 'vitest'
import { createEmptyDocument, createShapeNode } from '../document/factory'
import { addNode } from '../document/ops'
import { fileNameFor, parseDesignFile, serializeDesign } from './design-file'

describe('design files', () => {
  it('round-trips a design', () => {
    const doc = addNode(createEmptyDocument('Phone Stand'), createShapeNode({ shapeType: 'box', name: 'Box', params: { width: 5 }, color: '#fff' }))
    expect(parseDesignFile(serializeDesign(doc))).toEqual({ ok: true, value: doc })
  })

  it('explains files that are not JSON', () => {
    expect(parseDesignFile('not json at all')).toEqual({ ok: false, error: "This file isn't a BloKade design." })
  })

  it('explains damaged designs', () => {
    const result = parseDesignFile(JSON.stringify({ ...createEmptyDocument(), root: ['ghost'] }))
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toContain('damaged')
  })

  it('makes friendly file names', () => {
    expect(fileNameFor(createEmptyDocument("Kade's Phone Stand!"), 'stl')).toBe('kade-s-phone-stand.stl')
    expect(fileNameFor(createEmptyDocument('***'), '3mf')).toBe('design.3mf')
  })
})
