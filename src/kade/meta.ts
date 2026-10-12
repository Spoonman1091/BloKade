// src/kade/meta.ts
import type { ParamSpecs, ShapePlugin } from '../plugins/types'

/** What the worker reports about one of Kade's shapes. Plain data, so it crosses to the page. */
export interface ShapeMeta {
  readonly name: string
  readonly icon: string
  readonly params: ParamSpecs
  readonly size?: ShapePlugin['size']
  readonly mode?: 'hole'
  readonly palette?: 'shapes' | 'fit' | 'hidden'
}

export type InspectResult =
  | { readonly ok: true; readonly meta: ShapeMeta }
  | { readonly ok: false; readonly problem: string }
