import { shapesOf } from '../checks'
import type { Tutorial } from '../types'

export const firstShape: Tutorial = {
  id: 'first-shape',
  title: 'Your first shape',
  icon: '🟦',
  intro: 'Add a box, change its size, and look at it from every side.',
  steps: [
    {
      id: 'add-box', text: 'Click **Box** in the Shapes list to add a box.', target: 'add-box',
      check: (v) => shapesOf(v, 'box').length > 0,
      hint: 'The Shapes list is at the top left. The box is the first button.',
    },
    {
      id: 'width', text: 'Your box is selected, so its sizes show on the right. Type **40** into **Width** and press Enter.',
      target: 'param-width',
      check: (v) => shapesOf(v, 'box').some((b) => b.params.width === 40),
      hint: 'Width is under Size in Properties, on the right. If Properties is empty, click the box first.',
    },
    {
      id: 'look', text: 'Look around! Drag in the 3D view to spin it. Scroll to zoom. Right-drag to slide. Click **Next** when you are ready.',
      target: 'viewport',
      hint: 'Hold the left mouse button and drag to spin. Hold the right button to slide. The mouse wheel zooms.',
    },
    {
      id: 'deselect', text: 'Press **Esc** to unselect the box. (Clicking empty space in the 3D view works too.)',
      check: (v) => v.selection.length === 0 && shapesOf(v, 'box').length > 0,
      hint: 'Esc is the key in the top left corner of your keyboard.',
    },
    {
      id: 'reselect', text: 'Now click the box again, in the 3D view or in **Parts** on the left, to select it.',
      check: (v) => shapesOf(v, 'box').some((b) => v.selection.includes(b.id)),
      hint: 'Parts is the list under the shapes on the left. Click the row called Box.',
    },
  ],
}
