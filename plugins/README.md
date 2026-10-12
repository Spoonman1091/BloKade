# Shape files

The easiest way to make a shape is **🧩 My shapes** in BloKade itself. Files in this folder are for shapes that should
be built into the app for everyone who uses it.

Every `.js` or `.ts` file here that `export default`s a shape shows up in BloKade's palette. A file looks exactly
like a shape in My shapes:

```js
export default {
  name: 'Robot head',
  icon: '🤖',
  settings: {
    size: { type: 'mm', default: 20, label: 'Size' },
  },
  size: { x: 'size', y: 'size', z: 'size' },
  build({ size }, cad) {
    return cad.box(size, size, size).cut(cad.cylinder(6, size + 2).move(0, 0, -1))
  },
}
```

- The shape's id comes from the file name (`robot-head.js` is `robot-head`). Add `id: 'robot'` to choose one, and
  `version: 2` when a change should rebuild designs that use it. Built-in ids like `box` or `peg` are taken.
- `settings` (or `params`) can be `mm`, `whole`, `number`, `angle`, `text` (one line, up to 40 letters),
  `choice` (`options: ['round', 'square']`) or `yesno` (a tick box: `build` gets `true` or `false`).
  `label` is optional. `min` and `max` work on number settings, and `formula: 'fit'` starts a number as the
  design's fit gap.
- `size` says which number settings the x, y and z size handles change.
- `mode: 'hole'` makes new parts start as holes. `palette: 'fit'` lists the shape under Fit tools.
- `build` gets the settings and the friendly `cad` toolkit. Every command makes a new part and never changes the
  old one. Open **❓ Commands** in My shapes for the full list with examples:
  - parts: `box`, `cylinder`, `sphere`, `cone`, `ring`, `wedge`, `text`
  - outlines: `rect`, `circle`, `polygon`, then `.extrude(height)` or `.spin()`
  - steps: `.move`, `.rotate`, `.add`, `.cut`, `.overlap`, `.mirror`, `.copy`
  - helpers: `cad.repeat`, `cad.angle`, `cad.sin`, `cad.cos`

If a file has a problem, BloKade shows a message when it starts and leaves that shape out.
