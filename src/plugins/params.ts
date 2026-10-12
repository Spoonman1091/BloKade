import { MAX_TEXT_PARAM_LENGTH, type ParamValue } from '../document/types'
import type { NumberParamSpec, ParamSpec, ParamValues, ShapePlugin, TextParamSpec } from './types'

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

const normalizeAny = (spec: ParamSpec, raw: unknown): ParamValue =>
  spec.type === 'text' ? normalizeTextParam(spec, raw) : normalizeParam(spec, raw)

export function resolveParams(plugin: ShapePlugin, raw: Readonly<Record<string, unknown>>): ParamValues {
  return Object.fromEntries(
    Object.entries<ParamSpec>(plugin.params).map(([key, spec]) => [key, normalizeAny(spec, raw[key])]),
  )
}

export const defaultParams = (plugin: ShapePlugin): ParamValues => resolveParams(plugin, {})
