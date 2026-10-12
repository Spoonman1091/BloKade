import { z } from 'zod'
import { fail, ok, type Result } from '../shared/result'
import type { BloKadeDocument } from './types'

const vec3 = z.tuple([z.number(), z.number(), z.number()])
const transform = z.object({ position: vec3, rotation: vec3 })
const base = {
  id: z.string().min(1),
  name: z.string(),
  mode: z.enum(['solid', 'hole']),
  transform,
  hidden: z.boolean(),
  color: z.string(),
}
const shapeNode = z.object({
  ...base,
  kind: z.literal('shape'),
  shapeType: z.string().min(1),
  params: z.record(z.string(), z.number()),
})
const groupNode = z.object({ ...base, kind: z.literal('group'), children: z.array(z.string()) })
const sceneNode = z.discriminatedUnion('kind', [shapeNode, groupNode])

const documentShape = z.object({
  schemaVersion: z.literal(1),
  name: z.string(),
  units: z.literal('mm'),
  settings: z.object({ gridSnap: z.number().min(0) }),
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

export const documentSchema = documentShape.superRefine(checkTree)

export function validateDocument(raw: unknown): Result<BloKadeDocument> {
  const parsed = documentSchema.safeParse(raw)
  if (parsed.success) return ok(parsed.data)
  const issue = parsed.error.issues[0]
  const where = issue && issue.path.length > 0 ? ` (at ${issue.path.join('.')})` : ''
  return fail(`This design is damaged: ${issue?.message ?? 'unknown problem'}${where}`)
}
