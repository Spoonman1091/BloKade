# Kade's Plugins

This folder is for shapes Kade writes himself. Every `.js` or `.ts` file here that
`export default`s a plugin shows up in BloKade's shape palette.

The plugin guide arrives in Milestone 5. Until then, look at `src/plugins/builtin/`,
because every built-in shape is a plugin written the same way.

Parameters can be numbers (`mm`, `whole`, `number`, `angle`) or one line of text (`type: 'text'`,
up to 40 characters). `src/plugins/builtin/text.ts` shows a text parameter in use.

### Pick-from-a-list and fit-aware parameters

- `{ type: 'choice', default: 'round', label: 'Shape', options: [{ value: 'round', label: 'Round' }, { value: 'square', label: 'Square' }] }`
  shows a drop-down. `build()` gets the picked `value`.
- Add `formula: 'fit'` to a number parameter to start it as the design's fit gap (only `fit` is allowed there).
- Built-in ids like `peg`, `socket`, `screw-hole`, `threaded-rod`, `threaded-hole`, `snap-clip`, `snap-catch` (and the basic shapes) are taken, so your own plugin needs a different id.
- `mode: 'hole'` makes new parts of your shape start as holes.
- `palette: 'fit'` lists your shape under Fit tools instead of Shapes.
