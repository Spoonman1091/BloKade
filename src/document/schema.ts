import { z } from 'zod'
import { MAX_FORMULA_LENGTH } from '../formulas/formula'
import { variableNameProblem } from '../formulas/variables'
import { fail, ok, type Result } from '../shared/result'
import { MAX_FIT, MAX_TEXT_PARAM_LENGTH, type BloKadeDocument } from './types'

const FIELD_KEY = /^(?:param\.[A-Za-z0-9_]+|position\.[0-2]|rotation\.[0-2])$/

const vec3 = z.tuple([z.number(), z.number(), z.number()])
const transform = z.object({ position: vec3, rotation: vec3 })
const base = {
  id: z.string().min(1),
  name: z.string(),
  mode: z.enum(['solid', 'hole']),
  transform,
  hidden: z.boolean(),
  color: z.string(),
  formulas: z.record(z.string().regex(FIELD_KEY), z.string().max(MAX_FORMULA_LENGTH)).optional(),
}
const shapeNode = z.object({
  ...base,
  kind: z.literal('shape'),
  shapeType: z.string().min(1),
  params: z.record(z.string(), z.union([z.number(), z.string().max(MAX_TEXT_PARAM_LENGTH * 2)])),
})
const groupNode = z.object({ ...base, kind: z.literal('group'), children: z.array(z.string()) })
const sceneNode = z.discriminatedUnion('kind', [shapeNode, groupNode])
const variable = z.object({ name: z.string(), expr: z.string().max(MAX_FORMULA_LENGTH) })

const documentShape = z.object({
  schemaVersion: z.literal(2),
  name: z.string(),
  units: z.literal('mm'),
  settings: z.object({ gridSnap: z.number().min(0), fit: z.number().min(0).max(MAX_FIT) }),
  variables: z.array(variable).max(200),
  root: z.array(z.string()),
  nodes: z.record(z.string(), sceneNode),
})

type DocShape = z.infer<typeof documentShape>

/** Every node is reachable from root exactly once; ids match their keys. */
function checkTree(doc: DocShape, ctx: z.RefinementCtx): void {
  for (const [key, node] of Object.entries(doc.nodes)) {
    if (node.id !== key) ctx.addIssue({ code: 'custom', message: `Part "${key}" has mismatched id "${node.id}"` })
  }
  const seen = new Set<string>()
  const visit = (ids: readonly string[]): void => {
    for (const id of ids) {
      const node = Object.hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined
      if (!node) {
        ctx.addIssue({ code: 'custom', message: `Missing part "${id}"` })
      } else if (seen.has(id)) {
        ctx.addIssue({ code: 'custom', message: `Part "${id}" appears more than once` })
      } else {
        seen.add(id)
        if (node.kind === 'group') visit(node.children)
      }
    }
  }
  visit(doc.root)
  if (seen.size !== Object.keys(doc.nodes).length) {
    ctx.addIssue({ code: 'custom', message: 'Some parts are not connected to the design' })
  }
}

/** Variable names are valid, unreserved, and unique. */
function checkVariables(doc: DocShape, ctx: z.RefinementCtx): void {
  doc.variables.forEach((v, index) => {
    const problem = variableNameProblem(v.name, doc.variables.slice(0, index).map((earlier) => earlier.name))
    if (problem) ctx.addIssue({ code: 'custom', message: problem, path: ['variables', index, 'name'] })
  })
}

export const documentSchema = documentShape.superRefine((doc, ctx) => {
  checkTree(doc, ctx)
  checkVariables(doc, ctx)
})

export function validateDocument(raw: unknown): Result<BloKadeDocument> {
  const parsed = documentSchema.safeParse(raw)
  if (parsed.success) return ok(parsed.data)
  const issue = parsed.error.issues[0]
  const where = issue && issue.path.length > 0 ? ` (at ${issue.path.join('.')})` : ''
  return fail(`This design is damaged: ${issue?.message ?? 'unknown problem'}${where}`)
}
