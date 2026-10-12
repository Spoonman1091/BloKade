// @vitest-environment jsdom
import { EditorView } from 'codemirror'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CodeBox } from './CodeBox'

const viewOf = (): EditorView => {
  const view = EditorView.findFromDOM(screen.getByTestId('code-box'))
  if (!view) throw new Error('no editor')
  return view
}

describe('CodeBox', () => {
  it('shows the code and reports what Kade types', () => {
    const onChange = vi.fn()
    render(<CodeBox docKey="a" code="return 1" onChange={onChange} jump={null} />)
    expect(screen.getByTestId('code-input')).toHaveTextContent('return 1')
    expect(screen.getByLabelText('Shape code')).toBe(screen.getByTestId('code-input'))
    viewOf().dispatch({ changes: { from: 0, insert: '// hi\n' } })
    expect(onChange).toHaveBeenLastCalledWith('// hi\nreturn 1')
  })
  it('keeps its own text while the same shape is open, and starts fresh for another shape', () => {
    const { rerender } = render(<CodeBox docKey="a" code="one" onChange={vi.fn()} jump={null} />)
    rerender(<CodeBox docKey="a" code="changed outside" onChange={vi.fn()} jump={null} />)
    expect(viewOf().state.doc.toString()).toBe('one')
    rerender(<CodeBox docKey="b" code="two" onChange={vi.fn()} jump={null} />)
    expect(viewOf().state.doc.toString()).toBe('two')
  })
  it('jumps to a line', () => {
    const { rerender } = render(<CodeBox docKey="a" code={'one\ntwo\nthree'} onChange={vi.fn()} jump={null} />)
    rerender(<CodeBox docKey="a" code={'one\ntwo\nthree'} onChange={vi.fn()} jump={{ line: 3, nonce: 1 }} />)
    expect(viewOf().state.selection.main.head).toBe(8)
    rerender(<CodeBox docKey="a" code={'one\ntwo\nthree'} onChange={vi.fn()} jump={{ line: 99, nonce: 2 }} />)
    expect(viewOf().state.selection.main.head).toBe(8)
  })
  it('does not offer autocomplete', () => {
    render(<CodeBox docKey="a" code="" onChange={vi.fn()} jump={null} />)
    viewOf().dispatch({ changes: { from: 0, insert: 'cad.re' }, userEvent: 'input.type' })
    expect(document.querySelector('.cm-tooltip-autocomplete')).toBeNull()
    expect(document.querySelector('.cm-tooltip')).toBeNull()
  })
})
