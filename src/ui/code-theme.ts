import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags, type Tag } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'

/** Code colours, each a CSS variable from App.css, so switching dark or light mode recolours the editor live. */
export const CODE_COLORS: readonly { readonly tag: Tag | readonly Tag[]; readonly color: string }[] = [
  { tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword], color: 'var(--code-keyword)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--code-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--code-number)' },
  { tag: [tags.lineComment, tags.blockComment], color: 'var(--code-comment)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--code-function)' },
  { tag: [tags.propertyName], color: 'var(--code-property)' },
  { tag: [tags.definition(tags.variableName)], color: 'var(--code-variable)' },
]

const highlight = HighlightStyle.define(CODE_COLORS.map(({ tag, color }) => ({ tag, color })))

/** Editor background, text, gutter and cursor follow the page's theme colours. */
const look = EditorView.theme({
  '&': { color: 'var(--ink)', backgroundColor: 'var(--panel)' },
  '.cm-content': { caretColor: 'var(--ink)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ink)' },
  '.cm-gutters': { color: 'var(--muted)', backgroundColor: 'var(--bg)', borderRight: '1px solid var(--border)' },
  '.cm-activeLine': { backgroundColor: 'var(--code-active-line)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--code-active-line)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--code-selection)' },
  '&.cm-focused .cm-matchingBracket': { backgroundColor: 'var(--code-selection)', outline: '1px solid var(--accent)' },
})

export const codeTheme: Extension = [look, syntaxHighlighting(highlight)]
