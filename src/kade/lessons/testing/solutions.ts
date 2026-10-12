import type { ParamValue } from '../../../document/types'
import { addCut, moveTurn, outlines, repeatLesson, settingsLesson } from '../shapes'
import { errorsLesson, firstShape, functionsLesson, numbers, variables } from '../basics'

export interface Solution {
  readonly code: string
  readonly values?: Readonly<Record<string, ParamValue>>
}

/** The code after one edit. Fails loudly if a lesson's starter changed under the solution. */
function edit(code: string, from: string, to: string): string {
  if (!code.includes(from)) throw new Error(`Solution text not found: ${from}`)
  return code.replace(from, to)
}

const n1 = edit(numbers.starter, 'cad.box(20, 10, 5)', 'cad.box(40, 10, 5)')
const n2 = edit(n1, 'cad.box(40, 10, 5)', 'cad.box(40, 10, 25)')
const n3 = edit(n2, 'cad.box(40, 10, 25)', 'cad.cylinder(20, 30)')

const v1 = edit(variables.starter, 'const width = 30\n    return cad.box(width, 10, 5)', 'const width = 30\n    const height = 25\n    return cad.box(width, 10, height)')
const v2 = edit(v1, 'const height = 25', 'const height = 40')

const f1 = edit(functionsLesson.starter, 'return post(0)\n', 'return post(0).add(post(20))\n')
const f2 = edit(f1, 'return post(0).add(post(20))', 'return post(0).add(post(20)).add(post(40))')
const f3 = edit(f2, 'cad.box(4, 4, 20)', 'cad.box(4, 4, 35)')

const e1 = edit(errorsLesson.starter, 'cad.box(widht, 10, 5\n', 'cad.box(widht, 10, 5)\n')
const e2 = edit(e1, 'widht', 'width')
const e3 = edit(e2, '    box\n', '    return box\n')

const s1 = edit(firstShape.starter, "name: 'My first shape'", "name: 'Robot head'")
const s2 = edit(s1, "icon: '🧩'", "icon: '🤖'")

const HEIGHT_SETTING = "    height: { type: 'mm', default: 30, label: 'Height' },\n"
const WIDTH_SETTING = "    width: { type: 'mm', default: 20, label: 'Width' },\n"
const t2 = [
  (c: string) => edit(c, HEIGHT_SETTING, HEIGHT_SETTING + WIDTH_SETTING),
  (c: string) => edit(c, 'build({ height }, cad)', 'build({ height, width }, cad)'),
  (c: string) => edit(c, 'cad.box(20, 20, height)', 'cad.box(width, width, height)'),
].reduce((code, step) => step(code), settingsLesson.starter)
const t3 = edit(t2, WIDTH_SETTING, `${WIDTH_SETTING}    round: { type: 'yesno', default: false, label: 'Round' },\n`)

const c1 = edit(addCut.starter, '    return body\n', '    return body.cut(cad.cylinder(24, 40).move(0, 0, 3))\n')
const c2 = edit(c1, 'return body.cut(', 'return body.add(cad.box(6, 4, 24).move(18, 0, 8)).cut(')

const m1 = edit(moveTurn.starter, '    return bar\n', "    return bar.add(bar.rotate('z', 90))\n")
const m2 = edit(m1, "bar.add(bar.rotate('z', 90))", "bar.add(bar.rotate('z', 90)).move(0, 0, 10)")

const o1 = edit(outlines.starter, 'extrude(5)', 'extrude(12)')
const o2 = edit(o1, '[30, 0], [30, 10]', '[30, 0], [40, 5], [30, 10]')
const o3 = edit(o2, 'extrude(12)', 'spin()')

const r1 = edit(repeatLesson.starter, 'body.add(tooth)', "body.add(cad.repeat(12, (i) => tooth.rotate('z', cad.angle(i, 12))))")
const r2 = edit(r1, 'cad.angle(i, 12))))\n', 'cad.angle(i, 12)))).cut(cad.cylinder(5, 8).move(0, 0, -1))\n')

/** What Kade could type to finish each checked step, by lesson id and step id. */
export const SOLUTIONS: Readonly<Record<string, Readonly<Record<string, Solution>>>> = {
  'code-numbers': { wider: { code: n1 }, taller: { code: n2 }, cylinder: { code: n3 } },
  'code-variables': { 'add-height': { code: v1 }, 'change-it': { code: v2 } },
  'code-functions': { 'second-post': { code: f1 }, 'third-post': { code: f2 }, taller: { code: f3 } },
  'code-errors': { bracket: { code: e1 }, spelling: { code: e2 }, return: { code: e3 } },
  'code-first-shape': { name: { code: s1 }, icon: { code: s2 } },
  'code-settings': { 'try-it': { code: settingsLesson.starter, values: { height: 60 } }, 'add-width': { code: t2, values: { height: 60 } }, yesno: { code: t3, values: { height: 60 } } },
  'code-add-cut': { hollow: { code: c1 }, handle: { code: c2 } },
  'code-move-turn': { turn: { code: m1 }, lift: { code: m2 } },
  'code-outlines': { taller: { code: o1 }, point: { code: o2 }, spin: { code: o3 } },
  'code-repeat': { teeth: { code: r1 }, hole: { code: r2 } },
}
