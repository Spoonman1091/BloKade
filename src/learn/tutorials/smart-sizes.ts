import { paramFormula, shapesOf, variableExpr } from '../checks'
import type { LessonView, Tutorial } from '../types'

const usesWall = (formula: string | undefined): boolean => formula !== undefined && /\bwall\b/.test(formula)
const box = (v: LessonView) => shapesOf(v, 'box')[0]
const cylinder = (v: LessonView) => shapesOf(v, 'cylinder')[0]

export const smartSizes: Tutorial = {
  id: 'smart-sizes',
  title: 'Smart sizes',
  icon: '🧮',
  intro: 'Give a number a name, use it in two parts, and change both at once.',
  steps: [
    {
      id: 'add-box', text: 'Click **Box** to add a box.', target: 'add-box',
      check: (v) => box(v) !== undefined,
      hint: 'Box is the first button in the Shapes list.',
    },
    {
      id: 'add-variable', text: 'Click **+ Add variable** under **Variables** on the right.', target: 'add-variable',
      check: (v) => v.doc.variables.length > 0,
      hint: 'Variables is below Properties on the right. Scroll down if you cannot see it.',
    },
    {
      id: 'name-it', text: 'Click its **Name** box, type **wall** and press Enter.', target: 'var-name-var1',
      check: (v) => variableExpr(v, 'wall') !== undefined,
      hint: 'The new variable is called var1. Its name box is on the left of its row.',
    },
    {
      id: 'set-it', text: 'Type **3** into the box after **=** and press Enter.', target: 'var-expr-wall',
      check: (v) => variableExpr(v, 'wall')?.trim() === '3',
      hint: 'The = box is on the right of the wall row.',
    },
    {
      id: 'use-it', text: 'Click the box, then type **wall * 10** into **Width** and press Enter. Width becomes 30.',
      target: 'param-width',
      check: (v) => { const b = box(v); return b !== undefined && usesWall(paramFormula(b, 'width')) },
      hint: 'Width is under Size in Properties. The * means "times".',
    },
    {
      id: 'add-cylinder', text: 'Click **Cylinder** to add one.', target: 'add-cylinder',
      check: (v) => cylinder(v) !== undefined,
      hint: 'Cylinder is next to Box in the Shapes list.',
    },
    {
      id: 'diameter', text: 'Type **wall * 5** into the cylinder’s **Diameter** and press Enter.', target: 'param-diameter',
      check: (v) => { const c = cylinder(v); return c !== undefined && usesWall(paramFormula(c, 'diameter')) },
      hint: 'Diameter is under Size in Properties while the cylinder is selected.',
    },
    {
      id: 'change', text: 'Now change **wall** to **4**. Watch the box and the cylinder both grow!', target: 'var-expr-wall',
      check: (v) => variableExpr(v, 'wall')?.trim() === '4',
      hint: 'wall is in Variables, on the right. Type 4 into its = box and press Enter.',
    },
  ],
}
