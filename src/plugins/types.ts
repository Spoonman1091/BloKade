import type { Shape3D } from 'replicad'
import type { CadToolkit } from './cad-types'

export type NumberParamType = 'mm' | 'whole' | 'number' | 'angle'

export interface NumberParamSpec {
  readonly type: NumberParamType
  readonly default: number
  readonly min?: number
  readonly max?: number
  readonly label: string
}

export type ParamValues = Readonly<Record<string, number>>

export interface ShapePlugin<K extends string = string> {
  readonly id: string
  readonly name: string
  readonly icon: string
  readonly version: number
  readonly params: Readonly<Record<K, NumberParamSpec>>
  /** Which parameter each size handle (x/y/z) changes. */
  readonly size?: { readonly x?: K; readonly y?: K; readonly z?: K }
  build(params: Readonly<Record<K, number>>, cad: CadToolkit): Shape3D
}

/** Identity helper so plugin authors get type checking and inferred parameter names. */
export function definePlugin<K extends string>(plugin: ShapePlugin<K>): ShapePlugin<K> {
  return plugin
}
