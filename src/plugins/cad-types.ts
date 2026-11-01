import type { Shape3D } from 'replicad'

export type Point2 = readonly [number, number]

/** A cubic Bézier from the previous point: two control points, then the end point. */
export interface CurveStep {
  readonly curve: readonly [Point2, Point2, Point2]
}
/** One step of an outline: a straight line to a point, or a smooth curve. The first step must be a point. */
export type OutlineStep = Point2 | CurveStep

/** The toolkit handed to every plugin's build(). Implemented in cad.ts (worker and tests only). */
export interface CadToolkit {
  /** Box centered on X/Y, sitting on z = 0. */
  box(x: number, y: number, z: number): Shape3D
  /** Upright cylinder centered on X/Y, sitting on z = 0. */
  cylinder(diameter: number, height: number): Shape3D
  /** Ball sitting on z = 0. */
  sphere(diameter: number): Shape3D
  /** Ring lying flat on z = 0. */
  torus(outerDiameter: number, thickness: number): Shape3D
  /** Spin a [radius, z] outline (points and smooth curves) around the Z axis. */
  revolve(profile: readonly OutlineStep[]): Shape3D
  /** Draw an [x, z] outline (points and smooth curves) and push it out across Y, centered. */
  extrudeSide(profile: readonly OutlineStep[], width: number): Shape3D
  /** Raised letters, centered on X/Y and sitting on z = 0. `size` is the font size in mm. */
  text(text: string, size: number, depth: number, fontFamily?: string): Shape3D
  /** Push a flat [x, y] outline (points and smooth curves) straight up from z = 0 (hexagons, slots…). */
  prism(outline: readonly OutlineStep[], height: number): Shape3D
  /** Metric-style threaded rod, centered on X/Y, sitting on z = 0. Up to 40 turns long. */
  thread(diameter: number, pitch: number, length: number): Shape3D
}
