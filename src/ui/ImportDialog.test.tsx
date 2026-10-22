// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { preparedModel } from '../app/testing/prepared'
import { cubeMesh } from '../geometry/testing/meshes'
import { HAS_GAPS_NOTE, TOO_LARGE_SIZE, simplifiedNote } from '../import/limits'
import type { PreparedModel } from '../import/prepare'
import { ImportDialog } from './ImportDialog'

const model = (extra: Partial<PreparedModel> = {}): PreparedModel =>
  ({ ...preparedModel(cubeMesh(1)), size: [20, 20, 10], ...extra })

function show(m: PreparedModel) {
  const onImport = vi.fn()
  const onCancel = vi.fn()
  render(<ImportDialog fileName="a.stl" model={m} onImport={onImport} onCancel={onCancel} />)
  return { onImport, onCancel }
}

describe('ImportDialog', () => {
  it('shows the size in mm and follows the unit choice', async () => {
    show(model())
    expect(screen.getByTestId('import-size')).toHaveTextContent('20 × 20 × 10 mm')
    await userEvent.selectOptions(screen.getByTestId('import-units'), 'inches')
    expect(screen.getByTestId('import-size')).toHaveTextContent('508 × 508 × 254 mm')
  })

  it('shows the notes only when they apply', () => {
    const { unmount } = render(<ImportDialog fileName="a.stl" model={model()} onImport={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByTestId('import-note-simplified')).toBeNull()
    expect(screen.queryByTestId('import-note-gaps')).toBeNull()
    unmount()
    show(model({ simplified: true, triangleCount: 20000, hasGaps: true }))
    expect(screen.getByTestId('import-note-simplified')).toHaveTextContent(simplifiedNote(20000))
    expect(screen.getByTestId('import-note-simplified')).toHaveTextContent('20,000')
    expect(screen.getByTestId('import-note-gaps')).toHaveTextContent(HAS_GAPS_NOTE)
  })

  it('refuses a model that is too large in the chosen unit', async () => {
    show(model({ size: [100, 1, 1] }))
    expect(screen.queryByTestId('import-too-large')).toBeNull()
    await userEvent.selectOptions(screen.getByTestId('import-units'), 'inches')
    expect(screen.getByTestId('import-too-large')).toHaveTextContent(TOO_LARGE_SIZE)
    expect(screen.getByTestId('import-confirm')).toBeDisabled()
  })

  it('imports with the chosen unit and cancels on Esc, Cancel and the backdrop', async () => {
    const { onImport, onCancel } = show(model())
    await userEvent.selectOptions(screen.getByTestId('import-units'), 'cm')
    await userEvent.click(screen.getByTestId('import-confirm'))
    expect(onImport).toHaveBeenCalledWith('cm')
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByTestId('import-cancel'))
    await userEvent.click(screen.getByTestId('import-dialog'))
    expect(onCancel).toHaveBeenCalledTimes(3)
  })
})
