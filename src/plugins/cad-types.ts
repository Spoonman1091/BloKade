import type { Shape3D } from 'replicad'

export type Point2 = readonly [number, number]

/** The toolkit handed to every plugin's build(). Implemented in cad.ts (worker only). */
export interface CadToolkit {
  box(x: number, y: number, z: number): Shape3D
}
