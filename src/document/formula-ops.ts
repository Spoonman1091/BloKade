import { computeFormula, MAX_FORMULA_LENGTH } from '../formulas/formula'
import { resolveVariables, type VariableValues } from '../formulas/variables'
import { formulaEntries, formulaOf, readField, withFormula, writeField } from './fields'
import { DocumentOpError, updateNode } from './ops'
import type { BloKadeDocument, FieldKey, NodeId, SceneNode } from './types'

/** Clamps a number for one field (for example sizes to 0.01–2000 mm). The app supplies it; it knows the plugins. */
export type NormalizeField = (node: SceneNode, key: FieldKey, value: number) => number

export type FormulaErrors = Readonly<Record<NodeId, Readonly<Record<string, string>>>>

export const variableValues = (doc: BloKadeDocument): VariableValues =>
  resolveVariables(doc.variables, doc.settings.fit)

function applyInput(node: SceneNode, key: FieldKey, input: string, scope: ReadonlyMap<string, number>, normalize: NormalizeField): SceneNode {
  if (readField(node, key) === undefined) throw new DocumentOpError("That value can't hold a number.")
  const literal = Number(input)
  if (Number.isFinite(literal)) {
    const next = writeField(node, key, normalize(node, key, literal))
    return formulaOf(node, key) === undefined ? next : withFormula(next, key, null)
  }
  const result = computeFormula(input, scope)
  const withText = withFormula(node, key, input)
  // A broken formula is kept so Kade can fix it; meanwhile the field keeps its last good number.
  return result.ok ? writeField(withText, key, normalize(node, key, result.value)) : withText
}

/** Typing into a field: a plain number replaces any formula; anything else is kept as a formula. */
export function setFieldInput(
  doc: BloKadeDocument, id: NodeId, key: FieldKey, text: string, normalize: NormalizeField,
): BloKadeDocument {
  const input = text.trim()
  if (input === '') throw new DocumentOpError('Type a number or a formula.')
  if (input.length > MAX_FORMULA_LENGTH) {
    throw new DocumentOpError(`Formulas can be up to ${MAX_FORMULA_LENGTH} characters long.`)
  }
  const { scope } = variableValues(doc)
  return updateNode(doc, id, (node) => applyInput(node, key, input, scope, normalize))
}

function recomputeNode(node: SceneNode, scope: ReadonlyMap<string, number>, normalize: NormalizeField): SceneNode {
  return formulaEntries(node).reduce((acc, [key, text]) => {
    const result = computeFormula(text, scope)
    return result.ok ? writeField(acc, key, normalize(acc, key, result.value)) : acc
  }, node)
}

/** Re-runs every field formula after a variable or `fit` changed. Broken formulas keep their last number. */
export function recomputeFormulas(doc: BloKadeDocument, normalize: NormalizeField): BloKadeDocument {
  const { scope } = variableValues(doc)
  const nodes = Object.fromEntries(
    Object.entries(doc.nodes).map(([id, node]) => [id, recomputeNode(node, scope, normalize)] as const),
  )
  return { ...doc, nodes }
}

/** Every field formula that doesn't work right now, by part and field. */
export function formulaErrors(doc: BloKadeDocument): FormulaErrors {
  const { scope } = variableValues(doc)
  return Object.fromEntries(Object.values(doc.nodes).flatMap((node) => {
    const problems = formulaEntries(node).flatMap(([key, text]) => {
      const result = computeFormula(text, scope)
      return result.ok ? [] : [[key, result.error] as const]
    })
    return problems.length > 0 ? [[node.id, Object.fromEntries(problems)] as const] : []
  }))
}
