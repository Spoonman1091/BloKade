// @vitest-environment jsdom
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithStore } from '../app/testing/render'
import { createEmptyDocument } from '../document/factory'
import { createBloKadeStore } from '../store/store'
import { OverlapCheck } from './OverlapCheck'

describe('OverlapCheck', () => {
  it('runs the check and shows the result while it is current', async () => {
    const store = createBloKadeStore({ designId: 'd', doc: createEmptyDocument() })
    const onCheck = vi.fn()
    renderWithStore(<OverlapCheck onCheck={onCheck} />, store)
    await userEvent.click(screen.getByTestId('check-overlap'))
    expect(onCheck).toHaveBeenCalled()
    expect(screen.queryByTestId('overlap-result')).toBeNull()
    act(() => {
      const s = store.getState()
      s.setOverlap({ doc: s.history.present, selection: s.selection, result: { status: 'overlap', volume: 12.34, mesh: {} as never } })
    })
    expect(screen.getByTestId('overlap-result')).toHaveTextContent('These overlap by 12.3 mm³ (shown in red).')
    act(() => {
      const s = store.getState()
      s.setOverlap({ doc: s.history.present, selection: s.selection, result: { status: 'none' } })
    })
    expect(screen.getByTestId('overlap-result')).toHaveTextContent("No overlap — they don't run into each other.")
  })
})
