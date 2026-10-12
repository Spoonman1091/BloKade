import type { Point2 } from '../cad-types'
import type { ScrewSpec } from '../fit-sizes'

export type ScrewStyle = 'plain' | 'countersunk' | 'counterbored' | 'nut' | 'insert'

const fmt = (n: number): string => String(Math.round(n * 100) / 100)

function needDepth(depth: number, feature: number, what: string): void {
  if (depth <= feature + 1) throw new Error(`Make the hole deeper than ${fmt(feature + 1)} mm so ${what} fits.`)
}

/** [radius, z] outline of a screw hole for cad.revolve. The screw goes in from the top (z = depth). */
export function screwHoleProfile(screw: ScrewSpec, style: ScrewStyle, depth: number, clearance: number): Point2[] {
  const r = screw.diameter / 2 + clearance
  switch (style) {
    case 'countersunk': {
      const head = screw.countersunkHead / 2 + clearance
      const cone = head - r
      needDepth(depth, cone, 'the screw head')
      return [[0, 0], [r, 0], [r, depth - cone], [head, depth], [0, depth]]
    }
    case 'counterbored': {
      const head = screw.capHead / 2 + clearance
      const pocket = screw.capHeight + clearance
      needDepth(depth, pocket, 'the screw head')
      return [[0, 0], [r, 0], [r, depth - pocket], [head, depth - pocket], [head, depth], [0, depth]]
    }
    case 'insert': {
      const hole = screw.insertHole / 2
      needDepth(depth, screw.insertLength, 'the insert')
      return [[0, 0], [r, 0], [r, depth - screw.insertLength], [hole, depth - screw.insertLength], [hole, depth], [0, depth]]
    }
    case 'nut':
      needDepth(depth, screw.nutHeight + clearance, 'the nut')
      return [[0, 0], [r, 0], [r, depth], [0, depth]]
    case 'plain':
      return [[0, 0], [r, 0], [r, depth], [0, depth]]
  }
}

/** A hexagon centered on 0,0 with flat top and bottom (corners on ±X). */
export function hexOutline(acrossFlats: number): Point2[] {
  const corner = acrossFlats / Math.sqrt(3)
  return Array.from({ length: 6 }, (_, i): Point2 => {
    const angle = (Math.PI / 3) * i
    return [corner * Math.cos(angle), corner * Math.sin(angle)]
  })
}
