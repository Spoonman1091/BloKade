import { PerspectiveCamera } from 'three'
import { describe, expect, it } from 'vitest'
import type { Vec3 } from '../document/types'
import type { SizeHandle } from './face-handles'
import { closestOnAxis, hitPlaneZ, movedSince, pointerRay, screenScale, toLocalRay, trackPoint, type Ray } from './handle-drag'

const SIDE: SizeHandle = { id: 'x+', kind: 'side', dir: [1, 0, 0], position: [10, 0, 10] }
const TOP: SizeHandle = { id: 'z+', kind: 'top', dir: [0, 0, 1], position: [0, 0, 20] }
const CORNER: SizeHandle = { id: 'corner-x+y+', kind: 'corner', dir: [1, 1, 0], position: [10, 10, 0] }
const expectClose = (actual: readonly number[] | null, expected: readonly number[]): void => {
  expect(actual).not.toBeNull()
  expected.forEach((v, i) => expect(actual?.[i]).toBeCloseTo(v, 6))
}

describe('pointerRay', () => {
  it('points straight ahead from the middle of the view', () => {
    const camera = new PerspectiveCamera(45, 1, 0.5, 5000)
    camera.position.set(0, 0, 100)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()
    const element = { getBoundingClientRect: () => ({ left: 50, top: 20, width: 200, height: 200 }) }
    const ray = pointerRay({ clientX: 150, clientY: 120, shiftKey: false, altKey: false }, element, camera)
    expectClose(ray.origin, [0, 0, 100])
    expectClose(ray.direction, [0, 0, -1])
  })
})

describe('toLocalRay', () => {
  it('moves and turns a ray into the part’s own frame', () => {
    const ray: Ray = { origin: [10, 0, 5], direction: [1, 0, 0] }
    const local = toLocalRay(ray, { position: [10, 0, 0], rotation: [0, 0, 90] })
    expectClose(local.origin, [0, 0, 5])
    expectClose(local.direction, [0, -1, 0])
  })
})

describe('closestOnAxis', () => {
  it('finds how far along the axis the pointer is', () => {
    expect(closestOnAxis({ origin: [5, -100, 0], direction: [0, 1, 0] }, [0, 0, 0], 0)).toBeCloseTo(5, 6)
  })

  it('gives up when the ray runs along the axis', () => {
    expect(closestOnAxis({ origin: [0, 0, 50], direction: [1, 0, 0] }, [0, 0, 0], 0)).toBeNull()
  })
})

describe('hitPlaneZ', () => {
  it('finds where the ray meets the flat plane', () => {
    expectClose(hitPlaneZ({ origin: [0, 0, 10], direction: [0.6, 0, -0.8] }, 0), [7.5, 0])
  })

  it('gives up when the ray runs along the plane or away from it', () => {
    expect(hitPlaneZ({ origin: [0, 0, 10], direction: [1, 0, 0] }, 0)).toBeNull()
    expect(hitPlaneZ({ origin: [0, 0, 10], direction: [0, 0, 1] }, 0)).toBeNull()
  })
})

describe('trackPoint', () => {
  it('slides a side handle along its axis', () => {
    expectClose(trackPoint(SIDE, { origin: [15, -100, 10], direction: [0, 1, 0] }), [5, 0, 0])
  })

  it('slides the top handle up and down', () => {
    expectClose(trackPoint(TOP, { origin: [-100, 0, 27], direction: [1, 0, 0] }), [0, 0, 7])
  })

  it('slides a corner across the bottom', () => {
    expectClose(trackPoint(CORNER, { origin: [12, 13, 50], direction: [0, 0, -1] }), [12, 13, 0])
  })

  it('gives up when the camera looks straight down the top handle’s track', () => {
    expect(trackPoint(TOP, { origin: [0, 0, 100], direction: [0, 0, -1] })).toBeNull()
  })

  it('gives up when the camera looks at a corner edge-on', () => {
    expect(trackPoint(CORNER, { origin: [0, -100, 0], direction: [0, 1, 0] })).toBeNull()
  })
})

describe('movedSince and screenScale', () => {
  it('measures the move between two track points', () => {
    const from: Vec3 = [5, 0, 0]
    expect(movedSince(from, [12, 0, 0])).toEqual([7, 0, 0])
  })

  it('sizes a handle so it looks the same on screen at any distance', () => {
    expect(screenScale(100, 90, 200, 10)).toBeCloseTo(10, 6)
    expect(screenScale(200, 90, 200, 10)).toBeCloseTo(20, 6)
  })
})

describe('tracks seen nearly end-on', () => {
  const tilted = (degrees: number): Vec3 => {
    const r = (degrees * Math.PI) / 180
    return [Math.sin(r), 0, -Math.cos(r)]
  }

  it('ignores a top handle seen from almost straight above, instead of jumping', () => {
    expect(closestOnAxis({ origin: [10, 0, 200], direction: tilted(3) }, [0, 0, 20], 2)).toBeNull()
    expect(closestOnAxis({ origin: [-100, 0, 200], direction: tilted(30) }, [0, 0, 20], 2)).not.toBeNull()
  })

  it('ignores a point on the track behind the camera', () => {
    expect(closestOnAxis({ origin: [0, 0, 10], direction: [0.6, 0, 0.8] }, [0, 0, 0], 0)).toBeNull()
  })

  it('ignores the bottom plane seen almost edge-on', () => {
    expect(hitPlaneZ({ origin: [0, 0, 10], direction: tilted(87) }, 0)).toBeNull()
    expect(hitPlaneZ({ origin: [0, 0, 10], direction: tilted(60) }, 0)).not.toBeNull()
  })
})
