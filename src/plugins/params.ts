import type { NumberParamSpec, ParamValues, ShapePlugin } from './types'

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

export function resolveParams(plugin: ShapePlugin, raw: Readonly<Record<string, unknown>>): ParamValues {
  return Object.fromEntries(
    Object.entries<NumberParamSpec>(plugin.params).map(([key, spec]) => [key, normalizeParam(spec, raw[key])]),
  )
}

export const defaultParams = (plugin: ShapePlugin): ParamValues => resolveParams(plugin, {})
