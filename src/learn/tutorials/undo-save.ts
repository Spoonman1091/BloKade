import { shapesOf } from '../checks'
import { lessonDesignName } from '../names'
import type { LessonView, Tutorial } from '../types'

const TITLE = 'Undo, names and saving'
const hasSphere = (v: LessonView): boolean => shapesOf(v, 'sphere').length > 0

export const undoSave: Tutorial = {
  id: 'undo-save',
  title: TITLE,
  icon: '↶',
  intro: 'Fix mistakes with Undo, name your design, and save a copy to a file.',
  steps: [
    {
      id: 'add-sphere', text: 'Click **Sphere** to add a ball.', target: 'add-sphere',
      check: hasSphere,
      hint: 'Sphere is in the Shapes list at the top left.',
    },
    {
      id: 'delete', text: 'Click **Delete** in the top bar to remove the ball.', target: 'delete',
      check: (v) => !hasSphere(v) && v.canUndo,
      hint: 'Delete is in the top bar. The ball must be selected: click it first if Delete is grey.',
    },
    {
      id: 'undo', text: 'Oops! Click **↶ Undo** to bring it back.', target: 'undo',
      check: hasSphere,
      hint: 'Undo is near the left of the top bar. Ctrl+Z does the same.',
    },
    {
      id: 'redo', text: 'Click **↷ Redo**. It does the delete again.', target: 'redo',
      check: (v) => !hasSphere(v),
      hint: 'Redo is right next to Undo.',
    },
    {
      id: 'undo-again', text: 'Click **↶ Undo** once more to keep the ball.', target: 'undo',
      check: hasSphere,
      hint: 'Undo can go back many steps, one click at a time.',
    },
    {
      id: 'rename', text: "Click the **📁** button at the top left. Type a new name into **This design's name** and press Enter.",
      target: 'design-name',
      check: (v) => v.doc.name.trim() !== '' && v.doc.name !== lessonDesignName(TITLE),
      hint: 'The 📁 button shows the design name. It opens Designs, where the name box is at the top.',
    },
    {
      id: 'save-file', text: 'In Designs, **Save to file** downloads a copy. **Load from file** opens it again. Click **Close**, then **Next**.',
      hint: 'Save to file and Load from file are at the bottom of the Designs window.',
    },
  ],
}
