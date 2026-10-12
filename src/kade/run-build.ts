import type { Shape3D } from 'replicad'
import type { CadToolkit } from '../plugins/cad-types'
import type { ParamValues } from '../plugins/types'
import { CadError } from './args'
import { friendlyError } from './errors'
import { ASYNC_BUILD } from './messages'
import { Outline, Part, ShapeTracker } from './part'
import { createKadeToolkit, type KadeToolkit } from './toolkit'

export type KadeBuild = (values: ParamValues, cad: KadeToolkit) => unknown

export const MISSING_RETURN = 'build() needs to end with return and a part, like return cad.box(10, 10, 10).'
export const RETURNED_OUTLINE = 'build() gave back a flat outline. Turn it into a part first with .extrude(height) or .spin().'

function isThenable(value: unknown): value is PromiseLike<unknown> {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false
  return typeof (value as { then?: unknown }).then === 'function'
}

/** The part build() gave back. An async build gives back a promise: its later failure is let go quietly. */
export function resultOf(value: unknown): Part {
  if (value instanceof Part) return value
  if (isThenable(value)) {
    value.then(undefined, () => undefined)
    throw new CadError(ASYNC_BUILD)
  }
  throw new CadError(value instanceof Outline ? RETURNED_OUTLINE : MISSING_RETURN)
}

/** The result's shape. A part kept from an earlier build belongs to that build, so this build gives back its own copy. */
function ownShape(part: Part, tracker: ShapeTracker): Shape3D {
  return tracker.owns(part) ? part.shape : tracker.track(part.shape.clone())
}

/**
 * Runs one of Kade's builds with the friendly toolkit. Errors come back in plain words, with the line when known.
 * Every shape the build made is freed except the result, which the caller now owns.
 */
export function runKadeBuild(
  build: KadeBuild, values: ParamValues, source: string | null, internal?: CadToolkit, tracker = new ShapeTracker(),
): Shape3D {
  let result: Shape3D | null = null
  try {
    result = ownShape(resultOf(build(values, createKadeToolkit(tracker, internal))), tracker)
    return result
  } catch (error) {
    throw new Error(friendlyError(error, source))
  } finally {
    tracker.freeAllBut(result)
  }
}
