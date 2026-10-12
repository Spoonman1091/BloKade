import { z } from 'zod'
import { MAX_TEXT_PARAM_LENGTH } from '../document/types'
import type { ShapePlugin } from './types'

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
})
const textSpec = z.object({
  type: z.literal('text'),
  default: z.string().max(MAX_TEXT_PARAM_LENGTH),
  maxLength: z.number().int().min(1).max(MAX_TEXT_PARAM_LENGTH).optional(),
  label: z.string().min(1),
})
const paramSpec = z.union([numberSpec, textSpec])

const pluginSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/, 'id must be lowercase letters, numbers and dashes'),
    name: z.string().min(1),
    icon: z.string().min(1),
    version: z.number().int().positive(),
    params: z.record(z.string(), paramSpec),
    size: z.object({ x: z.string().optional(), y: z.string().optional(), z: z.string().optional() }).optional(),
    build: z.custom<ShapePlugin['build']>((v) => typeof v === 'function', 'build must be a function'),
  })
  .superRefine((p, ctx) => {
    for (const target of Object.values(p.size ?? {})) {
      if (!target) continue
      const spec = Object.hasOwn(p.params, target) ? p.params[target] : undefined
      if (!spec) ctx.addIssue({ code: 'custom', message: `size handle points at missing parameter "${target}"` })
      else if (spec.type === 'text') ctx.addIssue({ code: 'custom', message: `size handle can't change the text parameter "${target}"` })
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
