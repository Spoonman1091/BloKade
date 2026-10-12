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

const BUILT_IN_WORKER = (): never => {
  throw new Error("Kade's shapes are built in the geometry worker.")
}

/** A plugin entry made from the worker's report. The page uses it for the palette, Properties and size handles; it never builds. */
export function metaToPlugin(id: string, meta: ShapeMeta, revision?: string): ShapePlugin {
  return {
    id, name: meta.name, icon: meta.icon, version: 1, toolkit: 'kade', params: meta.params,
    ...(revision ? { revision } : {}),
    ...(meta.size ? { size: meta.size } : {}),
    ...(meta.mode ? { mode: meta.mode } : {}),
    ...(meta.palette ? { palette: meta.palette } : {}),
    build: BUILT_IN_WORKER,
  }
}

export type InspectResult =
  | { readonly ok: true; readonly meta: ShapeMeta }
  | { readonly ok: false; readonly problem: string }
