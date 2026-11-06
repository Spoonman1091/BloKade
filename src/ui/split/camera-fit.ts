/** The Split view looks at the plate from the front-right, above. Only the direction matters. */
const VIEW_DIRECTION = [120, -160, 120] as const
/** Room around the framed area, as a share of its size. */
const MARGIN_FACTOR = 1.3
/** What to frame when there is no model and no printer, mm. */
const MIN_EXTENT = 180

export interface Footprint { readonly width: number; readonly depth: number }
export interface CameraPlacement { readonly position: readonly [number, number, number]; readonly target: readonly [number, number, number] }

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180

/**
 * Where the camera goes to see the whole model and the whole plate (both centred on the origin):
 * the larger of the two, with some room around, fitted to the narrower of the vertical and horizontal view angle.
 */
export function cameraFit(model: Footprint | null, plate: Footprint | null, fovDegrees: number, aspect: number): CameraPlacement {
  const extent = Math.max(model?.width ?? 0, model?.depth ?? 0, plate?.width ?? 0, plate?.depth ?? 0) || MIN_EXTENT
  const halfVertical = toRadians(fovDegrees) / 2
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * Math.max(aspect, Number.EPSILON))
  const distance = (MARGIN_FACTOR * extent) / (2 * Math.tan(Math.min(halfVertical, halfHorizontal)))
  const length = Math.hypot(...VIEW_DIRECTION)
  const [x, y, z] = VIEW_DIRECTION.map((d) => (d / length) * distance)
  return { position: [x ?? 0, y ?? 0, z ?? 0], target: [0, 0, 0] }
}
