import { z } from 'zod'
import { MAX_FORMULA_LENGTH } from '../formulas/formula'
import { variableNameProblem } from '../formulas/variables'
import { fail, ok, type Result } from '../shared/result'
import { MAX_IMPORT_TRIANGLES, MAX_MODELS } from '../import/limits'
import { FIELD_KEY_PATTERN, isFieldKey } from './fields'
import {
  MAX_CARRIED_SHAPES, MAX_EDGE_SIZE, MAX_FIT, MAX_MODIFIERS, MAX_OFFSET, MAX_PATTERN_ANGLE, MAX_PATTERN_COUNT,
  MAX_PICKED_EDGES, MAX_SHAPE_CODE_LENGTH, MAX_SHAPE_NAME_LENGTH, MAX_TEXT_PARAM_LENGTH, MAX_VARIABLES,
  MIN_EDGE_SIZE, MIN_PATTERN_ANGLE, SHAPE_ID_PATTERN, type BloKadeDocument,
} from './types'

const vec3 = z.tuple([z.number(), z.number(), z.number()])
const transform = z.object({ position: vec3, rotation: vec3 })
const fingerprint = z.object({
  kind: z.enum(['line', 'circle', 'other']),
  mid: vec3,
  dir: vec3,
  length: z.number().min(0),
})
const edgeSelection = z.discriminatedUnion('by', [
  z.object({ by: z.literal('description'), which: z.enum(['all', 'top', 'bottom', 'vertical', 'horizontal']) }),
  z.object({ by: z.literal('picked'), fingerprints: z.array(fingerprint).max(MAX_PICKED_EDGES) }),
])
const offset = z.number().min(-MAX_OFFSET).max(MAX_OFFSET)
const offsetVec = z.tuple([offset, offset, offset])
const edgeSize = z.number().min(MIN_EDGE_SIZE).max(MAX_EDGE_SIZE)
const count = z.number().int().min(1).max(MAX_PATTERN_COUNT)
const modifierBase = { id: z.string().regex(/^[a-f0-9]{8}$/), enabled: z.boolean() }
const modifier = z.discriminatedUnion('type', [
  z.object({ ...modifierBase, type: z.literal('fillet'), radius: edgeSize, edges: edgeSelection }),
  z.object({ ...modifierBase, type: z.literal('chamfer'), distance: edgeSize, edges: edgeSelection }),
  z.object({ ...modifierBase, type: z.literal('linearPattern'), count, spacing: offsetVec }),
  z.object({
    ...modifierBase, type: z.literal('circularPattern'), count, axis: z.enum(['x', 'y', 'z']),
    angle: z.number().min(MIN_PATTERN_ANGLE).max(MAX_PATTERN_ANGLE), center: offsetVec,
  }),
  z.object({ ...modifierBase, type: z.literal('mirror'), plane: z.enum(['XY', 'XZ', 'YZ']), keepOriginal: z.boolean() }),
])
const base = {
  id: z.string().min(1),
  name: z.string(),
  mode: z.enum(['solid', 'hole']),
  transform,
  hidden: z.boolean(),
  color: z.string(),
  formulas: z.record(z.string().regex(FIELD_KEY_PATTERN).refine(isFieldKey), z.string().max(MAX_FORMULA_LENGTH)).optional(),
  modifiers: z.array(modifier).max(MAX_MODIFIERS).optional(),
}
const shapeNode = z.object({
  ...base,
  kind: z.literal('shape'),
  shapeType: z.string().min(1),
  params: z.record(z.string(), z.union([z.number(), z.string().max(MAX_TEXT_PARAM_LENGTH * 2), z.boolean()])),
})
const groupNode = z.object({ ...base, kind: z.literal('group'), children: z.array(z.string()) })
const sceneNode = z.discriminatedUnion('kind', [shapeNode, groupNode])
const variable = z.object({ name: z.string(), expr: z.string().max(MAX_FORMULA_LENGTH) })

const carriedShape = z.object({
  name: z.string().min(1).max(MAX_SHAPE_NAME_LENGTH),
  code: z.string().max(MAX_SHAPE_CODE_LENGTH),
})
const carriedShapes = z.record(z.string().regex(SHAPE_ID_PATTERN), carriedShape)
  .refine((shapes) => Object.keys(shapes).length <= MAX_CARRIED_SHAPES, `A design can carry up to ${MAX_CARRIED_SHAPES} of your shapes`)

/** Longest base64 text for this many bytes (rounded up, plus padding slack). */
const base64Limit = (bytes: number): number => Math.ceil((bytes * 4) / 3) + 4
const VERTEX_BYTES = 3 * MAX_IMPORT_TRIANGLES * 12
const TRIANGLE_BYTES = MAX_IMPORT_TRIANGLES * 12
const base64 = /^[A-Za-z0-9+/]*={0,2}$/
const importedModel = z.object({
  name: z.string().max(100),
  vertices: z.string().max(base64Limit(VERTEX_BYTES)).regex(base64),
  triangles: z.string().max(base64Limit(TRIANGLE_BYTES)).regex(base64),
})
const importedModels = z.record(z.string().regex(/^[0-9a-f]{8}-[0-9a-z]+$/), importedModel)
  .refine((models) => Object.keys(models).length <= MAX_MODELS, `A design can have up to ${MAX_MODELS} imported models`)

const documentShape = z.object({
  schemaVersion: z.literal(5),
  name: z.string(),
  units: z.literal('mm'),
  settings: z.object({ gridSnap: z.number().min(0), fit: z.number().min(0).max(MAX_FIT) }),
  variables: z.array(variable).max(MAX_VARIABLES),
  root: z.array(z.string()),
  nodes: z.record(z.string(), sceneNode),
  plugins: carriedShapes,
  models: importedModels,
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

/** Modifier ids are unique within each part (fields and formulas are keyed by them). */
function checkModifierIds(doc: DocShape, ctx: z.RefinementCtx): void {
  for (const node of Object.values(doc.nodes)) {
    const ids = (node.modifiers ?? []).map((m) => m.id)
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', message: `Part "${node.name}" has two modifiers with the same id` })
    }
  }
}

export const documentSchema = documentShape.superRefine((doc, ctx) => {
  checkTree(doc, ctx)
  checkVariables(doc, ctx)
  checkModifierIds(doc, ctx)
})

export function validateDocument(raw: unknown): Result<BloKadeDocument> {
  const parsed = documentSchema.safeParse(raw)
  if (parsed.success) return ok(parsed.data)
  const issue = parsed.error.issues[0]
  const where = issue && issue.path.length > 0 ? ` (at ${issue.path.join('.')})` : ''
  return fail(`This design is damaged: ${issue?.message ?? 'unknown problem'}${where}`)
}
