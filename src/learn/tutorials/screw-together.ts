import { groupsOf, nodeById, shapesOf } from '../checks'
import type { LessonView, Tutorial } from '../types'

const box = (v: LessonView) => shapesOf(v, 'box')[0]
const hole = (v: LessonView) => shapesOf(v, 'threaded-hole')[0]
const rod = (v: LessonView) => shapesOf(v, 'threaded-rod')[0]

/** Room for the M12 rod (6 mm) beside the 20 mm nut (10 mm), so the two don't touch. */
const BESIDE_NUT = 16

function isThreadedHole(v: LessonView, id: string): boolean {
  const node = nodeById(v, id)
  return node?.kind === 'shape' && node.shapeType === 'threaded-hole'
}

function holeGoesThrough(v: LessonView): boolean {
  const depth = hole(v)?.params.depth
  const height = box(v)?.params.height
  return typeof depth === 'number' && typeof height === 'number' && depth > height
}

function rodBesideNut(v: LessonView): boolean {
  const [x, y] = rod(v)?.transform.position ?? [0, 0]
  return Math.max(Math.abs(x), Math.abs(y)) >= BESIDE_NUT
}

export const screwTogether: Tutorial = {
  id: 'screw-together',
  title: 'Screw it together',
  icon: '🪛',
  intro: 'Make a nut and a bolt that screw together after printing.',
  steps: [
    {
      id: 'add-box', text: 'Click **Box** to add a box. It will be the nut.', target: 'add-box',
      check: (v) => box(v) !== undefined,
      hint: 'Box is the first button in the Shapes list.',
    },
    {
      id: 'add-hole', text: 'Click **🌀 Threaded hole** under **Fit tools**. It appears in the middle of the box.', target: 'add-threaded-hole',
      check: (v) => hole(v) !== undefined,
      hint: 'Fit tools is below Shapes and More shapes on the left. Scroll down if you cannot see it.',
    },
    {
      id: 'hole-size', text: 'Choose **M12** in **Thread size**. Bigger threads print stronger.', target: 'param-size',
      check: (v) => hole(v)?.params.size === 'M12',
      hint: 'Thread size is under Size in Properties while the Threaded hole is selected.',
    },
    {
      id: 'through', text: 'Type **25** into **Depth** and press Enter. The box is 20 mm tall, so the hole now goes right through.', target: 'param-depth',
      check: holeGoesThrough,
      hint: 'Depth is under Thread size in Properties. Make it a bit more than the box is tall.',
    },
    {
      id: 'select-both', text: 'Select both: click **Box** in **Parts**, then hold **Shift** and click **Threaded hole**.',
      check: (v) => {
        const b = box(v)
        const h = hole(v)
        return b !== undefined && h !== undefined && v.selection.includes(b.id) && v.selection.includes(h.id)
      },
      hint: 'Parts is the list on the left. Shift is the key with the up arrow, above Ctrl.',
    },
    {
      id: 'group', text: 'Click **Group** in the top bar. The thread cuts into the box: now it is a nut!', target: 'group',
      check: (v) => groupsOf(v).some((g) => g.children.some((id) => isThreadedHole(v, id))),
      hint: 'Group is in the top bar, after Undo and Redo. It only works with two or more parts selected.',
    },
    {
      id: 'add-rod', text: 'Click **🪛 Threaded rod** under **Fit tools**. This is the bolt.', target: 'add-threaded-rod',
      check: (v) => rod(v) !== undefined,
      hint: 'Threaded rod is in Fit tools on the left, next to Threaded hole.',
    },
    {
      id: 'rod-size', text: 'Choose **M12** in its **Thread size** too. The rod and the hole must be the same size to screw together.', target: 'param-size',
      check: (v) => { const r = rod(v); const h = hole(v); return r !== undefined && h !== undefined && r.params.size === h.params.size },
      hint: 'Thread size is under Size in Properties while the Threaded rod is selected.',
    },
    {
      id: 'move-rod', text: 'Type **30** into Position **x** and press Enter, so the rod stands next to the nut instead of inside it.', target: 'pos-x',
      check: rodBesideNut,
      hint: 'Position is in Properties on the right. x is the first box.',
    },
    {
      id: 'print', text: 'Print both and screw the rod into the nut! The hole is a little bigger than the rod, set by **Fit gap**.',
      hint: 'If the printed parts are too tight, make Fit gap bigger and print again.',
    },
  ],
}
