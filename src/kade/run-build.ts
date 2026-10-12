import type { Shape3D } from 'replicad'
import type { CadToolkit } from '../plugins/cad-types'
import type { ParamValues } from '../plugins/types'
import { CadError } from './args'
import { friendlyError } from './errors'
import { Outline, Part, ShapeTracker } from './part'
import { createKadeToolkit, type KadeToolkit } from './toolkit'

export type KadeBuild = (values: ParamValues, cad: KadeToolkit) => unknown

export const MISSING_RETURN = 'build() needs to end with return and a part, like return cad.box(10, 10, 10).'
export const RETURNED_OUTLINE = 'build() gave back a flat outline. Turn it into a part first with .extrude(height) or .spin().'

function resultOf(value: unknown): Part {
  if (value instanceof Part) return value
  throw new CadError(value instanceof Outline ? RETURNED_OUTLINE : MISSING_RETURN)
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
    result = resultOf(build(values, createKadeToolkit(tracker, internal))).shape
    return result
  } catch (error) {
    throw new Error(friendlyError(error, source))
  } finally {
    tracker.freeAllBut(result)
  }
}
