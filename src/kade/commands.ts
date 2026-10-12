export interface CadCommand {
  /** The toolkit key, part step or outline step. */
  readonly name: string
  readonly on: 'cad' | 'part' | 'outline'
  readonly group: 'start' | 'outline' | 'step' | 'helper'
  readonly call: string
  /** One short line, in Kade's words. */
  readonly does: string
  /** A tiny working example. Tested: each one builds. */
  readonly example: string
}

export const COMMAND_GROUPS: readonly { readonly group: CadCommand['group']; readonly title: string }[] = [
  { group: 'start', title: 'Starting parts' },
  { group: 'outline', title: 'Flat outlines' },
  { group: 'step', title: 'Part steps' },
  { group: 'helper', title: 'Helpers' },
]

/** Every command Kade can use. The ❓ Commands tab shows this list, and a test checks it against the toolkit. */
export const CAD_COMMANDS: readonly CadCommand[] = [
  { name: 'box', on: 'cad', group: 'start', call: 'cad.box(width, depth, height)', does: 'A box, sitting on the ground in the middle.', example: 'cad.box(20, 10, 5)' },
  { name: 'cylinder', on: 'cad', group: 'start', call: 'cad.cylinder(diameter, height)', does: 'An upright cylinder.', example: 'cad.cylinder(10, 20)' },
  { name: 'sphere', on: 'cad', group: 'start', call: 'cad.sphere(diameter)', does: 'A ball resting on the ground.', example: 'cad.sphere(20)' },
  { name: 'cone', on: 'cad', group: 'start', call: 'cad.cone(bottom, top, height)', does: 'A cone. Make the top 0 for a point.', example: 'cad.cone(20, 0, 30)' },
  { name: 'ring', on: 'cad', group: 'start', call: 'cad.ring(outside, thickness)', does: 'A ring lying flat, like a doughnut.', example: 'cad.ring(40, 8)' },
  { name: 'wedge', on: 'cad', group: 'start', call: 'cad.wedge(width, depth, height)', does: 'A ramp: tall on the left, down to the ground on the right.', example: 'cad.wedge(20, 10, 15)' },
  { name: 'text', on: 'cad', group: 'start', call: "cad.text('words', size, depth)", does: 'Raised letters.', example: "cad.text('Hi', 10, 2)" },
  { name: 'rect', on: 'cad', group: 'outline', call: 'cad.rect(width, depth)', does: 'A flat rectangle outline.', example: 'cad.rect(20, 10).extrude(5)' },
  { name: 'circle', on: 'cad', group: 'outline', call: 'cad.circle(diameter)', does: 'A flat circle outline.', example: 'cad.circle(20).extrude(3)' },
  { name: 'polygon', on: 'cad', group: 'outline', call: 'cad.polygon([[x, y], …])', does: 'A flat outline through the points you list.', example: 'cad.polygon([[0, 0], [20, 0], [0, 10]]).extrude(4)' },
  { name: 'extrude', on: 'outline', group: 'outline', call: '.extrude(height)', does: 'Pushes an outline straight up into a part.', example: 'cad.rect(20, 10).extrude(5)' },
  { name: 'spin', on: 'outline', group: 'outline', call: '.spin()', does: 'Spins an outline around the up line. x is how far out, y is how high.', example: 'cad.polygon([[0, 0], [10, 0], [0, 15]]).spin()' },
  { name: 'move', on: 'part', group: 'step', call: '.move(x, y, z)', does: 'Moves a part. z is up.', example: 'cad.box(10, 10, 10).move(20, 0, 5)' },
  { name: 'rotate', on: 'part', group: 'step', call: ".rotate('x' | 'y' | 'z', degrees)", does: 'Turns a part around a line through the middle of the ground.', example: "cad.box(20, 5, 5).rotate('z', 45)" },
  { name: 'add', on: 'part', group: 'step', call: '.add(part)', does: 'Joins two parts into one.', example: 'cad.box(20, 20, 5).add(cad.cylinder(10, 15))' },
  { name: 'cut', on: 'part', group: 'step', call: '.cut(part)', does: 'Cuts one part out of another, like drilling a hole.', example: 'cad.box(20, 20, 5).cut(cad.cylinder(6, 7).move(0, 0, -1))' },
  { name: 'overlap', on: 'part', group: 'step', call: '.overlap(part)', does: 'Keeps only the space both parts share.', example: 'cad.box(20, 20, 20).overlap(cad.sphere(26).move(0, 0, -3))' },
  { name: 'mirror', on: 'part', group: 'step', call: ".mirror('x' | 'y' | 'z')", does: 'Flips a part to the other side.', example: "cad.wedge(20, 10, 15).mirror('x')" },
  { name: 'copy', on: 'part', group: 'step', call: '.copy()', does: 'Makes a copy of a part.', example: 'cad.box(10, 10, 10).copy()' },
  { name: 'repeat', on: 'cad', group: 'helper', call: 'cad.repeat(count, (i) => part)', does: 'Makes count parts (i counts 0, 1, 2…) and joins them.', example: 'cad.repeat(4, (i) => cad.box(5, 5, 5).move(i * 10, 0, 0))' },
  { name: 'angle', on: 'cad', group: 'helper', call: 'cad.angle(i, count)', does: 'The angle for copy i when count copies go around a circle.', example: 'cad.angle(1, 4)' },
  { name: 'sin', on: 'cad', group: 'helper', call: 'cad.sin(degrees)', does: 'The sine of an angle in degrees, for placing things round a circle.', example: 'cad.sin(30)' },
  { name: 'cos', on: 'cad', group: 'helper', call: 'cad.cos(degrees)', does: 'The cosine of an angle in degrees.', example: 'cad.cos(60)' },
]
