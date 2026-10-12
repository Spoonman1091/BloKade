// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { findTargetRect } from './target'

const box = (top: number, left: number, width: number, height: number) =>
  ({ top, left, width, height, bottom: top + height, right: left + width, x: left, y: top, toJSON: () => ({}) }) as DOMRect

function place(html: string, rects: Record<string, DOMRect>) {
  document.body.innerHTML = html
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const id = this.getAttribute('data-rect') ?? ''
    return rects[id] ?? box(0, 0, 0, 0)
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('findTargetRect (Review Focus 5)', () => {
  it('finds a visible control by its test id', () => {
    place('<button data-testid="add-box" data-rect="b">Box</button>', { b: box(10, 20, 80, 30) })
    expect(findTargetRect('add-box')).toEqual({ top: 10, left: 20, width: 80, height: 30 })
  })

  it('returns null for missing, zero-size or off-screen controls', () => {
    place('<button data-testid="tiny" data-rect="t"></button><button data-testid="far" data-rect="f"></button>',
      { t: box(0, 0, 0, 0), f: box(5000, 10, 40, 20) })
    expect(findTargetRect('nope')).toBeNull()
    expect(findTargetRect('tiny')).toBeNull()
    expect(findTargetRect('far')).toBeNull()
  })

  it('returns null when the control is scrolled out of its panel', () => {
    place('<div style="overflow-y: auto" data-rect="panel"><input data-testid="fit" data-rect="fit"></div>',
      { panel: box(0, 0, 200, 300), fit: box(400, 10, 100, 20) })
    expect(findTargetRect('fit')).toBeNull()
  })

  it('ignores ids that are not plain test ids', () => {
    expect(findTargetRect('a"]; b')).toBeNull()
  })
})
