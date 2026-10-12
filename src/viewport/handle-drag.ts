import { MathUtils, Raycaster, Vector2, Vector3, type Camera } from 'three'
import type { Axis } from '../document/box'
import { transformToMatrix } from '../document/transform-math'
import type { Transform, Vec3 } from '../document/types'
import type { SizeHandle } from './face-handles'

/** A start point and a unit direction. */
export interface Ray {
  readonly origin: Vec3
  readonly direction: Vec3
}

/** The parts of a pointer event a drag needs. A DOM PointerEvent has all of them. */
export interface PointerSpot {
  readonly clientX: number
  readonly clientY: number
  readonly shiftKey: boolean
  readonly altKey: boolean
}

interface Rect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/**
 * A ray within about 10° of a track (or of the bottom plane) counts as running along it. Closer than that, one
 * pixel of mouse movement is tens of millimetres, so the size would jump.
 */
const MIN_SIN = Math.sin((10 * Math.PI) / 180)
const UNIT: readonly Vec3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]

const vec = (v: Vector3): Vec3 => [v.x, v.y, v.z]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

/** The ray from the camera through the pointer. */
export function pointerRay(spot: PointerSpot, element: { getBoundingClientRect(): Rect }, camera: Camera): Ray {
  const r = element.getBoundingClientRect()
  const ndc = new Vector2(((spot.clientX - r.left) / r.width) * 2 - 1, -((spot.clientY - r.top) / r.height) * 2 + 1)
  const raycaster = new Raycaster()
  raycaster.setFromCamera(ndc, camera)
  return { origin: vec(raycaster.ray.origin), direction: vec(raycaster.ray.direction) }
}

/** The same ray in a part's own frame. */
export function toLocalRay(ray: Ray, transform: Transform): Ray {
  const inverse = transformToMatrix(transform).invert()
  return {
    origin: vec(new Vector3(...ray.origin).applyMatrix4(inverse)),
    direction: vec(new Vector3(...ray.direction).transformDirection(inverse)),
  }
}

/** How far along `axis` (from `through`) the point nearest the ray is, or null when the ray runs (nearly) along that line or the point is behind the camera. */
export function closestOnAxis(ray: Ray, through: Vec3, axis: Axis): number | null {
  const u = UNIT[axis] ?? [1, 0, 0]
  const b = dot(u, ray.direction)
  const denom = 1 - b * b
  if (denom < MIN_SIN * MIN_SIN) return null
  const w = sub(through, ray.origin)
  const alongRay = (dot(ray.direction, w) - b * dot(u, w)) / denom
  if (alongRay < 0) return null
  return (b * dot(ray.direction, w) - dot(u, w)) / denom
}

/** Where the ray meets the flat plane at height `z`, or null when it runs (nearly) along the plane or away from it. */
export function hitPlaneZ(ray: Ray, z: number): readonly [number, number] | null {
  const dz = ray.direction[2]
  if (Math.abs(dz) < MIN_SIN) return null
  const t = (z - ray.origin[2]) / dz
  if (t < 0) return null
  return [ray.origin[0] + t * ray.direction[0], ray.origin[1] + t * ray.direction[1]]
}

const draggedAxis = (handle: SizeHandle): Axis => (handle.dir[0] !== 0 ? 0 : handle.dir[1] !== 0 ? 1 : 2)

/**
 * The pointer's place on a handle's track, in the part's own frame. Side and top handles slide along their
 * axis; corners slide across the bottom. Null when the camera looks straight along the track.
 */
export function trackPoint(handle: SizeHandle, ray: Ray): Vec3 | null {
  if (handle.kind === 'corner') {
    const hit = hitPlaneZ(ray, handle.position[2])
    return hit ? [hit[0], hit[1], 0] : null
  }
  const axis = draggedAxis(handle)
  const s = closestOnAxis(ray, handle.position, axis)
  if (s === null) return null
  return [axis === 0 ? s : 0, axis === 1 ? s : 0, axis === 2 ? s : 0]
}

export const movedSince = (from: Vec3, to: Vec3): Vec3 => sub(to, from)

/** The world size that looks `px` pixels tall at `distance` from a perspective camera. */
export function screenScale(distance: number, fovDegrees: number, viewportHeightPx: number, px: number): number {
  return (2 * distance * Math.tan(MathUtils.degToRad(fovDegrees) / 2) * px) / viewportHeightPx
}
