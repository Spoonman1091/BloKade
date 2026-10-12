// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createEditorStore } from '../kade/editor-store'
import { createMemoryShapeLibrary, type LibraryShape } from '../kade/library'
import { CODE_TOO_BIG } from '../kade/messages'
import { downloadBytes } from '../app/download'
import { LibraryList } from './LibraryList'

vi.mock('../app/download', () => ({ downloadBytes: vi.fn() }))

const shape = (id: string, name: string): LibraryShape => ({ id, name, code: `export default { name: '${name}' }`, updatedAt: 1 })

async function setup(shapes: LibraryShape[] = [shape('my-a', 'Gear'), shape('my-b', 'Robot')]) {
  const editor = createEditorStore(createMemoryShapeLibrary(shapes))
  await editor.getState().load()
  render(<LibraryList editor={editor} />)
  return editor
}

describe('LibraryList', () => {
  it('lists the shapes and selects one', async () => {
    const editor = await setup()
    expect(screen.getByTestId('shape-item-my-a')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByTestId('shape-item-my-b'))
    expect(editor.getState().selectedId).toBe('my-b')
  })
  it('makes and duplicates shapes', async () => {
    const editor = await setup()
    await userEvent.click(screen.getByTestId('new-shape'))
    expect(screen.getByRole('button', { name: 'My shape' })).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('duplicate-shape'))
    expect(editor.getState().shapes.map((s) => s.name)).toContain('My shape copy')
  })
  it('asks before deleting', async () => {
    const editor = await setup()
    await userEvent.click(screen.getByTestId('delete-shape'))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Delete Gear?')
    await userEvent.click(screen.getByTestId('delete-shape-no'))
    expect(editor.getState().shapes).toHaveLength(2)
    await userEvent.click(screen.getByTestId('delete-shape'))
    await userEvent.click(screen.getByTestId('delete-shape-yes'))
    expect(editor.getState().shapes.map((s) => s.id)).toEqual(['my-b'])
  })
  it('saves the code Kade is typing to a .js file', async () => {
    const editor = await setup()
    act(() => editor.getState().setCode('my-a', 'typed just now'))
    await userEvent.click(screen.getByTestId('save-shape-file'))
    expect(downloadBytes).toHaveBeenCalledWith('typed just now', 'gear.js', 'text/javascript')
  })
  it('loads a shape from a file', async () => {
    const editor = await setup([])
    const file = new File(["export default { name: 'Rocket' }"], 'rocket.js', { type: 'text/javascript' })
    await userEvent.upload(screen.getByTestId('load-shape-file'), file)
    await vi.waitFor(() => expect(editor.getState().shapes.map((s) => s.name)).toEqual(['Rocket']))
  })
  it('refuses a file that is too long', async () => {
    const editor = await setup([])
    const file = new File(['x'.repeat(50_001)], 'big.js', { type: 'text/javascript' })
    await userEvent.upload(screen.getByTestId('load-shape-file'), file)
    await vi.waitFor(() => expect(editor.getState().notice).toBe(CODE_TOO_BIG))
    expect(editor.getState().shapes).toEqual([])
  })
  it('says how to start when the library is empty', async () => {
    await setup([])
    expect(screen.getByText(/No shapes yet/)).toBeInTheDocument()
    expect(screen.getByTestId('delete-shape')).toBeDisabled()
  })
})
