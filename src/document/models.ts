import { codeHash } from '../kade/hash'
import { MAX_MODELS } from '../import/limits'
import { createShapeNode } from './factory'
import { addNode, DocumentOpError } from './ops'
import { descendantsOf } from './tree'
import type { BloKadeDocument, ImportedModel, NodeId, Vec3 } from './types'

/** The shape type of a part made from an imported model. */
export const IMPORTED_SHAPE = 'imported'

export const TOO_MANY_MODELS = `This design already has ${MAX_MODELS} imported models. Delete a part that uses one, then try again.`

/** Bytes turned into text in one call, so a big model can't overflow the call stack. */
const CHUNK_BYTES = 32 * 1024

function toBase64(bytes: Uint8Array): string {
  const chunks: string[] = []
  for (let start = 0; start < bytes.length; start += CHUNK_BYTES) {
    chunks.push(String.fromCharCode(...bytes.subarray(start, start + CHUNK_BYTES)))
  }
  return btoa(chunks.join(''))
}

function fromBase64(text: string): ArrayBuffer {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

const bytesOf = (array: Float32Array | Uint32Array): Uint8Array => new Uint8Array(array.buffer, array.byteOffset, array.byteLength)

/** Packs a model for the design file. The id comes from the data, so the same model is only stored once. */
export function encodeModel(name: string, vertices: Float32Array, triangles: Uint32Array): { id: string; model: ImportedModel } {
  const model: ImportedModel = { name, vertices: toBase64(bytesOf(vertices)), triangles: toBase64(bytesOf(triangles)) }
  return { id: codeHash(`${model.vertices}|${model.triangles}`), model }
}

/** Unpacks a stored model (little-endian numbers, as written by encodeModel). */
export function decodeModel(model: ImportedModel): { vertices: Float32Array; triangles: Uint32Array } {
  return { vertices: new Float32Array(fromBase64(model.vertices)), triangles: new Uint32Array(fromBase64(model.triangles)) }
}

interface ImportedPartInput {
  name: string
  vertices: Float32Array
  triangles: Uint32Array
  /** The model's natural size in mm; it becomes the part's starting width, depth and height. */
  size: Vec3
  color: string
  position?: Vec3
  rotation?: Vec3
}

/** Stores the model (once) and adds a part that uses it. Models no part uses are dropped; undo still has them in the history. */
export function addImportedPart(doc: BloKadeDocument, input: ImportedPartInput): { doc: BloKadeDocument; id: NodeId } {
  const { id: modelId, model } = encodeModel(input.name, input.vertices, input.triangles)
  const current = withoutUnusedModels(doc)
  const known = Object.hasOwn(current.models, modelId)
  if (!known && Object.keys(current.models).length >= MAX_MODELS) throw new DocumentOpError(TOO_MANY_MODELS)
  const [width, depth, height] = input.size
  const node = createShapeNode({
    shapeType: IMPORTED_SHAPE, name: input.name, params: { model: modelId, width, depth, height },
    color: input.color, position: input.position, rotation: input.rotation,
  })
  const withModel = known ? current : { ...current, models: { ...current.models, [modelId]: model } }
  return { doc: addNode(withModel, node), id: node.id }
}

/** The ids of the models that parts use. */
export function modelsInUse(doc: BloKadeDocument): ReadonlySet<string> {
  return new Set(Object.values(doc.nodes).flatMap((node) => {
    const model = node.kind === 'shape' && node.shapeType === IMPORTED_SHAPE ? node.params.model : undefined
    return typeof model === 'string' ? [model] : []
  }))
}

/** The design without models no part uses. Only the saved copy is trimmed, so undo can still bring a model back. */
export function withoutUnusedModels(doc: BloKadeDocument): BloKadeDocument {
  const used = modelsInUse(doc)
  const kept = Object.entries(doc.models).filter(([id]) => used.has(id))
  return kept.length === Object.keys(doc.models).length ? doc : { ...doc, models: Object.fromEntries(kept) }
}

const isImportedPart = (doc: BloKadeDocument, id: NodeId): boolean => {
  const node = Object.hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined
  return node?.kind === 'shape' && node.shapeType === IMPORTED_SHAPE
}

/** True for an imported part, or a group with one anywhere inside. */
export function containsImported(doc: BloKadeDocument, id: NodeId): boolean {
  return isImportedPart(doc, id) || descendantsOf(doc, id).some((child) => isImportedPart(doc, child))
}
