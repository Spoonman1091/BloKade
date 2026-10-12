import {
  draw,
  drawCircle,
  drawText,
  getFont,
  makeBaseBox,
  makeCylinder,
  makeSphere,
  type AnyShape,
  type Drawing,
  type Shape3D,
} from 'replicad'
import type { CadToolkit, Point2 } from './cad-types'
import { TEXT_FONT } from './font'

const EPS = 1e-9
const samePoint = (a: Point2, b: Point2): boolean => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS

/** Drops consecutive repeats and a closing point equal to the first. */
export function cleanProfile(profile: readonly Point2[]): Point2[] {
  const noRepeats = profile.filter((p, i) => {
    const prev = profile[i - 1]
    return i === 0 || !prev || !samePoint(p, prev)
  })
  const first = noRepeats[0]
  const last = noRepeats[noRepeats.length - 1]
  return noRepeats.length > 1 && first && last && samePoint(first, last) ? noRepeats.slice(0, -1) : noRepeats
}

function profileDrawing(profile: readonly Point2[]) {
  const [first, ...rest] = cleanProfile(profile)
  if (!first || rest.length < 2) throw new Error('A profile needs at least 3 different points.')
  return rest.reduce((pen, [x, y]) => pen.lineTo([x, y]), draw([first[0], first[1]])).close()
}

function asSolid(shape: Shape3D | AnyShape): Shape3D {
  if ('fuse' in shape && 'cut' in shape) return shape as Shape3D
  throw new Error("That outline didn't make a solid shape.")
}

const CANT_DRAW = "BloKade can't make 3D letters from that text. Try plain letters and numbers."

function letters(text: string, size: number, fontFamily: string): Drawing {
  if (!getFont(fontFamily)) throw new Error("The letter shapes aren't ready yet. Try again in a moment.")
  try {
    return drawText(text, { fontSize: size, fontFamily })
  } catch {
    throw new Error(CANT_DRAW)
  }
}

function raise(drawing: Drawing, depth: number): Shape3D {
  try {
    return asSolid(drawing.sketchOnPlane('XY').extrude(depth) as Shape3D)
  } catch {
    throw new Error(CANT_DRAW)
  }
}

export function createCadToolkit(): CadToolkit {
  return {
    box: (x, y, z) => makeBaseBox(x, y, z),
    cylinder: (diameter, height) => makeCylinder(diameter / 2, height),
    sphere: (diameter) => makeSphere(diameter / 2).translate([0, 0, diameter / 2]),
    torus: (outerDiameter, thickness) => {
      const tube = thickness / 2
      const ringRadius = outerDiameter / 2 - tube
      if (ringRadius <= tube) throw new Error('Make the ring wider than twice its thickness.')
      return asSolid(drawCircle(tube).translate([ringRadius, tube]).sketchOnPlane('XZ').revolve())
    },
    revolve: (profile) => {
      if (profile.some(([x]) => x < 0)) {
        throw new Error('A spin outline must stay on the right of the center line (x ≥ 0).')
      }
      return asSolid(profileDrawing(profile).sketchOnPlane('XZ').revolve())
    },
    extrudeSide: (profile, width) =>
      asSolid(profileDrawing(profile).sketchOnPlane('XZ', [0, width / 2, 0]).extrude(width)),
    text: (text, size, depth, fontFamily = TEXT_FONT) => {
      const clean = text.trim()
      if (!clean) throw new Error('Type some letters first.')
      const solid = raise(letters(clean, size, fontFamily), depth)
      const [[x0, y0], [x1, y1]] = solid.boundingBox.bounds
      return solid.translate([-(x0 + x1) / 2, -(y0 + y1) / 2, 0])
    },
  }
}
