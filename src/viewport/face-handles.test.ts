import { describe, expect, it } from 'vitest'
import type { Box } from '../document/box'
import type { ParamValue, Vec3 } from '../document/types'
import { registry } from '../plugins/index'
import type { ShapePlugin } from '../plugins/types'
import { dragToScale, handlesFor, handleTip, type SizeHandle } from './face-handles'

const plugin = (id: string): ShapePlugin => {
  const found = registry.get(id)
  if (!found) throw new Error(id)
  return found
}
const BOX: Box = { min: [-10, -10, 0], max: [10, 10, 20] }
const SIZES = { width: 20, depth: 20, height: 20 }

const handle = (id: string, p: ShapePlugin = plugin('box')): SizeHandle => {
  const found = handlesFor(p, BOX).find((h) => h.id === id)
  if (!found) throw new Error(id)
  return found
}

interface Extra {
  readonly params?: Readonly<Record<string, ParamValue>>
  readonly snap?: number
  readonly keepProportions?: boolean
}
const drag = (id: string, moved: Vec3, extra: Extra = {}) => dragToScale({
  plugin: plugin('box'), params: extra.params ?? SIZES, box: BOX, handle: handle(id), moved,
  snap: extra.snap ?? 1, keepProportions: extra.keepProportions ?? false,
})

describe('handlesFor', () => {
  it('gives a box four sides, a top and four bottom corners', () => {
    expect(handlesFor(plugin('box'), BOX).map((h) => h.id)).toEqual([
      'x-', 'x+', 'y-', 'y+', 'z+', 'corner-x-y-', 'corner-x-y+', 'corner-x+y-', 'corner-x+y+',
    ])
  })

  it('puts each handle on its face or corner', () => {
    expect(handle('x+').position).toEqual([10, 0, 10])
    expect(handle('y-').position).toEqual([0, -10, 10])
    expect(handle('z+').position).toEqual([0, 0, 20])
    expect(handle('corner-x-y+').position).toEqual([-10, 10, 0])
    expect(handle('corner-x+y-').dir).toEqual([1, -1, 0])
  })

  it('gives a shape that only sizes its depth just the top handle', () => {
    expect(handlesFor(plugin('screw-hole'), BOX).map((h) => h.id)).toEqual(['z+'])
  })

  it('gives a snap clip its width sides and a top, but no corners', () => {
    expect(handlesFor(plugin('snap-clip'), BOX).map((h) => h.id)).toEqual(['y-', 'y+', 'z+'])
  })

  it('gives no handles to a shape without sizes', () => {
    expect(handlesFor({ ...plugin('box'), size: {} }, BOX)).toEqual([])
  })
})

describe('dragToScale', () => {
  it('grows one side by how far the handle moved', () => {
    const r = drag('x+', [12, 0, 0])
    expect(r.scale).toEqual([1.6, 1, 1])
    expect(r.changes).toEqual([{ key: 'width', label: 'Width', value: 32 }])
    expect(r.biggest).toBeNull()
  })

  it('grows the minus side when it is dragged the minus way', () => {
    expect(drag('x-', [-5, 0, 0]).changes[0]?.value).toBe(25)
  })

  it('snaps the new size to the grid', () => {
    expect(drag('x+', [12.4, 0, 0]).changes[0]?.value).toBe(32)
  })

  it('does not snap when snapping is off', () => {
    expect(drag('x+', [12.4, 0, 0], { snap: 0 }).changes[0]?.value).toBe(32.4)
  })

  it('leaves an off-grid size alone until the handle moves', () => {
    const r = drag('x+', [0, 0, 0], { params: { ...SIZES, width: 20.3 } })
    expect(r.scale).toEqual([1, 1, 1])
    expect(r.changes[0]?.value).toBe(20.3)
  })

  it('stops at one grid step instead of turning inside out', () => {
    expect(drag('x+', [-50, 0, 0]).changes[0]?.value).toBe(1)
  })

  it('stops at 0.1 mm when snapping is off', () => {
    expect(drag('x+', [-50, 0, 0], { snap: 0 }).changes[0]?.value).toBe(0.1)
  })

  it('stops at the biggest size and says so', () => {
    const r = drag('x+', [5000, 0, 0])
    expect(r.changes[0]?.value).toBe(2000)
    expect(r.biggest).toBe(2000)
  })

  it('changes the height from the top handle', () => {
    expect(drag('z+', [0, 0, 5]).changes).toEqual([{ key: 'height', label: 'Height', value: 25 }])
  })

  it('changes width and depth together from a corner', () => {
    const r = drag('corner-x+y+', [10, 5, 0])
    expect(r.changes).toEqual([
      { key: 'width', label: 'Width', value: 30 },
      { key: 'depth', label: 'Depth', value: 25 },
    ])
    expect(r.scale).toEqual([1.5, 1.25, 1])
  })

  it('keeps the proportions from a corner with Alt', () => {
    const r = drag('corner-x+y+', [10, 5, 0], { keepProportions: true })
    expect(r.scale).toEqual([1.5, 1.5, 1.5])
    expect(r.changes.map((c) => c.value)).toEqual([30, 30, 30])
  })

  it('ignores Alt on a side handle', () => {
    expect(drag('x+', [10, 0, 0], { keepProportions: true }).scale).toEqual([1.5, 1, 1])
  })

  it('grows a shared size on every axis it covers', () => {
    const cylinder = plugin('cylinder')
    const r = dragToScale({
      plugin: cylinder, params: { diameter: 20, height: 20 }, box: BOX, handle: handle('x+', cylinder),
      moved: [10, 0, 0], snap: 1, keepProportions: false,
    })
    expect(r.changes).toEqual([{ key: 'diameter', label: 'Diameter', value: 30 }])
    expect(r.scale).toEqual([1.5, 1.5, 1])
  })

  it('uses the bigger change when a corner drags one shared size two ways', () => {
    const cylinder = plugin('cylinder')
    const r = dragToScale({
      plugin: cylinder, params: { diameter: 20, height: 20 }, box: BOX, handle: handle('corner-x+y+', cylinder),
      moved: [10, 2, 0], snap: 1, keepProportions: false,
    })
    expect(r.changes).toEqual([{ key: 'diameter', label: 'Diameter', value: 30 }])
  })
})

describe('handleTip', () => {
  it('names the size a side handle changes', () => {
    expect(handleTip(plugin('box'), handle('x+'))).toBe('Drag to change the Width.')
    expect(handleTip(plugin('box'), handle('z+'))).toBe('Drag to change the Height.')
  })

  it('names both sizes on a corner and mentions Alt', () => {
    expect(handleTip(plugin('box'), handle('corner-x-y-')))
      .toBe("Drag to change the Width and Depth. Hold Alt to keep the shape's proportions.")
  })

  it('names a shared size once', () => {
    const cylinder = plugin('cylinder')
    expect(handleTip(cylinder, handle('corner-x-y-', cylinder)))
      .toBe("Drag to change the Diameter. Hold Alt to keep the shape's proportions.")
  })
})
