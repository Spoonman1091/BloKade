import type { ChangeEvent } from 'react'
import { downloadBytes } from '../app/download'
import { MAX_SHAPE_CODE_LENGTH } from '../document/types'
import { currentCode, type EditorStore } from '../kade/editor-store'
import { shapeFileName } from '../kade/library'
import { CODE_TOO_BIG } from '../kade/messages'

const FILE_READ_FAILED = "That file couldn't be read. Try another one."

/** Save the selected shape to a .js file, and load a shape from one. */
export function useShapeFiles(editor: EditorStore) {
  const saveFile = (): void => {
    const state = editor.getState()
    const selected = state.shapes.find((s) => s.id === state.selectedId)
    if (!selected) return
    downloadBytes(currentCode(state, selected.id) ?? selected.code, shapeFileName(selected.name), 'text/javascript')
  }
  const loadFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input = event.target
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    const { create, notify } = editor.getState()
    try {
      const text = await file.text()
      if (text.length > MAX_SHAPE_CODE_LENGTH) notify(CODE_TOO_BIG)
      else create(text)
    } catch (error) {
      console.error('Could not read a shape file', error)
      notify(FILE_READ_FAILED)
    }
  }
  return { saveFile, loadFile }
}
