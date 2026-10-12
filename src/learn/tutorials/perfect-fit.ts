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
      id: 'check', text: 'Peg and Socket are both selected. Click **🔍 Check overlap** to see if they bump into each other.', target: 'check-overlap',
      check: (v) => v.overlapShown,
      hint: 'Check overlap is in Properties while two parts are selected. If it is missing, click Peg in Parts, then hold Shift and click Socket.',
    },
  ],
}
