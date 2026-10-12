import { groupsOf, nodeById, shapesOf } from '../checks'
import type { LessonView, Tutorial } from '../types'

const box = (v: LessonView) => shapesOf(v, 'box')[0]
const cylinder = (v: LessonView) => shapesOf(v, 'cylinder')[0]

export const holesGroups: Tutorial = {
  id: 'holes-groups',
  title: 'Holes and groups',
  icon: '⬚',
  intro: 'Turn a part into a hole and use it to cut another part.',
  steps: [
    {
      id: 'add-box', text: 'Click **Box** to add a box.', target: 'add-box',
      check: (v) => box(v) !== undefined,
      hint: 'Box is the first button in the Shapes list at the top left.',
    },
    {
      id: 'add-cylinder', text: 'Click **Cylinder**. It lands inside the box.', target: 'add-cylinder',
      check: (v) => cylinder(v) !== undefined,
      hint: 'Cylinder is next to Box in the Shapes list.',
    },
    {
      id: 'make-hole', text: 'The cylinder is selected. Click **Hole** in Properties.', target: 'mode-hole',
      check: (v) => cylinder(v)?.mode === 'hole',
      hint: 'Solid and Hole are under the name in Properties, on the right.',
    },
    {
      id: 'select-both', text: 'Select both: click **Box** in **Parts**, then hold **Shift** and click **Cylinder**.',
      check: (v) => {
        const b = box(v)
        const c = cylinder(v)
        return b !== undefined && c !== undefined && v.selection.includes(b.id) && v.selection.includes(c.id)
      },
      hint: 'Parts is the list on the left. Shift is the key with the up arrow, above Ctrl.',
    },
    {
      id: 'group', text: 'Click **Group** in the top bar. The hole cuts through the box!', target: 'group',
      check: (v) => groupsOf(v).some((g) => g.children.some((id) => nodeById(v, id)?.mode === 'hole')),
      hint: 'Group is in the top bar, after Undo and Redo. It only works with two or more parts selected.',
    },
    {
      id: 'why', text: 'A hole only cuts the parts in its own group. Click **Ungroup** any time to change the pieces again.',
      target: 'ungroup',
      hint: 'Ungroup is next to Group in the top bar.',
    },
  ],
}
