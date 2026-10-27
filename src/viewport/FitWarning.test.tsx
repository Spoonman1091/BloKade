// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FitWarning } from './FitWarning'

afterEach(cleanup)

describe('FitWarning', () => {
  it('shows nothing when everything fits', () => {
    render(<FitWarning warning={null} offPlateIds={new Set()} onPutOnPlate={() => undefined} />)
    expect(screen.queryByTestId('fit-warning')).toBeNull()
  })

  it('offers Put on plate for parts hanging off the plate', async () => {
    const onPutOnPlate = vi.fn()
    render(<FitWarning warning="**Box** doesn't fit." offPlateIds={new Set(['a', 'b'])} onPutOnPlate={onPutOnPlate} />)
    await userEvent.click(screen.getByTestId('fit-put-on-plate'))
    expect(onPutOnPlate).toHaveBeenCalledWith(['a', 'b'])
  })

  it('has no button when a part is only too tall', () => {
    render(<FitWarning warning="**Box** is too tall." offPlateIds={new Set()} onPutOnPlate={() => undefined} />)
    expect(screen.getByTestId('fit-warning')).toBeInTheDocument()
    expect(screen.queryByTestId('fit-put-on-plate')).toBeNull()
  })
})
