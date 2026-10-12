import type { Shape3D } from 'replicad'
import { MAX_TEXT_PARAM_LENGTH } from '../document/types'
import { createCadToolkit } from '../plugins/cad'
import type { CadToolkit, Point2 } from '../plugins/cad-types'
import { MAX_MM } from '../plugins/params'
import { CadError, MAX_REPEAT, needArgs, numberArg, sizeArg, sizeOrZeroArg, wholeArg } from './args'
import { Outline, Part, type OutlineShape, type ShapeTracker } from './part'

type Command<R> = (...args: unknown[]) => R

/** The `cad` that Kade's build() receives. Every command checks its inputs and explains mistakes. */
export interface KadeToolkit {
  readonly box: Command<Part>
  readonly cylinder: Command<Part>
  readonly sphere: Command<Part>
  readonly cone: Command<Part>
  readonly ring: Command<Part>
  readonly wedge: Command<Part>
  readonly text: Command<Part>
  readonly rect: Command<Outline>
  readonly circle: Command<Outline>
  readonly polygon: Command<Outline>
  readonly repeat: Command<Part>
  readonly angle: Command<number>
  readonly sin: Command<number>
  readonly cos: Command<number>
}

function sizesOf<N extends string>(command: string, args: readonly unknown[], names: readonly N[], example: string): Record<N, number> {
  needArgs(args, names.length, { command, what: names.length === 1 ? 'a size' : `${names.length} sizes`, example })
  return Object.fromEntries(names.map((name, i) => [name, sizeArg(command, name, args[i])])) as Record<N, number>
}

function startingParts(part: (shape: Shape3D) => Part, internal: CadToolkit) {
  return {
    box: (...args: unknown[]) => {
      const { width, depth, height } = sizesOf('cad.box', args, ['width', 'depth', 'height'], 'cad.box(20, 10, 5)')
      return part(internal.box(width, depth, height))
    },
    cylinder: (...args: unknown[]) => {
      const { diameter, height } = sizesOf('cad.cylinder', args, ['diameter', 'height'], 'cad.cylinder(10, 20)')
      return part(internal.cylinder(diameter, height))
    },
    sphere: (...args: unknown[]) => part(internal.sphere(sizesOf('cad.sphere', args, ['diameter'], 'cad.sphere(20)').diameter)),
    cone: (...args: unknown[]) => {
      needArgs(args, 3, { command: 'cad.cone', what: '3 sizes', example: 'cad.cone(20, 0, 30)' })
      const bottom = sizeOrZeroArg('cad.cone', 'bottom', args[0])
      const top = sizeOrZeroArg('cad.cone', 'top', args[1])
      const height = sizeArg('cad.cone', 'height', args[2])
      if (bottom === 0 && top === 0) throw new CadError('A cone needs a bottom or a top bigger than 0.')
      return part(internal.revolve([[0, 0], [bottom / 2, 0], [top / 2, height], [0, height]]))
    },
    ring: (...args: unknown[]) => {
      const { outside, thickness } = sizesOf('cad.ring', args, ['outside', 'thickness'], 'cad.ring(40, 8)')
      return part(internal.torus(outside, thickness))
    },
    wedge: (...args: unknown[]) => {
      const { width, depth, height } = sizesOf('cad.wedge', args, ['width', 'depth', 'height'], 'cad.wedge(20, 10, 15)')
      return part(internal.extrudeSide([[-width / 2, 0], [width / 2, 0], [-width / 2, height]], depth))
    },
    text: (...args: unknown[]) => {
      needArgs(args, 3, { command: 'cad.text', what: 'words, a size and a depth', example: "cad.text('Hi', 10, 2)" })
      const words = args[0]
      if (typeof words !== 'string' || !words.trim()) throw new CadError("cad.text needs words in quotes first, like cad.text('Hi', 10, 2)")
      if (Array.from(words).length > MAX_TEXT_PARAM_LENGTH) throw new CadError(`cad.text can show up to ${MAX_TEXT_PARAM_LENGTH} letters.`)
      return part(internal.text(words, sizeArg('cad.text', 'size', args[1]), sizeArg('cad.text', 'depth', args[2])))
    },
  }
}

const POLYGON_USAGE = 'cad.polygon needs a list of at least 3 points, like cad.polygon([[0, 0], [20, 0], [0, 20]])'

function pointOf(value: unknown, index: number): Point2 {
  const good = Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === 'number' && Number.isFinite(v))
  if (!good) throw new CadError(`cad.polygon: point ${index + 1} must be two numbers in brackets, like [10, 5]`)
  const [x, y] = value as [number, number]
  if (Math.abs(x) > MAX_MM || Math.abs(y) > MAX_MM) throw new CadError(`Points can be up to ${MAX_MM} mm from the middle.`)
  return [x, y]
}

function outlines(outline: (drawing: OutlineShape) => Outline) {
  return {
    rect: (...args: unknown[]) => {
      const { width, depth } = sizesOf('cad.rect', args, ['width', 'depth'], 'cad.rect(20, 10)')
      const [x, y] = [width / 2, depth / 2]
      return outline({ kind: 'polygon', points: [[-x, -y], [x, -y], [x, y], [-x, y]] })
    },
    circle: (...args: unknown[]) => outline({ kind: 'circle', diameter: sizesOf('cad.circle', args, ['diameter'], 'cad.circle(10)').diameter }),
    polygon: (...args: unknown[]) => {
      const list = args[0]
      if (!Array.isArray(list) || list.length < 3) throw new CadError(POLYGON_USAGE)
      return outline({ kind: 'polygon', points: list.map(pointOf) })
    },
  }
}

const REPEAT_EXAMPLE = '(i) => cad.box(5, 5, 5).move(i * 10, 0, 0)'
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180

function helpers() {
  return {
    repeat: (...args: unknown[]) => {
      needArgs(args, 2, { command: 'cad.repeat', what: 'a count and a function', example: `cad.repeat(6, ${REPEAT_EXAMPLE})` })
      const count = wholeArg('cad.repeat', 'count', args[0], 1, MAX_REPEAT)
      const make = args[1]
      if (typeof make !== 'function') throw new CadError(`cad.repeat needs a function second, like ${REPEAT_EXAMPLE}`)
      const copies = Array.from({ length: count }, (_, i) => {
        const made: unknown = make(i)
        if (!(made instanceof Part)) throw new CadError(`cad.repeat's function must give back a part — copy ${i + 1} didn't.`)
        return made
      })
      const [first, ...rest] = copies as [Part, ...Part[]]
      return rest.reduce((acc, copy) => acc.add(copy), first)
    },
    angle: (...args: unknown[]) => {
      needArgs(args, 2, { command: 'cad.angle', what: 'a copy number and a count', example: 'cad.angle(1, 4)' })
      const i = numberArg('cad.angle', 'copy number', args[0])
      const count = numberArg('cad.angle', 'count', args[1])
      if (count <= 0) throw new CadError(`cad.angle: the count must be bigger than 0 — it was ${count}`)
      return (360 * i) / count
    },
    sin: (...args: unknown[]) => Math.sin(toRadians(numberArg('cad.sin', 'angle', args[0]))),
    cos: (...args: unknown[]) => Math.cos(toRadians(numberArg('cad.cos', 'angle', args[0]))),
  }
}

/** A fresh friendly toolkit for one build. Every solid it makes is tracked so the build can free it. */
export function createKadeToolkit(tracker: ShapeTracker, internal: CadToolkit = createCadToolkit()): KadeToolkit {
  const part = (shape: Shape3D): Part => new Part(tracker, tracker.track(shape))
  const outline = (drawing: OutlineShape): Outline => new Outline(tracker, internal, drawing)
  return { ...startingParts(part, internal), ...outlines(outline), ...helpers() }
}
