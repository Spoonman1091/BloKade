import { boxGap, boxSize, type Box } from '../document/box'
import type { Vec3 } from '../document/types'
import type { NamedBox } from './bounds'

export interface Measurement {
  readonly size: Vec3
  readonly nearest: { readonly name: string; readonly distance: number } | null
}

const TOUCHING = 0.05

export function measure(target: Box, others: readonly NamedBox[]): Measurement {
  const nearest = others.reduce<Measurement['nearest']>((best, other) => {
    const distance = boxGap(target, other.box)
    return best === null || distance < best.distance ? { name: other.name, distance } : best
  }, null)
  return { size: boxSize(target), nearest }
}

const mm = (value: number): string => {
  const rounded = Math.round(value * 10) / 10
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

/** "20 × 20 × 40 mm · 5.5 mm from Cylinder", "… · touching Cylinder", or just the size. */
export function formatMeasurement(m: Measurement): string {
  const size = `${m.size.map(mm).join(' × ')} mm`
  if (!m.nearest) return size
  return m.nearest.distance < TOUCHING
    ? `${size} · touching ${m.nearest.name}`
    : `${size} · ${mm(m.nearest.distance)} mm from ${m.nearest.name}`
}
