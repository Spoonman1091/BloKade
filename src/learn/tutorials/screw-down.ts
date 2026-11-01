import { groupsOf, nodeById, shapesOf } from '../checks'
import type { LessonView, Tutorial } from '../types'

const box = (v: LessonView) => shapesOf(v, 'box')[0]
const hole = (v: LessonView) => shapesOf(v, 'screw-hole')[0]

/** The screw goes in from the top of the hole, so a hole as deep as the plate puts the head at the plate's top. */
function asDeepAsPlate(v: LessonView): boolean {
  const depth = hole(v)?.params.depth
  return typeof depth === 'number' && depth === box(v)?.params.height
}

function isScrewHole(v: LessonView, id: string): boolean {
  const node = nodeById(v, id)
  return node?.kind === 'shape' && node.shapeType === 'screw-hole'
}

export const screwDown: Tutorial = {
  id: 'screw-down',
  title: 'Screw it down',
  icon: '🔩',
  intro: 'Make a plate with a hole for a real metal screw, so you can screw it onto wood.',
  steps: [
    {
      id: 'add-box', text: 'Click **Box** to add a box. It will be a plate you can screw onto something.', target: 'add-box',
      check: (v) => box(v) !== undefined,
      hint: 'Box is the first button in the Shapes list.',
    },
    {
      id: 'thin', text: 'Type **5** into **Height** and press Enter to make it a flat plate.', target: 'param-height',
      check: (v) => box(v)?.params.height === 5,
      hint: 'Height is under Size in Properties while the box is selected.',
    },
    {
      id: 'add-hole', text: 'Click **🔩 Metal screw hole** under **Fit tools**. It appears in the middle of the plate.', target: 'add-screw-hole',
      check: (v) => hole(v) !== undefined,
      hint: 'Fit tools is below Shapes and More shapes on the left. Scroll down if you cannot see it.',
    },
    {
      id: 'size', text: 'Screw sizes are printed on the box, like **M3** or **M4**. Say yours are M4: choose **M4** in **Screw size**.', target: 'param-size',
      check: (v) => hole(v)?.params.size === 'M4',
      hint: 'Screw size is under Size in Properties while the Metal screw hole is selected.',
    },
    {
      id: 'depth', text: 'Type **5** into **Depth** and press Enter, so the hole is as deep as the plate. The screw goes in from the top.', target: 'param-depth',
      check: asDeepAsPlate,
      hint: 'Depth is in Properties, below Style. Make it the same as the plate’s Height.',
    },
    {
      id: 'style', text: 'Choose **Countersunk (flat head)** in **Style**. A cone at the top lets a flat screw head sink in, flat with the top.', target: 'param-style',
      check: (v) => hole(v)?.params.style === 'countersunk',
      hint: 'Style is under Screw size in Properties. Cap-head screws need Counterbored instead.',
    },
    {
      id: 'select-both', text: 'Select both: click **Box** in **Parts**, then hold **Shift** and click **Metal screw hole**.',
      check: (v) => {
        const b = box(v)
        const h = hole(v)
        return b !== undefined && h !== undefined && v.selection.includes(b.id) && v.selection.includes(h.id)
      },
      hint: 'Parts is the list on the left. Shift is the key with the up arrow, above Ctrl.',
    },
    {
      id: 'group', text: 'Click **Group** in the top bar. The hole cuts through the plate!', target: 'group',
      check: (v) => groupsOf(v).some((g) => g.children.some((id) => isScrewHole(v, id))),
      hint: 'Group is in the top bar, after Undo and Redo. It only works with two or more parts selected.',
    },
    {
      id: 'print', text: 'Print it and push an M4 flat-head screw through. Other **Styles** fit cap-head screws, nuts and heat-set inserts.',
      hint: 'Nut trap holds a nut at the bottom, so the screw can go into a nut instead of wood.',
    },
  ],
}
