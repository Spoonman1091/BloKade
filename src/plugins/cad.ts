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
import type { CadToolkit, CurveStep, OutlineStep, Point2 } from './cad-types'
import { makeThread } from './cad-thread'
import { fontFailed, TEXT_FONT } from './font'

const EPS = 1e-9
const samePoint = (a: Point2, b: Point2): boolean => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS

const isCurve = (step: OutlineStep): step is CurveStep => 'curve' in step
const endOf = (step: OutlineStep): Point2 => (isCurve(step) ? step.curve[2] : step)

/** Drops repeated points and a closing point equal to the first. A curve step is never dropped. */
export function cleanProfile(profile: readonly OutlineStep[]): OutlineStep[] {
  const noRepeats = profile.filter((step, i) => {
    const prev = profile[i - 1]
    return i === 0 || !prev || isCurve(step) || !samePoint(step, endOf(prev))
  })
  const first = noRepeats[0]
  const last = noRepeats[noRepeats.length - 1]
  return noRepeats.length > 1 && first && last && !isCurve(last) && samePoint(endOf(first), last)
    ? noRepeats.slice(0, -1)
    : noRepeats
}

function profileDrawing(profile: readonly OutlineStep[]) {
  const [first, ...rest] = cleanProfile(profile)
  if (!first || isCurve(first)) throw new Error('An outline must start with a point.')
  if (rest.length < 2) throw new Error('A profile needs at least 3 different points.')
  const pen = rest.reduce(
    (p, step) =>
      isCurve(step)
        ? p.cubicBezierCurveTo([...step.curve[2]], [...step.curve[0]], [...step.curve[1]])
        : p.lineTo([step[0], step[1]]),
    draw([first[0], first[1]]),
  )
  // close() adds a closing line only when the outline doesn't already end on its start.
  return pen.close()
}

function asSolid(shape: Shape3D | AnyShape): Shape3D {
  if ('fuse' in shape && 'cut' in shape) return shape as Shape3D
  throw new Error("That outline didn't make a solid shape.")
}

const CANT_DRAW = "BloKade can't make 3D letters from that text. Try plain letters and numbers."

function letters(text: string, size: number, fontFamily: string): Drawing {
  if (!getFont(fontFamily)) {
    if (fontFailed()) throw new Error("The letter font couldn't load. Reload BloKade to try again.")
    throw new Error("The letter shapes aren't ready yet. Try again in a moment.")
  }
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
      if (profile.some((step) => (isCurve(step) ? step.curve : [step]).some(([x]) => x < 0))) {
        throw new Error('A spin outline must stay on the right of the center line (x ≥ 0).')
      }
      return asSolid(profileDrawing(profile).sketchOnPlane('XZ').revolve())
    },
    extrudeSide: (profile, width) =>
      asSolid(profileDrawing(profile).sketchOnPlane('XZ', [0, width / 2, 0]).extrude(width)),
    prism: (outline, height) => asSolid(profileDrawing(outline).sketchOnPlane('XY').extrude(height) as Shape3D),
    thread: (diameter, pitch, length) => makeThread(diameter, pitch, length),
    text: (text, size, depth, fontFamily = TEXT_FONT) => {
      const clean = text.trim()
      if (!clean) throw new Error('Type some letters first.')
      const solid = raise(letters(clean, size, fontFamily), depth)
      const [[x0, y0], [x1, y1]] = solid.boundingBox.bounds
      return solid.translate([-(x0 + x1) / 2, -(y0 + y1) / 2, 0])
    },
  }
}
