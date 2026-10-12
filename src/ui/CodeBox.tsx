import { javascript } from '@codemirror/lang-javascript'
import { bracketMatching, foldGutter, indentOnInput } from '@codemirror/language'
import { highlightActiveLine, highlightActiveLineGutter, lineNumbers } from '@codemirror/view'
import { EditorView, minimalSetup } from 'codemirror'
import { useEffect, useRef } from 'react'

export interface CodeJump {
  readonly line: number
  /** Changes on every click, so clicking the same problem twice still jumps. */
  readonly nonce: number
}

interface CodeBoxProps {
  /** A new key makes a fresh editor: another shape. While the key stays, the editor owns the text. */
  docKey: string
  code: string
  onChange(code: string): void
  jump: CodeJump | null
}

/**
 * Kade's code box (CodeMirror): line numbers, colours, bracket matching and
 * history. It uses `minimalSetup`, not `basicSetup`, so there is no autocomplete.
 */
export function CodeBox({ docKey, code, onChange, jump }: CodeBoxProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const changed = useRef(onChange)
  const startCode = useRef(code)
  startCode.current = code

  useEffect(() => {
    changed.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!host.current) return undefined
    const editor = new EditorView({
      doc: startCode.current,
      parent: host.current,
      extensions: [
        minimalSetup,
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        bracketMatching(),
        indentOnInput(),
        foldGutter(),
        javascript(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) changed.current(update.state.doc.toString())
        }),
        EditorView.contentAttributes.of({ 'data-testid': 'code-input', 'aria-label': 'Shape code' }),
      ],
    })
    view.current = editor
    return () => {
      editor.destroy()
      view.current = null
    }
  }, [docKey])

  useEffect(() => {
    const editor = view.current
    if (!editor || !jump) return
    const doc = editor.state.doc
    const line = doc.line(Math.min(Math.max(jump.line, 1), doc.lines))
    editor.dispatch({ selection: { anchor: line.from }, scrollIntoView: true })
    editor.focus()
  }, [jump])

  return <div className="code-box" ref={host} data-testid="code-box" />
}
