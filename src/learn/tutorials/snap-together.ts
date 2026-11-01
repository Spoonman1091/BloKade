import { shapesOf, variableExpr } from '../checks'
import type { LessonView, Tutorial } from '../types'

const clip = (v: LessonView) => shapesOf(v, 'snap-clip')[0]
const slot = (v: LessonView) => shapesOf(v, 'snap-catch')[0]

function onlySelected(v: LessonView, id: string | undefined): boolean {
  return id !== undefined && v.selection.length === 1 && v.selection[0] === id
}

/** Turned a quarter either way around x, so the arm lies flat with its hook beside it. */
function lyingFlat(v: LessonView): boolean {
  const rx = clip(v)?.transform.rotation[0]
  return rx !== undefined && Math.abs(rx) % 180 === 90
}

export const snapTogether: Tutorial = {
  id: 'snap-together',
  title: 'Snap together',
  icon: '🧩',
  intro: 'Make a clip that bends, pushes through a slot and clicks into place.',
  steps: [
    {
      id: 'kit', text: 'Click **🧩 Snap-fit clip** under **Fit tools**. You get a **Snap clip** and a **Snap catch**.',
      target: 'add-kit-snap-fit',
      check: (v) => clip(v) !== undefined && slot(v) !== undefined,
      hint: 'Fit tools is below Shapes and More shapes on the left. Scroll down if you cannot see it.',
    },
    {
      id: 'how', text: 'The clip is a bendy arm with a hook. The catch is a slot. Push the arm through: it bends, then the hook clicks behind the wall.',
      target: 'viewport',
      hint: 'The clip is the thin arm standing up. The catch is the see-through slot next to it.',
    },
    {
      id: 'thickness', text: 'Type **2** into **clip_thickness** and press Enter. A thicker arm is stronger but harder to bend. The slot grows too.',
      target: 'var-expr-clip_thickness',
      check: (v) => variableExpr(v, 'clip_thickness')?.trim() === '2',
      hint: 'clip_thickness is in Variables on the right, below Fit gap. It starts at 1.5.',
    },
    {
      id: 'select-catch', text: 'Click **Snap catch** in **Parts**, so only the catch is selected.',
      check: (v) => onlySelected(v, slot(v)?.id),
      hint: 'Parts is the list on the left. Click the name without holding Shift.',
    },
    {
      id: 'wall', text: 'Say your wall is 4 mm thick: type **4** into **Wall thickness** and press Enter. The slot goes right through it.',
      target: 'param-wall',
      check: (v) => slot(v)?.params.wall === 4,
      hint: 'Wall thickness is under Size in Properties while Snap catch is selected.',
    },
    {
      id: 'select-clip', text: 'Now click **Snap clip** in **Parts**.',
      check: (v) => onlySelected(v, clip(v)?.id),
      hint: 'Parts is the list on the left. Snap clip is just above Snap catch.',
    },
    {
      id: 'lay-flat', text: 'Type **90** into Rotation **x** and press Enter to lay the clip on its side. Printed standing up, the arm snaps off.',
      target: 'rot-x',
      check: lyingFlat,
      hint: 'Rotation is in Properties, under Position. x is the first box. Lying down, the layers run along the arm, so it bends instead of breaking.',
    },
    {
      id: 'put-down', text: 'Half of it sank into the plate. Click **⬇ Put on plate** (or press **D**) to set it down.',
      target: 'put-on-plate',
      check: (v) => lyingFlat(v) && (clip(v)?.transform.position[2] ?? 0) > 0,
      hint: 'Put on plate is in Properties, just under Position, while the clip is selected.',
    },
    {
      id: 'use-it', text: 'To use it, put the catch in a part’s wall and group them to cut the slot. Print both and push the clip in: click!',
      hint: 'It works like the socket in Perfect fit: a hole only cuts when it is grouped with a solid part.',
    },
  ],
}
