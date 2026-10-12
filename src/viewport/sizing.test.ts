import { describe, expect, it } from 'vitest'
import { registry } from '../plugins/index'
import { MIN_MM } from '../plugins/params'
import { paramsFromScale } from './sizing'

const plugin = (id: string) => {
  const found = registry.get(id)
  if (!found) throw new Error(id)
  return found
}

describe('paramsFromScale', () => {
  it('scales each mapped parameter by its axis', () => {
    expect(paramsFromScale(plugin('box'), { width: 20, depth: 20, height: 20 }, [2, 1, 0.5]))
      .toEqual({ width: 40, depth: 20, height: 10 })
  })

  it('uses the axis that changed most when two axes share a parameter', () => {
    expect(paramsFromScale(plugin('cylinder'), { diameter: 20, height: 10 }, [1.5, 0.9, 1]).diameter).toBe(30)
  })

  it('rounds to 0.01 mm', () => {
    expect(paramsFromScale(plugin('sphere'), { diameter: 10 }, [1.23456, 1, 1]).diameter).toBe(12.35)
  })

  it('never goes below the minimum size, even when flipped', () => {
    expect(paramsFromScale(plugin('box'), { width: 20, depth: 20, height: 20 }, [0, 1, 1]).width).toBe(MIN_MM)
    expect(paramsFromScale(plugin('box'), { width: 20, depth: 20, height: 20 }, [-2, 1, 1]).width).toBe(40)
  })

  it('leaves unmapped parameters alone', () => {
    expect(paramsFromScale(plugin('cone'), { bottomDiameter: 20, topDiameter: 4, height: 20 }, [2, 2, 1]))
      .toEqual({ bottomDiameter: 40, topDiameter: 4, height: 20 })
  })

  it('leaves a parameter exactly as it was when its axis did not scale', () => {
    const width = 10 * Math.PI
    const next = paramsFromScale(plugin('box'), { width, depth: 20, height: 20 }, [1, 1, 2])
    expect(next.width).toBe(width)
    expect(next.height).toBe(40)
  })
})
