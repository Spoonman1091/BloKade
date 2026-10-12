import { Object3D, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { transformToMatrix } from '../document/transform-math'
import { pickFromIntersections, workplaneFromHit } from './workplane'

describe('workplaneFromHit', () => {
  it('keeps an upward face flat and rounds the point to 0.01 mm', () => {
    expect(workplaneFromHit([1.234, 5, 20], [0, 0, 1])).toEqual({ origin: [1.23, 5, 20], rotation: [0, 0, 0] })
  })

  it.each([[1, 0, 0], [0, -1, 0], [0, 0, -1], [1, 1, 0], [0, 3, 4]])('stands new shapes on a face facing %d %d %d', (x, y, z) => {
    const { rotation } = workplaneFromHit([0, 0, 0], [x, y, z])
    const up = new Vector3(0, 0, 1).transformDirection(transformToMatrix({ position: [0, 0, 0], rotation }))
    expect(up.distanceTo(new Vector3(x, y, z).normalize())).toBeLessThan(1e-3)
  })

  it('falls back to flat for a broken normal', () => {
    expect(workplaneFromHit([0, 0, 0], [0, 0, 0]).rotation).toEqual([0, 0, 0])
  })
})

describe('pickFromIntersections', () => {
  const plain = new Object3D()

  it('skips line hits that have no face and uses the first face hit', () => {
    const picked = pickFromIntersections([
      { point: new Vector3(9, 9, 9), object: plain },
      { point: new Vector3(1, 2, 3), face: { normal: new Vector3(0, 0, 1) }, object: plain },
    ])
    expect(picked).toEqual({ point: [1, 2, 3], normal: [0, 0, 1] })
  })

  it('turns the face normal into world space for a rotated part', () => {
    const part = new Object3D()
    part.rotation.x = Math.PI / 2
    part.updateMatrixWorld()
    const picked = pickFromIntersections([{ point: new Vector3(0, 0, 0), face: { normal: new Vector3(0, 0, 1) }, object: part }])
    expect(new Vector3(...(picked?.normal ?? [0, 0, 0])).distanceTo(new Vector3(0, -1, 0))).toBeLessThan(1e-6)
  })

  it('gives nothing when no hit has a face', () => {
    expect(pickFromIntersections([{ point: new Vector3(), object: plain }])).toBeNull()
    expect(pickFromIntersections([])).toBeNull()
  })

  it('with `within`, skips hits on objects outside that part', () => {
    const part = new Object3D()
    const inside = new Object3D()
    part.add(inside)
    const unrelated = new Object3D()
    const picked = pickFromIntersections([
      { point: new Vector3(7, 7, 7), face: { normal: new Vector3(1, 0, 0) }, object: unrelated },
      { point: new Vector3(1, 2, 3), face: { normal: new Vector3(0, 0, 1) }, object: inside },
    ], part)
    expect(picked?.point).toEqual([1, 2, 3])
    expect(pickFromIntersections([{ point: new Vector3(), face: { normal: new Vector3(0, 0, 1) }, object: part }], part)).not.toBeNull()
    expect(pickFromIntersections([{ point: new Vector3(), face: { normal: new Vector3(0, 0, 1) }, object: unrelated }], part)).toBeNull()
  })
})
