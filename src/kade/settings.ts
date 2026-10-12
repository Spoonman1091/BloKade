import { MAX_TEXT_PARAM_LENGTH } from '../document/types'
import { computeFormula, MAX_FORMULA_LENGTH } from '../formulas/formula'
import { FIT_ONLY } from '../plugins/registry'
import type { ChoiceOption, ChoiceParamSpec, NumberParamSpec, ParamSpec, ParamSpecs, TextParamSpec, YesNoParamSpec } from '../plugins/types'
import { fail, ok, type Result } from '../shared/result'

export const MAX_SETTINGS = 30
const MAX_LABEL = 40
const MAX_OPTION = 40
const SETTING_NAME = /^[A-Za-z_$][A-Za-z0-9_$]*$/
const NUMBER_TYPES: readonly string[] = ['mm', 'whole', 'number', 'angle']

type Raw = Readonly<Record<string, unknown>>

export const isRecord = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value)

const labelOf = (name: string, raw: Raw): string =>
  typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim().slice(0, MAX_LABEL) : name

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function startingFormula(name: string, value: unknown): Result<string | null> {
  if (value === undefined) return ok(null)
  if (typeof value === 'string' && value.length <= MAX_FORMULA_LENGTH && computeFormula(value, FIT_ONLY).ok) return ok(value)
  return fail(`The starting formula of "${name}" can only use fit, like formula: 'fit'.`)
}

function numberSpec(name: string, raw: Raw, type: NumberParamSpec['type']): Result<ParamSpec> {
  const { default: value, min, max } = raw
  if (!isFiniteNumber(value)) return fail(`The setting "${name}" needs a number default, like default: 20.`)
  if ((min !== undefined && !isFiniteNumber(min)) || (max !== undefined && !isFiniteNumber(max))) {
    return fail(`The min and max of "${name}" must be numbers.`)
  }
  if (isFiniteNumber(min) && isFiniteNumber(max) && min > max) return fail(`The setting "${name}" has a min bigger than its max.`)
  if ((isFiniteNumber(min) && value < min) || (isFiniteNumber(max) && value > max)) {
    return fail(`The default of "${name}" is outside its min and max.`)
  }
  const formula = startingFormula(name, raw.formula)
  if (!formula.ok) return fail(formula.error)
  return ok({
    type, default: value, label: labelOf(name, raw),
    ...(isFiniteNumber(min) ? { min } : {}), ...(isFiniteNumber(max) ? { max } : {}),
    ...(formula.value ? { formula: formula.value } : {}),
  })
}

function textSpec(name: string, raw: Raw): Result<TextParamSpec> {
  const { default: value, maxLength } = raw
  if (typeof value !== 'string' || Array.from(value).length > MAX_TEXT_PARAM_LENGTH) {
    return fail(`The setting "${name}" needs a default in quotes, like default: 'Hi' (up to ${MAX_TEXT_PARAM_LENGTH} letters).`)
  }
  const goodLength = typeof maxLength === 'number' && Number.isInteger(maxLength) && maxLength >= 1 && maxLength <= MAX_TEXT_PARAM_LENGTH
  if (maxLength !== undefined && !goodLength) return fail(`The maxLength of "${name}" must be a whole number from 1 to ${MAX_TEXT_PARAM_LENGTH}.`)
  return ok({ type: 'text', default: value, label: labelOf(name, raw), ...(typeof maxLength === 'number' ? { maxLength } : {}) })
}

function optionOf(value: unknown): ChoiceOption | null {
  if (typeof value === 'string' && value && value.length <= MAX_OPTION) return { value, label: value }
  if (!isRecord(value) || typeof value.value !== 'string' || !value.value || value.value.length > MAX_OPTION) return null
  return { value: value.value, label: typeof value.label === 'string' && value.label ? value.label : value.value }
}

function choiceSpec(name: string, raw: Raw): Result<ChoiceParamSpec> {
  const listed = Array.isArray(raw.options) ? raw.options.map(optionOf) : []
  const options = listed.filter((o): o is ChoiceOption => o !== null)
  if (options.length < 2 || options.length !== listed.length) {
    return fail(`The setting "${name}" needs at least 2 options, like options: ['round', 'square'].`)
  }
  if (new Set(options.map((o) => o.value)).size !== options.length) return fail(`Two options of "${name}" are the same.`)
  const value = raw.default
  if (typeof value !== 'string' || !options.some((o) => o.value === value)) return fail(`The default of "${name}" must be one of its options.`)
  return ok({ type: 'choice', default: value, label: labelOf(name, raw), options })
}

function yesNoSpec(name: string, raw: Raw): Result<YesNoParamSpec> {
  if (typeof raw.default !== 'boolean') return fail(`The setting "${name}" needs default: true or default: false.`)
  return ok({ type: 'yesno', default: raw.default, label: labelOf(name, raw) })
}

function specOf(name: string, raw: unknown): Result<ParamSpec> {
  if (!SETTING_NAME.test(name)) return fail(`"${name}" can't be a setting name. Use letters and numbers, like width2.`)
  if (!isRecord(raw)) return fail(`The setting "${name}" needs curly brackets, like ${name}: { type: 'mm', default: 20 }.`)
  const type = raw.type
  if (typeof type === 'string' && NUMBER_TYPES.includes(type)) return numberSpec(name, raw, type as NumberParamSpec['type'])
  if (type === 'text') return textSpec(name, raw)
  if (type === 'choice') return choiceSpec(name, raw)
  if (type === 'yesno') return yesNoSpec(name, raw)
  return fail(`The setting "${name}" needs a type: 'mm', 'whole', 'number', 'angle', 'text', 'choice' or 'yesno'.`)
}

/** Kade's `settings` (or `params`) as checked parameter specs, or the first problem in plain words. */
export function toParamSpecs(raw: unknown): Result<ParamSpecs> {
  if (raw === undefined) return ok({})
  if (!isRecord(raw)) return fail("settings needs curly brackets, like settings: { size: { type: 'mm', default: 20 } }.")
  const entries = Object.entries(raw)
  if (entries.length > MAX_SETTINGS) return fail(`A shape can have up to ${MAX_SETTINGS} settings.`)
  const checked = entries.map(([name, value]) => [name, specOf(name, value)] as const)
  for (const [, result] of checked) if (!result.ok) return fail(result.error)
  return ok(Object.fromEntries(checked.flatMap(([name, result]) => (result.ok ? [[name, result.value]] : []))))
}
