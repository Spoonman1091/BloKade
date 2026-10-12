import type { Shape3D } from 'replicad'
import type { CadToolkit, Point2 } from '../plugins/cad-types'
import { axisArg, CadError, distanceArg, needArgs, numberArg, sizeArg, type Axis } from './args'

/** Remembers every solid one build makes, so all but the result can be freed when it ends. */
export class ShapeTracker {
  private readonly live = new Set<Shape3D>()
  private made = 0

  track(shape: Shape3D): Shape3D {
    this.live.add(shape)
    this.made += 1
    return shape
  }

  /** Frees every shape made so far except `keep` (the build's result, which the caller now owns). */
  freeAllBut(keep: Shape3D | null): void {
    for (const shape of this.live) if (shape !== keep) shape.delete()
    this.live.clear()
  }

  /** How many shapes were made and how many are still held. For leak tests. */
  counts(): { made: number; held: number } {
    return { made: this.made, held: this.live.size }
  }
}

/** The steps a part has and an outline doesn't, and the other way round. The ❓ Commands list is checked against these. */
export const PART_STEPS = ['move', 'rotate', 'add', 'cut', 'overlap', 'mirror', 'copy'] as const
export const OUTLINE_STEPS = ['extrude', 'spin'] as const

const AXIS_DIRECTION: Readonly<Record<Axis, [number, number, number]>> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }
const MIRROR_PLANE = { x: 'YZ', y: 'XZ', z: 'XY' } as const

const notAPartYet = (step: string): CadError =>
  new CadError(`.${step} works on parts. Turn the outline into a part first with .extrude(height) or .spin().`)
const alreadyAPart = (step: string): CadError => new CadError(`.${step} is for flat outlines, and this is already a part.`)

function otherPart(command: string, value: unknown): Part {
  if (value instanceof Part) return value
  if (value instanceof Outline) {
    throw new CadError(`${command} needs a part, not an outline. Use .extrude(height) or .spin() on the outline first.`)
  }
  throw new CadError(`${command} needs a part, like ${command}(cad.box(10, 10, 10))`)
}

/** A solid in Kade's code. Every step makes a new part, and the old one never changes. */
export class Part {
  constructor(private readonly tracker: ShapeTracker, readonly shape: Shape3D) {}

  move(...args: unknown[]): Part {
    needArgs(args, 3, { command: '.move', what: '3 numbers', example: '.move(10, 0, 0)' })
    const x = distanceArg('.move', 'x', args[0])
    const y = distanceArg('.move', 'y', args[1])
    const z = distanceArg('.move', 'z', args[2])
    return this.next(this.shape.clone().translate([x, y, z]))
  }

  rotate(...args: unknown[]): Part {
    needArgs(args, 2, { command: '.rotate', what: 'an axis and an angle', example: ".rotate('z', 45)" })
    const axis = axisArg('.rotate', args[0])
    const degrees = numberArg('.rotate', 'angle', args[1])
    return this.next(this.shape.clone().rotate(degrees, [0, 0, 0], AXIS_DIRECTION[axis]))
  }

  add(other: unknown): Part {
    return this.combine('.add', other, (a, b) => a.fuse(b))
  }

  cut(other: unknown): Part {
    return this.combine('.cut', other, (a, b) => a.cut(b))
  }

  overlap(other: unknown): Part {
    return this.combine('.overlap', other, (a, b) => a.intersect(b))
  }

  mirror(axis: unknown): Part {
    return this.next(this.shape.clone().mirror(MIRROR_PLANE[axisArg('.mirror', axis)]))
  }

  copy(): Part {
    return this.next(this.shape.clone())
  }

  extrude(..._args: unknown[]): never {
    throw alreadyAPart('extrude')
  }

  spin(..._args: unknown[]): never {
    throw alreadyAPart('spin')
  }

  private next(shape: Shape3D): Part {
    return new Part(this.tracker, this.tracker.track(shape))
  }

  private combine(command: string, other: unknown, join: (a: Shape3D, b: Shape3D) => Shape3D): Part {
    const part = otherPart(command, other)
    let joined: Shape3D
    try {
      joined = join(this.shape, part.shape)
    } catch {
      throw new CadError(`${command} couldn't join these parts. Try moving one of them a little.`)
    }
    return this.next(joined)
  }
}

export type OutlineShape =
  | { readonly kind: 'polygon'; readonly points: readonly Point2[] }
  | { readonly kind: 'circle'; readonly diameter: number }

/** A flat drawing on the ground. It becomes a part with .extrude(height) or .spin(). */
export class Outline {
  constructor(private readonly tracker: ShapeTracker, private readonly cad: CadToolkit, readonly drawing: OutlineShape) {}

  extrude(...args: unknown[]): Part {
    needArgs(args, 1, { command: '.extrude', what: 'a height', example: '.extrude(5)' })
    const height = sizeArg('.extrude', 'height', args[0])
    const shape = this.drawing.kind === 'circle'
      ? this.cad.cylinder(this.drawing.diameter, height)
      : this.cad.prism(this.drawing.points, height)
    return new Part(this.tracker, this.tracker.track(shape))
  }

  /** Spins the outline around the up axis. x is the distance from the middle and y becomes the height. */
  spin(..._args: unknown[]): Part {
    if (this.drawing.kind === 'circle') throw new CadError("A circle can't spin. Use cad.sphere for a ball, or spin a polygon.")
    return new Part(this.tracker, this.tracker.track(this.cad.revolve(this.drawing.points)))
  }

  move(..._args: unknown[]): never { throw notAPartYet('move') }
  rotate(..._args: unknown[]): never { throw notAPartYet('rotate') }
  add(..._args: unknown[]): never { throw notAPartYet('add') }
  cut(..._args: unknown[]): never { throw notAPartYet('cut') }
  overlap(..._args: unknown[]): never { throw notAPartYet('overlap') }
  mirror(..._args: unknown[]): never { throw notAPartYet('mirror') }
  copy(..._args: unknown[]): never { throw notAPartYet('copy') }
}
