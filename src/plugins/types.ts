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
  /** Starts as this formula instead of a plain number, e.g. 'fit' for a clearance. May only use `fit`. */
  readonly formula?: string
}

/** A line of text, such as the letters of the Text shape. Text params never hold formulas. */
export interface TextParamSpec {
  readonly type: 'text'
  readonly default: string
  /** At most this many characters (never more than MAX_TEXT_PARAM_LENGTH). */
  readonly maxLength?: number
  readonly label: string
  /** Built-in shapes only: the part stores this value itself, so the properties panel doesn't show it. */
  readonly hidden?: true
}

export interface ChoiceOption {
  readonly value: string
  readonly label: string
}

/** Pick one from a list, like a screw size. Stored as the option's value; never holds a formula. */
export interface ChoiceParamSpec {
  readonly type: 'choice'
  readonly default: string
  readonly options: readonly ChoiceOption[]
  readonly label: string
}

/** A tick box. build() gets true or false. Never holds a formula. */
export interface YesNoParamSpec {
  readonly type: 'yesno'
  readonly default: boolean
  readonly label: string
}

export type ParamSpec = NumberParamSpec | TextParamSpec | ChoiceParamSpec | YesNoParamSpec

export const isNumberSpec = (spec: ParamSpec): spec is NumberParamSpec =>
  spec.type !== 'text' && spec.type !== 'choice' && spec.type !== 'yesno'

export type ParamSpecs = Readonly<Record<string, ParamSpec>>
export type ParamValues = Readonly<Record<string, ParamValue>>

/** Distributes over a union, so a general ParamSpec gives number | string | boolean. Choices give the union of their option values. */
type ValueOf<S> = S extends ChoiceParamSpec ? S['options'][number]['value']
  : S extends TextParamSpec ? string
    : S extends YesNoParamSpec ? boolean
      : number

/** What build() receives: numbers, strings for text and choices, booleans for tick boxes. */
export type ParamValuesOf<P extends ParamSpecs> = { readonly [K in keyof P]: ValueOf<P[K]> }

type NumberParamKey<P extends ParamSpecs> = { [K in keyof P]: P[K] extends NumberParamSpec ? K : never }[keyof P] & string
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
  /**
   * Other number parameters that grow along with one size axis, so the part keeps its shape when a handle stretches
   * it (a cone's top diameter grows with its bottom). The live preview stretches the whole part, and this makes the
   * saved part match it.
   */
  readonly alsoScales?: { readonly [key: string]: 'x' | 'y' | 'z' }
  /** New parts of this kind start as holes (sockets, screw holes). Missing means solid. */
  readonly mode?: 'hole'
  /** Which palette section lists it. 'hidden' parts are only added by a kit. Missing means 'shapes'. */
  readonly palette?: 'shapes' | 'fit' | 'hidden'
  /** Kade's shapes: a hash of the code. The build cache uses it in place of `version`. */
  readonly revision?: string
  /** 'kade': build() takes the friendly toolkit and is run through runKadeBuild (Kade's library and the plugins/ folder). */
  readonly toolkit?: 'kade'
  /** Where Kade's code was loaded from, so errors can name the line. */
  readonly source?: string
  build(params: ParamValuesOf<P>, cad: CadToolkit): Shape3D
}

/** Identity helper so plugin authors get type checking and inferred parameter names and types. */
export function definePlugin<const P extends ParamSpecs>(plugin: ShapePlugin<P> & { readonly size?: SizeHandles<P> }): ShapePlugin<P> {
  return plugin
}
