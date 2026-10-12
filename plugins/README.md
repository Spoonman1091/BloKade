# Kade's Plugins

This folder is for shapes Kade writes himself. Every `.js` or `.ts` file here that
`export default`s a plugin shows up in BloKade's shape palette.

The plugin guide arrives in Milestone 5. Until then, look at `src/plugins/builtin/`,
because every built-in shape is a plugin written the same way.

Parameters can be numbers (`mm`, `whole`, `number`, `angle`) or one line of text (`type: 'text'`,
up to 40 characters). `src/plugins/builtin/text.ts` shows a text parameter in use.
