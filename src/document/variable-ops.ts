import { MAX_FORMULA_LENGTH, renameVariableIn } from '../formulas/formula'
import { variableNameProblem } from '../formulas/variables'
import { formulaEntries, withFormula } from './fields'
import { recomputeFormulas, type NormalizeField } from './formula-ops'
import { DocumentOpError } from './ops'
import { MAX_FIT, MAX_VARIABLES, type BloKadeDocument, type SceneNode, type Variable } from './types'

const namesOf = (doc: BloKadeDocument): string[] => doc.variables.map((v) => v.name)

function requireVariable(doc: BloKadeDocument, name: string): Variable {
  const found = doc.variables.find((v) => v.name === name)
  if (!found) throw new DocumentOpError(`There's no variable called "${name}".`)
  return found
}

function cleanExpr(expr: string): string {
  const text = expr.trim()
  if (text === '') throw new DocumentOpError('Type a number or a formula.')
  if (text.length > MAX_FORMULA_LENGTH) throw new DocumentOpError(`Formulas can be up to ${MAX_FORMULA_LENGTH} characters long.`)
  return text
}

/** The first free name like var1, var2… for a brand-new variable. */
export function nextVariableName(doc: BloKadeDocument): string {
  const taken = new Set(namesOf(doc))
  const free = Array.from({ length: taken.size + 1 }, (_, i) => `var${i + 1}`).find((name) => !taken.has(name))
  return free ?? `var${taken.size + 1}`
}

export function addVariable(doc: BloKadeDocument, name: string, expr: string, normalize: NormalizeField): BloKadeDocument {
  if (doc.variables.length >= MAX_VARIABLES) throw new DocumentOpError(`A design can have up to ${MAX_VARIABLES} variables.`)
  const problem = variableNameProblem(name, namesOf(doc))
  if (problem) throw new DocumentOpError(problem)
  return recomputeFormulas({ ...doc, variables: [...doc.variables, { name, expr: cleanExpr(expr) }] }, normalize)
}

export function setVariableExpr(doc: BloKadeDocument, name: string, expr: string, normalize: NormalizeField): BloKadeDocument {
  requireVariable(doc, name)
  const text = cleanExpr(expr)
  const variables = doc.variables.map((v) => (v.name === name ? { ...v, expr: text } : v))
  return recomputeFormulas({ ...doc, variables }, normalize)
}

const renameInNode = (node: SceneNode, from: string, to: string): SceneNode =>
  formulaEntries(node).reduce((acc, [key, text]) => {
    const renamed = renameVariableIn(text, from, to)
    return renamed === text ? acc : withFormula(acc, key, renamed)
  }, node)

const tooLong = (text: string): boolean => text.length > MAX_FORMULA_LENGTH

/** Renames a variable and rewrites every formula that uses it, so nothing breaks. */
export function renameVariable(doc: BloKadeDocument, from: string, to: string, normalize: NormalizeField): BloKadeDocument {
  requireVariable(doc, from)
  const name = to.trim()
  if (name === from) return doc
  const problem = variableNameProblem(name, namesOf(doc).filter((n) => n !== from))
  if (problem) throw new DocumentOpError(problem)
  const variables = doc.variables.map((v) => ({ name: v.name === from ? name : v.name, expr: renameVariableIn(v.expr, from, name) }))
  const nodes = Object.fromEntries(Object.entries(doc.nodes).map(([id, node]) => [id, renameInNode(node, from, name)] as const))
  const overlong = variables.some((v) => tooLong(v.expr))
    || Object.values(nodes).some((node) => formulaEntries(node).some(([, text]) => tooLong(text)))
  if (overlong) {
    throw new DocumentOpError(`That name would make a formula longer than ${MAX_FORMULA_LENGTH} characters. Pick a shorter name.`)
  }
  return recomputeFormulas({ ...doc, variables, nodes }, normalize)
}

/** Deletes a variable. Formulas that used it show a problem and keep their last number. */
export function removeVariable(doc: BloKadeDocument, name: string, normalize: NormalizeField): BloKadeDocument {
  requireVariable(doc, name)
  return recomputeFormulas({ ...doc, variables: doc.variables.filter((v) => v.name !== name) }, normalize)
}

/** Sets the `fit` gap (clamped to 0–2 mm) and re-runs formulas that use it. */
export function setFit(doc: BloKadeDocument, fit: number, normalize: NormalizeField): BloKadeDocument {
  if (!Number.isFinite(fit)) throw new DocumentOpError('The fit gap must be a number.')
  const clamped = Math.min(MAX_FIT, Math.max(0, fit))
  return recomputeFormulas({ ...doc, settings: { ...doc.settings, fit: clamped } }, normalize)
}
