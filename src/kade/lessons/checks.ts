import type { CodeView } from '../code-view'

const TOLERANCE = 0.5

export const near = (value: number | undefined, target: number, tolerance = TOLERANCE): boolean =>
  value !== undefined && Math.abs(value - target) <= tolerance

const sizeOf = (view: CodeView, axis: 0 | 1 | 2): number | undefined =>
  view.bounds ? view.bounds.max[axis] - view.bounds.min[axis] : undefined

/** Left to right (x). */
export const widthOf = (view: CodeView): number | undefined => sizeOf(view, 0)
/** Front to back (y). */
export const depthOf = (view: CodeView): number | undefined => sizeOf(view, 1)
/** Bottom to top (z). */
export const heightOf = (view: CodeView): number | undefined => sizeOf(view, 2)
export const bottomOf = (view: CodeView): number | undefined => view.bounds?.min[2]

export const codeHas = (view: CodeView, pattern: RegExp): boolean => pattern.test(view.code)

export const settingType = (view: CodeView, name: string): string | undefined =>
  view.meta && Object.hasOwn(view.meta.params, name) ? view.meta.params[name]?.type : undefined
