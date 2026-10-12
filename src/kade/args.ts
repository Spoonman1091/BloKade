import { MAX_MM } from '../plugins/params'

/** A problem with how Kade used a cad command. Its message is already kid-friendly. */
export class CadError extends Error {
  override name = 'CadError'
}

/** cad.repeat makes at most this many copies. */
export const MAX_REPEAT = 200

export type Axis = 'x' | 'y' | 'z'

function describe(value: unknown): string {
  if (value === undefined) return 'missing'
  if (typeof value === 'string') return `"${value}"`
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return 'a list'
  return typeof value === 'function' ? 'a function' : 'something else'
}

/** Stops with, for example, "cad.box needs 3 sizes, like cad.box(20, 10, 5)" when arguments are missing. */
export function needArgs(
  args: readonly unknown[], count: number, usage: { readonly command: string; readonly what: string; readonly example: string },
): void {
  if (args.length < count || args.slice(0, count).some((a) => a === undefined)) {
    throw new CadError(`${usage.command} needs ${usage.what}, like ${usage.example}`)
  }
}

export function numberArg(command: string, name: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CadError(`${command}: the ${name} must be a number — it was ${describe(value)}`)
  }
  return value
}

export function sizeArg(command: string, name: string, value: unknown): number {
  const size = numberArg(command, name, value)
  if (size <= 0) throw new CadError(`Sizes must be bigger than 0 — ${name} was ${size}`)
  if (size > MAX_MM) throw new CadError(`Sizes can be up to ${MAX_MM} mm — ${name} was ${size}`)
  return size
}

/** Like sizeArg, but 0 is allowed (for example a cone's pointy top). */
export function sizeOrZeroArg(command: string, name: string, value: unknown): number {
  const size = numberArg(command, name, value)
  if (size < 0) throw new CadError(`Sizes can't be less than 0 — ${name} was ${size}`)
  if (size > MAX_MM) throw new CadError(`Sizes can be up to ${MAX_MM} mm — ${name} was ${size}`)
  return size
}

export function distanceArg(command: string, name: string, value: unknown): number {
  const distance = numberArg(command, name, value)
  if (Math.abs(distance) > MAX_MM) throw new CadError(`Moves can be up to ${MAX_MM} mm — ${name} was ${distance}`)
  return distance
}

export function wholeArg(command: string, name: string, value: unknown, min: number, max: number): number {
  const n = numberArg(command, name, value)
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new CadError(`${command}: the ${name} must be a whole number from ${min} to ${max} — it was ${n}`)
  }
  return n
}

export function axisArg(command: string, value: unknown): Axis {
  if (value === 'x' || value === 'y' || value === 'z') return value
  throw new CadError(`${command} needs 'x', 'y' or 'z' — it was ${describe(value)}`)
}
