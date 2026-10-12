import { modifiersOfType, shapesOf } from '../checks'
import type { Tutorial } from '../types'

export const roundRepeat: Tutorial = {
  id: 'round-repeat',
  title: 'Round and repeat',
  icon: '◠',
  intro: 'Round off sharp edges, make a row of copies, and mirror them.',
  steps: [
    {
      id: 'add-box', text: 'Click **Box** to add a box.', target: 'add-box',
      check: (v) => shapesOf(v, 'box').length > 0,
      hint: 'Box is the first button in the Shapes list.',
    },
    {
      id: 'round', text: 'Pick **◠ Round edges** in **+ Add a modifier…** in Properties.', target: 'add-modifier',
      check: (v) => modifiersOfType(v, 'fillet').length > 0,
      hint: 'Modifiers is near the bottom of Properties. The list starts with "+ Add a modifier…".',
    },
    {
      id: 'roundness', text: 'Type **3** into **Roundness** and press Enter.', target: 'mod-radius-0',
      check: (v) => modifiersOfType(v, 'fillet').some((m) => m.type === 'fillet' && m.radius === 3),
      hint: 'Roundness is inside the Round edges card, under Modifiers.',
    },
    {
      id: 'repeat', text: 'Now pick **⋯ Repeat in a row** in **+ Add a modifier…**.', target: 'add-modifier',
      check: (v) => modifiersOfType(v, 'linearPattern').length > 0,
      hint: 'It is the same list you used for Round edges.',
    },
    {
      id: 'count', text: 'Type **4** into **How many** and press Enter. Four boxes in a row!', target: 'mod-count-1',
      check: (v) => modifiersOfType(v, 'linearPattern').some((m) => m.type === 'linearPattern' && m.count === 4),
      hint: 'How many is inside the Repeat in a row card, the second card under Modifiers.',
    },
    {
      id: 'mirror', text: 'Last one: pick **⇋ Mirror**. It copies the row to the other side.', target: 'add-modifier',
      check: (v) => modifiersOfType(v, 'mirror').length > 0,
      hint: 'Mirror is at the end of the + Add a modifier… list.',
    },
  ],
}
