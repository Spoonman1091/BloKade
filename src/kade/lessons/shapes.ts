import { bottomOf, codeHas, depthOf, heightOf, near, settingType, widthOf } from './checks'
import type { CodeLesson } from './types'

export const settingsLesson: CodeLesson = {
  id: 'code-settings', title: 'Settings', icon: '🎛️',
  intro: 'Turn numbers into settings you can change, just like in Properties.',
  starter: `export default {
  name: 'Tower',
  icon: '🗼',
  settings: {
    height: { type: 'mm', default: 30, label: 'Height' },
  },
  build({ height }, cad) {
    return cad.box(20, 20, height)
  },
}
`,
  steps: [
    { id: 'try-it', target: 'param-height', text: 'Your shape has a **Height** setting. Change it to **60** under the preview, and press Enter.',
      hint: 'Settings show under the preview on the right, like the sizes in Properties.',
      check: (v) => v.built && near(heightOf(v), 60) },
    { id: 'add-width', target: 'code-input', text: "Add a second setting under height: **width: { type: 'mm', default: 20, label: 'Width' },** Then use **width** in cad.box.",
      hint: 'Add width to build({ height, width }), then use cad.box(width, width, height).',
      check: (v) => v.built && settingType(v, 'width') === 'mm' },
    { id: 'yesno', target: 'code-input', text: "Add a tick box: **round: { type: 'yesno', default: false, label: 'Round' },** It gives build true or false.",
      hint: 'To use it, add round to build({ … }) and put if (round) { return cad.cylinder(width, height) } before the last return.',
      check: (v) => v.built && settingType(v, 'round') === 'yesno' },
  ],
}

export const addCut: CodeLesson = {
  id: 'code-add-cut', title: 'Add and cut', icon: '☕',
  intro: 'Stick parts together with add, and drill holes with cut.',
  starter: `export default {
  name: 'Cup',
  icon: '☕',
  build(settings, cad) {
    const body = cad.cylinder(30, 40)
    return body
  },
}
`,
  steps: [
    { id: 'hollow', target: 'code-input', text: 'Make it a cup. Change the last line to **return body.cut(cad.cylinder(24, 40).move(0, 0, 3))**. That drills out the inside but leaves a floor.',
      hint: '.cut takes the second part away from the first. The move lifts the drill 3 mm, so the cup keeps its floor.',
      check: (v) => v.built && codeHas(v, /\.cut\(/) && near(heightOf(v), 40) },
    { id: 'handle', target: 'code-input', text: 'Add a handle: put **.add(cad.box(6, 4, 24).move(18, 0, 8))** after **body** and before **.cut**.',
      hint: 'The line becomes return body.add(cad.box(6, 4, 24).move(18, 0, 8)).cut(…).',
      check: (v) => v.built && codeHas(v, /\.add\(/) && (widthOf(v) ?? 0) >= 35 },
    { id: 'three-ways', text: '**add** joins parts, **cut** takes one away, and **overlap** keeps only the space they share.',
      hint: 'You can look them up in **❓ Commands** any time.' },
  ],
}

export const moveTurn: CodeLesson = {
  id: 'code-move-turn', title: 'Move and turn', icon: '🔀',
  intro: 'Put parts exactly where you want them with move and rotate.',
  starter: `export default {
  name: 'Plus sign',
  icon: '➕',
  build(settings, cad) {
    const bar = cad.box(40, 8, 4)
    return bar
  },
}
`,
  steps: [
    { id: 'turn', target: 'code-input', text: "Make a plus sign. Change the last line to **return bar.add(bar.rotate('z', 90))**. The copy turns 90° around the up line.",
      hint: "rotate needs the line to turn around ('z' is up) and how far to turn, in degrees.",
      check: (v) => v.built && near(widthOf(v), 40) && near(depthOf(v), 40) },
    { id: 'lift', target: 'code-input', text: 'Lift the whole sign **10** mm off the ground: add **.move(0, 0, 10)** to the end of that line.',
      hint: 'move takes three numbers: left and right, front and back, and up.',
      check: (v) => v.built && near(bottomOf(v), 10) },
  ],
}

export const outlines: CodeLesson = {
  id: 'code-outlines', title: 'Outlines', icon: '✏️',
  intro: 'Draw a flat shape with polygon, then push it up or spin it round.',
  starter: `export default {
  name: 'Arrow',
  icon: '✏️',
  build(settings, cad) {
    const outline = cad.polygon([[0, 0], [30, 0], [30, 10], [0, 10]])
    return outline.extrude(5)
  },
}
`,
  steps: [
    { id: 'taller', target: 'code-input', text: 'An outline is flat, and **extrude** pushes it up. Change **extrude(5)** to **extrude(12)**.',
      hint: 'Change only the number inside extrude( ).',
      check: (v) => v.built && near(heightOf(v), 12) },
    { id: 'point', target: 'code-input', text: 'Make an arrow tip: put **[40, 5],** between **[30, 0],** and **[30, 10]**.',
      hint: 'Each [x, y] is a corner. The new corner sticks out to x = 40.',
      check: (v) => v.built && near(widthOf(v), 40) },
    { id: 'spin', target: 'code-input', text: 'Now change **extrude(12)** to **spin()**. The outline spins round the middle line, like clay on a potter’s wheel.',
      hint: 'spin turns the outline all the way round the up line, so the shape becomes twice as wide.',
      check: (v) => v.built && codeHas(v, /\.spin\(\)/) && near(widthOf(v), 80) },
  ],
}

export const repeatLesson: CodeLesson = {
  id: 'code-repeat', title: 'Repeat', icon: '⚙️',
  intro: "Use cad.repeat to give a gear all its teeth.",
  starter: `export default {
  name: 'Gear',
  icon: '⚙️',
  build(settings, cad) {
    const body = cad.cylinder(32, 6)
    const tooth = cad.box(8, 5, 6).move(16, 0, 0)
    return body.add(tooth)
  },
}
`,
  steps: [
    { id: 'teeth', target: 'code-input', text: "One tooth is lonely. Change **body.add(tooth)** to **body.add(cad.repeat(12, (i) => tooth.rotate('z', cad.angle(i, 12))))**.",
      hint: 'cad.repeat makes 12 teeth. Each one turns by cad.angle(i, 12): 0°, then 30°, then 60°, and so on.',
      check: (v) => v.built && codeHas(v, /cad\.repeat\(/) && near(depthOf(v), 40, 1) },
    { id: 'hole', target: 'code-input', text: 'Drill a hole for an axle: add **.cut(cad.cylinder(5, 8).move(0, 0, -1))** to the end of the return line.',
      hint: 'The drill is a little taller than the gear and starts below it, so it goes all the way through.',
      check: (v) => v.built && codeHas(v, /\.cut\(/) },
    { id: 'done', target: 'tab-commands', text: 'You made a gear! Open **❓ Commands** and find **⚙️ Gear**. It has settings for teeth, size and hole.',
      hint: '**Use as a starting point** copies it into your shapes, so you can change it.' },
  ],
}
