import type { ParamValue, Vec3 } from '../document/types'
import { resolveParams } from '../plugins/params'
import type { ParamValues, ShapePlugin } from '../plugins/types'

const AXES = ['x', 'y', 'z'] as const
const round2 = (v: number): number => Math.round(v * 100) / 100

/** A param whose axis didn't scale keeps its exact value, so its formula survives the drag. */
const scaleParam = (value: ParamValue, factor: number | undefined): ParamValue =>
  typeof value === 'number' && factor !== undefined && factor !== 1 ? round2(value * factor) : value

/** Turns a size-handle drag (scale per axis) into new plugin parameters. */
export function paramsFromScale(plugin: ShapePlugin, params: Readonly<Record<string, ParamValue>>, scale: Vec3): ParamValues {
  const factors = AXES.reduce<Readonly<Record<string, number>>>((acc, axis, i) => {
    const target = plugin.size?.[axis]
    const factor = Math.abs(scale[i] ?? 1)
    if (!target || factor === 1) return acc
    const current = acc[target]
    return current === undefined || Math.abs(factor - 1) > Math.abs(current - 1) ? { ...acc, [target]: factor } : acc
  }, {})
  const scaled = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, scaleParam(value, factors[key])]),
  )
  return resolveParams(plugin, scaled)
}
