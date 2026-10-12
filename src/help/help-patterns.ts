import type { HelpEntry } from './types'

export interface HelpPattern {
  readonly pattern: RegExp
  entry(label: string, match: RegExpMatchArray): HelpEntry
}

const MOD_TEXT: Readonly<Record<string, HelpEntry>> = {
  enabled: { tip: 'Turns this modifier on or off.', card: 'Untick a modifier to see the part without it. Nothing is lost.' },
  up: { tip: 'Moves this modifier up the list.', card: 'Modifiers run from top to bottom, so the order can change the result.' },
  down: { tip: 'Moves this modifier down the list.', card: 'Modifiers run from top to bottom, so the order can change the result.' },
  delete: { tip: 'Removes this modifier.', card: 'This removes just the modifier. The part stays.' },
  edges: { tip: 'Which edges to round or bevel.', card: 'Pick a group of edges, like Top edges, or "Edges I pick" to click the exact ones.', tutorial: 'round-repeat' },
  pick: { tip: 'Click edges in the 3D view to choose them.', card: 'While picking, click edges in the 3D view to add or remove them. Press Esc or click empty space when done.' },
  axis: { tip: 'Which line the copies go around.', card: 'Repeat in a circle places copies around this line, like spokes on a wheel.' },
  plane: { tip: 'Which side the mirror copy goes to.', card: 'The mirror copy appears on the other side of this flat line.' },
  keep: { tip: 'Keeps the original as well as the mirror copy.', card: 'Untick it to keep only the mirrored part.' },
  radius: { tip: 'How round the edges are, in mm.', card: 'Bigger roundness makes softer edges. Too big for the part shows a warning.', tutorial: 'round-repeat' },
  distance: { tip: 'How big the bevel is, in mm.', card: 'A bevel cuts the edge off at a slant. Bigger cuts more.' },
  count: { tip: 'How many copies in total.', card: 'This counts the original too. 3 means the part and two copies.', tutorial: 'round-repeat' },
  angle: { tip: 'How far around the copies spread, in degrees.', card: '360 spreads them all the way around. 180 spreads them over half a circle.' },
  spacing: { tip: 'The step from one copy to the next, in mm.', card: 'Each copy moves this far from the one before. x is left-right, y is front-back and z is up.' },
  center: { tip: 'The middle of the circle, from the part’s own centre, in mm.', card: 'Copies go around this point. 0, 0, 0 is the middle of the part.' },
}

const ALIGN_AXIS: Readonly<Record<string, string>> = { x: 'left to right', y: 'front to back', z: 'bottom to top' }

/** Families of controls. Checked in order, so more specific patterns come first. */
export const HELP_PATTERNS: readonly HelpPattern[] = [
  { pattern: /^shape-item-.+$/, entry: (label) => ({ tip: `Opens ${label}.`, card: 'Click a shape to open its code and its preview.' }) },
  { pattern: /^problem-\d+$/, entry: () => ({ tip: 'Click to jump to the line with the problem.', card: 'The message says what is wrong and which line to look at. Click it and the code box jumps there.' }) },
  { pattern: /^code-lesson-start-.+$/, entry: () => ({ tip: 'Starts this coding lesson with its own practice shape.', card: 'Coding lessons make a practice shape, so your own shapes stay safe.' }) },
  { pattern: /^add-kit-.+$/, entry: (label) => ({ tip: `Adds a matched ${label} set that fits together.`, card: `${label} adds parts that are linked by variables, so they stay matched when you change one.`, tutorial: 'perfect-fit' }) },
  { pattern: /^add-.+$/, entry: (label) => ({ tip: `Adds a ${label} to your design.`, card: `Click to add a ${label}. Change its size in Properties on the right.`, tutorial: 'first-shape' }) },
  { pattern: /^param-.+$/, entry: (label) => ({ tip: `Changes ${label}. Type a number or a formula, then press Enter.`, card: `${label} is one of this part's settings. You can type a number, or a formula like wall * 2 that uses your variables.`, tutorial: 'smart-sizes' }) },
  { pattern: /^var-name-.+$/, entry: () => ({ tip: 'The variable’s name. Use it in any size box.', card: 'Names can use letters, numbers and _. Renaming a variable updates every formula that uses it.', tutorial: 'smart-sizes' }) },
  { pattern: /^var-expr-.+$/, entry: () => ({ tip: 'The variable’s value: a number or a formula.', card: 'Change this, and every part that uses the variable changes too.', tutorial: 'smart-sizes' }) },
  { pattern: /^var-delete-.+$/, entry: () => ({ tip: 'Deletes this variable.', card: 'Parts that used it keep their current sizes.' }) },
  { pattern: /^align-([xyz])-(min|center|max)$/, entry: (_label, m) => ({ tip: `Lines the selected parts up ${ALIGN_AXIS[m[1] ?? 'x'] ?? ''}.`, card: 'Line up moves the selected parts so their edges or middles match.' }) },
  { pattern: /^mod-([a-z]+)-(?:[xyz]-)?\d+$/, entry: (_label, m) => MOD_TEXT[m[1] ?? ''] ?? { tip: 'A setting for this modifier.', card: 'Change it and the part updates.' } },
  { pattern: /^lesson-start-.+$/, entry: () => ({ tip: 'Starts this lesson in a new practice design.', card: 'Lessons use their own design, so your work stays safe.' }) },
]
