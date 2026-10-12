import { codeHas, heightOf, near, widthOf } from './checks'
import type { CodeLesson } from './types'

const DEFAULT_NAME = 'My first shape'

/** A real new name, not the old one or a half-deleted copy of it. */
const isNewName = (name: string): boolean =>
  name.length >= 2 && !name.startsWith(DEFAULT_NAME) && !DEFAULT_NAME.startsWith(name)

export const numbers: CodeLesson = {
  id: 'code-numbers', title: 'Numbers', icon: '🔢',
  intro: 'Change the numbers in your code and watch the shape change.',
  starter: `export default {
  name: 'Numbers practice',
  icon: '🔢',
  build(settings, cad) {
    return cad.box(20, 10, 5)
  },
}
`,
  steps: [
    { id: 'wider', target: 'code-input', text: 'The code says **cad.box(20, 10, 5)**. The first number is the width. Change **20** to **40**.',
      hint: 'Click in the code box just after 20. Press Backspace twice, then type 40. The preview on the right changes when you stop typing.',
      check: (v) => v.built && near(widthOf(v), 40) },
    { id: 'taller', target: 'code-input', text: 'The last number is the height. Make the box taller than **20** mm.',
      hint: 'Change the 5 at the end to a bigger number, like 25.',
      check: (v) => v.built && (heightOf(v) ?? 0) > 20 },
    { id: 'cylinder', target: 'code-input', text: 'Swap **cad.box(…)** for **cad.cylinder(20, 30)**. A cylinder needs two numbers: how wide, and how tall.',
      hint: 'Replace everything from cad.box to its closing bracket with cad.cylinder(20, 30). Keep the word return in front.',
      check: (v) => v.built && codeHas(v, /cad\.cylinder\(/) && near(widthOf(v), 20) && near(heightOf(v), 30) },
  ],
}

export const variables: CodeLesson = {
  id: 'code-variables', title: 'Names for numbers', icon: '🏷️',
  intro: 'Give a number a name, then use the name.',
  starter: `export default {
  name: 'Names practice',
  icon: '🏷️',
  build(settings, cad) {
    const width = 30
    return cad.box(width, 10, 5)
  },
}
`,
  steps: [
    { id: 'add-height', target: 'code-input', text: 'Under the width line, add **const height = 25**. Then change the **5** in cad.box to **height**.',
      hint: 'Click at the end of the line const width = 30 and press Enter. Type const height = 25. Then swap the last number in cad.box for the word height.',
      check: (v) => v.built && codeHas(v, /const\s+height\s*=/) && near(heightOf(v), 25) },
    { id: 'change-it', target: 'code-input', text: 'Now change **25** to **40** on the height line. The box grows, because cad.box uses the name.',
      hint: 'Only change the number after const height =. Leave cad.box(width, 10, height) as it is.',
      check: (v) => v.built && codeHas(v, /const\s+height\s*=\s*40\b/) && near(heightOf(v), 40) },
    { id: 'why', text: 'A name keeps a number in one place. Change it once, and everything that uses the name changes too.',
      hint: "Names can use letters and numbers, like height or wall2. They can't have spaces." },
  ],
}

export const functionsLesson: CodeLesson = {
  id: 'code-functions', title: 'Doing it again', icon: '🔁',
  intro: 'Write a function once and use it again and again.',
  starter: `export default {
  name: 'Fence',
  icon: '🔁',
  build(settings, cad) {
    function post(x) {
      return cad.box(4, 4, 20).move(x, 0, 0)
    }
    return post(0)
  },
}
`,
  steps: [
    { id: 'second-post', target: 'code-input', text: 'A function is a recipe you can use again. Change the last line to **return post(0).add(post(20))**.',
      hint: 'post(20) makes a post 20 mm along. .add joins it to the first one.',
      check: (v) => v.built && near(widthOf(v), 24) },
    { id: 'third-post', target: 'code-input', text: 'Add a third post at **40**: put **.add(post(40))** on the end of that line.',
      hint: 'The line becomes return post(0).add(post(20)).add(post(40)).',
      check: (v) => v.built && near(widthOf(v), 44) },
    { id: 'taller', target: 'code-input', text: 'Inside the function, change the **20** in **cad.box(4, 4, 20)** to **35**. Every post grows at once.',
      hint: 'Only the recipe changes, and every post uses the recipe.',
      check: (v) => v.built && near(widthOf(v), 44) && near(heightOf(v), 35) },
  ],
}

export const errorsLesson: CodeLesson = {
  id: 'code-errors', title: 'Reading error messages', icon: '🔧',
  intro: 'Every coder makes mistakes. Error messages help you fix them.',
  starter: `export default {
  name: 'Fix me',
  icon: '🔧',
  build(settings, cad) {
    const width = 30
    const box = cad.box(widht, 10, 5
    box
  },
}
`,
  steps: [
    { id: 'bracket', target: 'code-problems', text: 'This code is broken. Read the message under the code box, then add the missing **)** at the end of the cad.box line.',
      hint: 'Click the message to jump to the line. The line should end with 5) and a closing bracket.',
      check: (v) => v.syntaxOk },
    { id: 'spelling', target: 'code-problems', text: "A new message! **widht** is a spelling mistake. Change it to **width**.",
      hint: 'Look on the cad.box line. Swap the h and the t.',
      check: (v) => v.syntaxOk && codeHas(v, /cad\.box\(\s*width\s*,/) },
    { id: 'return', target: 'code-problems', text: 'Last one. build has to **return** the part. Change the line **box** to **return box**.',
      hint: 'Type return and a space in front of box.',
      check: (v) => v.built },
  ],
}

export const firstShape: CodeLesson = {
  id: 'code-first-shape', title: 'Your first shape', icon: '🧩',
  intro: 'Make a shape of your own and put it in your design.',
  starter: `export default {
  name: 'My first shape',
  icon: '🧩',
  build(settings, cad) {
    return cad.box(20, 20, 20)
  },
}
`,
  steps: [
    { id: 'name', target: 'code-input', text: 'Give your shape its own name. Change **My first shape** to a name you like, such as **Robot head**.',
      hint: 'Keep the quote marks around the name.',
      check: (v) => v.built && v.meta !== null && isNewName(v.meta.name) },
    { id: 'icon', target: 'code-input', text: 'Now pick an icon. Change **🧩** to another emoji, like **🤖**.',
      hint: 'On a Mac, press Ctrl+Cmd+Space for emoji. On Windows, press the Windows key and the full stop together.',
      check: (v) => v.built && v.meta !== null && v.meta.icon !== '🧩' },
    { id: 'add', target: 'add-to-design', text: 'Click **➕ Add to my design**. Your shape joins your design. Find it again under **🧩 My shapes** on the left.',
      hint: 'The button is under the preview, on the right.' },
  ],
}
