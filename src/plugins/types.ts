import type { Shape3D } from 'replicad'
import type { ParamValue } from '../document/types'
import type { CadToolkit } from './cad-types'

export type NumberParamType = 'mm' | 'whole' | 'number' | 'angle'

export interface NumberParamSpec {
  readonly type: NumberParamType
  readonly default: number
  readonly min?: number
  readonly max?: number
  readonly label: string
}

/** A line of text, such as the letters of the Text shape. Text params never hold formulas. */
export interface TextParamSpec {
  readonly type: 'text'
  readonly default: string
  /** At most this many characters (never more than MAX_TEXT_PARAM_LENGTH). */
  readonly maxLength?: number
  readonly label: string
}

export type ParamSpec = NumberParamSpec | TextParamSpec
export type ParamSpecs = Readonly<Record<string, ParamSpec>>
export type ParamValues = Readonly<Record<string, ParamValue>>

/** Distributes over a union, so a general ParamSpec gives number | string. */
type ValueOf<S> = S extends TextParamSpec ? string : number

/** What build() receives: numbers for number params, strings for text params. */
export type ParamValuesOf<P extends ParamSpecs> = { readonly [K in keyof P]: ValueOf<P[K]> }

type NumberParamKey<P extends ParamSpecs> = { [K in keyof P]: P[K] extends TextParamSpec ? never : K }[keyof P] & string
/** Size handles may only point at number params. Kept out of ShapePlugin so ShapePlugin<ParamSpecs> stays assignable from any plugin. */
type SizeHandles<P extends ParamSpecs> = NoInfer<{
  readonly x?: NumberParamKey<P>
  readonly y?: NumberParamKey<P>
  readonly z?: NumberParamKey<P>
}>

export interface ShapePlugin<P extends ParamSpecs = ParamSpecs> {
  readonly id: string
  readonly name: string
  readonly icon: string
  readonly version: number
  readonly params: P
  /** Which number parameter each size handle (x/y/z) changes. */
  readonly size?: { readonly x?: string; readonly y?: string; readonly z?: string }
  build(params: ParamValuesOf<P>, cad: CadToolkit): Shape3D
}

/** Identity helper so plugin authors get type checking and inferred parameter names and types. */
export function definePlugin<const P extends ParamSpecs>(plugin: ShapePlugin<P> & { readonly size?: SizeHandles<P> }): ShapePlugin<P> {
  return plugin
}
