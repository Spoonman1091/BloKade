import { shapesOf } from '../checks'
import type { LessonView, Tutorial } from '../types'

const peg = (v: LessonView) => shapesOf(v, 'peg')[0]
const socket = (v: LessonView) => shapesOf(v, 'socket')[0]

export const perfectFit: Tutorial = {
  id: 'perfect-fit',
  title: 'Perfect fit',
  icon: '🧷',
  intro: 'Make two parts that slide together after printing.',
  steps: [
    {
      id: 'kit', text: 'Click **🧷 Peg & socket** under **Fit tools**.', target: 'add-kit-peg-socket',
      check: (v) => peg(v) !== undefined && socket(v) !== undefined,
      hint: 'Fit tools is below the Shapes list on the left. Scroll down if you cannot see it.',
    },
    {
      id: 'why', text: 'The socket is a hole a little bigger than the peg, so the printed peg slides in. **Fit gap** sets how much bigger.',
      target: 'fit',
      hint: 'Fit gap is at the top of Variables, on the right.',
    },
    {
      id: 'fit', text: 'Type **0.3** into **Fit gap** and press Enter. The socket grows a tiny bit.', target: 'fit',
      check: (v) => v.doc.settings.fit === 0.3,
      hint: 'Fit gap is at the top of Variables, on the right. It starts at 0.2.',
    },
    {
      id: 'select-pair', text: 'Click **Peg** in **Parts**, then hold **Shift** and click **Socket**.',
      check: (v) => {
        const p = peg(v)
        const s = socket(v)
        return p !== undefined && s !== undefined && v.selection.length === 2 && v.selection.includes(p.id) && v.selection.includes(s.id)
      },
      hint: 'Parts is the list on the left. Hold Shift while you click the second one.',
    },
    {
      id: 'check', text: 'Click **🔍 Check overlap**. It tells you if the two parts bump into each other.', target: 'check-overlap',
      check: (v) => v.overlapShown,
      hint: 'Check overlap is in Properties while two parts are selected.',
    },
  ],
}
