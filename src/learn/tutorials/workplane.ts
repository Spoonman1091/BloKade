import { shapesOf } from '../checks'
import type { Tutorial } from '../types'

export const workplaneTutorial: Tutorial = {
  id: 'workplane',
  title: 'Build on a face',
  icon: '📐',
  intro: 'Stick new shapes onto the side or top of a part.',
  steps: [
    {
      id: 'add-box', text: 'Click **Box** to add a box.', target: 'add-box',
      check: (v) => shapesOf(v, 'box').length > 0,
      hint: 'Box is the first button in the Shapes list.',
    },
    {
      id: 'workplane-button', text: 'Click **📐 Workplane** in the top bar.', target: 'workplane',
      check: (v) => v.pickingWorkplane || v.workplane !== null,
      hint: 'Workplane is in the top bar, after the Move, Rotate and Size buttons.',
    },
    {
      id: 'pick-face', text: 'Now click any face of the box in the 3D view. A marker shows where new shapes will go.',
      target: 'viewport',
      check: (v) => v.workplane !== null,
      hint: 'Click right on the box, not on the grid. If nothing happens, click 📐 Workplane again first.',
    },
    {
      id: 'add-cone', text: 'Click **Cone**. It stands on the face you picked!', target: 'add-cone',
      check: (v) => shapesOf(v, 'cone').length > 0,
      hint: 'Cone is in the Shapes list, below Box.',
    },
    {
      id: 'ground', text: 'Click **Ground** in the top bar to build on the floor again.', target: 'workplane-reset',
      check: (v) => v.workplane === null && !v.pickingWorkplane,
      hint: 'Ground appears next to Workplane while you are building on a face.',
    },
  ],
}
