import type { Shape3D } from 'replicad'

export type Point2 = readonly [number, number]

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
  /** Spin a [radius, z] outline around the Z axis. */
  revolve(profile: readonly Point2[]): Shape3D
  /** Draw an [x, z] outline and push it out across Y, centered. */
  extrudeSide(profile: readonly Point2[], width: number): Shape3D
}
