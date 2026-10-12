import { z } from 'zod'
import { MAX_TEXT_PARAM_LENGTH } from '../document/types'
import { computeFormula, MAX_FORMULA_LENGTH } from '../formulas/formula'
import { isNumberSpec, type ParamSpec, type ShapePlugin } from './types'

export interface PluginRegistry {
  get(id: string): ShapePlugin | undefined
  list(): readonly ShapePlugin[]
}

const numberSpec = z.object({
  type: z.enum(['mm', 'whole', 'number', 'angle']),
  default: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
  label: z.string().min(1),
  formula: z.string().min(1).max(MAX_FORMULA_LENGTH).optional(),
})
const textSpec = z.object({
  type: z.literal('text'),
  default: z.string().max(MAX_TEXT_PARAM_LENGTH),
  maxLength: z.number().int().min(1).max(MAX_TEXT_PARAM_LENGTH).optional(),
  label: z.string().min(1),
})
const choiceSpec = z.object({
  type: z.literal('choice'),
  default: z.string(),
  options: z.array(z.object({ value: z.string().min(1).max(40), label: z.string().min(1) })).min(2),
  label: z.string().min(1),
}).refine((s) => s.options.some((o) => o.value === s.default), 'a choice default must be one of its options')
const yesNoSpec = z.object({ type: z.literal('yesno'), default: z.boolean(), label: z.string().min(1) })
const paramSpec = z.union([numberSpec, textSpec, choiceSpec, yesNoSpec])

/** Starting formulas may only use `fit`: it's the one variable every design has. */
export const FIT_ONLY = new Map([['fit', 0.2]])

const pluginSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/, 'id must be lowercase letters, numbers and dashes'),
    name: z.string().min(1),
    icon: z.string().min(1),
    version: z.number().int().positive(),
    params: z.record(z.string(), paramSpec),
    mode: z.literal('hole').optional(),
    palette: z.enum(['shapes', 'fit', 'hidden']).optional(),
    revision: z.string().optional(),
    toolkit: z.literal('kade').optional(),
    source: z.string().optional(),
    size: z.object({ x: z.string().optional(), y: z.string().optional(), z: z.string().optional() }).optional(),
    build: z.custom<ShapePlugin['build']>((v) => typeof v === 'function', 'build must be a function'),
  })
  .superRefine((p, ctx) => {
    for (const target of Object.values(p.size ?? {})) {
      if (!target) continue
      const spec = Object.hasOwn(p.params, target) ? p.params[target] : undefined
      if (!spec) ctx.addIssue({ code: 'custom', message: `size handle points at missing parameter "${target}"` })
      else if (!isNumberSpec(spec as ParamSpec)) ctx.addIssue({ code: 'custom', message: `size handle can't change the ${spec.type} parameter "${target}"` })
    }
    for (const [name, spec] of Object.entries(p.params)) {
      if (!isNumberSpec(spec as ParamSpec) || !('formula' in spec) || spec.formula === undefined) continue
      if (!computeFormula(spec.formula, FIT_ONLY).ok) {
        ctx.addIssue({ code: 'custom', message: `the starting formula of "${name}" may only use fit` })
      }
    }
  })

const labelOf = (candidate: unknown, index: number): string => {
  const name = typeof candidate === 'object' && candidate !== null && 'name' in candidate ? String(candidate.name) : ''
  return name ? `"${name}"` : `#${index + 1}`
}

export function createRegistry(candidates: readonly unknown[]): {
  registry: PluginRegistry
  problems: readonly string[]
} {
  const byId = new Map<string, ShapePlugin>()
  const problems: string[] = []
  candidates.forEach((candidate, index) => {
    const parsed = pluginSchema.safeParse(candidate)
    if (!parsed.success) {
      problems.push(`Plugin ${labelOf(candidate, index)} has a problem: ${parsed.error.issues[0]?.message ?? 'invalid'}`)
      return
    }
    const plugin = candidate as ShapePlugin
    if (byId.has(plugin.id)) {
      problems.push(`Two plugins use the id "${plugin.id}"; keeping the first one.`)
      return
    }
    byId.set(plugin.id, plugin)
  })
  const list = [...byId.values()]
  return { registry: { get: (id) => byId.get(id), list: () => list }, problems }
}
