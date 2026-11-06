import type { Vec3 } from '../document/types'

export interface Plate { readonly width: number; readonly depth: number }            // mm
export interface ModelInfo { readonly size: Vec3; readonly triangleCount: number }  // mm
export type Axis2 = 'x' | 'y'
export interface Cut { readonly axis: Axis2; readonly min: number; readonly max: number; readonly at: number } // model coords, centred
export interface GridPlan { readonly cols: number; readonly rows: number; readonly cuts: readonly Cut[] }
export type JointStyle = 'tabs' | 'tongue' | 'none'
export interface SplitSettings { readonly joint: JointStyle; readonly fitGap: number; readonly numbers: boolean; readonly baseThickness: number | null }
export interface PieceMesh {
  readonly number: number                 // 1-based, row-major from the front-left (−x, −y)
  readonly vertices: Float32Array; readonly triangles: Uint32Array // in assembly position (model coords)
  readonly size: Vec3; readonly fits: boolean
}
export interface PiecesResult { readonly pieces: readonly PieceMesh[]; readonly glueCuts: readonly number[] /* indices into cuts */ }
export type SplitResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string }
