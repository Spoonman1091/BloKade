import { shapesOf } from '../checks'
import type { Tutorial } from '../types'

export const readyToPrint: Tutorial = {
  id: 'ready-to-print',
  title: 'Ready to print',
  icon: '🖨',
  intro: 'Turn your design into a file your 3D printer can use.',
  steps: [
    {
      id: 'add-box', text: 'Click **Box** so there is something to print.', target: 'add-box',
      check: (v) => shapesOf(v).length > 0,
      hint: 'Box is the first button in the Shapes list.',
    },
    {
      id: 'stl', text: 'Click **⬇ STL**. Your browser downloads a file you can open in your slicer. Then click **Next**.',
      target: 'export-stl',
      hint: 'STL is near the right end of the top bar.',
    },
    {
      id: '3mf', text: '**⬇ 3MF** makes a file too, and it keeps your colours. Most slicers open both. Click **Next**.',
      target: 'export-3mf',
      hint: '3MF is right next to STL in the top bar.',
    },
    {
      id: 'slicer', text: 'In your slicer (like Cura, PrusaSlicer or Bambu Studio), open the file. Check it lies flat, then slice and print!',
      hint: 'The slicer is the program that talks to your printer. Ask Larry which one your printer uses.',
    },
  ],
}
