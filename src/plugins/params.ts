import { MAX_TEXT_PARAM_LENGTH, type ParamValue } from '../document/types'
import type { ChoiceParamSpec, NumberParamSpec, ParamSpec, ParamValues, ShapePlugin, TextParamSpec, YesNoParamSpec } from './types'

export const MIN_MM = 0.01
export const MAX_MM = 2000

function boundsOf(spec: NumberParamSpec): { min: number; max: number } {
  const isMm = spec.type === 'mm'
  return {
    min: spec.min ?? (isMm ? MIN_MM : -Infinity),
    max: spec.max ?? (isMm ? MAX_MM : Infinity),
  }
}

/** Junk becomes the default; numbers are clamped (and rounded for whole numbers). */
export function normalizeParam(spec: NumberParamSpec, raw: unknown): number {
  const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : spec.default
  const { min, max } = boundsOf(spec)
  const clamped = Math.min(max, Math.max(min, value))
  return spec.type === 'whole' ? Math.round(clamped) : clamped
}

/** Text keeps to one line and to its length limit (counted in characters, so emoji aren't split). */
export function normalizeTextParam(spec: TextParamSpec, raw: unknown): string {
  if (typeof raw !== 'string') return spec.default
  const limit = Math.min(spec.maxLength ?? MAX_TEXT_PARAM_LENGTH, MAX_TEXT_PARAM_LENGTH)
  return Array.from(raw.replace(/[\r\n\t]+/g, ' ')).slice(0, limit).join('')
}

/** A known option's value, or the default. */
export function normalizeChoiceParam(spec: ChoiceParamSpec, raw: unknown): string {
  return typeof raw === 'string' && spec.options.some((o) => o.value === raw) ? raw : spec.default
}

/** true or false; anything else becomes the default. */
export function normalizeYesNoParam(spec: YesNoParamSpec, raw: unknown): boolean {
  return typeof raw === 'boolean' ? raw : spec.default
}

function normalizeAny(spec: ParamSpec, raw: unknown): ParamValue {
  switch (spec.type) {
    case 'text': return normalizeTextParam(spec, raw)
    case 'choice': return normalizeChoiceParam(spec, raw)
    case 'yesno': return normalizeYesNoParam(spec, raw)
    default: return normalizeParam(spec, raw)
  }
}

export function resolveParams(plugin: ShapePlugin, raw: Readonly<Record<string, unknown>>): ParamValues {
  return Object.fromEntries(
    Object.entries<ParamSpec>(plugin.params).map(([key, spec]) => [key, normalizeAny(spec, raw[key])]),
  )
}

export const defaultParams = (plugin: ShapePlugin): ParamValues => resolveParams(plugin, {})
