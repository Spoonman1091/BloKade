import { shapesOf } from '../checks'
import type { LessonView, Tutorial } from '../types'

const cylinder = (v: LessonView) => shapesOf(v, 'cylinder')[0]

export const moveTurnSize: Tutorial = {
  id: 'move-turn-size',
  title: 'Move, turn and size',
  icon: '✥',
  intro: 'Slide a part around, turn it, and stretch it.',
  steps: [
    {
      id: 'add-cylinder', text: 'Click **Cylinder** to add one.', target: 'add-cylinder',
      check: (v) => cylinder(v) !== undefined,
      hint: 'Cylinder is in the Shapes list at the top left, next to Box.',
    },
    {
      id: 'slide', text: 'Drag the red arrow in the 3D view to slide the cylinder. (You can also type a number into Position **x**.)',
      target: 'viewport',
      check: (v) => { const c = cylinder(v); return c !== undefined && (c.transform.position[0] !== 0 || c.transform.position[1] !== 0) },
      hint: 'Put the mouse on the red arrow, hold the button down and move the mouse.',
    },
    {
      id: 'exact', text: 'Type **30** into Position **x** and press Enter. Now it is exactly 30 mm from the middle.',
      target: 'pos-x',
      check: (v) => cylinder(v)?.transform.position[0] === 30,
      hint: 'Position is in Properties on the right. x is the first box.',
    },
    {
      id: 'rotate-tool', text: 'Click **⟳ Rotate** in the top bar.', target: 'tool-rotate',
      check: (v) => v.tool === 'rotate',
      hint: 'The top bar is the row of buttons at the very top. Rotate is next to Move.',
    },
    {
      id: 'tip-over', text: 'Type **45** into Rotation **y** and press Enter to tip it over. (Or drag a ring in the 3D view.)',
      target: 'rot-y',
      check: (v) => cylinder(v)?.transform.rotation[1] === 45,
      hint: 'Rotation is in Properties, under Position. y is the middle box.',
    },
    {
      id: 'size-tool', text: 'Click **⤢ Size** in the top bar.', target: 'tool-size',
      check: (v) => v.tool === 'size',
      hint: 'Size is next to Rotate in the top bar.',
    },
    {
      id: 'taller', text: 'Make it taller: drag the top handle, or type **40** into **Height**.', target: 'param-height',
      check: (v) => { const h = cylinder(v)?.params.height; return typeof h === 'number' && h > 20 },
      hint: 'Height is under Size in Properties. The cylinder starts 20 mm tall.',
    },
    {
      id: 'move-tool', text: 'Click **✥ Move** to go back to moving things.', target: 'tool-move',
      check: (v) => v.tool === 'move',
      hint: 'Move is the first of the three handle buttons in the top bar.',
    },
  ],
}
