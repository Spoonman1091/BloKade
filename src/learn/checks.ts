import { formulaOf, paramField } from '../document/fields'
import type { GroupNode, Modifier, ModifierType, SceneNode, ShapeNode } from '../document/types'
import type { LessonView } from './types'

const nodesOf = (view: LessonView): SceneNode[] => Object.values(view.doc.nodes)

export function nodeById(view: LessonView, id: string): SceneNode | undefined {
  return Object.hasOwn(view.doc.nodes, id) ? view.doc.nodes[id] : undefined
}

/** Every shape, or only shapes of one plugin id such as 'box'. */
export function shapesOf(view: LessonView, shapeType?: string): ShapeNode[] {
  return nodesOf(view).filter((n): n is ShapeNode => n.kind === 'shape' && (shapeType === undefined || n.shapeType === shapeType))
}

export const groupsOf = (view: LessonView): GroupNode[] => nodesOf(view).filter((n): n is GroupNode => n.kind === 'group')

export function modifiersOfType(view: LessonView, type: ModifierType): Modifier[] {
  return nodesOf(view).flatMap((n) => (n.modifiers ?? []).filter((m) => m.type === type))
}

export const variableExpr = (view: LessonView, name: string): string | undefined =>
  view.doc.variables.find((v) => v.name === name)?.expr

export const paramFormula = (node: ShapeNode, name: string): string | undefined => formulaOf(node, paramField(name))
