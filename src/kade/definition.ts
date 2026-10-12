import { MAX_SHAPE_NAME_LENGTH } from '../document/types'
import { isNumberSpec, type ParamSpecs, type ParamValues } from '../plugins/types'
import { fail, ok, type Result } from '../shared/result'
import type { ShapeMeta } from './meta'
import { isRecord, toParamSpecs } from './settings'

export const DEFAULT_ICON = '🧩'
export const NO_EXPORT = 'Your shape needs to start with export default { … }. Look at a new shape to see how.'
export const NO_NAME = "Your shape needs a name in quotes, like name: 'Robot head'."
export const NO_BUILD = 'Your shape needs a build function, like build(settings, cad) { return cad.box(10, 10, 10) }.'

/** Kade's build function. The worker calls it through runKadeBuild with the friendly toolkit. */
export type ShapeBuild = (values: ParamValues, cad: unknown) => unknown

export interface ShapeDefinition {
  readonly meta: ShapeMeta
  readonly build: ShapeBuild
}

const AXES = ['x', 'y', 'z'] as const

function nameOf(raw: unknown): Result<string> {
  const name = typeof raw === 'string' ? raw.trim() : ''
  if (!name) return fail(NO_NAME)
  return name.length > MAX_SHAPE_NAME_LENGTH ? fail(`Shape names can be up to ${MAX_SHAPE_NAME_LENGTH} letters long.`) : ok(name)
}

const iconOf = (raw: unknown): string =>
  typeof raw === 'string' && raw.trim() ? Array.from(raw.trim()).slice(0, 4).join('') : DEFAULT_ICON

function handleProblem(axis: string, target: unknown, params: ParamSpecs): string | null {
  if (typeof target !== 'string') return `size.${axis} needs a setting name in quotes, like ${axis}: 'width'.`
  const spec = Object.hasOwn(params, target) ? params[target] : undefined
  if (!spec) return `size.${axis} points at "${target}", but there's no setting called "${target}".`
  return isNumberSpec(spec) ? null : `size.${axis} can only change a number setting, and "${target}" is a ${spec.type} setting.`
}

function sizeHandles(raw: unknown, params: ParamSpecs): Result<ShapeMeta['size']> {
  if (raw === undefined) return ok(undefined)
  if (!isRecord(raw)) return fail("size needs curly brackets, like size: { x: 'width', y: 'depth', z: 'height' }.")
  const handles = AXES.flatMap((axis) => (raw[axis] === undefined ? [] : [[axis, raw[axis]] as const]))
  for (const [axis, target] of handles) {
    const problem = handleProblem(axis, target, params)
    if (problem) return fail(problem)
  }
  return ok(Object.fromEntries(handles) as ShapeMeta['size'])
}

function modeOf(raw: unknown): Result<'hole' | undefined> {
  if (raw === undefined || raw === 'solid') return ok(undefined)
  return raw === 'hole' ? ok('hole') : fail("mode can be 'solid' or 'hole'.")
}

function paletteOf(raw: unknown): Result<ShapeMeta['palette']> {
  if (raw === undefined) return ok(undefined)
  return raw === 'shapes' || raw === 'fit' || raw === 'hidden' ? ok(raw) : fail("palette can be 'shapes' or 'fit'.")
}

/** Checks a module's `export default { … }` and returns its details and build, or the first problem in plain words. */
export function readShapeDefinition(exports: Readonly<Record<string, unknown>>): Result<ShapeDefinition> {
  const raw = exports.default
  if (!isRecord(raw)) return fail(NO_EXPORT)
  const name = nameOf(raw.name)
  if (!name.ok) return fail(name.error)
  if (typeof raw.build !== 'function') return fail(NO_BUILD)
  const params = toParamSpecs(raw.settings ?? raw.params)
  if (!params.ok) return fail(params.error)
  const size = sizeHandles(raw.size, params.value)
  if (!size.ok) return fail(size.error)
  const mode = modeOf(raw.mode)
  if (!mode.ok) return fail(mode.error)
  const palette = paletteOf(raw.palette)
  if (!palette.ok) return fail(palette.error)
  const meta: ShapeMeta = {
    name: name.value, icon: iconOf(raw.icon), params: params.value,
    ...(size.value ? { size: size.value } : {}), ...(mode.value ? { mode: mode.value } : {}),
    ...(palette.value ? { palette: palette.value } : {}),
  }
  return ok({ meta, build: raw.build as ShapeBuild })
}
